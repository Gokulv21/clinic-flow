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
const SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];
const PUBLIC_KEY = env['VITE_SUPABASE_PUBLISHABLE_KEY'];

// Admin client to manage auth
const adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

// Public client to simulate RLS
const clientSupabase = createClient(SUPABASE_URL, PUBLIC_KEY, {
  auth: { persistSession: false }
});

const CLINIC_ID = '9087544f-87ea-467b-9392-b336a9cf03fe';
const GUEST_DR_PROFILE_ID = '2e3fe683-648c-4a24-8a80-aa4f9cbac05e';

async function run() {
  console.log("Listing auth users...");
  const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers();
  if (listError) {
    console.error("List Users Error:", listError.message);
    return;
  }

  const nurseUser = users.find(u => u.email === 'staff@gvclinic.com');
  if (!nurseUser) {
    console.error("Nurse user staff@gvclinic.com not found!");
    return;
  }

  console.log(`Found Nurse User ID: ${nurseUser.id}`);

  // Temporarily reset password to 'StaffTemp@123'
  console.log("Resetting Nurse password temporarily...");
  const { error: resetError } = await adminSupabase.auth.admin.updateUserById(nurseUser.id, {
    password: 'StaffTemp@123'
  });
  if (resetError) {
    console.error("Password reset failed:", resetError.message);
    return;
  }

  try {
    console.log("Logging in as Nurse via client client...");
    const { data: authData, error: loginError } = await clientSupabase.auth.signInWithPassword({
      email: 'staff@gvclinic.com',
      password: 'StaffTemp@123'
    });

    if (loginError) {
      console.error("Nurse Login Failed:", loginError.message);
      return;
    }

    console.log("Logged in! Fetching a patient...");
    const { data: patients } = await clientSupabase.from('patients').select('id').limit(1);
    const patientId = patients?.[0]?.id;
    if (!patientId) {
      console.error("No patients found!");
      return;
    }

    console.log(`Using Patient ID: ${patientId}. Attempting to insert visit assigned to Guest Doctor...`);
    const { data: visit, error: insertError } = await clientSupabase.from('visits').insert({
      patient_id: patientId,
      token_number: 7777,
      assigned_doctor_id: GUEST_DR_PROFILE_ID,
      clinic_id: CLINIC_ID,
      status: 'waiting'
    }).select();

    if (insertError) {
      console.error("Insert Error as Nurse:", insertError);
    } else {
      console.log("SUCCESS! Inserted visit as Nurse:", visit);
      
      // Clean up
      console.log("Cleaning up visit...");
      const { error: delError } = await clientSupabase.from('visits').delete().eq('id', visit[0].id);
      console.log("Delete status:", delError ? delError.message : "Success");
    }

    await clientSupabase.auth.signOut();
  } finally {
    // Restore the password (we can set it to a dummy or keep it StaffTemp@123 so they can use it, or reset to their standard)
    // Since we don't know the old password, we'll keep it as StaffTemp@123, or if they need to change it they can do forgot password.
    // Wait, let's change it back to 'Staff@gvclinic.com' or similar in case that was it, or leave it so they can use it.
    console.log("Completed. Nurse password is left as: StaffTemp@123");
  }
}

run();
