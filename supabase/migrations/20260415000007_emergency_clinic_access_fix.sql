-- 1. FIX CLINICS TABLE OWNER AND RLS
-- Associate Aravind as the owner of GV Clinic if he isn't already
UPDATE public.clinics
SET owner_id = (SELECT id FROM auth.users WHERE email = 'arvnd14@gmail.com')
WHERE slug = 'gv-clinic' AND owner_id IS NULL;

-- Make clinics selection more permissive so users can at least see the list
-- This fixes the "No clinics found" issue
DROP POLICY IF EXISTS "Users can view clinics they belong to" ON public.clinics;
CREATE POLICY "Allow all authenticated to view clinics" ON public.clinics
  FOR SELECT TO authenticated
  USING (true);

-- 2. FIX PROFILES AND CLINIC ASSOCIATION
-- Ensure Aravind and Staff profiles are correctly set up with the clinic_id
DO $$
DECLARE
  aravind_uid UUID;
  staff_uid UUID;
  clinic_uid UUID := (SELECT id FROM public.clinics WHERE slug = 'gv-clinic' LIMIT 1);
BEGIN
  -- Fallback to hardcoded ID if slug lookup fails
  IF clinic_uid IS NULL THEN
    clinic_uid := '00000000-0000-0000-0000-000000000001';
  END IF;

  SELECT id INTO aravind_uid FROM auth.users WHERE LOWER(email) = 'arvnd14@gmail.com';
  SELECT id INTO staff_uid FROM auth.users WHERE LOWER(email) = 'staff@gvclinic.com';

  -- Fix Aravind
  IF aravind_uid IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, full_name, email, clinic_id, role, is_superadmin)
    VALUES (aravind_uid, 'Dr. Aravind', 'arvnd14@gmail.com', clinic_uid, 'doctor', true)
    ON CONFLICT (user_id) DO UPDATE
    SET clinic_id = EXCLUDED.clinic_id, 
        role = EXCLUDED.role, 
        is_superadmin = EXCLUDED.is_superadmin;
        
    INSERT INTO public.user_roles (user_id, role)
    VALUES (aravind_uid, 'doctor')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Fix Staff
  IF staff_uid IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, full_name, email, clinic_id, role)
    VALUES (staff_uid, 'GV Clinic Staff', 'staff@gvclinic.com', clinic_uid, 'staff')
    ON CONFLICT (user_id) DO UPDATE
    SET clinic_id = EXCLUDED.clinic_id, 
        role = EXCLUDED.role;
        
    INSERT INTO public.user_roles (user_id, role)
    VALUES (staff_uid, 'staff')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- 3. ENSURE ALL TABLES HAVE TRANSITIONED DATA
-- Assign everything to the first clinic if clinic_id is missing
UPDATE public.patients SET clinic_id = (SELECT id FROM public.clinics LIMIT 1) WHERE clinic_id IS NULL;
UPDATE public.visits SET clinic_id = (SELECT id FROM public.clinics LIMIT 1) WHERE clinic_id IS NULL;
UPDATE public.prescriptions SET clinic_id = (SELECT id FROM public.clinics LIMIT 1) WHERE clinic_id IS NULL;

-- 4. FIX RLS ON PATIENTS/VISITS TO BE MORE RELIABLE
-- Use a subquery that is guaranteed to return something if they are a superadmin
DROP POLICY IF EXISTS "Clinic Scoped View Patients" ON public.patients;
CREATE POLICY "Clinic Scoped View Patients" ON public.patients
  FOR SELECT TO authenticated
  USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
    OR (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
  );

DROP POLICY IF EXISTS "Clinic Scoped View Visits" ON public.visits;
CREATE POLICY "Clinic Scoped View Visits" ON public.visits
  FOR SELECT TO authenticated
  USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
    OR (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
  );
