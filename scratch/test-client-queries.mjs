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

// We use the public publishable key to act as a client with standard RLS checks
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false
  }
});

const CLINIC_ID = '9087544f-87ea-467b-9392-b336a9cf03fe';
const GUEST_DR_USER_ID = '2e3fe683-648c-4a24-8a80-aa4f9cbac05e'; // guestdr@gvclinic.com
const OWNER_USER_ID = '46ec2a22-4545-4ec1-8462-e34d3593b904'; // arvnd14@gmail.com
const NURSE_USER_ID = '8e79d79c-39be-46e3-8e68-2192ceae38b3'; // staff@gvclinic.com

async function testAsUser(email, password, label) {
  console.log(`\n========================================`);
  console.log(`LOGGING IN AS: ${label} (${email})`);
  console.log(`========================================`);
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error("Auth Error:", authError.message);
    return null;
  }

  const user = authData.user;
  console.log(`Logged in successfully! User ID: ${user.id}`);

  // 1. Fetch Profile
  const { data: myProfile, error: pError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  console.log("My Profile ID:", myProfile?.id, "Role:", myProfile?.role);

  // 2. Fetch Doctors (Simulate NurseEntry dropdown)
  const { data: doctors, error: dError } = await supabase
    .from('profiles')
    .select('id, user_id, full_name, role, email')
    .in('role', ['doctor', 'owner'])
    .eq('clinic_id', CLINIC_ID)
    .neq('is_superadmin', true);
  
  if (dError) {
    console.error("Doctors Fetch Error:", dError.message);
  } else {
    console.log(`Doctors visible to this user: ${doctors.length}`);
    doctors.forEach(d => {
      console.log(`  - Dr. ${d.full_name} | Email: ${d.email} | Profile ID: ${d.id} | User ID: ${d.user_id}`);
    });
  }

  // 3. Fetch Consultation Queue (Simulate DoctorConsultation fetch)
  // Get roles
  const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  const roles = (roleData || []).map(r => r.role);
  const hasRole = (role) => roles.includes(role) || myProfile?.role === role;

  console.log("Roles detected:", roles, "Profile Role:", myProfile?.role);

  let queueQuery = supabase
    .from('visits')
    .select('*, patients(*)')
    .eq('clinic_id', CLINIC_ID)
    .in('status', ['waiting', 'in_consultation']);
  
  // Superadmin can view all; every other clinician sees only general queue + their assigned queue
  if (!hasRole('superadmin')) {
    const doctorScopes = ['assigned_doctor_id.is.null'];
    if (user?.id) doctorScopes.push(`assigned_doctor_id.eq.${user.id}`);
    if (myProfile?.id) doctorScopes.push(`assigned_doctor_id.eq.${myProfile.id}`);
    queueQuery = queueQuery.or(doctorScopes.join(','));
  }

  const { data: queue, error: qError } = await queueQuery.order('token_number', { ascending: true });
  if (qError) {
    console.error("Queue Fetch Error:", qError.message);
  } else {
    const queueList = queue || [];
    console.log(`Queue items visible to this user: ${queueList.length}`);
    queueList.forEach(v => {
      console.log(`  - Visit #${v.token_number} | Patient: ${v.patients?.name} | Assigned Doctor ID: ${v.assigned_doctor_id} | Status: ${v.status}`);
    });
  }

  // Log out session
  await supabase.auth.signOut();
  return { user, myProfile, doctors, queue };
}

async function run() {
  await testAsUser('staff@gvclinic.com', 'StaffTemp@123', 'Nurse');
}

run();


