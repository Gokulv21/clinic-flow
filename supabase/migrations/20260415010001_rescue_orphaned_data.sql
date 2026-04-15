-- FIND THE ACTUAL CLINIC ID DYNAMICALLY
DO $$
DECLARE
  actual_clinic_id UUID;
  dummy_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- We search for the clinic by its slug or name
  SELECT id INTO actual_clinic_id FROM public.clinics WHERE slug = 'gv-clinic' OR name = 'GV Clinic' LIMIT 1;

  IF actual_clinic_id IS NOT NULL THEN
     -- 1. RESCUE THE LOST VISITS
     UPDATE public.visits 
     SET clinic_id = actual_clinic_id 
     WHERE clinic_id IS NULL OR clinic_id = dummy_id;

     -- 2. RESCUE THE LOST PATIENTS
     UPDATE public.patients 
     SET clinic_id = actual_clinic_id 
     WHERE clinic_id IS NULL OR clinic_id = dummy_id;

     -- 3. RESCUE THE LOST PRESCRIPTIONS
     UPDATE public.prescriptions 
     SET clinic_id = actual_clinic_id 
     WHERE clinic_id IS NULL OR clinic_id = dummy_id;

     RAISE NOTICE 'SUCCESS: All records synced to Clinic ID: %', actual_clinic_id;
  ELSE
     RAISE NOTICE 'WARNING: GV Clinic not found, skipping rescue.';
  END IF;
END $$;
