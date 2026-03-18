-- Add clinical_notes column to prescriptions table
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS clinical_notes TEXT;
