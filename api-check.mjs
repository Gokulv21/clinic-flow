import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Super simple .env parser
function loadEnv() {
    try {
        const envFile = fs.readFileSync('.env', 'utf8');
        const env = {};
        envFile.split('\n').forEach(line => {
            const [key, ...value] = line.split('=');
            if (key && value) {
                env[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
            }
        });
        return env;
    } catch (e) {
        console.error("❌ Error: .env file not found!");
        process.exit(1);
    }
}

const env = loadEnv();
const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY = env['VITE_SUPABASE_ANON_KEY'] || env['VITE_SUPABASE_PUBLISHABLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Error: Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runAudit() {
    console.log("\n🚀 Starting API Health Audit...\n");

    // 1. Connection Test
    console.log("1. Testing Supabase Connectivity...");
    try {
        const start = Date.now();
        const response = await fetch(SUPABASE_URL);
        const duration = Date.now() - start;
        if (response.ok) {
            console.log(`✅ URL Reachable (${duration}ms)`);
        } else {
            console.log(`❌ URL returned status ${response.status}`);
        }
    } catch (e) {
        console.log(`❌ URL Unreachable: ${e.message}`);
    }

    // 2. Auth Test
    console.log("\n2. Testing Auth Service...");
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) {
        console.log(`❌ Auth Error: ${authError.message}`);
    } else {
        console.log("✅ Auth Service is UP");
    }

    // 3. Database Table Audit
    const tables = ['clinics', 'profiles', 'patients', 'visits', 'prescriptions'];
    console.log("\n3. Auditing Database Tables (Anon Access)...");
    
    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) {
            if (error.code === 'PGRST116' || error.code === '42501') {
                console.log(`ℹ️  ${table.padEnd(15)}: Restricted (RLS Active - OK)`);
            } else {
                console.log(`❌ ${table.padEnd(15)}: Error (${error.message})`);
            }
        } else {
            console.log(`✅ ${table.padEnd(15)}: Accessible`);
        }
    }

    // 4. LiveKit Check
    const LIVEKIT_URL = env['VITE_LIVEKIT_URL'];
    if (LIVEKIT_URL) {
        console.log("\n4. Testing LiveKit Connectivity...");
        const httpUrl = LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://');
        try {
            const response = await fetch(httpUrl);
            console.log(`✅ LiveKit reachability check passed`);
        } catch (e) {
            console.log(`❌ LiveKit URL unreachable`);
        }
    }

    console.log("\n🏁 Audit Complete!\n");
}

runAudit();

