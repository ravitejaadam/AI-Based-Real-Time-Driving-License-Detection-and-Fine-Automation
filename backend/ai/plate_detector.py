import os
import cv2
import numpy as np
from ultralytics import YOLO

class PlateDetector:
    def __init__(self, model_path=None):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Search multiple possible model locations
        search_paths = []
        if model_path is not None:
            search_paths.append(model_path)
        search_paths.extend([
            os.path.join(current_dir, "models", "license_plate_model.pt"),
            os.path.join(current_dir, "models", "licence_plate.pt"),
            os.path.join(current_dir, "..", "..", "license_plate.pt"),   # project root
            os.path.join(current_dir, "..", "..", "licence_plate.pt"),   # project root alt spelling
        ])
            
        self.model_loaded = False
        self.model = None
        
        for path in search_paths:
            resolved = os.path.abspath(path)
            if os.path.exists(resolved):
                try:
                    self.model = YOLO(resolved)
                    self.model_loaded = True
                    print(f"License plate model loaded successfully from: {resolved}")
                    break
                except Exception as e:
                    print(f"Error loading license plate model from {resolved}: {e}")
        
        if not self.model_loaded:
            print(f"WARNING: License plate model not found in any location. OpenCV contours will be used as fallback.")
            print(f"Searched paths: {[os.path.abspath(p) for p in search_paths]}")
            
    def detect_plates(self, full_frame, vehicle_bbox=None):
        """
        Detects license plates within the full frame or specific vehicle bounding box.
        Returns: list of dicts: [{"bbox": [x1, y1, x2, y2], "confidence": float, "method": str}]
        Note: bbox coordinates are in full-frame coordinate space.
        """
        # 1. Prepare target region (crop vehicle or use full frame)
        if vehicle_bbox is not None:
            vx1, vy1, vx2, vy2 = vehicle_bbox
            # Bound coordinates
            h, w = full_frame.shape[:2]
            vx1, vy1, vx2, vy2 = max(0, vx1), max(0, vy1), min(w, vx2), min(h, vy2)
            
            if (vx2 - vx1) <= 10 or (vy2 - vy1) <= 10:
                return []
                
            crop_img = full_frame[vy1:vy2, vx1:vx2]
            offset_x, offset_y = vx1, vy1
        else:
            crop_img = full_frame
            offset_x, offset_y = 0, 0
            
        plates = []
        
        # 2. Try YOLO License Plate model if loaded
        if self.model_loaded:
            try:
                results = self.model(crop_img, verbose=False)
                for result in results:
                    if not result.boxes:
                        continue
                    for box in result.boxes:
                        conf = float(box.conf[0])
                        coords = box.xyxy[0].tolist()  # [cx1, cy1, cx2, cy2] relative to crop
                        
                        # Map back to full frame
                        px1 = int(coords[0]) + offset_x
                        py1 = int(coords[1]) + offset_y
                        px2 = int(coords[2]) + offset_x
                        py2 = int(coords[3]) + offset_y
                        
                        plates.append({
                            "bbox": [px1, py1, px2, py2],
                            "confidence": conf,
                            "method": "YOLO"
                        })
            except Exception as e:
                print(f"YOLO Plate Detection failed: {e}. Falling back to OpenCV contours.")
                
        # 3. If no plates detected by YOLO, use OpenCV contours fallback
        if not plates:
            cv_plates = self._detect_plates_opencv(crop_img, offset_x, offset_y)
            plates.extend(cv_plates)
            
        return plates
        
    def _detect_plates_opencv(self, img, offset_x, offset_y):
        """
        OpenCV contour-based plate detection fallback.
        Looks for rectangular boxes with Indian license plate aspect ratios (approx 2.5 to 5.5).
        """
        if img is None or img.size == 0:
            return []
            
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Blur to reduce noise
        blurred = cv2.bilateralFilter(gray, 11, 17, 17)
        
        # Edge detection
        edged = cv2.Canny(blurred, 30, 200)
        
        # Find contours
        contours, _ = cv2.findContours(edged.copy(), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:30]
        
        plates = []
        for c in contours:
            # Approximate the contour
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.018 * peri, True)
            
            # If the contour has 4 points, it's highly likely a rectangle
            if len(approx) == 4:
                x, y, w_box, h_box = cv2.boundingRect(approx)
                
                # Check aspect ratio (Indian plates are roughly 3.0 to 5.5 in ratio)
                if h_box > 0:
                    aspect_ratio = float(w_box) / h_box
                    if 2.2 <= aspect_ratio <= 6.0 and w_box > 30 and h_box > 10:
                        px1 = x + offset_x
                        py1 = y + offset_y
                        px2 = x + w_box + offset_x
                        py2 = y + h_box + offset_y
                        
                        plates.append({
                            "bbox": [px1, py1, px2, py2],
                            "confidence": 0.50,  # Constant baseline confidence for contour fallback
                            "method": "OpenCV"
                        })
                        
        # Remove overlapping boxes and take the largest/best ones
        return plates[:3]
