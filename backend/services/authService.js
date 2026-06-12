const { createClient } = require('@supabase/supabase-js');
const { supabase, supabaseUrl, supabaseServiceRoleKey, supabaseConfigError, isSupabaseConfigured } = require('../config/supabase');
const { getProfileById } = require('./profileService');

function buildError(message, status = 401) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function createAuthClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw buildError('Supabase authentication client is not configured.', 503);
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: () => null,
        setItem: () => null,
        removeItem: () => null,
      },
    },
  });
}

async function loginUser(email, password) {
  if (!isSupabaseConfigured) {
    throw buildError(supabaseConfigError, 503);
  }

  const authClient = createAuthClient();
  console.log('loginUser called for email:', email);
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  console.log('Auth result:', { hasData: !!data, hasError: !!error, errorMsg: error?.message });

  if (error) {
    console.error('Auth error:', error.message);
    throw buildError(error.message || 'Invalid email or password.', 401);
  }

  if (!data?.session || !data?.user) {
    console.error('Invalid session or user data');
    throw buildError('Unable to establish authentication session.', 401);
  }

  console.log('Auth successful, userId:', data.user.id);
  const profileResult = await getProfileById(data.user.id);
  console.log('Profile query result:', { status: profileResult.status, hasProfile: !!profileResult.profile });

  if (profileResult.status !== 'found' || !profileResult.profile) {
    console.error('Profile not found');
    throw buildError('No user profile could be located. Contact the Super Administrator.', 403);
  }

  const profile = profileResult.profile;
  console.log('Profile:', profile);
  console.log('Role:', profile?.role);
  console.log('Status:', profile?.status);

  if (profile.status === 'inactive') {
    console.error('Account inactive');
    throw buildError('Your account has been deactivated.', 403);
  }

  if (profile.status === 'suspended') {
    console.error('Account suspended');
    throw buildError('Your account has been suspended. Contact the Super Administrator.', 403);
  }

  if (!['admin', 'super_admin'].includes(profile.role)) {
    console.error('Invalid role:', profile.role);
    throw buildError('This account does not have permission to access the Traffic Monitoring System.', 403);
  }

  console.log('All validations passed, returning profile');
  return {
    profile: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      status: profile.status,
    },
    session: data.session,
  };
}

async function validateToken(token) {
  if (!isSupabaseConfigured) {
    throw buildError(supabaseConfigError, 503);
  }

  const authClient = createAuthClient();
  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data?.user) {
    throw buildError('Session expired or invalid. Please login again.', 401);
  }

  const profileResult = await getProfileById(data.user.id);

  if (profileResult.status !== 'found' || !profileResult.profile) {
    throw buildError('No user profile could be located. Contact the Super Administrator.', 403);
  }

  const profile = profileResult.profile;

  if (profile.status === 'inactive') {
    throw buildError('Your account has been deactivated.', 403);
  }

  if (profile.status === 'suspended') {
    throw buildError('Your account has been suspended. Contact the Super Administrator.', 403);
  }

  if (!['admin', 'super_admin'].includes(profile.role)) {
    throw buildError('This account does not have permission to access the Traffic Monitoring System.', 403);
  }

  return {
    profile: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      status: profile.status,
    },
  };
}

async function requireSuperAdminToken(token) {
  const result = await validateToken(token);

  if (result.profile.role !== 'super_admin') {
    throw buildError('Only Super Admin accounts may access this resource.', 403);
  }

  return result.profile;
}

module.exports = {
  loginUser,
  validateToken,
  requireSuperAdminToken,
};
