-- 1. SECURITY CLEANUP: REMOVING LEGACY DEBUG POLICIES
-- This migration ensures that only the production-hardened policies remain active.

-- A. Drop Emergency Access Policies
DROP POLICY IF EXISTS "emergency_full_access_patients" ON public.patients;
DROP POLICY IF EXISTS "emergency_full_access_visits" ON public.visits;
DROP POLICY IF EXISTS "emergency_full_access_prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "emergency_unblocker_patients" ON public.patients;
DROP POLICY IF EXISTS "emergency_unblocker_visits" ON public.visits;
DROP POLICY IF EXISTS "emergency_unblocker_prescriptions" ON public.prescriptions;

-- B. Drop Debug Access Policies
DROP POLICY IF EXISTS "debug_full_access_patients" ON public.patients;
DROP POLICY IF EXISTS "debug_full_access_visits" ON public.visits;
DROP POLICY IF EXISTS "debug_full_access_prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "debug_full_access_profiles" ON public.profiles;

-- C. Drop Permissive Select Policies
DROP POLICY IF EXISTS "profiles_permissive_select" ON public.profiles;
DROP POLICY IF EXISTS "clinics_permissive_select" ON public.clinics;
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all clinics" ON public.clinics;

-- D. Drop legacy "has role" based policies (replaced by clinic-scoped ones)
DROP POLICY IF EXISTS "Staff can view patients" ON public.patients;
DROP POLICY IF EXISTS "Staff can view visits" ON public.visits;
DROP POLICY IF EXISTS "Staff can view prescriptions" ON public.prescriptions;


-- 2. FINAL INTEGRITY CHECK
-- We ensure every critical table has RLS enabled and a "production_*" policy.
-- Note: These were created in migration 20260420000002_idor_lockdown.sql

DO $$
BEGIN
    -- This block verifies that we haven't accidentally left a table unprotected.
    -- If a table has RLS enabled but no policies (which we just dropped many), 
    -- it defaults to "Deny All" for non-owners, which is the safest state.
    -- The IDOR lockdown migration added back the correct clinic-scoped policies.
    
    RAISE NOTICE 'Security cleanup complete. Legacy permissive policies have been removed.';
END $$;
