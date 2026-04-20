-- 1. SECURITY AUDIT LOGGING SYSTEM
-- This system tracks sensitive operations and authentication events.

-- Create Audit Log Table
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL, -- LOGIN_SUCCESS, LOGIN_FAILURE, ROLE_CHANGE, DATA_DELETION, AUTH_ERROR
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only SuperAdmins can see all logs; Admins can see their own clinic logs.
CREATE POLICY "SuperAdmins can see all security logs" ON public.security_audit_logs
    FOR SELECT TO authenticated
    USING (public.is_auth_superadmin());

CREATE POLICY "Admins can see clinic security logs" ON public.security_audit_logs
    FOR SELECT TO authenticated
    USING (
        clinic_id = public.get_auth_clinic_id()
    );

-- Policy: Authenticated users can insert their own events (e.g., frontend error logging)
CREATE POLICY "Enable audit insertion for users" ON public.security_audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (actor_id = auth.uid());


-- 2. AUTOMATED DATA AUDIT TRIGGERS
-- Tracks changes to sensitive records without requiring app-level logic.

-- Function for logging changes
CREATE OR REPLACE FUNCTION public.log_security_change()
RETURNS TRIGGER AS $$
DECLARE
    _clinic_id UUID;
    _event_type TEXT;
    _metadata JSONB;
BEGIN
    -- Determine clinic_id context and event details
    IF (TG_TABLE_NAME = 'user_roles') THEN
        _clinic_id := (SELECT p.clinic_id FROM public.profiles p WHERE p.user_id = COALESCE(NEW.user_id, OLD.user_id) LIMIT 1);
        _event_type := 'ROLE_CHANGE';
        _metadata := jsonb_build_object(
            'target_user_id', COALESCE(NEW.user_id, OLD.user_id),
            'old_role', OLD.role,
            'new_role', NEW.role
        );
    ELSIF (TG_TABLE_NAME = 'patients') THEN
        _clinic_id := COALESCE(OLD.clinic_id, NEW.clinic_id);
        _event_type := 'DATA_DELETION';
        _metadata := jsonb_build_object('patient_name', OLD.name, 'target_id', OLD.id);
    END IF;

    -- Only log for relevant operations
    IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND _event_type = 'ROLE_CHANGE')) THEN
        INSERT INTO public.security_audit_logs (event_type, actor_id, clinic_id, metadata)
        VALUES (_event_type, auth.uid(), _clinic_id, _metadata);
    END IF;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply triggers
DROP TRIGGER IF EXISTS audit_role_changes ON public.user_roles;
CREATE TRIGGER audit_role_changes
AFTER UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_security_change();

DROP TRIGGER IF EXISTS audit_patient_deletion ON public.patients;
CREATE TRIGGER audit_patient_deletion
BEFORE DELETE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.log_security_change();


-- 3. ACTIVITY MONITORING
-- Track last activity date for users
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
