-- Migration: Ensure public.prescriptions(visit_id) is unique to allow upsert logic

-- 1. Remove existing duplicates if any (keep the most recent one)
DELETE FROM public.prescriptions p1
USING public.prescriptions p2
WHERE p1.id < p2.id
  AND p1.visit_id = p2.visit_id;

-- 2. Drop the existing non-unique index
DROP INDEX IF EXISTS public.idx_prescriptions_visit_id;

-- 3. Add the unique constraint/index
ALTER TABLE public.prescriptions 
ADD CONSTRAINT prescriptions_visit_id_key UNIQUE (visit_id);

-- 4. Re-create the index as unique (optional but good for performance)
-- Note: The step above already creates a unique index, but we can give it a specific name if preferred.
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_prescriptions_visit_id_unique ON public.prescriptions(visit_id);
