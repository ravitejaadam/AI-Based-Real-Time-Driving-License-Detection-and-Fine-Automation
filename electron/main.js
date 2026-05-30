const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = require('electron-is-dev');

let backendProcess = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'AI-Based Smart Traffic Monitoring',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(
    isDev
      ? 'http://localhost:5173'
      : `file://${path.join(__dirname, '../frontend/dist/index.html')}`
  );

  if (isDev) {
    win.webContents.openDevTools();
  }
}

function startBackendServer() {
  const backendPath = path.join(__dirname, '../backend/server.js');
  backendProcess = spawn('node', [backendPath], {
    cwd: path.join(__dirname, '../backend'),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout.on('data', data => {
    process.stdout.write(`[BACKEND] ${data.toString()}`);
  });

  backendProcess.stderr.on('data', data => {
    process.stderr.write(`[BACKEND ERROR] ${data.toString()}`);
  });

  backendProcess.on('exit', (code, signal) => {
    console.log(`Backend server exited with code=${code} signal=${signal}`);
    backendProcess = null;
  });
}

function stopBackendServer() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

// IPC Handlers
ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.on('notify', (event, data) => {
  console.log('Notification request:', data);
});

app.whenReady().then(() => {
  startBackendServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopBackendServer();
    app.quit();
  }
});

app.on('quit', () => {
  stopBackendServer();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
