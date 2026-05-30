const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;
const PYTHON_PORT = process.env.PYTHON_PORT || 8001;
const AI_ENGINE_PATH = path.join(__dirname, '../ai-engine/app.py');
const SCREENSHOTS_DIR = path.join(__dirname, 'storage/screenshots');
const LOGS_DIR = path.join(__dirname, 'storage/logs');
const DETECTION_LOG_FILE = path.join(LOGS_DIR, 'detections.json');
const UNIQUE_PLATES_FILE = path.join(LOGS_DIR, 'unique_plates.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

let pythonProcess = null;
let pythonReady = false;
let pythonError = null;

// Load existing detection logs
let detectionLogs = [];
if (fs.existsSync(DETECTION_LOG_FILE)) {
    try {
        detectionLogs = JSON.parse(fs.readFileSync(DETECTION_LOG_FILE, 'utf8'));
    } catch (e) {
        console.error('Error loading detection logs:', e);
    }
}

// Load unique plates (for duplicate filtering)
let uniquePlates = new Map(); // plateNumber -> lastSeenTimestamp
if (fs.existsSync(UNIQUE_PLATES_FILE)) {
    try {
        const platesData = JSON.parse(fs.readFileSync(UNIQUE_PLATES_FILE, 'utf8'));
        uniquePlates = new Map(Object.entries(platesData));
    } catch (e) {
        console.error('Error loading unique plates:', e);
    }
}

// Save detection logs to file
function saveDetectionLogs() {
    try {
        fs.writeFileSync(DETECTION_LOG_FILE, JSON.stringify(detectionLogs, null, 2));
    } catch (e) {
        console.error('Error saving detection logs:', e);
    }
}

// Save unique plates to file
function saveUniquePlates() {
    try {
        fs.writeFileSync(UNIQUE_PLATES_FILE, JSON.stringify(Object.fromEntries(uniquePlates), null, 2));
    } catch (e) {
        console.error('Error saving unique plates:', e);
    }
}

// Save plate image to file and return the relative path
function savePlateImage(plateText, base64Image) {
    try {
        const timestamp = Date.now();
        const filename = `${plateText || 'plate'}_${timestamp}.jpg`;
        const filepath = path.join(SCREENSHOTS_DIR, filename);
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filepath, buffer);
        return `storage/screenshots/${filename}`;
    } catch (e) {
        console.error('Error saving plate image:', e);
        return null;
    }
}

function checkPythonReady() {
  // Also poll the /health endpoint to confirm
  axios.get(`http://127.0.0.1:${PYTHON_PORT}/health`, { timeout: 2000 })
    .then(response => {
      console.log('Health check response:', response.data);
      if (response.data.model_loaded) {
        pythonReady = true;
        pythonError = null;
        console.log('Python service is now ready!');
      }
    })
    .catch(err => {
      // Ignore errors, just keep trying
    });
}

function spawnPythonService(commandIndex = 0) {
  pythonReady = false;
  pythonError = null;
  const pythonBinaries = process.env.PYTHON_BINARY ? [process.env.PYTHON_BINARY] : ['python', 'python3'];
  if (commandIndex >= pythonBinaries.length) {
    console.error('Unable to launch Python AI service. No Python binary found.');
    return;
  }

  const pythonBinary = pythonBinaries[commandIndex];
  console.log(`Starting Python AI service using ${pythonBinary}`);

  pythonProcess = spawn(pythonBinary, [AI_ENGINE_PATH], {
    cwd: path.dirname(AI_ENGINE_PATH),
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  pythonProcess.stdout.on('data', chunk => {
    const message = chunk.toString();
    process.stdout.write(`[PYTHON] ${message}`);
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('model loaded') || lowerMessage.includes('ai service ready')) {
      pythonReady = true;
      pythonError = null;
      console.log('Detected Python service ready from stdout!');
    }
  });

  pythonProcess.stderr.on('data', chunk => {
    const message = chunk.toString();
    process.stderr.write(`[PYTHON ERROR] ${message}`);
    // Only set pythonError if it's an actual error message
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('model loaded') || lowerMessage.includes('ai service ready')) {
      pythonReady = true;
      pythonError = null;
      console.log('Detected Python service ready from stderr!');
    } else if (lowerMessage.includes('error') || lowerMessage.includes('exception') || lowerMessage.includes('traceback')) {
      pythonError = message;
    }
  });

  pythonProcess.on('error', err => {
    console.error('Python AI service process failed to start:', err.message);
    pythonReady = false;
    pythonError = err.message;
    if (err.code === 'ENOENT') {
      spawnPythonService(commandIndex + 1);
    }
  });

  pythonProcess.on('exit', (code, signal) => {
    pythonReady = false;
    console.log(`Python AI service exited with code=${code} signal=${signal}`);
    if (!pythonError && code !== 0) {
      pythonError = `Process exited unexpectedly with code ${code}`;
    }
  });

  // Poll /health endpoint every 1 second to check if ready
  const healthCheckInterval = setInterval(() => {
    if (pythonProcess && !pythonProcess.killed) {
      checkPythonReady();
    } else {
      clearInterval(healthCheckInterval);
    }
  }, 1000);
}

async function forwardToPython(framePayload) {
  try {
    const response = await axios.post(`http://127.0.0.1:${PYTHON_PORT}/detect`, framePayload, {
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.error('Error forwarding request to Python AI service:', error.message || error);
    throw error;
  }
}

app.get('/api/status', async (req, res) => {
  console.log('Current status - pythonReady:', pythonReady, 'pythonError:', pythonError);
  res.json({
    status: 'Backend server is running',
    python: pythonReady,
    pythonError: pythonError,
    port: PORT,
    pythonPort: PYTHON_PORT,
  });
});

// New endpoint to get detection logs
app.get('/api/detections', async (req, res) => {
  res.json({ logs: detectionLogs });
});

app.post('/api/detect', async (req, res) => {
  const { image, sourceType } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Image payload is required', vehicles: [], plates: [], fps: 0 });
  }

  try {
    const result = await forwardToPython({ image });
    
    // Process plates to save images and log detections
    if (result.plates && Array.isArray(result.plates)) {
      for (const plate of result.plates) {
        const plateText = plate.text;
        if (plateText && plateText.length >= 6) {
          // Check if we already have this plate in the last hour (3600000ms)
          const now = Date.now();
          const lastSeen = uniquePlates.get(plateText);
          const isDuplicate = lastSeen && (now - lastSeen < 3600000);
          
          if (!isDuplicate) {
            let imagePath = null;
            if (plate.image) {
              imagePath = savePlateImage(plateText, plate.image);
            }
            
            const newLog = {
              id: Date.now() + Math.random(),
              plateNumber: plateText,
              confidence: plate.confidence,
              timestamp: new Date().toISOString(),
              sourceType: sourceType || 'unknown',
              imagePath: imagePath,
            };
            
            detectionLogs.unshift(newLog);
            // Keep only last 100 logs
            if (detectionLogs.length > 100) {
              detectionLogs = detectionLogs.slice(0, 100);
            }
            
            // Update unique plates map
            uniquePlates.set(plateText, now);
            
            saveDetectionLogs();
            saveUniquePlates();
          }
        }
      }
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Detection failed', vehicles: [], plates: [], fps: 0 });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
  spawnPythonService();
});
