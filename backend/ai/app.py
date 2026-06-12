import os
import sys
import time
import base64
import numpy as np
import cv2
from flask import Flask, request, jsonify
from datetime import datetime

# Add the current folder to python path to resolve imports cleanly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from detection_manager import DetectionManager

app = Flask(__name__)

# Start timestamp to track uptime
start_time = time.time()
detection_manager = None
init_error = None

# Initialize detection manager
try:
    detection_manager = DetectionManager()
except Exception as e:
    init_error = str(e)
    print(f"CRITICAL INITIALIZATION ERROR: {e}")

def get_uptime():
    """
    Computes uptime as a string formatted HH:MM:SS
    """
    diff = int(time.time() - start_time)
    hours, remainder = divmod(diff, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

@app.route('/health', methods=['GET', 'POST'])
def health():
    """
    Detailed system health monitoring endpoint.
    """
    global detection_manager, init_error
    
    yolo_loaded = False
    plate_model_loaded = False
    ocr_loaded = False
    status_str = "online"
    
    if init_error is not None:
        status_str = "degraded"
    elif detection_manager is not None:
        try:
            yolo_loaded = detection_manager.vehicle_detector.model is not None
            plate_model_loaded = detection_manager.plate_detector.model_loaded
            ocr_loaded = detection_manager.ocr_engine.reader is not None
        except Exception as e:
            status_str = "degraded"
            init_error = str(e)
            
    return jsonify({
        "status": status_str,
        "yolo_loaded": yolo_loaded,
        "ocr_loaded": ocr_loaded,
        "plate_model_loaded": plate_model_loaded,
        "uptime": get_uptime(),
        "error": init_error
    })

@app.route('/detect', methods=['POST'])
def detect():
    """
    Receives base64-encoded frame and processes vehicle and plate OCR detections.
    """
    global detection_manager
    if detection_manager is None:
        return jsonify({
            "error": "AI Engine is not initialized",
            "details": init_error or "Unknown initialization error"
        }), 503
        
    try:
        data = request.json or {}
        frame_base64 = data.get("frame", "")
        ocr_threshold = float(data.get("ocr_threshold", 0.40))
        include_previews = bool(data.get("include_previews", False))
        
        if not frame_base64:
            return jsonify({
                "error": "Missing 'frame' data in request body"
            }), 400
            
        # Decode base64 image to OpenCV format
        if "," in frame_base64:
            frame_base64 = frame_base64.split(",")[1]
            
        img_data = base64.b64decode(frame_base64)
        nparr = np.frombuffer(img_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None or frame.size == 0:
            return jsonify({
                "error": "Corrupted or invalid base64 image data"
            }), 400
            
        # Run detection pipeline
        results = detection_manager.process_frame(
            frame, 
            ocr_threshold=ocr_threshold, 
            include_previews=include_previews
        )
        
        return jsonify(results)
        
    except Exception as e:
        print(f"Inference pipeline execution failure: {e}")
        return jsonify({
            "error": "Inference processing error occurred",
            "details": str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('AI_SERVICE_PORT', 8000))
    # Run server on local loopback to avoid external network exposures
    print(f"Starting Python Traffic AI Service on port {port}...")
    app.run(host='127.0.0.1', port=port, debug=False)
