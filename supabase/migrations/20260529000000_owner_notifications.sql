-- Drop existing select/update policies on password_reset_requests
DROP POLICY IF EXISTS "Admins can see clinic staff requests" ON public.password_reset_requests;
DROP POLICY IF EXISTS "SuperAdmins can see doctor requests" ON public.password_reset_requests;
DROP POLICY IF EXISTS "Admins can update request status" ON public.password_reset_requests;
DROP POLICY IF EXISTS "SuperAdmins can update status" ON public.password_reset_requests;

-- 1. Clinic owners/doctors (managers) can see staff/doctor requests for their clinic
CREATE POLICY "Admins can see clinic requests" ON public.password_reset_requests
    FOR SELECT TO authenticated
    USING (
        (clinic_id = public.get_auth_clinic_id() AND requester_role IN ('staff', 'doctor') AND EXISTS (
            SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('owner', 'doctor')
        ))
        OR public.is_auth_superadmin()
    );

-- 2. Clinic owners/doctors (managers) can update staff/doctor requests for their clinic
CREATE POLICY "Admins can update clinic requests" ON public.password_reset_requests
    FOR UPDATE TO authenticated
    USING (
        (clinic_id = public.get_auth_clinic_id() AND requester_role IN ('staff', 'doctor') AND EXISTS (
            SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('owner', 'doctor')
        ))
        OR public.is_auth_superadmin()
    );

-- 3. Super Admins can see owner requests
CREATE POLICY "SuperAdmins can see owner requests" ON public.password_reset_requests
    FOR SELECT TO authenticated
    USING (
        public.is_auth_superadmin() AND requester_role = 'owner'
    );

-- 4. Super Admins can update owner requests
CREATE POLICY "SuperAdmins can update owner requests" ON public.password_reset_requests
    FOR UPDATE TO authenticated
    USING (
        public.is_auth_superadmin() AND requester_role = 'owner'
    );
