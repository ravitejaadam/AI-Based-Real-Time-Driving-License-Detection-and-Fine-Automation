
import os
import cv2
import numpy as np
import easyocr
import base64
import urllib.request
import re
from ultralytics import YOLO
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [PlateDetector] %(levelname)s %(message)s')

class PlateDetector:
    def __init__(self, plate_model_path: str):
        if not os.path.exists(plate_model_path):
            # Try to download a pre-trained license plate model from GitHub
            try:
                logging.info("Downloading pre-trained license plate detection model...")
                model_url = "https://github.com/sergiovirahonda/AutomaticNumberPlateRecognition-YOLOv8/releases/download/1.0.0/best.pt"
                urllib.request.urlretrieve(model_url, plate_model_path)
                self.plate_model = YOLO(plate_model_path)
                logging.info("Successfully downloaded license plate model!")
            except Exception as e:
                logging.warning(f"Failed to download model: {e}. Using vehicle detection fallback.")
                self.plate_model = None
        else:
            self.plate_model = YOLO(plate_model_path)
        
        # Initialize EasyOCR for English (supports Indian plates)
        self.reader = easyocr.Reader(['en'], gpu=False)
        # Regex pattern for Indian license plates (supports common formats)
        self.indian_plate_pattern = re.compile(r'^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$')
        
        # Common OCR substitutions for better accuracy
        self.ocr_substitutions = {
            'O': '0', 'Q': '0', 'D': '0',
            'I': '1', 'L': '1', 'J': '1',
            'Z': '2',
            'E': '3',
            'A': '4',
            'S': '5',
            'G': '6', 'C': '6',
            'T': '7',
            'B': '8',
            'F': '8',
            'g': '9', 'q': '9'
        }
    
    def preprocess_plate_image(self, plate_img: np.ndarray) -> np.ndarray:
        # Preprocess plate image for better OCR
        # 1. Resize to at least 400px width (even bigger for OCR)
        height, width = plate_img.shape[:2]
        if width < 400:
            scale = 400 / width
            new_width = 400
            new_height = int(height * scale)
            plate_img = cv2.resize(plate_img, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
        
        # 2. Convert to grayscale
        gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
        
        # 3. Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
        
        # 4. Apply bilateral filter to reduce noise while keeping edges
        blurred = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # 5. Apply thresholding (multiple methods)
        _, thresh_otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        thresh_adaptive = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                               cv2.THRESH_BINARY_INV, 21, 8)
        
        # Combine both threshold results
        thresh = cv2.bitwise_or(thresh_otsu, thresh_adaptive)
        
        # 6. Apply morphological operations to clean up
        kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        morph = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel_close)
        
        kernel_open = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        morph = cv2.morphologyEx(morph, cv2.MORPH_OPEN, kernel_open)
        
        # 7. Denoise
        denoised = cv2.fastNlMeansDenoising(morph, None, 20, 7, 21)
        
        # 8. Dilate to make characters thicker
        kernel_dilate = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        dilated = cv2.dilate(denoised, kernel_dilate, iterations=1)
        
        return dilated

    def clean_and_validate_plate(self, text: str) -> str:
        # Convert to uppercase
        text = text.upper()
        
        # Remove any non-alphanumeric characters
        text = re.sub(r'[^A-Z0-9]', '', text)
        
        # Apply OCR substitutions (try multiple passes)
        def apply_substitutions(t):
            new_text = []
            for char in t:
                new_text.append(self.ocr_substitutions.get(char, char))
            return ''.join(new_text)
        
        # Try multiple substitution passes
        cleaned = apply_substitutions(text)
        for _ in range(2):
            cleaned = apply_substitutions(cleaned)
        
        # Validate against Indian license plate pattern
        if self.indian_plate_pattern.match(cleaned):
            return cleaned
        
        # If not valid, try to fix common length issues
        if len(cleaned) < 8:
            return None
        if len(cleaned) > 10:
            # Try to truncate to valid length (common formats are 9 or 10 chars)
            if len(cleaned) >= 9:
                cleaned = cleaned[:10]
        
        # One last validation try
        if self.indian_plate_pattern.match(cleaned):
            return cleaned
        
        # If still not valid, return the cleaned text if it's reasonable (6-12 chars)
        if 6 <= len(cleaned) <= 12:
            return cleaned
        
        return None

    def encode_image(self, img: np.ndarray) -> str:
        # Encode numpy array (OpenCV image) to base64 JPEG
        _, buffer = cv2.imencode('.jpg', img)
        return base64.b64encode(buffer).decode('utf-8')
    
    def detect_and_read_plate(self, img: np.ndarray, vehicle_detections=None):
        plates = []
        plate_crops = []
        plate_crops_base64 = []

        if self.plate_model:
            # Use dedicated plate detection model
            results = self.plate_model(img, conf=0.3, verbose=False)
            for result in results:
                if result.boxes is None:
                    continue
                for box in result.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    confidence = float(box.conf[0])

                    # Crop plate
                    x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                    plate_crop = img[y1:y2, x1:x2]

                    if plate_crop.size == 0:
                        continue

                    # Preprocess and OCR
                    processed_plate = self.preprocess_plate_image(plate_crop)
                    ocr_results = self.reader.readtext(processed_plate, detail=0, paragraph=False)

                    # Combine OCR results
                    raw_text = ''.join(ocr_results)
                    # Clean and validate
                    plate_text = self.clean_and_validate_plate(raw_text)

                    if plate_text:
                        # Encode plate crop to base64
                        plate_crop_base64 = self.encode_image(plate_crop)

                        # Store plate data
                        plates.append({
                            "class": "license-plate",
                            "confidence": confidence,
                            "bbox": [x1, y1, x2, y2],
                            "text": plate_text,
                            "text_confidence": 0.8
                        })
                        plate_crops.append(plate_crop)
                        plate_crops_base64.append(plate_crop_base64)
        elif vehicle_detections:
            # No plate model: try OCR on bottom 30-40% of each detected vehicle
            for vehicle in vehicle_detections:
                vx1, vy1, vx2, vy2 = vehicle["bbox"]
                # Use bottom 35% of vehicle for plate candidate
                plate_height = (vy2 - vy1) * 0.35
                px1 = vx1 + (vx2 - vx1) * 0.05  # Slight padding on left
                py1 = vy2 - plate_height
                px2 = vx2 - (vx2 - vx1) * 0.05  # Slight padding on right
                py2 = vy2
                px1, py1, px2, py2 = int(px1), int(py1), int(px2), int(py2)
                plate_crop = img[py1:py2, px1:px2]

                if plate_crop.size == 0:
                    continue

                # Preprocess and OCR
                processed_plate = self.preprocess_plate_image(plate_crop)
                ocr_results = self.reader.readtext(processed_plate, detail=0, paragraph=False)

                # Combine OCR results
                raw_text = ''.join(ocr_results)
                # Clean and validate
                plate_text = self.clean_and_validate_plate(raw_text)

                if plate_text:
                    # Encode plate crop to base64
                    plate_crop_base64 = self.encode_image(plate_crop)

                    # Store plate data
                    plates.append({
                        "class": "license-plate",
                        "confidence": 0.5,
                        "bbox": [px1, py1, px2, py2],
                        "text": plate_text,
                        "text_confidence": 0.5
                    })
                    plate_crops.append(plate_crop)
                    plate_crops_base64.append(plate_crop_base64)

        return plates, plate_crops, plate_crops_base64

