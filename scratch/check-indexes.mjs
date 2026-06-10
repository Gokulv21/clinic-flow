import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkIndexes() {
  const { data, error } = await supabase.rpc('execute_sql', {
    query: `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public';`
  });

  if (error) {
    console.error("RPC failed, maybe execute_sql doesn't exist.", error);
  } else {
    console.log("Indexes:", data);
  }
}

checkIndexes();
