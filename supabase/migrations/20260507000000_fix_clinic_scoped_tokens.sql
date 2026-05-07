-- Update get_next_token to be clinic-aware
CREATE OR REPLACE FUNCTION public.get_next_token(p_clinic_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(token_number), 0) + 1
  FROM public.visits
  WHERE created_at::date = CURRENT_DATE
  AND clinic_id = p_clinic_id
$$;

-- Also provide a version with no arguments for backward compatibility or default clinic
-- This will use the clinic_id from the user's profile if authenticated
CREATE OR REPLACE FUNCTION public.get_next_token()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clinic_id UUID;
BEGIN
    SELECT clinic_id INTO v_clinic_id FROM public.profiles WHERE user_id = auth.uid();
    
    RETURN (
        SELECT COALESCE(MAX(token_number), 0) + 1
        FROM public.visits
        WHERE created_at::date = CURRENT_DATE
        AND (clinic_id = v_clinic_id OR v_clinic_id IS NULL)
    );
END;
$$;
