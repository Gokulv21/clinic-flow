import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function loadEnv() {
    const envFile = fs.readFileSync('.env', 'utf8');
    const env = {};
    envFile.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) {
            env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
        }
    });
    return env;
}

const env = loadEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const CLINIC_ID = '9087544f-87ea-467b-9392-b336a9cf03fe';
const STAFF_USER_ID = '8e79d79c-39be-46e3-8e68-2192ceae38b3'; // staff@gvclinic.com
const PATIENT_ID = '6d3b4822-7777-4a0b-9390-50d4f24ef3b0'; // standard test patient

async function run() {
    // Find a valid patient
    console.log("Finding a valid patient...");
    const { data: patients } = await supabase.from('patients').select('id').limit(1);
    if (!patients || patients.length === 0) {
        console.error("No patients found in DB");
        return;
    }
    const patientId = patients[0].id;
    console.log("Using Patient ID:", patientId);

    console.log("Inserting visit with created_by set...");
    const { data, error } = await supabase.from('visits').insert({
        patient_id: patientId,
        token_number: 999,
        clinic_id: CLINIC_ID,
        created_by: STAFF_USER_ID
    }).select();

    if (error) {
        console.error("Insert Error:", error);
    } else {
        console.log("Inserted Visit:", data);
        // Clean up
        await supabase.from('visits').delete().eq('id', data[0].id);
        console.log("Cleaned up test visit");
    }
}

run();
