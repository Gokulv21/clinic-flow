-- Fix RLS Infinite Recursion & Extreme Performance Bottlenecks

-- 1. Create a STABLE, SQL-based SECURITY DEFINER function to securely check roles.
-- It is CRITICAL that this is STABLE and LANGUAGE sql, otherwise Postgres runs it per row (killing performance)
CREATE OR REPLACE FUNCTION public.is_clinic_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND (role IN ('doctor', 'owner') OR is_superadmin = true)
  );
$$;

-- 2. Restore STABLE flag to get_auth_clinic_id to ensure blazing fast queries on Patients/Visits
CREATE OR REPLACE FUNCTION public.get_auth_clinic_id()
RETURNS UUID 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 3. Restore STABLE flag to is_auth_superadmin
CREATE OR REPLACE FUNCTION public.is_auth_superadmin()
RETURNS boolean 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 4. Fix User Roles policy
DROP POLICY IF EXISTS "production_user_roles_security" ON public.user_roles;

CREATE POLICY "production_user_roles_security" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    public.is_clinic_manager()
    OR user_id = auth.uid()
  )
  WITH CHECK (
    public.is_clinic_manager()
  );

-- 5. Fix Profiles policy
DROP POLICY IF EXISTS "production_profiles_all_v3" ON public.profiles;
DROP POLICY IF EXISTS "production_profiles_all_v2" ON public.profiles;

CREATE POLICY "production_profiles_all_v3" ON public.profiles
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() 
    OR (clinic_id = public.get_auth_clinic_id() AND is_superadmin = false)
    OR public.is_auth_superadmin()
  )
  WITH CHECK (
    user_id = auth.uid() 
    OR public.is_auth_superadmin()
    OR (
      clinic_id = public.get_auth_clinic_id()
      AND public.is_clinic_manager()
    )
  );
