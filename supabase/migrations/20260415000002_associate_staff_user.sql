-- Associate staff@gvclinic.com with GV Clinic
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