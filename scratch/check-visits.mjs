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
  console.log("=== FETCHING CLINICS ===");
  const { data: clinics } = await supabase.from('clinics').select('*');
  console.log("Clinics:", clinics);

  console.log("\n=== FETCHING DOCTORS/PROFILES ===");
  const { data: profiles } = await supabase.from('profiles').select('id, user_id, full_name, role, email, clinic_id, is_superadmin');
  console.log(profiles);

  console.log("\n=== FETCHING RECENT VISITS ===");
  const { data: visits } = await supabase
    .from('visits')
    .select('id, token_number, assigned_doctor_id, clinic_id, status, created_at, patients(name)')
    .order('created_at', { ascending: false })
    .limit(10);
  
  visits?.forEach(v => {
    console.log(`Visit #${v.token_number} - Patient: ${v.patients?.name} - Assigned Doctor ID: ${v.assigned_doctor_id} - Clinic: ${v.clinic_id} - Status: ${v.status} - Created: ${v.created_at}`);
  });
}

run();
