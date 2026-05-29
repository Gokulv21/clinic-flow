import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Simple .env parser
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
  console.log("Fetching profiles...");
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
  if (pError) {
    console.error("Profiles Error:", pError);
    return;
  }
  console.log("Profiles count:", profiles.length);
  console.log("Sample Profile:", profiles[0]);

  // Let's get a real patient to use for the insert test to avoid patient_id fkey violation
  const { data: patients } = await supabase.from('patients').select('id').limit(1);
  const patientId = patients?.[0]?.id;
  console.log("Sample Patient ID:", patientId);

  if (!patientId) {
    console.log("No patient found, cannot run insert tests");
    return;
  }

  const aravindProfileId = 'ed400ab4-843c-47e2-bd19-32baf936f7de';
  const aravindUserId = '46ec2a22-4545-4ec1-8462-e34d3593b904';
  const clinicId = '9087544f-87ea-467b-9392-b336a9cf03fe';

  console.log("\n--- Testing Insert with assigned_doctor_id = Aravind Auth ID (User ID) ---");
  const { data: r1, error: err1 } = await supabase.from('visits').insert({
    patient_id: patientId,
    token_number: 9001,
    assigned_doctor_id: aravindUserId,
    clinic_id: clinicId
  }).select();
  if (err1) {
    console.log("Result: FAILED", err1.message);
  } else {
    console.log("Result: SUCCESS", r1);
    // Clean up
    await supabase.from('visits').delete().eq('id', r1[0].id);
  }

  console.log("\n--- Testing Insert with assigned_doctor_id = Aravind Profile ID (id) ---");
  const { data: r2, error: err2 } = await supabase.from('visits').insert({
    patient_id: patientId,
    token_number: 9002,
    assigned_doctor_id: aravindProfileId,
    clinic_id: clinicId
  }).select();
  if (err2) {
    console.log("Result: FAILED", err2.message);
  } else {
    console.log("Result: SUCCESS", r2);
    // Clean up
    await supabase.from('visits').delete().eq('id', r2[0].id);
  }
}

run();

