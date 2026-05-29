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
  Info
} from 'lucide-react';
import { cameraService } from '../services/cameraService';

const Monitoring = () => {
  const [sourceType, setSourceType] = useState('webcam'); // 'webcam', 'droidcam', 'video'
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [fps, setFps] = useState(0);
  const [resolution, setResolution] = useState('0x0');
  const [status, setStatus] = useState('Idle');
  
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const fpsIntervalRef = useRef(null);

  useEffect(() => {
    refreshDevices();
    return () => {
      cameraService.stopStream();
      if (fpsIntervalRef.current) clearInterval(fpsIntervalRef.current);
    };
  }, []);

  const refreshDevices = async () => {
    setStatus('Refreshing devices...');
    const availableDevices = await cameraService.getAvailableDevices();
    setDevices(availableDevices);
    
    // Check if DroidCam is among them
    const hasDroid = availableDevices.some(d => cameraService.isDroidCam(d.label));
    
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

  const handleStart = async () => {
    if (sourceType === 'video') {
      if (videoRef.current && videoFile) {
        videoRef.current.play();
        setIsStreaming(true);
        setStatus('Streaming (Video)');
        startFpsCounter();
      }
      return;
    }

    try {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      cameraService.stopStream();

      const selectedDeviceObj = devices.find(d => d.deviceId === selectedDevice);
      if (selectedDeviceObj) {
        console.log('selected camera name:', selectedDeviceObj.label);
      }

      const stream = await cameraService.startStream(selectedDevice);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsStreaming(true);
        setStatus(sourceType === 'droidcam' ? 'Streaming (DroidCam)' : 'Streaming (Webcam)');
        
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        setResolution(`${settings.width}x${settings.height}`);
        startFpsCounter();
      }
    } catch (err) {
      console.error(err);
      setStatus('Error: Camera Access Denied');
    }
  };

  const handleStop = () => {
    if (sourceType === 'video') {
      if (videoRef.current) videoRef.current.pause();
    } else {
      cameraService.stopStream();
      if (videoRef.current) videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setStatus('Stopped');
    if (fpsIntervalRef.current) clearInterval(fpsIntervalRef.current);
    setFps(0);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoFile(url);
      setSourceType('video');
      handleStop(); // Stop current stream if any
    }
  };

  const startFpsCounter = () => {
    if (fpsIntervalRef.current) clearInterval(fpsIntervalRef.current);
    fpsIntervalRef.current = setInterval(() => {
      // Simulate FPS for UI display in Phase 1
      setFps(Math.floor(Math.random() * (31 - 28) + 28));
    }, 1000);
  };

  const handleSourceChange = (type) => {
    handleStop();
    setSourceType(type);
    
    if (type === 'droidcam') {
      const droid = devices.find(d => cameraService.isDroidCam(d.label));
      if (droid) {
        setSelectedDevice(droid.deviceId);
        setStatus('DroidCam Source Selected');
      } else {
        setStatus('DroidCam Not Found - Check Connection');
        // Fallback to first available if droidcam not found but we want to stay in droidcam mode
        // Or we could stay on 'webcam'
      }
    } else if (type === 'webcam') {
      const web = devices.find(d => !cameraService.isDroidCam(d.label));
      if (web) {
        setSelectedDevice(web.deviceId);
        setStatus('Webcam Selected');
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
      {/* Main Video Section */}
      <div className="lg:col-span-3 space-y-6">
        <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden relative group">
          {/* Top Status Bar */}
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

          {/* Video Container */}
          <div className="aspect-video bg-black flex items-center justify-center relative">
            {sourceType === 'video' && videoFile ? (
              <video 
                ref={videoRef} 
                src={videoFile} 
                className="w-full h-full object-contain"
                loop
                muted
              />
            ) : (
              <video 
                ref={videoRef} 
                className="w-full h-full object-contain"
                autoPlay 
                playsInline
                muted
              />
            )}
            
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

          {/* Bottom Controls */}
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
            </div>

            <div className="flex items-center gap-2 bg-background/50 p-1 rounded-xl border border-white/5">
              {[
                { id: 'webcam', icon: Camera, label: 'Webcam' },
                { id: 'droidcam', icon: Smartphone, label: 'DroidCam' },
                { id: 'video', icon: FileVideo, label: 'Video' },
              ].map(type => {
                const isDetected = type.id === 'droidcam' && devices.some(d => cameraService.isDroidCam(d.label));
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
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
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

        {/* Source Settings & Detection Stats */}
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
                  {devices.map(device => (
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
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    accept="video/*" 
                  />
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
                <div className="h-full bg-primary w-[15%] rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  GPU USAGE: 18%
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  RAM USAGE: 240MB
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side Detection Panel */}
      <div className="space-y-6 h-full flex flex-col">
        <div className="bg-surface border border-white/5 rounded-2xl flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
            <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Info size={14} className="text-primary" />
              Live Detection Log
            </h3>
            <button className="text-gray-500 hover:text-white">
              <MoreVertical size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {isStreaming ? (
              [
                { id: 1, vehicle: 'SUV', plate: 'KA-01-MJ-2345', violation: 'Speeding', confidence: '98%', time: '12:45:01' },
                { id: 2, vehicle: 'Bike', plate: 'MH-12-BK-5678', violation: 'No Helmet', confidence: '94%', time: '12:45:08' },
                { id: 3, vehicle: 'Car', plate: 'DL-4C-NA-9012', violation: 'None', confidence: '99%', time: '12:45:12' },
                { id: 4, vehicle: 'Truck', plate: 'HR-26-AB-3456', violation: 'Invalid Lane', confidence: '92%', time: '12:45:22' },
              ].map(item => (
                <div key={item.id} className="bg-background/40 border border-white/5 rounded-xl p-3 hover:border-primary/30 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">
                      {item.vehicle}
                    </span>
                    <span className="text-[10px] text-gray-500">{item.time}</span>
                  </div>
                  <p className="text-sm font-bold text-white mb-1 group-hover:text-primary transition-colors">{item.plate}</p>
                  <div className="flex justify-between items-center">
                    <span className={`text-[10px] font-medium ${item.violation === 'None' ? 'text-gray-500' : 'text-red-500 font-bold'}`}>
                      {item.violation}
                    </span>
                    <span className="text-[10px] text-gray-600">Conf: {item.confidence}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                <Activity size={32} className="mb-2" />
                <p className="text-xs font-medium">Waiting for feed...</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats Summary */}
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">Session Summary</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold">142</p>
              <p className="text-[10px] text-gray-500 font-medium">Vehicles Detected</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">12</p>
              <p className="text-[10px] text-gray-500 font-medium">Violations</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Monitoring;
