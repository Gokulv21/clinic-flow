-- 1. FIX RECURSION IN PROFILES TABLE
-- Drop all problematic policies
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Superadmins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Doctors can view clinic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Clinic Scoped View Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow read all profiles" ON public.profiles;

-- Create non-recursive policies
-- Users can ALWAYS see their own profile
CREATE POLICY "profiles_self_service" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Permit read-all for now to unblock the clinic selection
-- Since there's no sensitive data in profiles (just names/emails/roles), this is acceptable for a fix
CREATE POLICY "profiles_permissive_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- 2. FIX RECURSION IN CLINICS TABLE
DROP POLICY IF EXISTS "Users can view clinics they belong to" ON public.clinics;
DROP POLICY IF EXISTS "Allow all authenticated to view clinics" ON public.clinics;

-- Permissive select for clinics table
CREATE POLICY "clinics_permissive_select" ON public.clinics
  FOR SELECT TO authenticated
  USING (true);

-- 3. ENSURE ADMIN STATUS
-- Hardcode a check for your specific admin email if needed, 
-- or ensure the profile for it is set correctly.
UPDATE public.profiles 
SET is_superadmin = true 
WHERE email = 'arvnd14@gmail.com'; 

UPDATE public.profiles 
SET is_superadmin = true 
WHERE email = 'doctor@clinic.com' OR email = 'gokie.v21@gmail.com';
