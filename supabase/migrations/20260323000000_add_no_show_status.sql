-- Update visits status check to include 'no_show'
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_status_check;
ALTER TABLE public.visits ADD CONSTRAINT visits_status_check CHECK (status IN ('waiting', 'in_consultation', 'completed', 'no_show'));
