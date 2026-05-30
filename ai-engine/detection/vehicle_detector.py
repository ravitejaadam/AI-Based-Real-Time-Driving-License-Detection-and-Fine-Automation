import os
import time
import logging
import cv2
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO, format='%(asctime)s [Detector] %(levelname)s %(message)s')

VALID_CLASSES = {'motorcycle', 'car', 'bus', 'truck'}

class VehicleDetector:
    def __init__(self, weights_path: str):
        if not os.path.exists(weights_path):
            raise FileNotFoundError(f'YOLO model file not found: {weights_path}')

        logging.info('Loading YOLOv8 model from %s', weights_path)
        self.model = YOLO(weights_path)
        self.names = self.model.names
        self.allowed_classes = {
            class_id
            for class_id, class_name in self.names.items()
            if class_name in VALID_CLASSES
        }

        if not self.allowed_classes:
            raise RuntimeError('No valid YOLO classes found for vehicle detection')

        logging.info('Valid vehicle classes: %s', [self.names[c] for c in self.allowed_classes])

    def detect(self, frame):
        start_time = time.time()
        frame = self._resize_frame(frame, target_width=640)
        results = self.model(frame, imgsz=640, conf=0.35, iou=0.45, classes=list(self.allowed_classes), verbose=False)
        elapsed = time.time() - start_time
        fps = 1.0 / max(elapsed, 1e-6)

        detections = []
        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                class_id = int(box.cls[0])
                if class_id not in self.allowed_classes:
                    continue
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    'class': self.names[class_id],
                    'confidence': float(box.conf[0]),
                    'bbox': [int(x1), int(y1), int(x2), int(y2)],
                })

        logging.info('Detected %d vehicles in %.2f ms', len(detections), elapsed * 1000)
        return detections, fps

    def _resize_frame(self, frame, target_width=640):
        height, width = frame.shape[:2]
        if width <= target_width:
            return frame
        scale = target_width / float(width)
        new_height = int(height * scale)
        return cv2.resize(frame, (target_width, new_height), interpolation=cv2.INTER_AREA)
