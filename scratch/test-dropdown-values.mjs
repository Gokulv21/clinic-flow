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

  // 1. Fetch doctors exactly as in NurseEntry.tsx
  const { data: doctors, error: dError } = await supabase
    .from('profiles')
    .select('id, user_id, full_name, role, email')
    .in('role', ['doctor', 'owner'])
    .eq('clinic_id', CLINIC_ID)
    .neq('is_superadmin', true);
  
  if (dError) {
    console.error("Doctors Error:", dError.message);
    return;
  }

  console.log(`Fetched ${doctors.length} doctors.`);

  // 2. Map to doctorOptions exactly as in NurseEntry.tsx
  const seen = new Set();
  const doctorOptions = doctors
    .map((doctor) => {
      const assignId = doctor?.id || doctor?.user_id || '';
      return { ...doctor, assignId: String(assignId) };
    })
    .filter((doctor) => {
      if (!doctor.assignId || seen.has(doctor.assignId)) return false;
      seen.add(doctor.assignId);
      return true;
    });

  console.log("doctorOptions mapped:", doctorOptions);

  // 3. Build availableDoctorIds set exactly as in NurseEntry.tsx
  const availableDoctorIds = new Set(doctorOptions.map((doctor) => doctor.assignId).filter(Boolean));
  console.log("availableDoctorIds set:", Array.from(availableDoctorIds));

  // 4. Test lookups
  const testIds = [
    '2e3fe683-648c-4a24-8a80-aa4f9cbac05e', // Guest Doctor Profile ID
    'ed400ab4-843c-47e2-bd19-32baf936f7de', // Owner Profile ID
  ];

  testIds.forEach(id => {
    const hasId = availableDoctorIds.has(id);
    const normalized = id !== "general" && availableDoctorIds.has(id) ? id : null;
    console.log(`Test ID: ${id} | Has ID: ${hasId} | Normalized: ${normalized}`);
  });

  await supabase.auth.signOut();
}

run();
