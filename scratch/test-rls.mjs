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
const PUBLIC_KEY = env['VITE_SUPABASE_PUBLISHABLE_KEY'];
const SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const userClient = createClient(SUPABASE_URL, PUBLIC_KEY, { auth: { persistSession: false } });

const CLINIC_ID = '9087544f-87ea-467b-9392-b336a9cf03fe';
const GUEST_DR_PROFILE_ID = '2e3fe683-648c-4a24-8a80-aa4f9cbac05e';

async function run() {
  // 1. Get patient
  const { data: patients } = await serviceClient.from('patients').select('id').limit(1);
  const patientId = patients?.[0]?.id;
  if (!patientId) {
    console.error("No patients found");
    return;
  }

  // 2. Insert test visit assigned to Guest Doctor
  console.log("Inserting test visit assigned to Guest Doctor...");
  const { data: visit, error: insErr } = await serviceClient.from('visits').insert({
    patient_id: patientId,
    token_number: 9991,
    assigned_doctor_id: GUEST_DR_PROFILE_ID,
    clinic_id: CLINIC_ID,
    status: 'waiting'
  }).select().single();

  if (insErr) {
    console.error("Failed to insert visit:", insErr.message);
    return;
  }

  console.log(`Inserted test visit ID: ${visit.id} (Assigned Doctor: ${visit.assigned_doctor_id})`);

  try {
    // 3. Log in as Owner (arvnd14@gmail.com)
    console.log("Logging in as Owner...");
    const { error: authErr } = await userClient.auth.signInWithPassword({
      email: 'arvnd14@gmail.com',
      password: 'Aravind@5'
    });

    if (authErr) {
      console.error("Owner Auth Error:", authErr.message);
      return;
    }

    // 4. Query all visits for the clinic as Owner (without any client-side assigned_doctor_id filter)
    console.log("Querying all visits in the clinic as Owner...");
    const { data: visits, error: selectErr } = await userClient
      .from('visits')
      .select('id, token_number, assigned_doctor_id')
      .eq('clinic_id', CLINIC_ID);

    if (selectErr) {
      console.error("Select Error:", selectErr.message);
    } else {
      const found = visits.find(v => v.id === visit.id);
      console.log(`Total visits returned: ${visits.length}`);
      if (found) {
        console.log("--> RESULT: Owner CAN read the guest doctor's visit! RLS is NOT isolating the owner (v4 policy is not active).");
      } else {
        console.log("--> RESULT: Owner CANNOT read the guest doctor's visit! RLS IS active and isolating correctly (v4 policy is applied).");
      }
    }
  } finally {
    // 5. Clean up
    console.log("Cleaning up test visit...");
    await serviceClient.from('visits').delete().eq('id', visit.id);
    console.log("Cleaned up.");
  }
}

run();
