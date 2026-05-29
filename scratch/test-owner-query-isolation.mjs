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

const CLINIC_ID = '9087544f-87ea-467b-9392-b336a9cf03fe';
const GUEST_DR_PROFILE_ID = '2e3fe683-648c-4a24-8a80-aa4f9cbac05e';
const OWNER_PROFILE_ID = 'ed400ab4-843c-47e2-bd19-32baf936f7de';
const OWNER_USER_ID = '46ec2a22-4545-4ec1-8462-e34d3593b904';

async function run() {
  // 1. Get a valid patient ID
  const { data: patients } = await supabase.from('patients').select('id').limit(1);
  const patientId = patients?.[0]?.id;
  if (!patientId) {
    console.error("No patients found in DB!");
    return;
  }

  console.log("Using patient ID:", patientId);

  // 2. Insert test visit assigned to Guest Doctor
  console.log("\nInserting visit assigned to Guest Doctor...");
  const { data: visit, error: insertErr } = await supabase.from('visits').insert({
    patient_id: patientId,
    token_number: 9999,
    assigned_doctor_id: GUEST_DR_PROFILE_ID,
    clinic_id: CLINIC_ID,
    status: 'waiting'
  }).select().single();

  if (insertErr) {
    console.error("Failed to insert test visit:", insertErr.message);
    return;
  }

  console.log("Inserted test visit ID:", visit.id, "Assigned Doctor ID:", visit.assigned_doctor_id);

  // 3. Query as Owner using the logic from DoctorConsultation.tsx
  console.log("\nQuerying visit queue using owner credentials...");
  
  // Scopes for owner:
  const doctorScopes = ['assigned_doctor_id.is.null'];
  doctorScopes.push(`assigned_doctor_id.eq.${OWNER_USER_ID}`);
  doctorScopes.push(`assigned_doctor_id.eq.${OWNER_PROFILE_ID}`);

  let query = supabase
    .from('visits')
    .select('*, patients(*)')
    .eq('clinic_id', CLINIC_ID)
    .in('status', ['waiting', 'in_consultation'])
    .or(doctorScopes.join(','));

  const { data: queue, error: qError } = await query;
  if (qError) {
    console.error("Query failed:", qError.message);
  } else {
    console.log(`Owner Queue length: ${queue?.length || 0}`);
    const found = queue?.find(v => v.id === visit.id);
    if (found) {
      console.log("FAIL: Owner CAN see the visit assigned to the Guest Doctor!");
      console.log("Visit details in owner queue:", found);
    } else {
      console.log("SUCCESS: Owner CANNOT see the visit assigned to the Guest Doctor.");
    }
  }

  // 4. Clean up
  console.log("\nCleaning up test visit...");
  await supabase.from('visits').delete().eq('id', visit.id);
  console.log("Done.");
}

run();
