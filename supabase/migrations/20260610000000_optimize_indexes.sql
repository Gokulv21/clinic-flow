-- Enable pg_trgm extension if not already enabled for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes for fast ilike search on patients table
CREATE INDEX IF NOT EXISTS idx_patients_name_trgm ON public.patients USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_phone_trgm ON public.patients USING GIN (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_reg_id_trgm ON public.patients USING GIN (registration_id gin_trgm_ops);

-- Create standard B-tree index for basic exact matching
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients(clinic_id);

-- Create composite index for visit queue to optimize realtime fetches
CREATE INDEX IF NOT EXISTS idx_visits_queue ON public.visits(clinic_id, status, assigned_doctor_id);
