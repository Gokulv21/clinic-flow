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

async function run() {
    console.log("Fetching latest visit...");
    const { data, error } = await supabase
        .from('visits')
        .select('*, patients(*)')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error:", error);
    } else {
        data.forEach(v => {
            console.log(`Visit ID: ${v.id}, Patient: ${v.patients?.name}, Token: ${v.token_number}, Created_By: ${v.created_by}`);
        });
    }
}

run();
