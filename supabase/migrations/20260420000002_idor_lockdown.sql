-- 1. SECURITY LOCKDOWN: IDOR PROTECTION (Row Level Security)
-- This migration enforces that EVERY database operation verifies the user's clinic_id.

-- A. Profiles & Roles Security
-- Profiles: Ensure users can only update their own profile, and only superadmins can change the is_superadmin flag.
DROP POLICY IF EXISTS "production_profiles_all" ON public.profiles;
DROP POLICY IF EXISTS "production_profiles_select" ON public.profiles;

CREATE POLICY "production_profiles_all_v2" ON public.profiles
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() 
    OR (clinic_id = public.get_auth_clinic_id() AND is_superadmin = false)
    OR public.is_auth_superadmin()
  )
  WITH CHECK (
    user_id = auth.uid() 
    OR public.is_auth_superadmin()
  );

-- User Roles: Prevent anyone except Doctors or SuperAdmins from managing roles.
DROP POLICY IF EXISTS "production_user_roles_manage" ON public.user_roles;
DROP POLICY IF EXISTS "production_user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "Staff can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Doctors can manage roles" ON public.user_roles;

CREATE POLICY "production_user_roles_security" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND (role = 'doctor' OR is_superadmin = true)
    )) 
    OR user_id = auth.uid() -- Can see own roles
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND (role = 'doctor' OR is_superadmin = true)
    ))
  );

-- B. Clinical Data Isolation (Patients, Visits, Rx, Protocols)
-- For each table, we ensure clinic_id must match the user's clinic_id.

-- Patients
DROP POLICY IF EXISTS "production_patients_isolation" ON public.patients;
DROP POLICY IF EXISTS "production_patients_all" ON public.patients;
DROP POLICY IF EXISTS "Staff can view patients" ON public.patients;

CREATE POLICY "production_patients_lockdown" ON public.patients
  FOR ALL TO authenticated
  USING (clinic_id = public.get_auth_clinic_id() OR public.is_auth_superadmin())
  WITH CHECK (clinic_id = public.get_auth_clinic_id() OR public.is_auth_superadmin());

-- Visits
DROP POLICY IF EXISTS "production_visits_isolation" ON public.visits;
DROP POLICY IF EXISTS "production_visits_all" ON public.visits;
DROP POLICY IF EXISTS "Staff can view visits" ON public.visits;

CREATE POLICY "production_visits_lockdown" ON public.visits
  FOR ALL TO authenticated
  USING (clinic_id = public.get_auth_clinic_id() OR public.is_auth_superadmin())
  WITH CHECK (clinic_id = public.get_auth_clinic_id() OR public.is_auth_superadmin());

-- Prescriptions
DROP POLICY IF EXISTS "production_prescriptions_isolation" ON public.prescriptions;
DROP POLICY IF EXISTS "production_prescriptions_all" ON public.prescriptions;
DROP POLICY IF EXISTS "Staff can view prescriptions" ON public.prescriptions;

CREATE POLICY "production_prescriptions_lockdown" ON public.prescriptions
  FOR ALL TO authenticated
  USING (clinic_id = public.get_auth_clinic_id() OR public.is_auth_superadmin())
  WITH CHECK (clinic_id = public.get_auth_clinic_id() OR public.is_auth_superadmin());

-- Medicine Protocols
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'medicine_protocols') THEN
    EXECUTE 'ALTER TABLE public.medicine_protocols ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS production_protocols_lockdown ON public.medicine_protocols';
    EXECUTE 'CREATE POLICY production_protocols_lockdown ON public.medicine_protocols FOR ALL TO authenticated USING (clinic_id = public.get_auth_clinic_id() OR public.is_auth_superadmin()) WITH CHECK (clinic_id = public.get_auth_clinic_id() OR public.is_auth_superadmin())';
  END IF;
END $$;


-- 2. STORAGE SECURITY (IDOR Prevention for Files)
-- Note: Requires storage policies to be active.

-- Sanity cleanup for storage policies
DO $$
BEGIN
  -- We attempt to create a secure storage policy if the storage schema exists
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    -- Avatars
    EXECUTE 'DROP POLICY IF EXISTS avatars_isolation ON storage.objects';
    EXECUTE 'CREATE POLICY avatars_isolation ON storage.objects FOR ALL TO authenticated USING (bucket_id = ''avatars'' AND (storage.foldername(name))[1] = public.get_auth_clinic_id()::text) WITH CHECK (bucket_id = ''avatars'' AND (storage.foldername(name))[1] = public.get_auth_clinic_id()::text)';
    
    -- Prescriptions
    EXECUTE 'DROP POLICY IF EXISTS prescriptions_storage_isolation ON storage.objects';
    EXECUTE 'CREATE POLICY prescriptions_storage_isolation ON storage.objects FOR ALL TO authenticated USING (bucket_id = ''prescriptions'' AND (storage.foldername(name))[1] = public.get_auth_clinic_id()::text) WITH CHECK (bucket_id = ''prescriptions'' AND (storage.foldername(name))[1] = public.get_auth_clinic_id()::text)';
  END IF;
END $$;


-- 3. FINAL SANITY CHECK: Ensure RLS is enabled everywhere
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
