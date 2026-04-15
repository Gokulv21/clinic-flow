-- 1. FIX ROLES: Only keep your main account as superadmin
-- Standardize Aravind as a regular Doctor so he auto-redirects
UPDATE public.profiles 
SET is_superadmin = false, 
    role = 'doctor',
    clinic_id = (SELECT id FROM public.clinics WHERE slug = 'gv-clinic' LIMIT 1)
WHERE email = 'arvnd14@gmail.com';

-- 2. DATA RECOVERY: Force-assign orphaned data to GV Clinic
-- This handles entries made while the profiles/RLS were broken
DO $$
DECLARE
  gv_clinic_id UUID := (SELECT id FROM public.clinics WHERE slug = 'gv-clinic' LIMIT 1);
BEGIN
  -- Fallback to hardcoded ID if slug lookup fails
  IF gv_clinic_id IS NULL THEN
    gv_clinic_id := '00000000-0000-0000-0000-000000000001';
  END IF;

  IF gv_clinic_id IS NOT NULL THEN
    -- Rescuing Patients
    UPDATE public.patients SET clinic_id = gv_clinic_id WHERE clinic_id IS NULL;
    -- Rescuing Visits
    UPDATE public.visits SET clinic_id = gv_clinic_id WHERE clinic_id IS NULL;
    -- Rescuing Prescriptions
    UPDATE public.prescriptions SET clinic_id = gv_clinic_id WHERE clinic_id IS NULL;
    
    -- Logging the update (visible in Supabase console)
    RAISE NOTICE 'Successfully rescued orphaned data to clinic: %', gv_clinic_id;
  END IF;
END $$;

-- 3. STAFF SYNC: Ensure the staff account is correctly scoped
UPDATE public.profiles
SET clinic_id = (SELECT id FROM public.clinics WHERE slug = 'gv-clinic' LIMIT 1),
    role = 'staff'
WHERE email = 'staff@gvclinic.com' OR email = 'staff@clinic.com';

-- 4. ENSURE USER ROLES TABLE IS SYNCED
-- If anyone exists in profiles but not user_roles, fix it.
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, role FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;
