-- Create the password_reset_requests table
-- Drop existing policies if they exist to allow re-running the migration
DROP POLICY IF EXISTS "Enable insert for everyone" ON public.password_reset_requests;
DROP POLICY IF EXISTS "Admins can see clinic staff requests" ON public.password_reset_requests;
DROP POLICY IF EXISTS "SuperAdmins can see doctor requests" ON public.password_reset_requests;
DROP POLICY IF EXISTS "Admins can update request status" ON public.password_reset_requests;
DROP POLICY IF EXISTS "SuperAdmins can update status" ON public.password_reset_requests;
DROP POLICY IF EXISTS "Admins can see clinic requests" ON public.password_reset_requests;

-- Create table
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    requester_role TEXT NOT NULL DEFAULT 'staff',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure requester_role exist if table was created in a previous version
ALTER TABLE public.password_reset_requests ADD COLUMN IF NOT EXISTS requester_role TEXT NOT NULL DEFAULT 'staff';

-- Enable RLS
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Polices
-- 1. Users can insert their own requests
CREATE POLICY "Enable insert for everyone" ON public.password_reset_requests FOR INSERT WITH CHECK (true);

-- 2. Clinic owners/admins can see STAFF requests for their clinic
CREATE POLICY "Admins can see clinic staff requests" ON public.password_reset_requests
    FOR SELECT TO authenticated
    USING (
        (clinic_id IN (
            SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid()
        ) AND requester_role = 'staff')
    );

-- 3. Super Admins can see DOCTOR requests
CREATE POLICY "SuperAdmins can see doctor requests" ON public.password_reset_requests
    FOR SELECT TO authenticated
    USING (
        (EXISTS (
            SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true
        ) AND requester_role = 'doctor')
    );

-- 4. Admins can update status (Staff requests)
CREATE POLICY "Admins can update request status" ON public.password_reset_requests
    FOR UPDATE TO authenticated
    USING (
        (clinic_id IN (
            SELECT clinic_id FROM public.profiles WHERE user_id = auth.uid()
        ) AND requester_role = 'staff')
    );

-- 5. Super Admins can update status (Doctor requests)
CREATE POLICY "SuperAdmins can update status" ON public.password_reset_requests
    FOR UPDATE TO authenticated
    USING (
        (EXISTS (
            SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_superadmin = true
        ) AND requester_role = 'doctor')
    );

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.password_reset_requests;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.password_reset_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
