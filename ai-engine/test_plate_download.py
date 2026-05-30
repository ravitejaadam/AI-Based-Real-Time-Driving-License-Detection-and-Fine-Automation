
import urllib.request
import os
from ultralytics import YOLO

plate_model_path = os.path.join(os.path.dirname(__file__), 'models', 'license-plate-detector.pt')

if not os.path.exists(plate_model_path):
    os.makedirs(os.path.dirname(plate_model_path), exist_ok=True)
    model_url = "https://github.com/sergiovirahonda/AutomaticNumberPlateRecognition-YOLOv8/releases/download/1.0.0/best.pt"
    print(f"Downloading model from {model_url}...")
    urllib.request.urlretrieve(model_url, plate_model_path)
    print("Model downloaded! Now loading...")

model = YOLO(plate_model_path)
print("Model loaded successfully!")
