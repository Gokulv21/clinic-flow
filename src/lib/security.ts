import { supabase } from "@/integrations/supabase/client";

export type SecurityEventType = 
  | 'LOGIN_SUCCESS' 
  | 'LOGIN_FAILURE' 
  | 'LOGOUT' 
  | 'AUTH_ERROR' 
  | 'SUSPICIOUS_TRAFFIC'
  | 'API_ERROR';

let isLogging = false;
let lastLogTime = 0;

/**
 * Logs a security event to the central audit table.
 * Strictly non-blocking and safe from recursive error cascades.
 */
export async function logSecurityEvent(
  eventType: SecurityEventType, 
  metadata: Record<string, any> = {},
  clinicId?: string,
  userId?: string
) {
  // Prevent re-entrancy and throttle excessive error logging (max 1 log per second)
  const now = Date.now();
  if (isLogging || (now - lastLogTime < 1000 && eventType === 'API_ERROR')) {
    return;
  }

  isLogging = true;
  lastLogTime = now;

  try {
    // Read session from local cache to avoid blocking network roundtrips
    let actorId = userId;
    if (!actorId) {
      const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      actorId = data?.session?.user?.id;
    }
    
    let finalClinicId = clinicId;
    if (!finalClinicId && actorId) {
      try {
        const savedProfile = sessionStorage.getItem('user_profile');
        if (savedProfile) {
          const parsed = JSON.parse(savedProfile);
          finalClinicId = parsed?.clinic_id;
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    try {
      await supabase.from('security_audit_logs').insert({
        event_type: eventType,
        actor_id: actorId,
        clinic_id: finalClinicId,
        metadata: {
          ...metadata,
          url: typeof window !== 'undefined' ? window.location.href : '',
          timestamp: new Date().toISOString()
        },
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
      });
    } catch (insertErr: any) {
      console.warn("[Security Logger] Insert failed (safe bypass):", insertErr?.message);
    }

  } catch (err) {
    // Silent fail to guarantee zero disruption to user workflow
    console.warn("[Security Logger] Safe bypass on error:", err);
  } finally {
    isLogging = false;
  }
}

