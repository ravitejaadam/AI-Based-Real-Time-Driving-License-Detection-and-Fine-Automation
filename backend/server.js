const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const authRoutes = require('./api/authRoutes');
const adminRoutes = require('./api/adminRoutes');
const vehicleRoutes = require('./api/vehicleRoutes');
const { findVehicleByNumber } = require('./services/vehicleService');
const { getOwnerDetails } = require('./services/profileService');

const app = express();
const PORT = process.env.BACKEND_PORT || 5000;
const AI_SERVICE_PORT = process.env.AI_SERVICE_PORT || 8000;
const AI_SERVICE_URL = `http://127.0.0.1:${AI_SERVICE_PORT}`;
const AI_ENGINE_DIR = path.join(__dirname, 'ai');

let aiProcess = null;
let isShuttingDown = false;
let restartTimer = null;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api', vehicleRoutes);

function startAiService() {
  if (aiProcess) {
    return aiProcess;
  }

  const pythonCommand = process.env.PYTHON_CMD || (process.platform === 'win32' ? 'python' : 'python3');
  aiProcess = spawn(pythonCommand, ['app.py'], {
    cwd: AI_ENGINE_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      AI_SERVICE_PORT,
    },
  });

  aiProcess.on('exit', (code, signal) => {
    aiProcess = null;
    if (!isShuttingDown) {
      console.log(`AI service stopped (${signal || code}). Restarting...`);
      clearTimeout(restartTimer);
      restartTimer = setTimeout(startAiService, 2000);
    }
  });

  return aiProcess;
}

async function forwardToAiService(pathname, payload) {
  const response = await fetch(`${AI_SERVICE_URL}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error || data?.message || 'AI service request failed';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

function extractPlateNumber(detectionPayload) {
  const latestDetection = detectionPayload?.latest_detection || {};
  const nestedPlate = detectionPayload?.latest_detection?.ocr?.plate_number;
  const candidate = latestDetection.vehicle_number || latestDetection.plate_number || nestedPlate || '';

  return String(candidate).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function createLookupSummary(vehicleResult, ownerResult) {
  const vehicle = vehicleResult?.vehicle || null;
  const owner = ownerResult?.owner || null;

  return {
    vehicle_status: vehicle ? 'Found' : 'Not Found',
    vehicle_found: Boolean(vehicle),
    vehicle_number: vehicle?.vehicle_number || vehicleResult?.normalizedVehicleNumber || '',
    vehicle_type: vehicle?.vehicle_type || '',
    owner_name: owner?.name || '',
    owner_email: owner?.email || '',
    owner_phone: owner?.phone || '',
    owner_role: owner?.role || '',
    owner_id: owner?.id || null,
    vehicle_id: vehicle?.id || null,
    user_id: vehicle?.user_id || null,
    license_number: vehicle?.license_number || '',
    license_status: vehicle?.license_status || 'Unknown',
    insurance_number: vehicle?.insurance_number || '',
    insurance_status: vehicle?.insurance_status || 'Unknown',
    insurance_expiry_date: vehicle?.insurance_expiry_date || '',
    lookup_status: ownerResult?.status || vehicleResult?.status || 'not_found',
    lookup_message: ownerResult?.message || vehicleResult?.message || '',
  };
}

async function enrichDetectionWithLookup(detectionData) {
  const plateNumber = extractPlateNumber(detectionData);
  if (!plateNumber) {
    return {
      vehicle_status: 'Not Found',
      vehicle_found: false,
      lookup_status: 'no_plate',
      lookup_message: 'No valid plate number detected',
    };
  }

  const vehicleResult = await findVehicleByNumber(plateNumber);
  if (vehicleResult.status !== 'found') {
    return {
      vehicle_status: vehicleResult.status === 'invalid_plate'
        ? 'Invalid Plate'
        : vehicleResult.status === 'unavailable'
          ? 'Database Unavailable'
          : 'Not Found',
      vehicle_found: false,
      vehicle_number: vehicleResult.normalizedVehicleNumber || plateNumber,
      vehicle_type: '',
      owner_name: '',
      owner_email: '',
      owner_phone: '',
      owner_role: '',
      owner_id: null,
      vehicle_id: null,
      user_id: null,
      license_number: '',
      license_status: 'Unknown',
      insurance_number: '',
      insurance_status: 'Unknown',
      insurance_expiry_date: '',
      lookup_status: vehicleResult.status,
      lookup_message: vehicleResult.message || '',
    };
  }

  const ownerResult = await getOwnerDetails(vehicleResult.vehicle.user_id);
  return createLookupSummary(vehicleResult, ownerResult);
}

app.get('/api/status', async (req, res) => {
  let aiStatus = 'starting';

  try {
    const healthResponse = await fetch(`${AI_SERVICE_URL}/health`);
    const healthData = await healthResponse.json();
    aiStatus = healthData.status === 'ok' ? 'online' : 'degraded';
  } catch (error) {
    aiStatus = 'offline';
  }

  res.json({
    status: 'Backend server is running',
    aiService: aiStatus,
    aiServiceUrl: AI_SERVICE_URL,
  });
});

app.get('/api/ai/health', async (req, res) => {
  try {
    const data = await forwardToAiService('/health', {});
    res.json(data);
  } catch (error) {
    res.status(503).json({
      error: 'AI service unavailable',
      details: error.message,
    });
  }
});

app.post('/api/ai/detect-frame', async (req, res) => {
  try {
    const meta = req.body?.frame_meta || {};
    console.log('Frame Received');
    console.log('Frame transfer verification:', JSON.stringify({
      original: {
        width: meta.original_width || null,
        height: meta.original_height || null,
      },
      transferred: {
        width: meta.transferred_width || null,
        height: meta.transferred_height || null,
      },
      displayed: {
        width: meta.displayed_width || null,
        height: meta.displayed_height || null,
      },
    }));
    const data = await forwardToAiService('/detect', req.body || {});
    const detectionCount = data?.detections?.length ?? data?.vehicle_count ?? 0;
    console.log(`Detection Count: ${detectionCount}`);
    console.log(`Detections sent to frontend: ${detectionCount}`);

    const lookup = await enrichDetectionWithLookup(data);
    const enrichedResponse = {
      ...data,
      vehicle_lookup: lookup,
      latest_detection: {
        ...(data?.latest_detection || {}),
        ...lookup,
      },
    };

    const responseStatus = lookup.lookup_status === 'unavailable' ? 503 : 200;
    res.status(responseStatus).json(enrichedResponse);
  } catch (error) {
    console.error('Detection forwarding failed:', error.message);
    res.status(error.status || 503).json({
      error: 'Detection service unavailable',
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
  startAiService();
});

process.on('SIGINT', () => {
  isShuttingDown = true;
  clearTimeout(restartTimer);
  if (aiProcess) {
    aiProcess.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  isShuttingDown = true;
  clearTimeout(restartTimer);
  if (aiProcess) {
    aiProcess.kill();
  }
  process.exit(0);
});
