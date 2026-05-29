-- Optimize RLS Helper Functions with Session Caching to prevent database connection exhaustion and hangs.

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- 1. Try to get from session cache
  v_role := current_setting('my.auth_role', true);
  IF v_role IS NOT NULL AND v_role <> '' THEN
    RETURN v_role;
  END IF;

  -- 2. Fallback to database query (RLS bypassed via SECURITY DEFINER)
  SELECT role::text INTO v_role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  
  -- 3. Cache it in session config for subsequent calls in the same transaction/session
  IF v_role IS NOT NULL THEN
    PERFORM set_config('my.auth_role', v_role, true);
  END IF;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION public.get_auth_clinic_id()
RETURNS UUID AS $$
DECLARE
  v_clinic_id TEXT;
BEGIN
  -- 1. Try to get from session cache
  v_clinic_id := current_setting('my.auth_clinic_id', true);
  IF v_clinic_id IS NOT NULL AND v_clinic_id <> '' THEN
    RETURN v_clinic_id::UUID;
  END IF;

  -- 2. Fallback to database query (RLS bypassed via SECURITY DEFINER)
  SELECT clinic_id::text INTO v_clinic_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  
  -- 3. Cache it in session config for subsequent calls in the same transaction/session
  IF v_clinic_id IS NOT NULL THEN
    PERFORM set_config('my.auth_clinic_id', v_clinic_id, true);
  END IF;
  
  RETURN v_clinic_id::UUID;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
