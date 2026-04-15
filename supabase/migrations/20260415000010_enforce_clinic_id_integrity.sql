-- 1. PRE-CHECK: Ensure no NULL clinic IDs exist before applying NOT NULL constraint
DO $$
DECLARE
  default_clinic_id UUID := (SELECT id FROM public.clinics LIMIT 1);
BEGIN
  UPDATE public.patients SET clinic_id = default_clinic_id WHERE clinic_id IS NULL;
  UPDATE public.visits SET clinic_id = default_clinic_id WHERE clinic_id IS NULL;
  UPDATE public.prescriptions SET clinic_id = default_clinic_id WHERE clinic_id IS NULL;
END $$;

-- 2. APPLY NOT NULL CONSTRAINTS
ALTER TABLE public.patients ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.visits ALTER COLUMN clinic_id SET NOT NULL;
ALTER TABLE public.prescriptions ALTER COLUMN clinic_id SET NOT NULL;

-- 3. CREATE INTELLIGENT AUTO-ASSIGN FUNCTION
-- This function ensures the clinic_id is always set based on the user's profile
CREATE OR REPLACE FUNCTION public.set_clinic_id_from_author_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. If clinic_id is missing, try to get it from the creator's profile
  IF NEW.clinic_id IS NULL THEN
    NEW.clinic_id := (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid());
  END IF;

  -- 2. If it's still missing (e.g. user is a superadmin with no home clinic), and this is an insert, 
  -- we should allow it if they provided it, otherwise fail.
  IF NEW.clinic_id IS NULL THEN
    RAISE EXCEPTION 'A clinic_id is required. Your account is either not assigned to a clinic or no ID was provided.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ATTACH TRIGGERS TO ALL MULTI-TENANT TABLES
-- Patients Trigger
DROP TRIGGER IF EXISTS ensure_patient_clinic_id ON public.patients;
CREATE TRIGGER ensure_patient_clinic_id
  BEFORE INSERT ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.set_clinic_id_from_author_profile();

-- Visits Trigger
DROP TRIGGER IF EXISTS ensure_visit_clinic_id ON public.visits;
CREATE TRIGGER ensure_visit_clinic_id
  BEFORE INSERT ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_clinic_id_from_author_profile();

-- Prescriptions Trigger
DROP TRIGGER IF EXISTS ensure_prescription_clinic_id ON public.prescriptions;
CREATE TRIGGER ensure_prescription_clinic_id
  BEFORE INSERT ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_clinic_id_from_author_profile();

-- 5. RELAX RLS ON CLINICS FOR NEW TENANT ONBOARDING
-- Users need to be able to see the clinic they were just added to
DROP POLICY IF EXISTS "clinics_permissive_select" ON public.clinics;
CREATE POLICY "clinics_permissive_select" ON public.clinics
  FOR SELECT TO authenticated
  USING (true);
