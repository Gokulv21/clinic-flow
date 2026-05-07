-- Fix RLS for SuperAdmins and enforce Doctor-Patient Isolation
-- 1. Robust SuperAdmin Check
CREATE OR REPLACE FUNCTION public.is_auth_superadmin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid() LIMIT 1),
    false
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 2. Helper to get authenticated user's role
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role::text FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 3. Update Clinics Policy
DROP POLICY IF EXISTS "production_clinics_select" ON public.clinics;
CREATE POLICY "production_clinics_select" ON public.clinics
  FOR SELECT TO authenticated
  USING (
    id = public.get_auth_clinic_id() 
    OR owner_id = auth.uid()
    OR public.is_auth_superadmin()
  );

-- 4. Update Visits Policy for Doctor Isolation
-- Doctors only see their assigned patients or general queue.
-- Staff/Nurses/Owners see everything in the clinic.
DROP POLICY IF EXISTS "Clinic Scoped View Visits" ON public.visits;
DROP POLICY IF EXISTS "production_visits_lockdown" ON public.visits;
DROP POLICY IF EXISTS "production_visits_isolation_v2" ON public.visits;

CREATE POLICY "production_visits_isolation_v3" ON public.visits
  FOR SELECT TO authenticated
  USING (
    public.is_auth_superadmin()
    OR (
      clinic_id = public.get_auth_clinic_id()
      AND (
        public.get_auth_role() IN ('nurse', 'staff', 'owner')
        OR (public.get_auth_role() = 'doctor' AND (assigned_doctor_id IS NULL OR assigned_doctor_id = auth.uid()))
      )
    )
  );

-- 5. Update Prescriptions Policy for Doctor Isolation
-- Doctors only see their own prescriptions.
DROP POLICY IF EXISTS "Clinic Scoped View Prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "production_prescriptions_lockdown" ON public.prescriptions;
DROP POLICY IF EXISTS "production_prescriptions_isolation_v2" ON public.prescriptions;

CREATE POLICY "production_prescriptions_isolation_v3" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (
    public.is_auth_superadmin()
    OR (
      clinic_id = public.get_auth_clinic_id()
      AND (
        public.get_auth_role() IN ('nurse', 'staff', 'owner')
        OR (public.get_auth_role() = 'doctor' AND (doctor_id = auth.uid()))
      )
    )
  );
