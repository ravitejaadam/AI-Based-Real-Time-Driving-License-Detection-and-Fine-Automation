const API_BASE_URL = 'http://localhost:5000';

/**
 * Service to communicate with the Node.js backend AI detection endpoints.
 */

export async function detectFrame(frameDataUrl, sourceType, frameMeta = {}, options = {}) {
  try {
    const ocrThreshold = options.ocrThreshold !== undefined ? options.ocrThreshold : 0.65;
    const includePreviews = options.includePreviews !== undefined ? options.includePreviews : false;

    const response = await fetch(`${API_BASE_URL}/api/ai/detect-frame`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        frame: frameDataUrl,
        source_type: sourceType,
        frame_meta: frameMeta,
        ocr_threshold: ocrThreshold,
        include_previews: includePreviews
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || errorData?.details || 'Frame detection failed');
    }

    return await response.json();
  } catch (error) {
    console.error('API detectFrame failed:', error);
    return {
      detections: [],
      latest_detection: {},
      vehicle_count: 0,
      frame_size: { width: 0, height: 0 },
      timestamp: new Date().toLocaleTimeString(),
      status_message: 'error',
      error: error.message
    };
  }
}

export async function getAiHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/health`);
    if (!response.ok) {
      throw new Error('AI health check failed');
    }
    return await response.json();
  } catch (error) {
    console.error('API getAiHealth failed:', error);
    return {
      status: 'offline',
      yolo_loaded: false,
      ocr_loaded: false,
      plate_model_loaded: false,
      uptime: '00:00:00',
      error: error.message
    };
  }
}