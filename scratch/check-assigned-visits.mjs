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
  const { data: visits, error } = await supabase
    .from('visits')
    .select('id, token_number, assigned_doctor_id, clinic_id, status, created_at, patients(name)')
    .not('assigned_doctor_id', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching non-null assigned visits:", error);
    return;
  }
  
  console.log(`Found ${visits?.length || 0} visits with non-null assigned_doctor_id:`);
  visits?.forEach(v => {
    console.log(`Visit #${v.token_number} - Patient: ${v.patients?.name} - Assigned Doctor ID: ${v.assigned_doctor_id} - Clinic: ${v.clinic_id} - Status: ${v.status} - Created: ${v.created_at}`);
  });
}

run();
