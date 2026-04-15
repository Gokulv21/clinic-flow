-- Fix: Revert to working policies while maintaining clinic isolation

-- Drop the broken policies first
DROP POLICY IF EXISTS "Clinic Scoped View Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Clinic Scoped Update Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Clinic Scoped Insert Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Clinic Scoped View User Roles" ON public.user_roles;
DROP POLICY IF EXISTS "Clinic Scoped Insert User Roles" ON public.user_roles;
DROP POLICY IF EXISTS "Clinic Scoped Update User Roles" ON public.user_roles;
DROP POLICY IF EXISTS "Clinic Scoped Delete User Roles" ON public.user_roles;
DROP POLICY IF EXISTS "Staff can view roles" ON public.profiles;

-- Create simpler, working policies that don't have circular reference issues

-- Profile: Allow users to see their own profile (always needed)
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Profile: Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Profile: Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow superadmins to view all profiles
CREATE POLICY "Superadmins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
  );

-- Allow superadmins to update profiles
CREATE POLICY "Superadmins can update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
  );

-- Allow doctors within the same clinic to view other profiles in their clinic
CREATE POLICY "Doctors can view clinic profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p1.clinic_id = p2.clinic_id AND p1.clinic_id IS NOT NULL
      WHERE p1.user_id = auth.uid()
      AND p2.user_id = profiles.user_id
      AND p1.role = 'doctor'
    )
  );

-- User Roles: Users can view their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- User Roles: Superadmins can manage all roles
CREATE POLICY "Superadmins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true)
  );

-- User Roles: Doctors can manage roles within their clinic
CREATE POLICY "Doctors can manage clinic roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p1.clinic_id = p2.clinic_id AND p1.clinic_id IS NOT NULL
      WHERE p1.user_id = auth.uid()
      AND p2.user_id = user_roles.user_id
      AND p1.role = 'doctor'
    )
  );