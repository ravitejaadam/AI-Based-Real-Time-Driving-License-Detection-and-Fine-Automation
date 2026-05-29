/**
 * Service to handle camera and video stream management
 */
class CameraService {
  constructor() {
    this.stream = null;
  }

  async getAvailableDevices() {
    try {
      // If labels are empty, we need to request permission first
      let devices = await navigator.mediaDevices.enumerateDevices();
      let hasLabels = devices.some(d => d.label);

      if (!hasLabels) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          // Close the dummy stream immediately
          stream.getTracks().forEach(track => track.stop());
          // Enumerate again, labels should be populated now
          devices = await navigator.mediaDevices.enumerateDevices();
        } catch (e) {
          console.warn('Permission denied or no camera available for label population');
        }
      }

      return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('Error enumerating devices:', error);
      return [];
    }
  }

  async startStream(deviceId = null) {
    this.stopStream();
    
    const constraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('stream connected');
      return this.stream;
    } catch (error) {
      console.error('stream failed', error);
      throw error;
    }
  }

  stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
    }
  }

  isDroidCam(label) {
    if (!label) return false;
    return label.toLowerCase().includes('droidcam');
  }
}

export const cameraService = new CameraService();
