import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
    }
});

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'] || env['VITE_SUPABASE_PUBLISHABLE_KEY'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log("=== CHECKING RLS POLICIES FOR PROFILES ===");
  const { data: profilePolicies, error: err1 } = await supabase.rpc('get_policies_for_table', { table_name: 'profiles' });
  if (err1) {
    // If RPC doesn't exist, we query pg_policies using sql/query if possible, or try direct query
    console.log("RPC get_policies_for_table not found, trying query via pg_catalog...");
  } else {
    console.log("Policies on profiles:", profilePolicies);
  }

  // Let's run a raw query to check policies on profiles
  const { data: pgPolicies, error: err2 } = await supabase.rpc('execute_sql', { 
    sql_query: "SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename IN ('profiles', 'visits');"
  });
  if (err2) {
    console.log("execute_sql RPC not found either, trying another way. Error:", err2.message);
  } else {
    console.log("Policies:", pgPolicies);
  }

  // Let's also check if we can simulate the doctor options query as the Nurse or Guest Doctor.
  // We can query as service role (which sees everything) vs checking the profiles directly.
  console.log("\n=== ALL PROFILES IN GV CLINIC ===");
  const { data: gvProfiles } = await supabase.from('profiles').select('id, user_id, full_name, role, email, clinic_id').eq('clinic_id', '9087544f-87ea-467b-9392-b336a9cf03fe');
  console.log(gvProfiles);
}

run();
