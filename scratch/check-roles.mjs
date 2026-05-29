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
const SUPABASE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log("=== FETCHING USER ROLES ===");
  const { data: userRoles, error } = await supabase
    .from('user_roles')
    .select('*');

  if (error) {
    console.error("Error fetching user roles:", error.message);
    return;
  }

  console.log(`Found ${userRoles?.length || 0} user roles:`);
  console.log(userRoles);
}

run();
