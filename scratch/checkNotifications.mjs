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
    console.log("Fetching notifications...");
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log(data);
    }
}

run();
