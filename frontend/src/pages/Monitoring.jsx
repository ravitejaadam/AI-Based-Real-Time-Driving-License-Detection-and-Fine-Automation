import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  Upload,
  RefreshCcw,
  Camera,
  Smartphone,
  FileVideo,
  Settings,
  Activity,
  Maximize2,
  MoreVertical,
  Zap,
  FileText,
} from 'lucide-react';
import { cameraService } from '../services/cameraService';
import { detectFrame } from '../services/detectionService';

const DEFAULT_COUNTS = {
  motorcycle: 0,
  car: 0,
  bus: 0,
  truck: 0,
};

const Monitoring = () => {
  const [sourceType, setSourceType] = useState('webcam');
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [videoKey, setVideoKey] = useState(0); // Key to force video element re-mount
  const [loopVideo, setLoopVideo] = useState(false); // Default to no loop
  const [fps, setFps] = useState(0);
  const [resolution, setResolution] = useState('0x0');
  const [status, setStatus] = useState('Idle');
  const [vehicleDetections, setVehicleDetections] = useState([]);
  const [plateDetections, setPlateDetections] = useState([]);
  const [vehicleCounts, setVehicleCounts] = useState({ ...DEFAULT_COUNTS });
  const [plateLogs, setPlateLogs] = useState([]);
  const [lastSeenPlates, setLastSeenPlates] = useState(new Map()); // plateNumber -> timestamp

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const captureCanvasRef = useRef(document.createElement('canvas'));
  const overlayCanvasRef = useRef(null);
  const detectIntervalRef = useRef(null);
  const inFlightRef = useRef(false);
  const oldBlobUrlRef = useRef(null); // Ref to track old blob URL for delayed cleanup

  useEffect(() => {
    refreshDevices();
    return () => {
      cameraService.stopStream();
      stopDetection();
      // Clean up all blob URLs when component unmounts
      if (videoFile) {
        URL.revokeObjectURL(videoFile);
      }
      if (oldBlobUrlRef.current) {
        URL.revokeObjectURL(oldBlobUrlRef.current);
      }
    };
  }, []);

  // Delayed cleanup of old blob URL after video key changes (old element is unmounted)
  useEffect(() => {
    if (oldBlobUrlRef.current) {
      // Wait a little bit to make sure the old video element is fully unmounted
      const timer = setTimeout(() => {
        URL.revokeObjectURL(oldBlobUrlRef.current);
        oldBlobUrlRef.current = null;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [videoKey]);

  // Clean up blob URL when switching away from video source
  useEffect(() => {
    if (sourceType !== 'video' && videoFile) {
      oldBlobUrlRef.current = videoFile;
      setVideoFile(null);
    }
  }, [sourceType, videoFile]);

  const refreshDevices = async () => {
    setStatus('Refreshing devices...');
    const availableDevices = await cameraService.getAvailableDevices();
    setDevices(availableDevices);

    const hasDroid = availableDevices.some((d) => cameraService.isDroidCam(d.label));
    if (hasDroid) {
      console.log('DroidCam detected');
    }

    if (availableDevices.length > 0) {
      if (!selectedDevice) {
        setSelectedDevice(availableDevices[0].deviceId);
      }
      setStatus(hasDroid ? 'DroidCam Detected' : 'Devices Refreshed');
    } else {
      setStatus('No Cameras Found');
    }
  };

  const resetDetectionState = () => {
    setVehicleDetections([]);
    setPlateDetections([]);
    setVehicleCounts({ ...DEFAULT_COUNTS });
    setFps(0);
    setPlateLogs([]);
    setLastSeenPlates(new Map());
    clearOverlay();
  };

  const clearOverlay = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const drawDetections = (vehicles, plates) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !videoRef.current) return;

    const video = videoRef.current;
    const width = video.videoWidth;
    const height = video.videoHeight;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    vehicles.forEach((item) => {
      const [x1, y1, x2, y2] = item.bbox;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.font = '14px Inter, sans-serif';
      const label = `${item.class} ${Math.round(item.confidence * 100)}%`;
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(x1, y1 - 24, textWidth + 14, 24);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x1 + 6, y1 - 8);
    });

    plates.forEach((item) => {
      const [x1, y1, x2, y2] = item.bbox;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.font = 'bold 14px Inter, sans-serif';
      const label = item.text || 'PLATE';
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
      ctx.fillRect(x1, y1 - 28, textWidth + 14, 28);
      ctx.fillStyle = '#000000';
      ctx.fillText(label, x1 + 6, y1 - 10);
    });
  };

  const updateDetectionState = (vehicles, plates, fpsValue) => {
    const counts = { ...DEFAULT_COUNTS };
    vehicles.forEach((item) => {
      if (counts[item.class] !== undefined) {
        counts[item.class] += 1;
      }
    });

    setVehicleDetections(vehicles);
    setPlateDetections(plates);
    setVehicleCounts(counts);
    setFps(fpsValue ? Number(fpsValue.toFixed(1)) : 0);

    const now = Date.now();
    const newLogs = [];
    const updatedLastSeen = new Map(lastSeenPlates);

    plates.forEach((plate) => {
      const plateText = plate.text;
      if (plateText && plateText.length >= 6) {
        const lastSeen = updatedLastSeen.get(plateText);
        const isDuplicate = lastSeen && (now - lastSeen < 3600000); // 1 hour

        if (!isDuplicate) {
          const newLog = {
            id: Date.now() + Math.random(),
            plateNumber: plateText,
            confidence: Math.round(plate.confidence * 100) + '%',
            timestamp: new Date().toLocaleTimeString(),
            source: sourceType.toUpperCase(),
          };
          newLogs.push(newLog);
          updatedLastSeen.set(plateText, now);
        }
      }
    });

    if (newLogs.length > 0) {
      setPlateLogs((prev) => [...newLogs, ...prev].slice(0, 20));
      setLastSeenPlates(updatedLastSeen);
    }

    drawDetections(vehicles, plates);
  };

  const handleDetectionFrame = async () => {
    if (inFlightRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

    inFlightRef.current = true;
    try {
      const canvas = captureCanvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg', 0.65);

      const response = await detectFrame(imageData, sourceType);
      if (response) {
        updateDetectionState(response.vehicles || [], response.plates || [], response.fps);
      }
    } catch (error) {
      console.error('Real-time detection error:', error);
      setStatus('Error: Detection service unavailable');
    } finally {
      inFlightRef.current = false;
    }
  };

  const startDetection = () => {
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
    }
    detectIntervalRef.current = window.setInterval(handleDetectionFrame, 250);
  };

  const stopDetection = () => {
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
      detectIntervalRef.current = null;
    }
    inFlightRef.current = false;
    setIsStreaming(false);
    setFps(0);
  };

  const handleStart = async () => {
    resetDetectionState();

    if (sourceType === 'video') {
      if (videoRef.current && videoFile) {
        try {
          await videoRef.current.play();
          setIsStreaming(true);
          setStatus('Streaming (Video)');
          setResolution(`${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
          startDetection();
        } catch (error) {
          console.error('Video playback failed', error);
          setStatus('Error: Unable to play video');
        }
      }
      return;
    }

    try {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      cameraService.stopStream();

      const stream = await cameraService.startStream(selectedDevice);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
        setStatus(sourceType === 'droidcam' ? 'Streaming (DroidCam)' : 'Streaming (Webcam)');

        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        setResolution(`${settings.width || videoRef.current.videoWidth}x${settings.height || videoRef.current.videoHeight}`);
        startDetection();
      }
    } catch (err) {
      console.error(err);
      setStatus('Error: Camera Access Denied');
    }
  };

  const handleStop = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      if (sourceType !== 'video') {
        videoRef.current.srcObject = null;
      }
    }
    cameraService.stopStream();
    stopDetection();
    setStatus('Stopped');
    resetDetectionState();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Track the old blob URL for delayed cleanup instead of revoking right away
      if (videoFile) {
        oldBlobUrlRef.current = videoFile;
      }
      const url = URL.createObjectURL(file);
      setVideoFile(url);
      setVideoKey(prev => prev + 1); // Force video element to re-mount
      setSourceType('video');
      handleStop();
    }
  };

  const handleSourceChange = (type) => {
    handleStop();
    setSourceType(type);
    setVideoKey(prev => prev + 1); // Force video element re-mount when switching sources

    if (type === 'droidcam') {
      const droid = devices.find((d) => cameraService.isDroidCam(d.label));
      if (droid) {
        setSelectedDevice(droid.deviceId);
        setStatus('DroidCam Source Selected');
      } else {
        setStatus('DroidCam Not Found - Check Connection');
      }
    } else if (type === 'webcam') {
      const web = devices.find((d) => !cameraService.isDroidCam(d.label));
      if (web) {
        setSelectedDevice(web.deviceId);
        setStatus('Webcam Selected');
      }
    } else if (type === 'video') {
      // Switching to video but no file selected yet
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
      <div className="lg:col-span-3 space-y-6">
        <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden relative group">
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full ${isStreaming ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
              <span className="text-xs font-bold uppercase tracking-widest text-white">{status}</span>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-medium text-gray-300">
              <span className="bg-black/40 px-2 py-1 rounded">RES: {resolution}</span>
              <span className="bg-black/40 px-2 py-1 rounded">FPS: {fps}</span>
              <span className="bg-black/40 px-2 py-1 rounded">SOURCE: {sourceType.toUpperCase()}</span>
            </div>
          </div>

          <div className="aspect-video bg-black flex items-center justify-center relative">
            {sourceType === 'video' && videoFile ? (
              <video
                key={`video-${videoKey}`}
                ref={videoRef}
                src={videoFile}
                className="w-full h-full object-contain"
                muted
                loop={loopVideo}
                onError={(e) => {
                  console.error('Video error:', e);
                  // Handle error gracefully
                }}
              />
            ) : (
              <video
                key={`webcam-${videoKey}`}
                ref={videoRef}
                className="w-full h-full object-contain"
                autoPlay
                playsInline
                muted
              />
            )}
            <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
            {!isStreaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                <Camera size={48} className="text-gray-700 mb-4" />
                <p className="text-gray-400 font-medium">Camera Feed Offline</p>
                <button
                  onClick={handleStart}
                  className="mt-6 bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-bold transition-all transform hover:scale-105 flex items-center gap-2"
                >
                  <Play size={20} fill="currentColor" />
                  Initialize Stream
                </button>
              </div>
            )}
          </div>

          <div className="p-4 bg-surface border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={isStreaming ? handleStop : handleStart}
                className={`p-3 rounded-xl transition-all ${
                  isStreaming
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white'
                    : 'bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white'
                }`}
              >
                {isStreaming ? <Square size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              </button>
              <button
                onClick={refreshDevices}
                className="p-3 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all"
              >
                <RefreshCcw size={20} />
              </button>
              {sourceType === 'video' && (
                <button
                  onClick={() => setLoopVideo(!loopVideo)}
                  className={`p-3 rounded-xl transition-all ${
                    loopVideo
                      ? 'bg-primary/20 text-primary hover:bg-primary hover:text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                  title="Toggle loop"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M3 12a9 9 0 0 1 9-9h9v4h-7a5 5 0 0 0-5 5v5a5 5 0 0 0 5 5h2"></path>
                    <polyline points="17 16 21 20 17 24"></polyline>
                  </svg>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 bg-background/50 p-1 rounded-xl border border-white/5">
              {[
                { id: 'webcam', icon: Camera, label: 'Webcam' },
                { id: 'droidcam', icon: Smartphone, label: 'DroidCam' },
                { id: 'video', icon: FileVideo, label: 'Video' },
              ].map((type) => {
                const isDetected = type.id === 'droidcam' && devices.some((d) => cameraService.isDroidCam(d.label));
                return (
                  <button
                    key={type.id}
                    onClick={() => handleSourceChange(type.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all relative ${
                      sourceType === type.id
                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <type.icon size={16} />
                    <span className="hidden sm:inline">{type.label}</span>
                    {isDetected && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button className="p-3 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 transition-all">
                <Maximize2 size={20} />
              </button>
              <button className="p-3 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 transition-all">
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface border border-white/5 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Settings size={16} />
              Stream Configuration
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-2">Select Camera Input</label>
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  disabled={sourceType === 'video'}
                  className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-50"
                >
                  {devices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                  {devices.length === 0 && <option>No Cameras Detected</option>}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-2">Video File Path</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-background border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-400 truncate">
                    {videoFile ? 'Video Loaded Successfully' : 'No video selected...'}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-surface border border-white/10 px-4 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <Upload size={18} />
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="video/*" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-white/5 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity size={16} />
              Real-time Performance
            </h3>
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Processing Latency</p>
                  <p className="text-xl font-bold">12ms</p>
                </div>
                <div className="flex items-center gap-1 text-green-500 text-xs font-bold">
                  <Zap size={14} fill="currentColor" />
                  OPTIMIZED
                </div>
              </div>
              <div className="h-2 bg-background rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[15%] rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  GPU USAGE: 18%
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  RAM USAGE: 240MB
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 h-full flex flex-col">
        <div className="bg-surface border border-white/5 rounded-2xl flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
            <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <FileText size={14} className="text-primary" />
              License Plate Log
            </h3>
            <button 
              onClick={() => {
                setPlateLogs([]);
                setLastSeenPlates(new Map());
              }} 
              className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              Clear Logs
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {isStreaming ? (
              plateLogs.length > 0 ? (
                plateLogs.map((item) => (
                  <div key={item.id} className="bg-background/40 border border-white/5 rounded-xl p-3 hover:border-primary/30 transition-all cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded uppercase">PLATE</span>
                      <span className="text-[10px] text-gray-500">{item.timestamp}</span>
                    </div>
                    <p className="text-sm font-bold text-white mb-1 group-hover:text-primary transition-colors">{item.plateNumber}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-gray-500">Confidence: {item.confidence}</span>
                      <span className="text-[10px] text-gray-500">Source: {item.source}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                  <Activity size={32} className="mb-2" />
                  <p className="text-xs font-medium">No license plates detected</p>
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                <Activity size={32} className="mb-2" />
                <p className="text-xs font-medium">Waiting for feed...</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">Detection Summary</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold">{vehicleCounts.car + vehicleCounts.motorcycle + vehicleCounts.bus + vehicleCounts.truck}</p>
              <p className="text-[10px] text-gray-500 font-medium">Total Vehicles</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{plateLogs.length}</p>
              <p className="text-[10px] text-gray-500 font-medium">Plates Detected</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{vehicleCounts.car}</p>
              <p className="text-[10px] text-gray-500 font-medium">Cars</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{vehicleCounts.motorcycle}</p>
              <p className="text-[10px] text-gray-500 font-medium">Bikes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{fps}</p>
              <p className="text-[10px] text-gray-500 font-medium">Current FPS</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Monitoring;
