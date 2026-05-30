import os
import base64
import logging
from typing import Optional
import numpy as np
import cv2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from detection.vehicle_detector import VehicleDetector
from detection.plate_detector import PlateDetector

logging.basicConfig(level=logging.INFO, format='%(asctime)s [AI] %(levelname)s %(message)s')

app = FastAPI(title='YOLOv8 Vehicle & License Plate Detection Engine')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

class DetectionRequest(BaseModel):
    image: str

class DetectionResponse(BaseModel):
    vehicles: list
    plates: list
    fps: float
    error: Optional[str] = None

VEHICLE_MODEL_FILE = os.path.join(os.path.dirname(__file__), 'models', 'yolov8n.pt')
PLATE_MODEL_FILE = os.path.join(os.path.dirname(__file__), 'models', 'license-plate-detector.pt')

vehicle_detector = None
plate_detector = None

@app.on_event('startup')
async def startup_event():
    global vehicle_detector, plate_detector
    try:
        vehicle_detector = VehicleDetector(VEHICLE_MODEL_FILE)
        plate_detector = PlateDetector(PLATE_MODEL_FILE)
        logging.info('AI Service ready (vehicle + plate detection).')
    except Exception as error:
        logging.exception('Failed to initialize detectors')
        vehicle_detector = None
        plate_detector = None

@app.get('/health')
async def health():
    return {
        'status': 'ok' if (vehicle_detector is not None and plate_detector is not None) else 'error',
        'python': True,
        'model_loaded': (vehicle_detector is not None and plate_detector is not None),
    }

@app.post('/detect', response_model=DetectionResponse)
async def detect(request: DetectionRequest):
    if vehicle_detector is None or plate_detector is None:
        logging.error('Detection request received before models were loaded')
        raise HTTPException(status_code=503, detail='AI models not ready')

    image_data = request.image
    if not image_data:
        raise HTTPException(status_code=400, detail='Missing image payload')

    try:
        frame = decode_image(image_data)
    except Exception as error:
        logging.exception('Invalid frame data received')
        raise HTTPException(status_code=400, detail='Invalid image data') from error

    try:
        # Detect vehicles
        vehicles, fps = vehicle_detector.detect(frame)
        
        # Detect and read plates
        plates, plate_crops, plate_crops_base64 = plate_detector.detect_and_read_plate(frame, vehicles)

        # Attach base64 to plates
        for i, plate in enumerate(plates):
            if i < len(plate_crops_base64):
                plate["image"] = plate_crops_base64[i]
        
        return {'vehicles': vehicles, 'plates': plates, 'fps': fps, 'error': None}
    except Exception as error:
        logging.exception('Detection failed')
        raise HTTPException(status_code=500, detail='Detection failed') from error

def decode_image(payload: str):
    if payload.startswith('data:image'):
        payload = payload.split(',', 1)[1]

    payload = payload.strip().replace('\n', '').replace('\r', '')
    image_bytes = base64.b64decode(payload)
    image_np = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(image_np, cv2.IMREAD_COLOR)

    if frame is None:
        raise ValueError('Unable to decode image')

    return frame

if __name__ == '__main__':
    import uvicorn

    logging.info('Starting Python AI service on http://127.0.0.1:8001')
    uvicorn.run('app:app', host='127.0.0.1', port=8001, log_level='info')
