-- Add doctor_id to prescriptions table
ALTER TABLE public.prescriptions 
ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON public.prescriptions(doctor_id);

-- Update RLS policies to allow doctors to view/update if they are the owners
-- (Existing policies already allow Doctors to view ALL prescriptions, but this adds more granular context)
