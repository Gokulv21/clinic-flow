-- Performance Optimization: Add indexes for frequently queried columns
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Visits: Performance for queue fetching and status filtering
CREATE INDEX IF NOT EXISTS idx_visits_status ON public.visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_created_at ON public.visits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON public.visits(patient_id);

-- Prescriptions: Performance for print queue and patient history
CREATE INDEX IF NOT EXISTS idx_prescriptions_is_printed ON public.prescriptions(is_printed);
CREATE INDEX IF NOT EXISTS idx_prescriptions_visit_id ON public.prescriptions(visit_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON public.prescriptions(created_at DESC);

-- Patients: Performance for search and directory
CREATE INDEX IF NOT EXISTS idx_patients_name_trgm ON public.patients USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_reg_id ON public.patients(registration_id);
CREATE INDEX IF NOT EXISTS idx_patients_last_opened ON public.patients(last_opened_at DESC NULLS LAST);
