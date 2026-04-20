-- 1. RATE LIMITING SYSTEM
-- Tracks request frequency to prevent abuse.

CREATE TABLE IF NOT EXISTS public.rate_limits (
    identifier TEXT NOT NULL, -- IP address or User ID
    bucket TEXT NOT NULL,     -- 'login', 'create-user', 'ai-gen'
    request_count INTEGER DEFAULT 1,
    last_request_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (identifier, bucket)
);

-- Function to check and update rate limits
-- Returns true if the request is allowed, false if rate limited.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_identifier TEXT,
    p_bucket TEXT,
    p_max_requests INTEGER,
    p_interval_seconds INTEGER
)
RETURNS BOOLEAN AS $$
    WITH updated AS (
        INSERT INTO public.rate_limits (identifier, bucket, request_count, last_request_at)
        VALUES (p_identifier, p_bucket, 1, now())
        ON CONFLICT (identifier, bucket) DO UPDATE
        SET 
            request_count = CASE 
                WHEN public.rate_limits.last_request_at < (now() - (p_interval_seconds || ' seconds')::interval) THEN 1
                ELSE public.rate_limits.request_count + 1
            END,
            last_request_at = CASE
                WHEN public.rate_limits.last_request_at < (now() - (p_interval_seconds || ' seconds')::interval) THEN now()
                ELSE public.rate_limits.last_request_at
            END
        RETURNING request_count, last_request_at
    )
    SELECT request_count <= p_max_requests FROM updated;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;


-- 2. BRUTE FORCE PROTECTION TRIGGER
-- Automatically increments login rate limit on failure.

CREATE OR REPLACE FUNCTION public.log_security_change_v2()
RETURNS TRIGGER AS $$
DECLARE
    _clinic_id UUID;
    _event_type TEXT;
    _metadata JSONB;
BEGIN
    -- Special handling for LOGIN events logged via security_audit_logs
    IF (TG_TABLE_NAME = 'security_audit_logs' AND NEW.event_type = 'LOGIN_FAILURE') THEN
        -- Check rate limit based on email (from metadata) or actor_id
        PERFORM public.check_rate_limit(COALESCE(NEW.metadata->>'email', NEW.actor_id::text), 'login', 5, 600);
        RETURN NEW;
    END IF;

    -- Existing logic for clinical data trackers (roles/patients)
    IF (TG_TABLE_NAME = 'user_roles') THEN
        _clinic_id := (SELECT p.clinic_id FROM public.profiles p WHERE p.user_id = COALESCE(NEW.user_id, OLD.user_id) LIMIT 1);
        _event_type := 'ROLE_CHANGE';
        _metadata := jsonb_build_object('target_user_id', COALESCE(NEW.user_id, OLD.user_id), 'old_role', OLD.role, 'new_role', NEW.role);
    ELSIF (TG_TABLE_NAME = 'patients') THEN
        _clinic_id := COALESCE(OLD.clinic_id, NEW.clinic_id);
        _event_type := 'DATA_DELETION';
        _metadata := jsonb_build_object('patient_name', OLD.name, 'target_id', OLD.id);
    END IF;

    -- Logging logic for foreign tables
    IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND _event_type = 'ROLE_CHANGE')) THEN
        INSERT INTO public.security_audit_logs (event_type, actor_id, clinic_id, metadata)
        VALUES (_event_type, auth.uid(), _clinic_id, _metadata);
    END IF;

    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to audit logs for brute-force detection
DROP TRIGGER IF EXISTS audit_log_abuse_monitor ON public.security_audit_logs;
CREATE TRIGGER audit_log_abuse_monitor
AFTER INSERT ON public.security_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.log_security_change_v2();


-- 3. INITIAL RATE LIMITS CONFIG
-- Cleanup old limits every 24 hours (can be done via vault or cron)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.rate_limits WHERE last_request_at < (now() - interval '24 hours');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
