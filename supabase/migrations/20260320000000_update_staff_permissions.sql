-- 1. Ensure 'staff' exists in app_role enum
BEGIN;
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';
COMMIT;

-- 2. Patients Policy: Allow 'staff' and 'doctor' to View, Insert, and Update
DROP POLICY IF EXISTS "Staff can view patients" ON public.patients;
DROP POLICY IF EXISTS "Staff can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Staff can update patients" ON public.patients;
DROP POLICY IF EXISTS "Nurse, doctor and staff can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Nurse and doctor can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Doctor can update patients" ON public.patients;

CREATE POLICY "Staff and Doctor View Patients" ON public.patients FOR SELECT TO authenticated USING (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Staff and Doctor Insert Patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Staff and Doctor Update Patients" ON public.patients FOR UPDATE TO authenticated USING (public.is_clinic_staff(auth.uid()));

-- 3. Visits Policy: Allow 'staff' and 'doctor' to View, Insert, and Update
DROP POLICY IF EXISTS "Staff can view visits" ON public.visits;
DROP POLICY IF EXISTS "Staff can insert visits" ON public.visits;
DROP POLICY IF EXISTS "Staff can update visits" ON public.visits;
DROP POLICY IF EXISTS "Nurse, doctor and staff can insert visits" ON public.visits;
DROP POLICY IF EXISTS "Nurse and doctor can insert visits" ON public.visits;
DROP POLICY IF EXISTS "Doctor can update visits" ON public.visits;

CREATE POLICY "Staff and Doctor View Visits" ON public.visits FOR SELECT TO authenticated USING (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Staff and Doctor Insert Visits" ON public.visits FOR INSERT TO authenticated WITH CHECK (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Staff and Doctor Update Visits" ON public.visits FOR UPDATE TO authenticated USING (public.is_clinic_staff(auth.uid()));

-- 4. Prescriptions Policy: Allow 'staff', 'doctor', and 'printer' to View and Update
DROP POLICY IF EXISTS "Staff can view prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Staff can update prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Doctor can update prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Printer can update print status" ON public.prescriptions;

CREATE POLICY "Staff and Doctor View Prescriptions" ON public.prescriptions FOR SELECT TO authenticated USING (public.is_clinic_staff(auth.uid()));
CREATE POLICY "Staff, Doctor, Printer Update Prescriptions" ON public.prescriptions FOR UPDATE TO authenticated USING (public.is_clinic_staff(auth.uid()));

-- 5. Fix Patient Title Constraint
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_title_check;
ALTER TABLE public.patients ADD CONSTRAINT patients_title_check CHECK (title IN ('Mr.', 'Mast.', 'Miss', 'Mrs.', 'Baby'));
