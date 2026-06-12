const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createAdminProfile } = require('./services/profileService');

(async () => {
  try {
    const email = 'test-admin-' + Date.now() + '@example.com';
    const result = await createAdminProfile({
      name: 'Test Admin',
      email,
      phone: '+1234567890',
      password: 'StrongP@ssw0rd1',
      createdBy: '00000000-0000-0000-0000-000000000000',
    });
    console.log('createAdminProfile succeeded:', result);
    process.exit(0);
  } catch (e) {
    console.error('createAdminProfile failed:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
