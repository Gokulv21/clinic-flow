-- Add title column to patients
ALTER TABLE public.patients ADD COLUMN title TEXT;
ALTER TABLE public.patients ADD CONSTRAINT patients_title_check CHECK (title IN ('Mr.', 'Miss', 'Mrs.', 'Baby'));

-- Change age to numeric to support fractional years
ALTER TABLE public.patients ALTER COLUMN age TYPE NUMERIC;

-- Update existing patients to have a default title if needed
UPDATE public.patients SET title = 
  CASE 
    WHEN age < 2 THEN 'Baby'
    WHEN sex = 'Male' THEN 'Mr.'
    WHEN sex = 'Female' THEN 'Miss'
    ELSE 'Mr.'
  END
WHERE title IS NULL;

-- Create a view that dynamically calculates the CURRENT title and age
-- This fulfills the "automatically changes" requirement
CREATE OR REPLACE VIEW public.active_patients AS
SELECT 
  *,
  -- Calculate current age based on creation date and recorded age
  -- Assuming 'age' is age at 'created_at'
  (age + EXTRACT(YEAR FROM age(now(), created_at)) + EXTRACT(MONTH FROM age(now(), created_at)) / 12.0) as current_age,
  CASE 
    -- If current age is < 2, it's Baby
    WHEN (age + EXTRACT(YEAR FROM age(now(), created_at)) + EXTRACT(MONTH FROM age(now(), created_at)) / 12.0) < 2 THEN 'Baby'
    -- If it was Baby but now >= 2, change to Mr./Miss
    WHEN title = 'Baby' AND sex = 'Male' THEN 'Mr.'
    WHEN title = 'Baby' AND sex = 'Female' THEN 'Miss'
    -- Otherwise keep the manually set title (e.g. Mrs. stays Mrs.)
    ELSE title
  END as current_title
FROM public.patients;

-- Function to update patient title based on current age
-- This is called whenever a visit is created
CREATE OR REPLACE FUNCTION public.update_patient_title_on_visit()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.patients
  SET title = 
    CASE 
      WHEN (age + EXTRACT(YEAR FROM age(now(), created_at)) + EXTRACT(MONTH FROM age(now(), created_at)) / 12.0) < 2 THEN 'Baby'
      WHEN sex = 'Male' THEN 'Mr.'
      WHEN sex = 'Female' THEN 'Miss' -- Note: Could be Miss or Mrs., defaulting to Miss if it was Baby. 
                                     -- If it was already Mrs., the logic below handles it.
      ELSE title
    END
  WHERE id = NEW.patient_id 
    AND title = 'Baby'; -- Only auto-update if they are currently 'Baby' and now older
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER on_visit_update_patient_title
AFTER INSERT ON public.visits
FOR EACH ROW EXECUTE FUNCTION public.update_patient_title_on_visit();
