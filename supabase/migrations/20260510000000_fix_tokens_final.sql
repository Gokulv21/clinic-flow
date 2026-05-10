-- 1. Drop all existing overloads of get_next_token to avoid ambiguity
DROP FUNCTION IF EXISTS public.get_next_token();
DROP FUNCTION IF EXISTS public.get_next_token(UUID);

-- 2. Create the robust clinic-aware version
CREATE OR REPLACE FUNCTION public.get_next_token(p_clinic_id UUID)
RETURNS INTEGER
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(token_number), 0) + 1
  FROM public.visits
  WHERE created_at::date = CURRENT_DATE
  AND clinic_id = p_clinic_id
$$;

-- 3. Create the fallback version for authenticated users
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
        WHERE created_at::date = CURRENT_DATE
        AND (clinic_id = v_clinic_id OR (v_clinic_id IS NULL AND clinic_id IS NULL))
    );
END;
$$;

-- 4. DATA FIX: Recalculate all token numbers for all time, isolated by clinic and date
-- This will fix the "all 1s" issue and any "mixed up" tokens from the past.
DO $$
BEGIN
    -- We use a CTE to calculate the correct sequence and then update the table.
    -- We partition by clinic_id and the DATE of created_at.
    -- We order by the original created_at timestamp to preserve the order of arrival.
    
    WITH reordered_visits AS (
      SELECT 
        id, 
        ROW_NUMBER() OVER (
          PARTITION BY clinic_id, (created_at AT TIME ZONE 'UTC')::date 
          ORDER BY created_at ASC
        ) as new_token
      FROM public.visits
    )
    UPDATE public.visits v
    SET token_number = r.new_token
    FROM reordered_visits r
    WHERE v.id = r.id;
    
    RAISE NOTICE 'Token numbers have been recalculated for all visits.';
END $$;
