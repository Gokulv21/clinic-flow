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

const adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  const newPassword = process.argv[2];
  if (!newPassword) {
    console.error("Please provide the new password as an argument. Example: node scratch/change-nurse-password.mjs MyPassword123");
    process.exit(1);
  }

  console.log("Fetching nurse user...");
  const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers();
  if (listError) {
    console.error("Failed to list users:", listError.message);
    return;
  }

  const nurseUser = users.find(u => u.email === 'staff@gvclinic.com');
  if (!nurseUser) {
    console.error("Nurse user staff@gvclinic.com not found!");
    return;
  }

  console.log(`Resetting password for user ${nurseUser.email}...`);
  const { error: resetError } = await adminSupabase.auth.admin.updateUserById(nurseUser.id, {
    password: newPassword
  });

  if (resetError) {
    console.error("Failed to update password:", resetError.message);
  } else {
    console.log("SUCCESS! Password updated successfully.");
  }
}

run();
