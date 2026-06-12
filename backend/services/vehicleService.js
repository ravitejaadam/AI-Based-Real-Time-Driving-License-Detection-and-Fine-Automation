const { supabase, supabaseConfigError, isSupabaseConfigured } = require('../config/supabase');

const vehicleCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

function normalizeVehicleNumber(vehicleNumber) {
  return String(vehicleNumber || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function isValidVehicleNumber(vehicleNumber) {
  return /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,2}[0-9]{4}$/.test(vehicleNumber);
}

function getCachedValue(cacheKey) {
  const cached = vehicleCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    vehicleCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function setCachedValue(cacheKey, value) {
  vehicleCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

async function findVehicleByNumber(vehicleNumber) {
  const normalizedVehicleNumber = normalizeVehicleNumber(vehicleNumber);

  if (!normalizedVehicleNumber) {
    return {
      status: 'invalid_plate',
      message: 'Invalid plate number',
      vehicle: null,
      normalizedVehicleNumber,
    };
  }

  if (!isValidVehicleNumber(normalizedVehicleNumber)) {
    return {
      status: 'invalid_plate',
      message: 'Invalid plate number format',
      vehicle: null,
      normalizedVehicleNumber,
    };
  }

  const cacheKey = normalizedVehicleNumber;
  const cached = getCachedValue(cacheKey);
  if (cached) {
    return {
      status: 'found',
      cacheHit: true,
      vehicle: cached,
      normalizedVehicleNumber,
    };
  }

  if (!isSupabaseConfigured) {
    return {
      status: 'unavailable',
      message: supabaseConfigError,
      vehicle: null,
      normalizedVehicleNumber,
    };
  }

  const { data, error } = await supabase
    .from('vehicles')
    .select('id, user_id, vehicle_number, vehicle_type, license_number, license_status, insurance_number, insurance_status, insurance_expiry_date')
    .eq('vehicle_number', normalizedVehicleNumber)
    .maybeSingle();

  if (error) {
    return {
      status: 'error',
      message: error.message,
      vehicle: null,
      normalizedVehicleNumber,
    };
  }

  if (!data) {
    return {
      status: 'not_found',
      message: 'Vehicle not found',
      vehicle: null,
      normalizedVehicleNumber,
    };
  }

  const vehicle = {
    id: data.id,
    user_id: data.user_id,
    vehicle_number: data.vehicle_number,
    vehicle_type: data.vehicle_type,
    license_number: data.license_number,
    license_status: data.license_status,
    insurance_number: data.insurance_number,
    insurance_status: data.insurance_status,
    insurance_expiry_date: data.insurance_expiry_date,
  };

  setCachedValue(cacheKey, vehicle);

  return {
    status: 'found',
    cacheHit: false,
    vehicle,
    normalizedVehicleNumber,
  };
}

async function getAllVehicles() {
  if (!isSupabaseConfigured) {
    return {
      status: 'unavailable',
      message: supabaseConfigError,
      vehicles: [],
    };
  }

  const queryDetails = {
    table: 'vehicles',
    select: 'vehicle_number, vehicle_type, user_id, owner:profiles(id,name)',
    order: { created_at: 'desc' },
  };

  console.log('Supabase getAllVehicles query:', queryDetails);

  const { data, error } = await supabase
    .from('vehicles')
    .select(queryDetails.select)
    .order('created_at', { ascending: false });

  console.log('Vehicle Query:', {
    records: Array.isArray(data) ? data.length : (data ? 1 : 0),
    sample: Array.isArray(data) ? data.slice(0, 5) : data,
    error: error || null,
  });

  console.log('Supabase getAllVehicles response:', {
    records: Array.isArray(data) ? data.length : (data ? 1 : 0),
    sample: Array.isArray(data) ? data.slice(0, 5) : data,
    error: error || null,
  });

  if (error) {
    console.error('Vehicle Error:', error);
    console.error('Supabase getAllVehicles query error details:', {
      message: error.message,
      code: error.code,
      hint: error.hint,
      details: error.details,
    });
  }

  if (error) {
    return {
      status: 'error',
      message: error.message,
      vehicles: [],
    };
  }

  const vehicles = (data || []).map((item) => {
    const ownerProfile = item.owner || null;
    const ownerName = ownerProfile?.name || 'Unknown Owner';

    console.log('Owner Profile:', ownerProfile);

    return {
      vehicle_number: item.vehicle_number || '',
      vehicle_type: item.vehicle_type || '',
      owner_name: ownerName,
      owner_profile: ownerProfile,
    };
  });

  return {
    status: 'found',
    vehicles,
  };
}

module.exports = {
  findVehicleByNumber,
  getAllVehicles,
  normalizeVehicleNumber,
};