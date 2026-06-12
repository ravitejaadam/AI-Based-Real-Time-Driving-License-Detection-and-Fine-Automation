import os
import cv2
import base64
from datetime import datetime

from vehicle_detector import VehicleDetector
from plate_detector import PlateDetector
from ocr_engine import OcrEngine

class DetectionManager:
    def __init__(self):
        print("Initializing DetectionManager pipeline...")
        self.vehicle_detector = VehicleDetector()
        self.plate_detector = PlateDetector()
        self.ocr_engine = OcrEngine()
        
    def process_frame(self, frame, ocr_threshold=0.15, include_previews=False):
        """
        Coordinates full pipeline: detects vehicles -> detects number plates -> preprocesses plate -> runs EasyOCR -> formats output.
        """
        if frame is None or frame.size == 0:
            return {
                "detections": [],
                "latest_detection": {},
                "vehicle_count": 0,
                "frame_size": {"width": 0, "height": 0},
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "status_message": "Empty or corrupted frame"
            }
            
        h, w = frame.shape[:2]
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 1. Vehicle Detection
        vehicles = self.vehicle_detector.detect_vehicles(frame)
        
        # We will enrich vehicle list with plates and OCR
        enriched_detections = []
        best_plate_info = None
        best_plate_ocr_conf = -1.0
        
        for vehicle in vehicles:
            v_box = vehicle["bbox"]
            v_class = vehicle["vehicle_class"]
            
            # 2. Number Plate Detection inside the vehicle bounding box
            plates = self.plate_detector.detect_plates(frame, vehicle_bbox=v_box)
            
            enriched_plates = []
            for plate in plates:
                p_box = plate["bbox"]
                p_conf = plate["confidence"]
                
                # Crop plate region with padding to prevent cutting off edge characters
                px1, py1, px2, py2 = p_box
                p_w, p_h = px2 - px1, py2 - py1
                pad_x = int(p_w * 0.10)
                pad_y = int(p_h * 0.15)
                
                px1, py1, px2, py2 = max(0, px1 - pad_x), max(0, py1 - pad_y), min(w, px2 + pad_x), min(h, py2 + pad_y)
                
                plate_crop = frame[py1:py2, px1:px2] if (px2 - px1) > 5 and (py2 - py1) > 5 else None
                
                # 3. OCR character recognition
                ocr_result = {"plate_number": "", "confidence": 0.0, "validation": "FAIL"}
                if plate_crop is not None:
                    ocr_result = self.ocr_engine.run_ocr(plate_crop)
                    
                # Format OCR output
                ocr_status = "No Plate Found"
                ocr_val = ocr_result["validation"]
                ocr_conf = ocr_result["confidence"]
                plate_num = ocr_result["plate_number"]
                
                # Apply OCR threshold filter
                if plate_num and ocr_conf >= ocr_threshold:
                    if ocr_val == "PASS":
                        ocr_status = "Plate Detected"
                    else:
                        ocr_status = "Format Mismatch"
                elif plate_num:
                    ocr_status = "Low Confidence"
                    # Ignore results that are below confidence threshold per requirements:
                    # - Ignore result / Mark as low confidence / Do not store in detection logs
                    ocr_val = "FAIL"
                    plate_num = "Low Conf Plate"
                    
                plate_data = {
                    "bbox": p_box,
                    "confidence": p_conf,
                    "vehicle_type": v_class,
                    "detection_status": ocr_status,
                    "ocr": {
                        "plate_number": plate_num,
                        "confidence": ocr_conf,
                        "validation": ocr_val,
                        "vehicle_type": v_class,
                        "detection_status": ocr_status
                    }
                }
                
                enriched_plates.append(plate_data)
                
                # Keep track of the highest confidence valid OCR detection for the top-level "latest_detection"
                if plate_num and plate_num != "Low Conf Plate" and ocr_conf >= ocr_threshold and ocr_conf > best_plate_ocr_conf:
                    best_plate_ocr_conf = ocr_conf
                    best_plate_info = {
                        "vehicle_type": v_class,
                        "vehicle_number": plate_num,
                        "plate_confidence": p_conf,
                        "ocr_confidence": ocr_conf,
                        "status": ocr_status,
                        "vehicle_bbox": v_box,
                        "plate_bbox": p_box
                    }
            
            enriched_vehicle = {
                "bbox": v_box,
                "vehicle_class": v_class,
                "confidence": vehicle["confidence"],
                "plates": enriched_plates
            }
            
            enriched_detections.append(enriched_vehicle)
            
        # Fallback: if no plates found inside any vehicle bbox, try full-frame plate detection
        has_any_plate = any(
            len(v.get("plates", [])) > 0 for v in enriched_detections
        )
        
        if not has_any_plate:
            full_frame_plates = self.plate_detector.detect_plates(frame, vehicle_bbox=None)
            if full_frame_plates:
                for plate in full_frame_plates:
                    p_box = plate["bbox"]
                    p_conf = plate["confidence"]
                    
                    px1, py1, px2, py2 = p_box
                    p_w, p_h = px2 - px1, py2 - py1
                    pad_x = int(p_w * 0.10)
                    pad_y = int(p_h * 0.15)
                    
                    px1, py1, px2, py2 = max(0, px1 - pad_x), max(0, py1 - pad_y), min(w, px2 + pad_x), min(h, py2 + pad_y)
                    
                    plate_crop = frame[py1:py2, px1:px2] if (px2 - px1) > 5 and (py2 - py1) > 5 else None
                    
                    ocr_result = {"plate_number": "", "confidence": 0.0, "validation": "FAIL"}
                    if plate_crop is not None:
                        ocr_result = self.ocr_engine.run_ocr(plate_crop)
                    
                    ocr_conf = ocr_result["confidence"]
                    plate_num = ocr_result["plate_number"]
                    ocr_val = ocr_result["validation"]
                    
                    ocr_status = "No Plate Found"
                    if plate_num and ocr_conf >= ocr_threshold:
                        ocr_status = "Plate Detected" if ocr_val == "PASS" else "Format Mismatch"
                    elif plate_num:
                        ocr_status = "Low Confidence"
                        ocr_val = "FAIL"
                        plate_num = "Low Conf Plate"
                    
                    plate_data = {
                        "bbox": p_box,
                        "confidence": p_conf,
                        "vehicle_type": "unknown",
                        "detection_status": ocr_status,
                        "ocr": {
                            "plate_number": plate_num,
                            "confidence": ocr_conf,
                            "validation": ocr_val,
                            "vehicle_type": "unknown",
                            "detection_status": ocr_status
                        }
                    }
                    
                    # Add as a standalone detection entry
                    standalone_vehicle = {
                        "bbox": p_box,  # use plate bbox as vehicle bbox
                        "vehicle_class": "unknown",
                        "confidence": p_conf,
                        "plates": [plate_data]
                    }
                    enriched_detections.append(standalone_vehicle)
                    
                    if plate_num and plate_num != "Low Conf Plate" and ocr_conf >= ocr_threshold and ocr_conf > best_plate_ocr_conf:
                        best_plate_ocr_conf = ocr_conf
                        best_plate_info = {
                            "vehicle_type": "unknown",
                            "vehicle_number": plate_num,
                            "plate_confidence": p_conf,
                            "ocr_confidence": ocr_conf,
                            "status": ocr_status,
                            "vehicle_bbox": p_box,
                            "plate_bbox": p_box
                        }
        
        # 4. Generate crop base64 previews ONLY if explicitly requested by client
        vehicle_crop_base64 = ""
        plate_crop_base64 = ""
        
        if include_previews and best_plate_info is not None:
            # Crop vehicle
            v_crop_base64 = self._crop_and_encode_base64(frame, best_plate_info["vehicle_bbox"])
            if v_crop_base64:
                vehicle_crop_base64 = v_crop_base64
            # Crop plate
            p_crop_base64 = self._crop_and_encode_base64(frame, best_plate_info["plate_bbox"])
            if p_crop_base64:
                plate_crop_base64 = p_crop_base64
                
        # 5. Format final response payload
        latest = {}
        if best_plate_info is not None:
            latest = {
                "vehicle_type": best_plate_info["vehicle_type"],
                "vehicle_number": best_plate_info["vehicle_number"],
                "plate_confidence": best_plate_info["plate_confidence"],
                "ocr_confidence": best_plate_info["ocr_confidence"],
                "status": best_plate_info["status"]
            }
            
        return {
            "detections": enriched_detections,
            "latest_detection": latest,
            "vehicle_count": len(vehicles),
            "vehicle_crop_preview": vehicle_crop_base64,
            "plate_crop_preview": plate_crop_base64,
            "frame_size": {"width": w, "height": h},
            "timestamp": timestamp,
            "status_message": "Success"
        }
        
    def _crop_and_encode_base64(self, img, bbox):
        try:
            h, w = img.shape[:2]
            x1, y1, x2, y2 = bbox
            x1, y1, x2, y2 = max(0, x1), max(0, y1), min(w, x2), min(h, y2)
            if (x2 - x1) <= 5 or (y2 - y1) <= 5:
                return ""
            crop = img[y1:y2, x1:x2]
            _, buffer = cv2.imencode('.jpg', crop)
            encoded = base64.b64encode(buffer).decode('utf-8')
            return f"data:image/jpeg;base64,{encoded}"
        except Exception as e:
            print(f"Error generating crop preview: {e}")
            return ""
