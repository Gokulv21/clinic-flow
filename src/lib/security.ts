import { supabase } from "@/integrations/supabase/client";

export type SecurityEventType = 
  | 'LOGIN_SUCCESS' 
  | 'LOGIN_FAILURE' 
  | 'LOGOUT' 
  | 'AUTH_ERROR' 
  | 'SUSPICIOUS_TRAFFIC'
  | 'API_ERROR';

/**
 * Logs a security event to the central audit table.
 * This should be used for sensitive actions or error detection.
 */
export async function logSecurityEvent(
  eventType: SecurityEventType, 
  metadata: Record<string, any> = {},
  clinicId?: string
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // We attempt to get clinic id from profile if not provided
    let finalClinicId = clinicId;
    if (!finalClinicId && user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('clinic_id')
            .eq('user_id', user.id)
            .maybeSingle();
        finalClinicId = profile?.clinic_id;
    }

    const { error } = await supabase.from('security_audit_logs').insert({
      event_type: eventType,
      actor_id: user?.id,
      clinic_id: finalClinicId,
      metadata: {
        ...metadata,
        url: window.location.href,
        timestamp: new Date().toISOString()
      },
      user_agent: navigator.userAgent
    });

    if (error) console.error("Failed to log security event:", error);
  } catch (err) {
    // Silent fail to avoid disrupting user experience
    console.warn("Security logger failed:", err);
  }
}
