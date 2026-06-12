const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
(async () => {
  const email = 'test-admin-1780379573000@example.com';
  const { data, error } = await supabase.from('profiles').select('*').eq('email', email).maybeSingle();
  console.log({ email, data, error });
})();
