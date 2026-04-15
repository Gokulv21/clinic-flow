
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findClinic() {
  const { data: clinics, error } = await supabase.from('clinics').select('*');
  if (error) {
    console.error('Error fetching clinics:', error);
  } else {
    console.log('All clinics:', JSON.stringify(clinics, null, 2));
  }

  const { data: patients, error: pError } = await supabase
    .from('patients')
    .select('registration_id, name, clinic_id')
    .in('registration_id', ['2600812', '2600811', '2600810', '2600813', '2600815']);
  
  console.log('Patients check:', JSON.stringify(patients, null, 2));

  // Check visits for these patients
  const patientIds = [2600812, 2600811, 2600810].map(id => id.toString());
  // Wait, I need the UUIDs
}

findClinic();
