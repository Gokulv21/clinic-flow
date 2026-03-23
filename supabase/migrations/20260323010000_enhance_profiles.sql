-- Enhance profiles table with clinical and branding fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS qualifications TEXT,
ADD COLUMN IF NOT EXISTS registration_id TEXT,
ADD COLUMN IF NOT EXISTS clinic_name TEXT,
ADD COLUMN IF NOT EXISTS clinic_address TEXT,
ADD COLUMN IF NOT EXISTS clinic_phone TEXT,
ADD COLUMN IF NOT EXISTS signature_data TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'light';

-- Ensure RLS allows users to update these new columns (already covered by existing policy usually, but good to check)
-- "Users can update own profile" policy in 20260311091933_38be4ac3-900b-4447-917a-cca39141d5fa.sql covers this.
