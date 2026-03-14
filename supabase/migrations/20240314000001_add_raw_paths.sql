-- Add raw_paths column to store vector drawing data
ALTER TABLE public.prescriptions ADD COLUMN raw_paths JSONB DEFAULT '[]';
