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
const SUPABASE_KEY = env['VITE_SUPABASE_PUBLISHABLE_KEY'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false
  }
});

const CLINIC_ID = '9087544f-87ea-467b-9392-b336a9cf03fe';
const GUEST_DR_PROFILE_ID = '2e3fe683-648c-4a24-8a80-aa4f9cbac05e';

async function run() {
  console.log("Logging in as Owner (arvnd14@gmail.com)...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'arvnd14@gmail.com',
    password: 'Aravind@5'
  });

  if (authError) {
    console.error("Auth Error:", authError.message);
    return;
  }

  console.log("Logged in! Fetching a patient...");
  const { data: patients } = await supabase.from('patients').select('id').limit(1);
  const patientId = patients?.[0]?.id;
  if (!patientId) {
    console.error("No patients found!");
    return;
  }

  console.log("Attempting to insert a visit assigned to Guest Doctor...");
  const { data: visit, error: insertError } = await supabase.from('visits').insert({
    patient_id: patientId,
    token_number: 8888,
    assigned_doctor_id: GUEST_DR_PROFILE_ID,
    clinic_id: CLINIC_ID,
    status: 'waiting'
  }).select();

  if (insertError) {
    console.error("Insert Error:", insertError);
  } else {
    console.log("SUCCESS! Inserted visit:", visit);
    
    // Clean up
    console.log("Cleaning up...");
    const { error: delError } = await supabase.from('visits').delete().eq('id', visit[0].id);
    console.log("Delete error status:", delError);
  }

  await supabase.auth.signOut();
}

run();
