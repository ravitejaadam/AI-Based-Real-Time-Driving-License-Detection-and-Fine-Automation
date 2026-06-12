const { supabase, supabaseConfigError, isSupabaseConfigured } = require('../config/supabase');

async function logAdminAction(adminId, action, actorId = null) {
  if (!isSupabaseConfigured) {
    return;
  }

  const payload = {
    admin_id: adminId,
    action,
    created_at: new Date().toISOString(),
  };

  if (actorId) {
    payload.deleted_by = actorId;
  }

  try {
    await supabase.from('admin_activity').insert([payload]);
  } catch (error) {
    console.error('Unable to log admin activity:', error.message || error);
  }
}

module.exports = {
  logAdminAction,
};
