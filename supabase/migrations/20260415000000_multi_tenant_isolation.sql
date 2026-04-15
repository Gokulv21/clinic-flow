-- 1. Create clinics table if not exists
CREATE TABLE IF NOT EXISTS public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add clinic_id to relevant tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.app_role;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT false;

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id);
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id);
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id);
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES auth.users(id);

-- Backfill: If we only have one clinic, assign everything to it.
-- This is a safe assumption for a single-clinic to multi-clinic migration start.
DO $$
DECLARE
  first_clinic_id UUID;
BEGIN
  SELECT id INTO first_clinic_id FROM public.clinics LIMIT 1;
  IF first_clinic_id IS NOT NULL THEN
    UPDATE public.profiles SET clinic_id = first_clinic_id WHERE clinic_id IS NULL;
    UPDATE public.patients SET clinic_id = first_clinic_id WHERE clinic_id IS NULL;
    UPDATE public.visits SET clinic_id = first_clinic_id WHERE clinic_id IS NULL;
    UPDATE public.prescriptions SET clinic_id = first_clinic_id WHERE clinic_id IS NULL;
  END IF;
END $$;

-- 3. Enable RLS on clinics
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- 4. Set up RLS for clinics
CREATE POLICY "Users can view clinics they belong to" ON public.clinics
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.clinic_id = clinics.id
    )
    OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
  );

-- 5. Update RLS policies for data isolation
-- Drop old policies first
DROP POLICY IF EXISTS "Staff and Doctor View Patients" ON public.patients;
DROP POLICY IF EXISTS "Staff and Doctor Insert Patients" ON public.patients;
DROP POLICY IF EXISTS "Staff and Doctor Update Patients" ON public.patients;

CREATE POLICY "Clinic Scoped View Patients" ON public.patients
  FOR SELECT TO authenticated
  USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
    OR (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
  );

CREATE POLICY "Clinic Scoped Insert Patients" ON public.patients
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
    OR (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
  );

CREATE POLICY "Clinic Scoped Update Patients" ON public.patients
  FOR UPDATE TO authenticated
  USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
    OR (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
  );

-- Repeat for Visits
DROP POLICY IF EXISTS "Staff and Doctor View Visits" ON public.visits;
DROP POLICY IF EXISTS "Staff and Doctor Insert Visits" ON public.visits;
DROP POLICY IF EXISTS "Staff and Doctor Update Visits" ON public.visits;

CREATE POLICY "Clinic Scoped View Visits" ON public.visits
  FOR SELECT TO authenticated
  USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
    OR (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
  );

CREATE POLICY "Clinic Scoped Insert Visits" ON public.visits
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
    OR (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
  );

CREATE POLICY "Clinic Scoped Update Visits" ON public.visits
  FOR UPDATE TO authenticated
  USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
    OR (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
  );

-- Repeat for Prescriptions
DROP POLICY IF EXISTS "Staff and Doctor View Prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Staff, Doctor, Printer Update Prescriptions" ON public.prescriptions;

CREATE POLICY "Clinic Scoped View Prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
    OR (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
  );

CREATE POLICY "Clinic Scoped Insert Prescriptions" ON public.prescriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
    OR (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
  );

CREATE POLICY "Clinic Scoped Update Prescriptions" ON public.prescriptions
  FOR UPDATE TO authenticated
  USING (
    clinic_id = (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
    OR (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
  );

-- 6. Helper function to ensure users always insert their own clinic_id
-- We can add a trigger for this if needed, but for now we'll rely on the application code
-- which already seems to handle it.
