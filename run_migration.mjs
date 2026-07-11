// Run this with: node run_migration.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yyaawwmgzqymyewdmbtj.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_Scuzz5mNP1A9T8h7MHPURA_lz4XSgKv';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const sql = `
-- Fix get_next_token to reset at midnight IST instead of UTC midnight
DROP FUNCTION IF EXISTS public.get_next_token();
DROP FUNCTION IF EXISTS public.get_next_token(UUID);

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
`;

const { data, error } = await supabase.rpc('exec_sql', { query: sql }).catch(() => ({ data: null, error: { message: 'exec_sql RPC not available' } }));

if (error) {
  // Fall back: try via Postgres REST
  console.log('RPC method unavailable, trying direct SQL via REST...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql })
  });
  const text = await res.text();
  console.log('Response:', res.status, text);
} else {
  console.log('✅ Migration applied successfully!', data);
}
