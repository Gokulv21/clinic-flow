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
const SUPABASE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log("=== Querying visits table policies ===");
  const { data, error } = await supabase.rpc('pg_eval', { 
    query: `
      SELECT 
        policyname, 
        schemaname, 
        tablename, 
        roles, 
        cmd, 
        qual, 
        with_check 
      FROM 
        pg_policies 
      WHERE 
        tablename = 'visits';
    ` 
  });
  
  if (error) {
    console.error("RPC pg_eval error (might not exist):", error.message);
    
    console.log("Let's try executing using direct sql execution or another script...");
  } else {
    console.log("Active Policies on 'visits':");
    data.forEach(p => {
      console.log(`- Policy: ${p.policyname} | Cmd: ${p.cmd} | Roles: ${p.roles}`);
      console.log(`  Qual: ${p.qual}`);
      console.log(`  With Check: ${p.with_check}`);
    });
  }
}

run();
