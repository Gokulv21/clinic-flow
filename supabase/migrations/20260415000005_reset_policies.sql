-- Reset profiles and user_roles policies to allow basic access
-- This will fix the "No clinics found" issue

-- Drop ALL existing policies on profiles table
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Clinic Scoped View Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Clinic Scoped Update Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Clinic Scoped Insert Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff can view roles" ON public.profiles;

-- Create simple permissive policies for profiles
-- Allow authenticated users to read all profiles (for clinic lookup)
CREATE POLICY "Allow read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Allow users to update their own profile
CREATE POLICY "Allow update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Allow insert (for trigger)
CREATE POLICY "Allow insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Drop ALL existing policies on user_roles table
DROP POLICY IF EXISTS "Staff can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Doctors can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Clinic Scoped View User Roles" ON public.user_roles;
DROP POLICY IF EXISTS "Clinic Scoped Insert User Roles" ON public.user_roles;
DROP POLICY IF EXISTS "Clinic Scoped Update User Roles" ON public.user_roles;
DROP POLICY IF EXISTS "Clinic Scoped Delete User Roles" ON public.user_roles;

-- Simple permissive policies for user_roles
CREATE POLICY "Allow read all user_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow insert user_roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update user_roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Allow delete user_roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (true);