
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function rescueData() {
  const dummy_id = '00000000-0000-0000-0000-000000000000';
  const actual_clinic_id = '9087544f-87ea-467b-9392-b336a9cf03fe';
  
  console.log('Using Clinic ID:', actual_clinic_id);

  // Rescue patients
  const { data: pData, error: pError } = await supabase
    .from('patients')
    .update({ clinic_id: actual_clinic_id })
    .or(`clinic_id.is.null,clinic_id.eq.${dummy_id}`)
    .select('id');
    
  console.log('Patients rescued:', pData?.length || 0, pError || 'No error');

  // Rescue visits
  const { data: vData, error: vError } = await supabase
    .from('visits')
    .update({ clinic_id: actual_clinic_id })
    .or(`clinic_id.is.null,clinic_id.eq.${dummy_id}`)
    .select('id');

  console.log('Visits rescued:', vData?.length || 0, vError || 'No error');

  // Verify those 3 patients
  const { data: patients } = await supabase
    .from('patients')
    .select('registration_id, name, clinic_id')
    .in('registration_id', ['2600812', '2600811', '2600810']);
    
  console.log('Restoration Check:', JSON.stringify(patients, null, 2));
}

rescueData();
