-- 1. Insert GV Clinic
INSERT INTO public.clinics (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'GV Clinic', 'gv-clinic')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

-- 2. Associate Aravind with GV Clinic
-- We'll look for Aravind's email and update the profile
UPDATE public.profiles
SET clinic_id = '00000000-0000-0000-0000-000000000001',
    role = 'doctor'
WHERE email = 'arvnd14@gmail.com' OR user_id IN (SELECT id FROM auth.users WHERE email = 'arvnd14@gmail.com');

-- Also ensure he has the role in user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'doctor' FROM auth.users WHERE email = 'arvnd14@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Prepare for the staff user staff@gvclinic.com
-- Note: You MUST create this user in Supabase Auth first.
-- Once created, you can run the following SQL to associate them:

/*
-- RUN THIS AFTER CREATING staff@gvclinic.com IN SUPABASE AUTH
DO $$
DECLARE
  staff_id UUID;
BEGIN
  SELECT id INTO staff_id FROM auth.users WHERE email = 'staff@gvclinic.com';
  
  IF staff_id IS NOT NULL THEN
    -- Upsert profile
    INSERT INTO public.profiles (user_id, full_name, email, clinic_id, role)
    VALUES (staff_id, 'GV Clinic Staff', 'staff@gvclinic.com', '00000000-0000-0000-0000-000000000001', 'staff')
    ON CONFLICT (user_id) DO UPDATE 
    SET clinic_id = EXCLUDED.clinic_id, role = EXCLUDED.role;
    
    -- Assign role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (staff_id, 'staff')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
*/
