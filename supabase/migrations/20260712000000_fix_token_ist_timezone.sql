-- Fix get_next_token to reset at midnight IST (Asia/Kolkata) instead of UTC midnight
-- The previous version used CURRENT_DATE which is UTC, so tokens wouldn't reset at midnight IST

DROP FUNCTION IF EXISTS public.get_next_token();
DROP FUNCTION IF EXISTS public.get_next_token(UUID);

-- Clinic-aware version (primary)
CREATE OR REPLACE FUNCTION public.get_next_token(p_clinic_id UUID)
RETURNS INTEGER
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(token_number), 0) + 1
  FROM public.visits
  WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
  AND clinic_id = p_clinic_id
$$;

-- Fallback version (uses auth profile to determine clinic)
CREATE OR REPLACE FUNCTION public.get_next_token()
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
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
        WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
        AND (clinic_id = v_clinic_id OR (v_clinic_id IS NULL AND clinic_id IS NULL))
    );
END;
$$;
