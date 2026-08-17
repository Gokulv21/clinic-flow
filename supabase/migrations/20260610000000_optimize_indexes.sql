-- 1. Shrink and rebuild bloated indexes
REINDEX TABLE public.prescriptions;
REINDEX TABLE public.visits;
REINDEX TABLE public.patients;
REINDEX TABLE public.security_audit_logs;

-- 2. Drop any redundant or duplicate indexes if present
DROP INDEX IF EXISTS public.idx_prescriptions_visit_id;
DROP INDEX IF EXISTS public.idx_prescriptions_created_at;
DROP INDEX IF EXISTS public.idx_prescriptions_is_printed;

-- 3. Create lean, high-performance compound indexes for clinic multi-tenancy & queries
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic_created 
  ON public.prescriptions(clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescriptions_visit_clinic 
  ON public.prescriptions(visit_id, clinic_id);

CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_lookup 
  ON public.prescriptions(doctor_id, clinic_id);

CREATE INDEX IF NOT EXISTS idx_visits_clinic_status_created 
  ON public.visits(clinic_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_visits_patient_clinic 
  ON public.visits(patient_id, clinic_id);

CREATE INDEX IF NOT EXISTS idx_patients_clinic_name 
  ON public.patients(clinic_id, name);

CREATE INDEX IF NOT EXISTS idx_patients_clinic_phone 
  ON public.patients(clinic_id, phone);

-- 4. Tune aggressive autovacuum on high-frequency tables to prevent future bloat
ALTER TABLE public.prescriptions SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 20,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 10
);

ALTER TABLE public.visits SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 20,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 10
);
