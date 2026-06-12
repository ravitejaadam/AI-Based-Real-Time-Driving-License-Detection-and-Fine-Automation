const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
(async () => {
  try {
    const { data, error } = await supabase.from('profiles').select('id,email,role,status,created_at').limit(50);
    console.log({ error, rows: data?.length, data });
    process.exit(error ? 1 : 0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
