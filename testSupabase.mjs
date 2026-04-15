import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Super simple .env parser
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
    }
});

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY = env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testLogin() {
    console.log("1. Attempting login as argv...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'arvnd14@gmail.com',
        password: 'Aravind@5'
    });

    if (authError) {
        console.error("Login Error:", authError);
        return;
    }

    const userId = authData.user.id;
    console.log("Login Success! User_ID:", userId);

    console.log("\n2. Fetching profile using eq('id', user.id)...");
    const { data: p1, error: e1 } = await supabase.from('profiles').select('*').eq('id', userId);
    console.log("P1 Result:", p1, "Error:", e1);

    console.log("\n3. Fetching profile using eq('user_id', user.id)...");
    const { data: p2, error: e2 } = await supabase.from('profiles').select('*').eq('user_id', userId);
    console.log("P2 Result:", p2, "Error:", e2);
    
    console.log("\n4. Fetching clinic info if clinic_id exists...");
    if (p2 && p2.length > 0 && p2[0].clinic_id) {
       const { data: c1, error: cErr } = await supabase.from('clinics').select('*').eq('id', p2[0].clinic_id);
       console.log("Clinic Data:", c1, "Error:", cErr);
    } else {
       console.log("Skipping clinic fetch, clinic_id is missing or profile doesn't exist.");
    }
}

testLogin();
