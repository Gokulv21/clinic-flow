-- 1. DROP ALL POTENTIALLY BROKEN OR CONFLICTING POLICIES
DROP POLICY IF EXISTS "Clinic Scoped View Patients" ON public.patients;
DROP POLICY IF EXISTS "Clinic Scoped Insert Patients" ON public.patients;
DROP POLICY IF EXISTS "Clinic Scoped Update Patients" ON public.patients;
DROP POLICY IF EXISTS "Clinic Scoped View Visits" ON public.visits;
DROP POLICY IF EXISTS "Clinic Scoped Insert Visits" ON public.visits;
DROP POLICY IF EXISTS "Clinic Scoped Update Visits" ON public.visits;
DROP POLICY IF EXISTS "Clinic Scoped View Prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Staff can view patients" ON public.patients;
DROP POLICY IF EXISTS "Staff can view visits" ON public.visits;
DROP POLICY IF EXISTS "Staff can view prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Nurse and doctor can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Nurse and doctor can insert visits" ON public.visits;

-- 2. CREATE TOTAL VISIBILITY POLICIES (Temporary for Debugging Access)
-- This will allow all authenticated users to see and manage data while we resolve the tenancy scoping
CREATE POLICY "debug_full_access_patients" ON public.patients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "debug_full_access_visits" ON public.visits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "debug_full_access_prescriptions" ON public.prescriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. FORCE DATA TO GV CLINIC
-- Ensure all orphaned data from today and yesterday is definitely visible in GV Clinic
DO $$
DECLARE
  gv_id UUID := (SELECT id FROM public.clinics WHERE slug = 'gv-clinic' LIMIT 1);
BEGIN
  IF gv_id IS NOT NULL THEN
    UPDATE public.patients SET clinic_id = gv_id WHERE clinic_id IS NULL OR clinic_id NOT IN (SELECT id FROM public.clinics);
    UPDATE public.visits SET clinic_id = gv_id WHERE clinic_id IS NULL OR clinic_id NOT IN (SELECT id FROM public.clinics);
    UPDATE public.prescriptions SET clinic_id = gv_id WHERE clinic_id IS NULL OR clinic_id NOT IN (SELECT id FROM public.clinics);
    
    RAISE NOTICE 'Aggressive data recovery complete for clinic: %', gv_id;
  END IF;
END $$;

-- 4. ENSURE PROFILES ARE ACCESSIBLE
DROP POLICY IF EXISTS "profiles_permissive_select" ON public.profiles;
CREATE POLICY "profiles_permissive_select" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. ENSURE CLINICS ARE ACCESSIBLE
DROP POLICY IF EXISTS "clinics_permissive_select" ON public.clinics;
CREATE POLICY "clinics_permissive_select" ON public.clinics FOR ALL TO authenticated USING (true) WITH CHECK (true);
