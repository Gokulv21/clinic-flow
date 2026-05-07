-- Add branding columns to clinics table
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS phone TEXT;

-- Migration: Copy existing branding from owner profiles to clinics
-- This is a one-time sync for existing clinics
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, owner_id FROM public.clinics LOOP
        UPDATE public.clinics
        SET 
            address = (SELECT clinic_address FROM public.profiles WHERE user_id = r.owner_id LIMIT 1),
            phone = (SELECT clinic_phone FROM public.profiles WHERE user_id = r.owner_id LIMIT 1)
        WHERE id = r.id;
    END LOOP;
END $$;
