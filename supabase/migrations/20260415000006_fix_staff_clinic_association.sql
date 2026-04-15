-- 1. Ensure the staff user is correctly associated with GV Clinic
DO $$
DECLARE
  staff_uid UUID;
  clinic_uid UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Find the staff user by email (case-insensitive)
  SELECT id INTO staff_uid FROM auth.users WHERE LOWER(email) = 'staff@gvclinic.com';

  IF staff_uid IS NOT NULL THEN
    -- Update or insert the profile with the correct clinic_id
    INSERT INTO public.profiles (user_id, full_name, email, clinic_id, role)
    VALUES (staff_uid, 'GV Clinic Staff', 'staff@gvclinic.com', clinic_uid, 'staff')
    ON CONFLICT (user_id) DO UPDATE
    SET clinic_id = EXCLUDED.clinic_id, 
        role = EXCLUDED.role,
        email = EXCLUDED.email;

    -- Ensure the role is also in user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (staff_uid, 'staff')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- 2. Backfill any existing patients/visits/prescriptions that have NULL clinic_id
-- If they belong to a user who is associated with a clinic, update them.
UPDATE public.patients p
SET clinic_id = pr.clinic_id
FROM public.profiles pr
WHERE p.clinic_id IS NULL 
AND pr.clinic_id IS NOT NULL;

UPDATE public.visits v
SET clinic_id = pr.clinic_id
FROM public.profiles pr
JOIN public.patients p ON v.patient_id = p.id
WHERE v.clinic_id IS NULL;

-- 3. Update RLS policies to use a more robust check that avoids subqueries in USING where possible
-- or at least handles the clinic_id better.

-- We'll use a function for clinic_id lookup to improve readability and potentially performance
CREATE OR REPLACE FUNCTION public.get_my_clinic_id()
RETURNS UUID AS $$
  SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Re-apply Patient policies
DROP POLICY IF EXISTS "Clinic Scoped View Patients" ON public.patients;
DROP POLICY IF EXISTS "Clinic Scoped Insert Patients" ON public.patients;
DROP POLICY IF EXISTS "Clinic Scoped Update Patients" ON public.patients;

CREATE POLICY "Clinic Scoped View Patients" ON public.patients
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.get_my_clinic_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
  );

CREATE POLICY "Clinic Scoped Insert Patients" ON public.patients
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.get_my_clinic_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
  );

CREATE POLICY "Clinic Scoped Update Patients" ON public.patients
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.get_my_clinic_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
  );

-- Re-apply Visit policies
DROP POLICY IF EXISTS "Clinic Scoped View Visits" ON public.visits;
DROP POLICY IF EXISTS "Clinic Scoped Insert Visits" ON public.visits;
DROP POLICY IF EXISTS "Clinic Scoped Update Visits" ON public.visits;

CREATE POLICY "Clinic Scoped View Visits" ON public.visits
  FOR SELECT TO authenticated
  USING (
    clinic_id = public.get_my_clinic_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
  );

CREATE POLICY "Clinic Scoped Insert Visits" ON public.visits
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = public.get_my_clinic_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
  );

CREATE POLICY "Clinic Scoped Update Visits" ON public.visits
  FOR UPDATE TO authenticated
  USING (
    clinic_id = public.get_my_clinic_id()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
  );
