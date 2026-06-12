const { supabase, supabaseConfigError, isSupabaseConfigured } = require('../config/supabase');

const profileCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

function getCachedValue(cacheKey) {
  const cached = profileCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    profileCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function setCachedValue(cacheKey, value) {
  profileCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

async function getOwnerDetails(userId) {
  if (!userId) {
    return {
      status: 'invalid_user',
      message: 'Missing user id',
      owner: null,
    };
  }

  const cacheKey = String(userId);
  const cached = getCachedValue(cacheKey);
  if (cached) {
    return {
      status: 'found',
      cacheHit: true,
      owner: cached,
    };
  }

  if (!isSupabaseConfigured) {
    return {
      status: 'unavailable',
      message: supabaseConfigError,
      owner: null,
    };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, phone, role')
    .eq('id', userId)
    .maybeSingle();

  console.log('Owner Query:', { userId, data, error });
  if (error) {
    console.error('Owner Error:', error);
    return {
      status: 'error',
      message: error.message,
      owner: null,
    };
  }

  if (!data) {
    return {
      status: 'not_found',
      message: 'Owner not found',
      owner: null,
    };
  }

  const owner = {
    id: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: data.role,
  };

  setCachedValue(cacheKey, owner);

  return {
    status: 'found',
    cacheHit: false,
    owner,
  };
}

async function getProfileById(profileId) {
  if (!profileId) {
    console.error('getProfileById: Missing profile id');
    return {
      status: 'invalid_id',
      message: 'Missing profile id',
      profile: null,
    };
  }

  console.log('getProfileById: Querying profile for id:', profileId);

  if (!isSupabaseConfigured) {
    console.error('getProfileById: Supabase not configured');
    return {
      status: 'unavailable',
      message: supabaseConfigError,
      profile: null,
    };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, phone, role, status, created_by, created_at')
    .eq('id', profileId)
    .maybeSingle();

  console.log('getProfileById: Query result:', { hasData: !!data, hasError: !!error, errorMsg: error?.message });

  if (error) {
    console.error('getProfileById: Query error:', error.message);
    return {
      status: 'error',
      message: error.message,
      profile: null,
    };
  }

  if (!data) {
    console.error('getProfileById: Profile not found for id:', profileId);
    return {
      status: 'not_found',
      message: 'Profile not found',
      profile: null,
    };
  }

  console.log('getProfileById: Profile found:', { id: data.id, name: data.name, role: data.role, status: data.status });
  return {
    status: 'found',
    profile: data,
  };
}

async function getProfileByEmail(email) {
  if (!email) {
    return {
      status: 'invalid_email',
      message: 'Missing email address',
      profile: null,
    };
  }

  if (!isSupabaseConfigured) {
    return {
      status: 'unavailable',
      message: supabaseConfigError,
      profile: null,
    };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, phone, role, status, created_by, created_at')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (error) {
    return {
      status: 'error',
      message: error.message,
      profile: null,
    };
  }

  if (!data) {
    return {
      status: 'not_found',
      message: 'Profile not found',
      profile: null,
    };
  }

  return {
    status: 'found',
    profile: data,
  };
}

async function getAdmins() {
  if (!isSupabaseConfigured) {
    throw new Error(supabaseConfigError);
  }

  const queryDetails = {
    table: 'profiles',
    select: 'id, name, email, phone, status, created_at',
    filter: { role: 'admin' },
    order: { created_at: 'desc' },
  };

  console.log('Supabase getAdmins query:', queryDetails);

  const { data, error } = await supabase
    .from('profiles')
    .select(queryDetails.select)
    .eq('role', queryDetails.filter.role)
    .order('created_at', { ascending: false });

  console.log('Supabase getAdmins response:', {
    records: Array.isArray(data) ? data.length : (data ? 1 : 0),
    sample: Array.isArray(data) ? data.slice(0, 5) : data,
    error: error || null,
  });

  console.log('Admin Query:', data);
  console.log('Admin Error:', error);

  if (error) {
    throw new Error(error.message || 'Unable to fetch admin profiles.');
  }

  return data || [];
}

async function createAdminProfile({ name, email, phone, password, createdBy }) {
  if (!isSupabaseConfigured) {
    throw new Error(supabaseConfigError);
  }

  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone ? phone.trim() : '';

  if (!normalizedName || !normalizedEmail || !password) {
    throw new Error('Name, email, and password are required.');
  }

  const { data: existingProfileByEmail, error: existingProfileByEmailError } = await supabase
    .from('profiles')
    .select('id, role, status')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingProfileByEmailError) {
    throw new Error(existingProfileByEmailError.message || 'Failed to validate existing profile email.');
  }

  if (existingProfileByEmail) {
    throw new Error('Administrator already exists.');
  }

  if (supabase?.auth?.admin?.listUsers) {
    const { data: existingUsers, error: existingUsersError } = await supabase.auth.admin.listUsers({ email: normalizedEmail });

    if (existingUsersError) {
      console.warn('Unable to verify auth user existence before creation:', existingUsersError.message || existingUsersError);
    } else {
      const matchingAuthUser = existingUsers?.users?.find(
        (user) => String(user?.email || '').toLowerCase() === normalizedEmail
      );

      if (matchingAuthUser) {
        throw new Error('Administrator already exists.');
      }
    }
  }

  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      name: normalizedName,
      phone: normalizedPhone,
    },
  });

  if (userError) {
    throw new Error(userError.message || 'Failed to create authentication user.');
  }

  if (!userData?.user?.id) {
    throw new Error('Authentication user creation returned an invalid id.');
  }

  const newAuthUserId = userData.user.id;
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', newAuthUserId)
    .maybeSingle();

  const profilePayload = {
    name: normalizedName,
    email: normalizedEmail,
    phone: normalizedPhone,
    role: 'admin',
    status: 'active',
    created_by: createdBy,
  };

  let profileData = null;
  let profileError = null;

  if (existingProfile) {
    const { data, error } = await supabase
      .from('profiles')
      .update(profilePayload)
      .eq('id', newAuthUserId)
      .select('*')
      .maybeSingle();

    profileData = data;
    profileError = error;
  } else {
    const insertPayload = {
      id: newAuthUserId,
      ...profilePayload,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('profiles')
      .insert([insertPayload])
      .select('*')
      .maybeSingle();

    profileData = data;
    profileError = error;
  }

  if (profileError || !profileData) {
    try {
      await supabase.auth.admin.deleteUser(newAuthUserId);
    } catch (cleanupError) {
      console.error('Cleanup failed after profile save error:', cleanupError.message || cleanupError);
    }

    throw new Error(profileError?.message || 'Failed to save admin profile.');
  }

  return profileData;
}

async function updateAdminStatus(adminId, status) {
  if (!isSupabaseConfigured) {
    throw new Error(supabaseConfigError);
  }

  const { error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', adminId)
    .eq('role', 'admin');

  if (error) {
    throw new Error(error.message || 'Unable to update admin status.');
  }
}

async function deleteAdminProfile(adminId, deletedBy) {
  if (!isSupabaseConfigured) {
    throw new Error(supabaseConfigError);
  }

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', adminId)
    .maybeSingle();

  if (existingProfileError) {
    throw new Error(existingProfileError.message || 'Unable to verify admin profile.');
  }

  if (!existingProfile) {
    throw new Error('Admin account not found.');
  }

  if (existingProfile.role === 'super_admin') {
    throw new Error('Super Admin accounts cannot be deleted.');
  }

  if (existingProfile.role !== 'admin') {
    throw new Error('Only administrator accounts may be deleted.');
  }

  // Fetch related admin_activity rows so we can restore on failure if needed
  let activityBackup = [];
  try {
    const { data: fetchedActivities, error: fetchActErr } = await supabase
      .from('admin_activity')
      .select('*')
      .eq('admin_id', adminId);

    if (fetchActErr) {
      console.warn('Unable to fetch admin_activity backup before delete:', fetchActErr.message || fetchActErr);
    } else if (Array.isArray(fetchedActivities) && fetchedActivities.length > 0) {
      activityBackup = fetchedActivities;
    }
  } catch (err) {
    console.warn('Failed to back up admin_activity rows:', err.message || err);
  }

  // Delete related admin_activity records to avoid FK constraint errors
  try {
    console.log(`Deleting admin_activity records for admin ${adminId}, backupCount=${activityBackup.length}`);
    const { error: deleteActivityError } = await supabase
      .from('admin_activity')
      .delete()
      .eq('admin_id', adminId);

    if (!deleteActivityError) {
      console.log(`Deleted admin_activity records for admin ${adminId}`);
    }

    if (deleteActivityError) {
      throw new Error(deleteActivityError.message || 'Failed to delete related admin activity logs.');
    }
  } catch (err) {
    throw new Error(err.message || 'Failed to remove related admin activity before profile deletion.');
  }

  const { error: deleteProfileError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', adminId)
    .eq('role', 'admin');

  if (deleteProfileError) {
    throw new Error(deleteProfileError.message || 'Failed to delete admin profile.');
  }

  console.log(`Deleted profile for admin ${adminId}`);

  if (!supabase?.auth?.admin?.deleteUser) {
    throw new Error('Unable to delete authentication user.');
  }

  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(adminId);

  if (authDeleteError) {
    // Attempt to restore the profile and any backed-up activity rows
    try {
      await supabase.from('profiles').insert([existingProfile]);

      if (activityBackup.length > 0) {
        try {
          // Reinsert activity rows (remove any id to let DB assign new ones if required)
          const restorePayload = activityBackup.map((r) => {
            const copy = { ...r };
            delete copy.id;
            return copy;
          });
          await supabase.from('admin_activity').insert(restorePayload);
        } catch (restoreActErr) {
          console.error('Failed to restore admin_activity after auth deletion failure:', restoreActErr.message || restoreActErr);
        }
      }
    } catch (restoreError) {
      console.error('Failed to restore profile after auth deletion failure:', restoreError.message || restoreError);
    }

    if (authDeleteError.status === 404 || String(authDeleteError.message).toLowerCase().includes('not found')) {
      throw new Error('Authentication user not found. The admin profile was restored.');
    }

    throw new Error(authDeleteError.message || 'Failed to delete authentication user.');
  }
}

async function insertProfile(profileData) {
  if (!isSupabaseConfigured) {
    throw new Error(supabaseConfigError);
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert([profileData])
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Unable to insert profile.');
  }

  return data;
}

module.exports = {
  getOwnerDetails,
  getProfileById,
  getProfileByEmail,
  getAdmins,
  createAdminProfile,
  updateAdminStatus,
  deleteAdminProfile,
  insertProfile,
};