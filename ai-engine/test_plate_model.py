import os
from ultralytics import YOLO
import logging

logging.basicConfig(level=logging.INFO)

print("Testing Hugging Face model...")
model = YOLO("keremberke/yolov8n-license-plate-detection")
print("Model loaded! Class names:", model.names)
