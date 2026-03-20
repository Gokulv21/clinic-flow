-- Add 'staff' to app_role enum if it doesn't exist
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- Update patients policies to allow 'staff' to insert
DROP POLICY IF EXISTS "Nurse and doctor can insert patients" ON public.patients;
CREATE POLICY "Nurse, doctor and staff can insert patients" ON public.patients
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'nurse') OR public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'staff'));

-- Update visits policies to allow 'staff' to insert
DROP POLICY IF EXISTS "Nurse and doctor can insert visits" ON public.visits;
CREATE POLICY "Nurse, doctor and staff can insert visits" ON public.visits
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'nurse') OR public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'staff'));

-- Ensure 'Mast.' is allowed in patient title constraint and fix others
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_title_check;
ALTER TABLE public.patients ADD CONSTRAINT patients_title_check CHECK (title IN ('Mr.', 'Mast.', 'Miss', 'Mrs.', 'Baby'));
