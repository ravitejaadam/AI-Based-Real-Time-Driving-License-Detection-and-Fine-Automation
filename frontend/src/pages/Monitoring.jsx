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
  Info,
  Car,
  Hash,
  BadgeCheck
} from 'lucide-react';
import { cameraService } from '../services/cameraService';
import { detectFrame, getAiHealth } from '../services/detectionService';

const Monitoring = () => {
  const [sourceType, setSourceType] = useState('webcam'); // 'webcam', 'droidcam', 'video'
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [videoFileName, setVideoFileName] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [videoFrameRate, setVideoFrameRate] = useState(30);
  const [fps, setFps] = useState(0);
  const [resolution, setResolution] = useState('0x0');
  const [status, setStatus] = useState('Idle');
  const [aiStatus, setAiStatus] = useState('AI Offline');
  
  const [frameSkip, setFrameSkip] = useState(1);
  const [includePreviews, setIncludePreviews] = useState(false);
  const [ocrThreshold, setOcrThreshold] = useState(0.15);
  const [duplicateWindow, setDuplicateWindow] = useState(5);
  const [healthDetails, setHealthDetails] = useState({ 
    yolo_loaded: false, 
    ocr_loaded: false, 
    plate_model_loaded: false, 
    uptime: '00:00:00' 
  });
  
  const [vehicleCount, setVehicleCount] = useState(0);
  const [detectedVehicles, setDetectedVehicles] = useState([]);
  const [detectedVehicleType, setDetectedVehicleType] = useState('---');
  const [plateNumber, setPlateNumber] = useState('---');
  const [plateConfidence, setPlateConfidence] = useState(0);
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [detectionTimestamp, setDetectionTimestamp] = useState('---');
  const [detectionStatus, setDetectionStatus] = useState('No Plate Found');
  const [vehicleLookup, setVehicleLookup] = useState({
    vehicle_status: 'Not Found',
    vehicle_found: false,
    vehicle_number: '',
    vehicle_type: '',
    owner_name: '',
    owner_email: '',
    owner_phone: '',
    owner_role: '',
    license_number: '',
    license_status: 'Unknown',
    insurance_number: '',
    insurance_status: 'Unknown',
    insurance_expiry_date: '',
    lookup_status: 'idle',
    lookup_message: '',
  });
  
  const [vehicleCropPreview, setVehicleCropPreview] = useState('');
  const [plateCropPreview, setPlateCropPreview] = useState('');
  const [detectionLogs, setDetectionLogs] = useState([]);
  
  const [framesCaptured, setFramesCaptured] = useState(0);
  const [framesProcessed, setFramesProcessed] = useState(0);
  const [framesSentToDetector, setFramesSentToDetector] = useState(0);
  
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const fpsIntervalRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const detectionInFlightRef = useRef(false);
  const overlayCanvasRef = useRef(null);
  const frameCanvasRef = useRef(null);
  const videoObjectUrlRef = useRef('');
  
  // Custom optimization counters
  const frameCounterRef = useRef(0);
  const recentPlatesRef = useRef({}); // plate: timestamp (duplicate filter cache)

  const getStatusTone = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (['valid', 'found', 'active', 'paid'].includes(normalized)) {
      return 'text-green-400 bg-green-500/10 border-green-500/20';
    }
    if (['expired', 'suspended', 'not found', 'invalid plate', 'unknown', 'database unavailable', 'error', 'unavailable'].includes(normalized)) {
      return 'text-red-400 bg-red-500/10 border-red-500/20';
    }
    return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
  };

  const updateResolutionFromVideo = () => {
    const video = videoRef.current;
    if (!video) return;

    const intrinsicWidth = video.videoWidth || video.clientWidth || 0;
    const intrinsicHeight = video.videoHeight || video.clientHeight || 0;

    if (intrinsicWidth > 0 && intrinsicHeight > 0) {
      setResolution(`${intrinsicWidth}x${intrinsicHeight}`);
    }

    if (video.duration && Number.isFinite(video.duration)) {
      setVideoDuration(video.duration);
    }

    try {
      const captureStream = video.captureStream?.();
      const captureTrack = captureStream?.getVideoTracks?.()[0];
      const trackFrameRate = captureTrack?.getSettings?.()?.frameRate;
      if (trackFrameRate && Number.isFinite(trackFrameRate)) {
        setVideoFrameRate(trackFrameRate);
      }
    } catch (error) {
      // Best effort only; fall back to the default frame rate.
    }
  };

  const formatTime = (seconds) => {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const totalSeconds = Math.floor(safeSeconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const getVideoElement = () => videoRef.current;

  const syncVideoState = () => {
    const video = getVideoElement();
    if (!video) return;

    setCurrentTime(video.currentTime || 0);
    setPlaybackSpeed(video.playbackRate || 1);
    setIsVideoPaused(video.paused);
  };

  const scheduleFrameAnalysis = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        captureAndDetectFrame();
      });
    });
  };

  const applyPlaybackSpeed = (speed) => {
    const video = getVideoElement();
    const numericSpeed = Number(speed);
    setPlaybackSpeed(numericSpeed);
    if (video) {
      video.playbackRate = numericSpeed;
    }
  };

  const handleVideoLoadedMetadata = () => {
    updateResolutionFromVideo();
    syncVideoState();
  };

  const handleVideoTimeUpdate = () => {
    syncVideoState();
  };

  const handleVideoSeeked = () => {
    syncVideoState();
    scheduleFrameAnalysis();
  };

  const handleVideoEnded = () => {
    setVideoCompleted(true);
    setIsStreaming(false);
    setIsVideoPaused(false);
    setStatus('Video Completed');
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
  };

  const handleSeekChange = (event) => {
    const nextTime = Number(event.target.value);
    const video = getVideoElement();
    if (!video || !Number.isFinite(nextTime)) return;

    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    scheduleFrameAnalysis();
  };

  const handlePauseVideo = () => {
    const video = getVideoElement();
    if (!video) return;

    video.pause();
    setIsVideoPaused(true);
    syncVideoState();
    scheduleFrameAnalysis();
  };

  const handleResumeVideo = async () => {
    const video = getVideoElement();
    if (!video) return;

    try {
      await video.play();
      setIsVideoPaused(false);
      setVideoCompleted(false);
      setStatus('Streaming (Video)');
      syncVideoState();
    } catch (error) {
      console.error('Unable to resume video playback:', error);
    }
  };

  const handleRestartVideo = async () => {
    const video = getVideoElement();
    if (!video) return;

    video.currentTime = 0;
    setCurrentTime(0);
    setVideoCompleted(false);
    setIsVideoPaused(false);
    setStatus('Streaming (Video)');

    try {
      await video.play();
      syncVideoState();
      scheduleFrameAnalysis();
    } catch (error) {
      console.error('Unable to restart video playback:', error);
    }
  };

  const handleVideoStop = () => {
    handleStop();
    setVideoCompleted(false);
  };

  const seekRelativeFrame = (frameDelta) => {
    const video = getVideoElement();
    if (!video) return;

    const framesPerSecond = videoFrameRate || 30;
    const nextTime = Math.min(
      Math.max(0, (video.currentTime || 0) + frameDelta / framesPerSecond),
      Number.isFinite(video.duration) ? video.duration : (video.currentTime || 0) + frameDelta / framesPerSecond
    );

    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    scheduleFrameAnalysis();
  };

  const handlePreviousFrame = () => {
    if (!isVideoPaused) return;
    seekRelativeFrame(-1);
  };

  const handleNextFrame = () => {
    if (!isVideoPaused) return;
    seekRelativeFrame(1);
  };

  // Perform AI Diagnostics monitoring check periodically
  const checkAiService = async () => {
    try {
      const health = await getAiHealth();
      setHealthDetails(health);
      if (health.status === 'online') {
        setAiStatus('Online');
      } else if (health.status === 'degraded') {
        setAiStatus('Degraded');
      } else {
        setAiStatus('Offline');
      }
    } catch (error) {
      setAiStatus('Offline');
    }
  };

  useEffect(() => {
    refreshDevices();
    checkAiService();
    
    // Periodically poll model readiness
    const healthInterval = setInterval(checkAiService, 5000);
    
    return () => {
      cameraService.stopStream();
      clearInterval(healthInterval);
      if (fpsIntervalRef.current) clearInterval(fpsIntervalRef.current);
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      if (videoObjectUrlRef.current) URL.revokeObjectURL(videoObjectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isStreaming) {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
      clearOverlay();
      return;
    }

    startDetectionLoop();

    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, [isStreaming, sourceType, frameSkip, ocrThreshold, includePreviews, duplicateWindow]);

  const refreshDevices = async () => {
    setStatus('Refreshing devices...');
    const availableDevices = await cameraService.getAvailableDevices();
    setDevices(availableDevices);
    
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

  const clearOverlay = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const resizeOverlay = (width, height) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return null;

    const displayWidth = canvas.clientWidth || width;
    const displayHeight = canvas.clientHeight || height;
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    return { displayWidth, displayHeight };
  };

  const drawOverlay = (detections, frameSize) => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !frameSize?.width || !frameSize?.height) return;

    const context = canvas.getContext('2d');
    const dimensions = resizeOverlay(frameSize.width, frameSize.height);
    if (!dimensions) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate object-contain offsets: the video preserves aspect ratio
    // inside the container, so there may be black bars (letterbox/pillarbox).
    // We need to map detection coords to the actual rendered video area.
    const containerW = canvas.width;
    const containerH = canvas.height;
    const videoNativeW = video?.videoWidth || frameSize.width;
    const videoNativeH = video?.videoHeight || frameSize.height;

    const containerAspect = containerW / containerH;
    const videoAspect = videoNativeW / videoNativeH;

    let renderW, renderH, offsetX, offsetY;
    if (videoAspect > containerAspect) {
      // Video is wider than container → pillarbox (black bars top/bottom)
      renderW = containerW;
      renderH = containerW / videoAspect;
      offsetX = 0;
      offsetY = (containerH - renderH) / 2;
    } else {
      // Video is taller than container → letterbox (black bars left/right)
      renderH = containerH;
      renderW = containerH * videoAspect;
      offsetX = (containerW - renderW) / 2;
      offsetY = 0;
    }

    const scaleX = renderW / frameSize.width;
    const scaleY = renderH / frameSize.height;

    detections.forEach(item => {
      const [x1, y1, x2, y2] = item.bbox;
      const drawX = x1 * scaleX + offsetX;
      const drawY = y1 * scaleY + offsetY;
      const drawWidth = (x2 - x1) * scaleX;
      const drawHeight = (y2 - y1) * scaleY;

      // Draw vehicle box in green
      context.lineWidth = 2;
      context.strokeStyle = '#22c55e';
      context.fillStyle = '#22c55e';
      context.strokeRect(drawX, drawY, drawWidth, drawHeight);

      const label = `${item.vehicle_class.toUpperCase()} ${(item.confidence * 100).toFixed(0)}%`;
      context.font = 'bold 12px sans-serif';
      const labelWidth = context.measureText(label).width + 14;
      const labelHeight = 20;
      context.fillRect(drawX, Math.max(0, drawY - labelHeight), labelWidth, labelHeight);
      context.fillStyle = '#0f172a';
      context.fillText(label, drawX + 7, Math.max(14, drawY - 6));

      item.plates?.forEach((plate) => {
        if (!plate?.bbox) return;
        const [px1, py1, px2, py2] = plate.bbox;
        const drawPx1 = px1 * scaleX + offsetX;
        const drawPy1 = py1 * scaleY + offsetY;
        const drawPw = (px2 - px1) * scaleX;
        const drawPh = (py2 - py1) * scaleY;

        // Draw license plate box in blue
        context.strokeStyle = '#38bdf8';
        context.fillStyle = '#38bdf8';
        context.strokeRect(drawPx1, drawPy1, drawPw, drawPh);
        
        const plateLabel = `PLATE ${(plate.confidence || 0).toFixed(2)}`;
        context.font = 'bold 11px sans-serif';
        const plateLabelWidth = context.measureText(plateLabel).width + 12;
        context.fillRect(drawPx1, Math.max(0, drawPy1 - 18), plateLabelWidth, 18);
        context.fillStyle = '#0f172a';
        context.fillText(plateLabel, drawPx1 + 6, Math.max(12, drawPy1 - 5));
        
        if (plate.ocr?.plate_number && plate.ocr.plate_number !== "Low Conf Plate") {
          context.fillStyle = '#22c55e';
          context.font = 'bold 14px sans-serif';
          context.fillText(plate.ocr.plate_number, drawPx1, py2 * scaleY + offsetY + 16);
        }
      });
    });
  };

  const extractBestPlate = (detections) => {
    let best = null;

    const scorePlate = (plate) => [
      plate?.ocr?.validation === 'PASS' ? 1 : 0,
      Number.isFinite(plate?.ocr?.confidence) ? plate.ocr.confidence : 0,
      Number.isFinite(plate?.confidence) ? plate.confidence : 0,
    ];

    for (const vehicle of detections) {
      const plate = vehicle.plates?.find(item => item.ocr?.plate_number && item.ocr.plate_number !== "Low Conf Plate");
      if (plate) {
        if (!best) {
          best = plate;
          continue;
        }

        const currentScore = scorePlate(plate);
        const bestScore = scorePlate(best);
        if (currentScore[0] > bestScore[0] || currentScore[0] === bestScore[0] && (currentScore[1] > bestScore[1] || currentScore[1] === bestScore[1] && currentScore[2] > bestScore[2])) {
          best = plate;
        }
      }
    }

    if (best) {
      return best;
    }

    for (const vehicle of detections) {
      const plate = vehicle.plates?.[0];
      if (plate && plate.ocr?.plate_number && plate.ocr.plate_number !== "Low Conf Plate") {
        return plate;
      }
    }

    return null;
  };

  const appendDetectionLogs = (frameResult) => {
    const timestamp = new Date().toLocaleTimeString();
    const newLogs = (frameResult.detections || []).flatMap(vehicle => {
      return (vehicle.plates || []).map(plate => {
        const ocr = plate?.ocr || {};
        if (!ocr.plate_number || ocr.plate_number === "Low Conf Plate") return null;

        const plateConfidenceValue = Number.isFinite(plate?.confidence) ? `${Math.round((plate.confidence || 0) * 100)}%` : 'N/A';

        return {
          id: `${timestamp}-${vehicle.vehicle_class}-${Math.random().toString(36).slice(2, 7)}`,
          vehicle: vehicle.vehicle_class,
          vehicleType: ocr.vehicle_type || vehicle.vehicle_class,
          plate: ocr.plate_number,
          plateConfidence: plateConfidenceValue,
          confidence: Number.isFinite(ocr.confidence) ? `${Math.round(ocr.confidence * 100)}%` : `${Math.round(vehicle.confidence * 100)}%`,
          ocrConfidence: Number.isFinite(ocr.confidence) ? `${Math.round(ocr.confidence * 100)}%` : 'N/A',
          status: ocr.detection_status || 'Plate Detected',
          time: timestamp,
        };
      });
    }).filter(Boolean);

    if (newLogs.length === 0) return;

    // Store rolling history cache capped at 20 detections
    setDetectionLogs(prev => {
      const filteredPrev = prev.filter(p => !newLogs.some(n => n.plate === p.plate));
      return [...newLogs, ...filteredPrev].slice(0, 20);
    });
  };

  const startDetectionLoop = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    
    // Check frames periodically
    detectionIntervalRef.current = setInterval(() => {
      captureAndDetectFrame();
    }, 30);
  };

  const captureAndDetectFrame = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    
    // Concurrency lock
    if (detectionInFlightRef.current) return;
    
    // Frame skipping check
    frameCounterRef.current += 1;
    if (frameCounterRef.current % frameSkip !== 0) return;
    
    setFramesCaptured(prev => prev + 1);

    try {
      // 1. Draw to canvas – preserve native aspect ratio (no stretching)
      let canvas = frameCanvasRef.current;
      if (!canvas) {
        canvas = document.createElement('canvas');
        frameCanvasRef.current = canvas;
      }
      
      // Use native video dimensions, capped at 640px width for performance
      const nativeW = video.videoWidth || video.clientWidth || 640;
      const nativeH = video.videoHeight || video.clientHeight || 480;
      const maxWidth = 640;
      const scale = nativeW > maxWidth ? maxWidth / nativeW : 1;
      canvas.width = Math.round(nativeW * scale);
      canvas.height = Math.round(nativeH * scale);
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // 2. Base64 export
      const frameBase64 = canvas.toDataURL('image/jpeg', 0.75);
      
      // 3. API Dispatch
      detectionInFlightRef.current = true;
      setFramesSentToDetector(prev => prev + 1);
      
      const data = await detectFrame(frameBase64, sourceType, {
        original_width: video.videoWidth || video.clientWidth,
        original_height: video.videoHeight || video.clientHeight,
        transferred_width: canvas.width,
        transferred_height: canvas.height,
        displayed_width: video.clientWidth,
        displayed_height: video.clientHeight
      }, {
        ocrThreshold: ocrThreshold,
        includePreviews: includePreviews
      });
      
      detectionInFlightRef.current = false;
      setFramesProcessed(prev => prev + 1);
      
      if (data.error) {
        console.warn('AI pipeline error:', data.error);
        return;
      }
      
      // 4. Overlays
      const origSize = data.frame_size || { width: video.videoWidth, height: video.videoHeight };
      drawOverlay(data.detections || [], origSize);
      
      // 5. Counters
      setVehicleCount(data.vehicle_count || 0);
      setDetectedVehicles(data.detections || []);

      const lookup = data.vehicle_lookup || data.latest_detection || {};
      setVehicleLookup(prev => ({
        ...prev,
        vehicle_status: lookup.vehicle_status || (lookup.vehicle_found ? 'Found' : 'Not Found'),
        vehicle_found: Boolean(lookup.vehicle_found),
        vehicle_number: lookup.vehicle_number || '',
        vehicle_type: lookup.vehicle_type || '',
        owner_name: lookup.owner_name || '',
        owner_email: lookup.owner_email || '',
        owner_phone: lookup.owner_phone || '',
        owner_role: lookup.owner_role || '',
        license_number: lookup.license_number || '',
        license_status: lookup.license_status || 'Unknown',
        insurance_number: lookup.insurance_number || '',
        insurance_status: lookup.insurance_status || 'Unknown',
        insurance_expiry_date: lookup.insurance_expiry_date || '',
        lookup_status: lookup.lookup_status || 'idle',
        lookup_message: lookup.lookup_message || '',
      }));

      setPlateNumber(lookup.vehicle_number || '---');
      setDetectedVehicleType(lookup.vehicle_type || '---');
      setDetectionStatus(lookup.vehicle_status || (lookup.vehicle_found ? 'Found' : 'Not Found'));

      if (lookup.owner_name || lookup.owner_phone || lookup.license_number || lookup.insurance_number) {
        setDetectionTimestamp(data.timestamp || new Date().toLocaleTimeString());
      }
      
      // 6. Previews
      if (includePreviews) {
        setVehicleCropPreview(data.vehicle_crop_preview || '');
        setPlateCropPreview(data.plate_crop_preview || '');
      } else {
        setVehicleCropPreview('');
        setPlateCropPreview('');
      }
      
      // 7. Duplicate filters & log tracking
      const bestPlate = extractBestPlate(data.detections || []);
      if (bestPlate && bestPlate.ocr?.plate_number && bestPlate.ocr.plate_number !== "Low Conf Plate") {
        const plateNum = bestPlate.ocr.plate_number;
        const now = Date.now();
        const lastSeen = recentPlatesRef.current[plateNum] || 0;
        
        if (now - lastSeen < duplicateWindow * 1000) {
          // Ignore duplicates within window
          return;
        }
        
        recentPlatesRef.current[plateNum] = now;
        
        setPlateNumber(plateNum);
        setPlateConfidence(bestPlate.confidence || 0);
        setOcrConfidence(bestPlate.ocr.confidence || 0);
        setDetectedVehicleType(bestPlate.ocr.vehicle_type || '---');
        setDetectionTimestamp(data.timestamp || new Date().toLocaleTimeString());
        setDetectionStatus(data.vehicle_lookup?.vehicle_found ? 'Found' : (bestPlate.ocr.detection_status || 'Plate Detected'));
        
        appendDetectionLogs(data);
      }
    } catch (error) {
      detectionInFlightRef.current = false;
      console.error('Frame analysis failed:', error);
    }
  };

  const handleStart = async () => {
    if (sourceType === 'video') {
      if (videoRef.current && videoFile) {
        videoRef.current.playbackRate = playbackSpeed;
        await videoRef.current.play();
        setVideoCompleted(false);
        setIsVideoPaused(false);
        setIsStreaming(true);
        setStatus('Streaming (Video)');
        startFpsCounter();
        scheduleFrameAnalysis();
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
        await videoRef.current.play();
        setIsStreaming(true);
        setStatus(sourceType === 'droidcam' ? 'Streaming (DroidCam)' : 'Streaming (Webcam)');
        updateResolutionFromVideo();
        
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        if (settings.width && settings.height) {
          setResolution(`${settings.width}x${settings.height}`);
        }
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
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    setFps(0);
    clearOverlay();
    setIsVideoPaused(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (videoObjectUrlRef.current) {
        URL.revokeObjectURL(videoObjectUrlRef.current);
      }

      const url = URL.createObjectURL(file);
      videoObjectUrlRef.current = url;
      setVideoFile(url);
      setVideoFileName(file.name);
      setVideoDuration(0);
      setCurrentTime(0);
      setPlaybackSpeed(1);
      setIsVideoPaused(false);
      setVideoCompleted(false);
      setVideoFrameRate(30);
      setSourceType('video');
      handleStop(); // Stop current stream if any
    }
  };

  const startFpsCounter = () => {
    if (fpsIntervalRef.current) clearInterval(fpsIntervalRef.current);
    fpsIntervalRef.current = setInterval(() => {
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

          {/* Cropped Previews */}
          {includePreviews && (vehicleCropPreview || plateCropPreview) && (
            <div className="absolute right-4 top-16 z-10 w-44 space-y-3">
              {vehicleCropPreview ? (
                <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md p-2 shadow-lg shadow-black/30">
                  <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-gray-400">Vehicle Crop</div>
                  <img
                    src={vehicleCropPreview}
                    alt="Detected vehicle crop"
                    className="h-24 w-full rounded-xl object-cover border border-white/10 bg-black"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              ) : null}
              {plateCropPreview ? (
                <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md p-2 shadow-lg shadow-black/30">
                  <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-gray-400">OCR Crop</div>
                  <img
                    src={plateCropPreview}
                    alt="Detected license plate crop"
                    className="h-24 w-full rounded-xl object-cover border border-white/10 bg-black"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              ) : null}
            </div>
          )}

          {/* Video Container */}
          <div className="aspect-video bg-black flex items-center justify-center relative">
            <canvas ref={overlayCanvasRef} className="absolute inset-0 z-10 h-full w-full pointer-events-none" />
            
            {sourceType === 'video' && videoFile ? (
              <video 
                ref={videoRef} 
                src={videoFile} 
                className="w-full h-full object-contain"
                loop
                muted
                onLoadedMetadata={handleVideoLoadedMetadata}
                onCanPlay={updateResolutionFromVideo}
                onLoadedData={updateResolutionFromVideo}
                onTimeUpdate={handleVideoTimeUpdate}
                onSeeked={handleVideoSeeked}
                onEnded={handleVideoEnded}
              />
            ) : (
              <video 
                ref={videoRef} 
                className="w-full h-full object-contain"
                autoPlay 
                playsInline
                muted
                onLoadedMetadata={updateResolutionFromVideo}
                onCanPlay={updateResolutionFromVideo}
                onLoadedData={updateResolutionFromVideo}
              />
            )}
            
            {videoCompleted ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-20">
                <Activity size={48} className="text-gray-400 mb-4" />
                <p className="text-gray-200 font-semibold">Video Completed</p>
                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={handleRestartVideo}
                    className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-xl font-bold transition-all"
                  >
                    Replay
                  </button>
                  <button
                    onClick={handleVideoStop}
                    className="bg-white/10 hover:bg-white/15 text-white px-5 py-2 rounded-xl font-bold transition-all"
                  >
                    Stop
                  </button>
                </div>
              </div>
            ) : !isStreaming && (
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

          {sourceType === 'video' && (
            <div className="px-4 pb-4 space-y-3 border-t border-white/5 bg-surface">
              <div className="flex flex-wrap items-center gap-2 pt-4">
                <button
                  onClick={handlePauseVideo}
                  disabled={!isStreaming || isVideoPaused}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-200 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm font-semibold"
                >
                  Pause
                </button>
                <button
                  onClick={handleResumeVideo}
                  disabled={!isStreaming || !isVideoPaused}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-200 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm font-semibold"
                >
                  Resume
                </button>
                <button
                  onClick={handleRestartVideo}
                  disabled={!videoFile}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-200 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm font-semibold"
                >
                  Restart
                </button>
                <button
                  onClick={handlePreviousFrame}
                  disabled={!isVideoPaused}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-200 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm font-semibold"
                >
                  Previous Frame
                </button>
                <button
                  onClick={handleNextFrame}
                  disabled={!isVideoPaused}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-200 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm font-semibold"
                >
                  Next Frame
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max={Number.isFinite(videoDuration) && videoDuration > 0 ? videoDuration : 0}
                    step="0.01"
                    value={Math.min(currentTime, videoDuration || currentTime)}
                    onChange={handleSeekChange}
                    disabled={!videoFile || videoCompleted}
                    className="w-full accent-primary"
                  />
                  <span className="text-xs text-gray-400 font-medium whitespace-nowrap w-[120px] text-right">
                    {formatTime(currentTime)} / {formatTime(videoDuration)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-400 font-semibold whitespace-nowrap">Playback Speed</label>
                  <select
                    value={playbackSpeed}
                    onChange={(e) => applyPlaybackSpeed(e.target.value)}
                    className="bg-background border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4].map(speed => (
                      <option key={speed} value={speed}>
                        {speed}x
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Source Settings & Detection Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-6 items-stretch">
          <div className="bg-surface border border-white/5 rounded-2xl p-6 h-full">
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
                    {videoFileName || (videoFile ? 'Video Loaded Successfully' : 'No video selected...')}
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

              <div className="grid grid-cols-2 gap-3 pb-2">
                <div className="bg-background/60 border border-white/10 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Duration</p>
                  <p className="text-sm font-semibold">{formatTime(videoDuration)}</p>
                </div>
                <div className="bg-background/60 border border-white/10 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Resolution</p>
                  <p className="text-sm font-semibold">{resolution}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-white/5 rounded-2xl p-6 h-full">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity size={16} />
              Real-time Performance
            </h3>
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Processing Latency</p>
                  <p className="text-xl font-bold">AI {aiStatus}</p>
                </div>
                <div className="flex items-center gap-1 text-green-500 text-xs font-bold">
                  <Zap size={14} fill="currentColor" />
                  LIVE PIPELINE
                </div>
              </div>
              <div className="h-2 bg-background rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[75%] rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
              </div>

              {/* Advanced AI Health Status Indicators */}
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 pt-2 border-t border-white/5 text-[10px] text-gray-400 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${healthDetails.yolo_loaded ? 'bg-green-500 shadow-[0_0_6px_#22c55e]' : 'bg-red-500'}`}></span>
                  YOLOv8 Vehicles
                </div>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${healthDetails.plate_model_loaded ? 'bg-green-500 shadow-[0_0_6px_#22c55e]' : 'bg-red-500'}`}></span>
                  YOLOv8 Plate
                </div>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${healthDetails.ocr_loaded ? 'bg-green-500 shadow-[0_0_6px_#22c55e]' : 'bg-red-500'}`}></span>
                  EasyOCR Engine
                </div>
                <div className="flex items-center gap-2 text-gray-500 font-semibold lowercase">
                  uptime: {healthDetails.uptime || '00:00:00'}
                </div>
              </div>

              <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-tighter pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  VEHICLES: {vehicleCount}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  DETECTIONS: {detectedVehicles.length}
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                <div>Frames Captured: {framesCaptured}</div>
                <div>Frames Sent: {framesSentToDetector}</div>
                <div>Frames Processed: {framesProcessed}</div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                <div>{detectionStatus}</div>
                <div>{detectionTimestamp !== '---' ? detectionTimestamp : 'Awaiting plate'}</div>
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
              Live Detection Log ({detectionLogs.length}/20)
            </h3>
            <button className="text-gray-500 hover:text-white">
              <MoreVertical size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {isStreaming ? (
              detectionLogs.length > 0 ? detectionLogs.map(item => (
                <div key={item.id} className="bg-background/40 border border-white/5 rounded-xl p-3 hover:border-primary/30 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                      <Car size={10} />
                      {item.vehicleType || item.vehicle}
                    </span>
                    <span className="text-[10px] text-gray-500">{item.time}</span>
                  </div>
                  <p className="text-sm font-bold text-white mb-1 group-hover:text-primary transition-colors flex items-center gap-2">
                    <Hash size={14} className="text-gray-500" />
                    {item.plate}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                      <BadgeCheck size={10} />
                      Plate Confidence
                    </span>
                    <span className="text-[10px] text-gray-200">{item.plateConfidence}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                      <BadgeCheck size={10} />
                      OCR Confidence
                    </span>
                    <span className="text-[10px] text-gray-200">{item.ocrConfidence}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-gray-400 uppercase tracking-wider">
                    {item.status}
                  </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                  <Activity size={32} className="mb-2" />
                  <p className="text-xs font-medium">Waiting for detections...</p>
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

        {/* Quick Stats Summary */}
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">Session Summary</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold">{vehicleCount}</p>
              <p className="text-[10px] text-gray-500 font-medium">Vehicles Detected</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">{plateNumber}</p>
              <p className="text-[10px] text-gray-500 font-medium">Vehicle Number</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-[10px] text-gray-400 uppercase tracking-wider">
            <span>Vehicle Type: {detectedVehicleType}</span>
            <span>Plate: {Math.round(plateConfidence * 100)}%</span>
            <span>OCR: {Math.round(ocrConfidence * 100)}%</span>
            <span>AI: {aiStatus}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Monitoring;
