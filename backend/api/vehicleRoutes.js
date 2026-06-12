const express = require('express');
const { findVehicleByNumber, getAllVehicles } = require('../services/vehicleService');
const { getOwnerDetails } = require('../services/profileService');

const router = express.Router();

function buildVehicleResponse(vehicleResult, ownerResult) {
  const vehicle = vehicleResult.vehicle || {};
  const owner = ownerResult?.owner || null;

  return {
    vehicle_number: vehicle.vehicle_number,
    vehicle_type: vehicle.vehicle_type,
    license_status: vehicle.license_status,
    insurance_status: vehicle.insurance_status,
    vehicle_id: vehicle.id || null,
    user_id: vehicle.user_id || null,
    license_number: vehicle.license_number || null,
    insurance_number: vehicle.insurance_number || null,
    insurance_expiry_date: vehicle.insurance_expiry_date || null,
    owner,
    vehicle_found: vehicleResult.status === 'found',
    status: vehicleResult.status,
    message: vehicleResult.message || null,
  };
}

router.get('/vehicle/:number', async (req, res) => {
  try {
    const { number } = req.params;
    const vehicleResult = await findVehicleByNumber(number);

    if (vehicleResult.status !== 'found') {
      const statusCode = vehicleResult.status === 'invalid_plate'
        ? 400
        : vehicleResult.status === 'unavailable'
          ? 503
          : 404;

      return res.status(statusCode).json({
        vehicle_number: vehicleResult.normalizedVehicleNumber || '',
        vehicle_type: null,
        license_status: null,
        insurance_status: null,
        vehicle_found: false,
        status: vehicleResult.status,
        message: vehicleResult.message || 'Vehicle not found',
      });
    }

    const ownerResult = await getOwnerDetails(vehicleResult.vehicle.user_id);
    return res.json(buildVehicleResponse(vehicleResult, ownerResult));
  } catch (error) {
    return res.status(503).json({
      status: 'error',
      message: 'Vehicle lookup failed',
      details: error.message,
    });
  }
});

router.get('/vehicles', async (req, res) => {
  try {
    console.log('GET /api/vehicles request:', {
      query: req.query,
      headers: { authorization: req.headers.authorization ? '[redacted]' : 'none' },
    });

    const result = await getAllVehicles();

    console.log('getAllVehicles result:', {
      status: result.status,
      message: result.message || null,
      records: Array.isArray(result.vehicles) ? result.vehicles.length : 0,
      sample: Array.isArray(result.vehicles) ? result.vehicles.slice(0, 3) : null,
    });

    if (result.status !== 'found') {
      const statusCode = result.status === 'unavailable' ? 503 : 500;
      console.error('getAllVehicles failed:', result);
      return res.status(statusCode).json({
        error: 'Unable to load vehicle records',
        details: result.message || 'Vehicle lookup failed',
      });
    }

    console.log(`Sending ${result.vehicles.length} vehicles to client`);
    return res.json(result.vehicles);
  } catch (error) {
    console.error('GET /api/vehicles catch error:', {
      message: error.message || error,
      stack: error.stack,
    });
    return res.status(503).json({
      error: 'Unable to load vehicle records',
      details: error.message,
    });
  }
});

module.exports = router;