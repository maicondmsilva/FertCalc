import { supabase } from './src/services/supabase';

async function check() {
  const { data, error } = await supabase.from('pricing_records').select('deletion_request').limit(1);
  console.log('pricing_records deletion_request:', error ? error.message : 'OK');
  
  const { data: d2, error: e2 } = await supabase.from('app_users').select('managed_user_ids').limit(1);
  console.log('app_users managed_user_ids:', e2 ? e2.message : 'OK');
}

check();
