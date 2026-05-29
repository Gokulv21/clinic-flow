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
    console.log("Testing SQL RPC...");
    const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
    console.log("exec_sql result:", data, "Error:", error);

    const { data: data2, error: error2 } = await supabase.rpc('execute_sql', { sql: 'SELECT 1' });
    console.log("execute_sql result:", data2, "Error:", error2);
}

run();
