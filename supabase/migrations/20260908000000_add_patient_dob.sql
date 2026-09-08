-- Add dob (Date of Birth) column to patients table
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS dob DATE;

-- Create index on dob for fast filtering / demographic queries
CREATE INDEX IF NOT EXISTS idx_patients_dob ON public.patients(dob);

-- Backfill approximate dob for existing patients using their initial age and created_at date
-- For example: a patient created on 2024-05-10 with age 10 will have approx dob 2014-05-10
UPDATE public.patients
SET dob = (created_at::DATE - (age || ' years')::INTERVAL)::DATE
WHERE dob IS NULL AND age IS NOT NULL;
