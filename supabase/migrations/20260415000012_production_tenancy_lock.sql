-- 1. PRODUCTION LOCKDOWN: DELETE ALL DEBUG AND PERMISSIVE POLICIES
DROP POLICY IF EXISTS "debug_full_access_patients" ON public.patients;
DROP POLICY IF EXISTS "debug_full_access_visits" ON public.visits;
DROP POLICY IF EXISTS "debug_full_access_prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "clinics_permissive_select" ON public.clinics;
DROP POLICY IF EXISTS "profiles_permissive_select" ON public.profiles;
DROP POLICY IF EXISTS "Allow all authenticated to view clinics" ON public.clinics;
DROP POLICY IF EXISTS "Allow read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_service" ON public.profiles;

-- 2. ENSURE ROLES ARE CORRECT IN DATABASE
-- Remove superadmin from Aravind
UPDATE public.profiles SET is_superadmin = false WHERE email = 'arvnd14@gmail.com';
-- Ensure your account is the only superadmin
UPDATE public.profiles SET is_superadmin = true WHERE email = 'gokie.v21@gmail.com';

-- 3. CREATE SECURE, NON-RECURSIVE LOOKUP FUNCTION
-- This avoid infinite loops in RLS
CREATE OR REPLACE FUNCTION public.get_auth_clinic_id()
RETURNS UUID AS $$
  SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_auth_superadmin()
RETURNS BOOLEAN AS $$
  SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 4. APPLY PRODUCTION RLS POLICIES

-- CLINICS: Users only see their assigned clinic or owned clinics
CREATE POLICY "production_clinics_select" ON public.clinics
  FOR SELECT TO authenticated
  USING (
    id = public.get_auth_clinic_id() 
    OR owner_id = auth.uid()
    OR public.is_auth_superadmin()
  );

-- PROFILES: Users see their own profile or colleagues in the same clinic
CREATE POLICY "production_profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR clinic_id = public.get_auth_clinic_id()
    OR public.is_auth_superadmin()
  );

-- PATIENTS: Strictly isolated by clinic_id
CREATE POLICY "production_patients_all" ON public.patients
  FOR ALL TO authenticated
  USING (
    clinic_id = public.get_auth_clinic_id()
    OR public.is_auth_superadmin()
  )
  WITH CHECK (
    clinic_id = public.get_auth_clinic_id()
    OR public.is_auth_superadmin()
  );

-- VISITS: Strictly isolated by clinic_id
CREATE POLICY "production_visits_all" ON public.visits
  FOR ALL TO authenticated
  USING (
    clinic_id = public.get_auth_clinic_id()
    OR public.is_auth_superadmin()
  )
  WITH CHECK (
    clinic_id = public.get_auth_clinic_id()
    OR public.is_auth_superadmin()
  );

-- PRESCRIPTIONS: Strictly isolated by clinic_id
CREATE POLICY "production_prescriptions_all" ON public.prescriptions
  FOR ALL TO authenticated
  USING (
    clinic_id = public.get_auth_clinic_id()
    OR public.is_auth_superadmin()
  )
  WITH CHECK (
    clinic_id = public.get_auth_clinic_id()
    OR public.is_auth_superadmin()
  );

-- 5. FINAL DATA RECOVERY (Hammer)
-- Force everything to GV Clinic just to make sure the data appears
UPDATE public.patients SET clinic_id = '00000000-0000-0000-0000-000000000001' WHERE clinic_id IS NULL;
UPDATE public.visits SET clinic_id = '00000000-0000-0000-0000-000000000001' WHERE clinic_id IS NULL;
UPDATE public.prescriptions SET clinic_id = '00000000-0000-0000-0000-000000000001' WHERE clinic_id IS NULL;
