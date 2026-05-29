-- Drop old and existing policies to make this script fully re-runnable
DROP POLICY IF EXISTS "production_visits_isolation_v4" ON public.visits;
DROP POLICY IF EXISTS "production_visits_isolation_v3" ON public.visits;
DROP POLICY IF EXISTS "production_visits_isolation_v2" ON public.visits;
DROP POLICY IF EXISTS "production_visits_lockdown" ON public.visits;
DROP POLICY IF EXISTS "Clinic Scoped View Visits" ON public.visits;
DROP POLICY IF EXISTS "Staff can view visits" ON public.visits;

DROP POLICY IF EXISTS "production_prescriptions_isolation_v4" ON public.prescriptions;
DROP POLICY IF EXISTS "production_prescriptions_isolation_v3" ON public.prescriptions;
DROP POLICY IF EXISTS "production_prescriptions_isolation_v2" ON public.prescriptions;
DROP POLICY IF EXISTS "production_prescriptions_lockdown" ON public.prescriptions;
DROP POLICY IF EXISTS "Clinic Scoped View Prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Staff can view prescriptions" ON public.prescriptions;

-- Create new strict isolation policies for visits
CREATE POLICY "production_visits_isolation_v4" ON public.visits
  FOR SELECT TO authenticated
  USING (
    public.is_auth_superadmin()
    OR (
      clinic_id = public.get_auth_clinic_id()
      AND (
        -- Staff and nurses can manage the visits queue (required for patient entry registration and checkout)
        public.get_auth_role() IN ('nurse', 'staff')
        -- Doctors and Owners can only see unassigned (general) visits
        OR (assigned_doctor_id IS NULL)
        -- Or visits specifically assigned to them
        OR (
          assigned_doctor_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
          OR assigned_doctor_id = auth.uid()
        )
      )
    )
  );

-- Create new strict isolation policies for prescriptions
CREATE POLICY "production_prescriptions_isolation_v4" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (
    public.is_auth_superadmin()
    OR (
      clinic_id = public.get_auth_clinic_id()
      AND (
        -- Staff and nurses can view prescriptions
        public.get_auth_role() IN ('nurse', 'staff')
        -- Doctors and Owners can only see prescriptions they created
        OR doctor_id = auth.uid()
        -- Or prescriptions for visits assigned to them
        OR visit_id IN (
          SELECT id FROM public.visits 
          WHERE assigned_doctor_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
             OR assigned_doctor_id = auth.uid()
        )
      )
    )
  );

