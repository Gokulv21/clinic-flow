-- Implement Super Admin Stealth Mode
-- Drop existing production select policy
DROP POLICY IF EXISTS "production_profiles_select" ON public.profiles;

-- Create new hierarchical visibility policy
-- 1. Users can always see their own profile
-- 2. Non-superadmins see profiles in their clinic ONLY IF they are not superadmins
-- 3. Superadmins can see ALL profiles across all clinics
CREATE POLICY "production_profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid()) OR
    (
      (clinic_id = public.get_auth_clinic_id() AND is_superadmin = false) OR
      (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true))
    )
  );

-- Also ensure user_roles table is filtered
DROP POLICY IF EXISTS "Allow read all user_roles" ON public.user_roles;
CREATE POLICY "production_user_roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid()) OR
    (
      EXISTS (
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = public.user_roles.user_id 
        AND p.is_superadmin = false
      ) OR
      (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true))
    )
  );
