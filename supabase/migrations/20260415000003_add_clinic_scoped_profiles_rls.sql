-- Add clinic-scoped RLS policies for profiles table
-- This ensures users can only see profiles within their own clinic

-- First, drop existing profiles policies that don't have clinic scoping
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Create new clinic-scoped policies for profiles
-- Users can view profiles within their clinic (including their own profile and superadmins)
CREATE POLICY "Clinic Scoped View Profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()  -- Users can always view their own profile
    OR (
      -- Check if user belongs to same clinic as the profile being viewed
      (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid()) IS NOT NULL
      AND clinic_id = (SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid())
    )
    OR (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
  );

-- Users can update own profile
CREATE POLICY "Clinic Scoped Update Profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
  );

-- Users can insert their own profile (handle_new_user trigger creates initial profile)
CREATE POLICY "Clinic Scoped Insert Profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Also drop and recreate user_roles policies with clinic scoping
DROP POLICY IF EXISTS "Staff can view roles" ON public.profiles;
DROP POLICY IF EXISTS "Staff can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Doctors can manage roles" ON public.user_roles;

-- User roles view policy - users can view roles within their clinic
CREATE POLICY "Clinic Scoped View User Roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()  -- Users can view their own roles
    OR (
      -- Users can view roles of other users in their clinic
      EXISTS (
        SELECT 1 FROM public.profiles p1
        JOIN public.profiles p2 ON p1.clinic_id = p2.clinic_id
        WHERE p1.user_id = auth.uid()
        AND p2.user_id = user_roles.user_id
        AND p1.clinic_id IS NOT NULL
      )
    )
    OR (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
  );

-- User roles insert policy - clinic admins can manage roles
CREATE POLICY "Clinic Scoped Insert User Roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
    OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'doctor'
  );

-- User roles update policy
CREATE POLICY "Clinic Scoped Update User Roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
    OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'doctor'
  );

-- User roles delete policy
CREATE POLICY "Clinic Scoped Delete User Roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    (SELECT is_superadmin FROM public.profiles WHERE user_id = auth.uid()) = true
    OR (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'doctor'
  );
