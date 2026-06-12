import os
import cv2
from ultralytics import YOLO

class VehicleDetector:
    def __init__(self, model_path=None):
        if model_path is None:
            # Resolve absolute path relative to this file
            current_dir = os.path.dirname(os.path.abspath(__file__))
            model_path = os.path.join(current_dir, "models", "yolov8n.pt")
        
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"YOLOv8 vehicle detection model not found at: {model_path}")
            
        self.model = YOLO(model_path)
        self.target_classes = {
            2: "car",
            3: "bike",  # COCO motorcycle
            5: "bus",
            7: "truck"
        }
        
    def detect_vehicles(self, frame):
        """
        Runs YOLOv8 inference on a frame and returns detected vehicles.
        :param frame: numpy.ndarray input image
        :return: list of dicts: [{"bbox": [x1, y1, x2, y2], "vehicle_class": str, "confidence": float}]
        """
        if frame is None or frame.size == 0:
            return []
            
        results = self.model(frame, verbose=False)
        detections = []
        
        for result in results:
            if not result.boxes:
                continue
                
            for box in result.boxes:
                cls_id = int(box.cls[0]) if box.cls is not None else -1
                if cls_id in self.target_classes:
                    conf = float(box.conf[0])
                    if conf >= 0.25:
                        coords = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
                        
                        detections.append({
                            "bbox": [int(c) for c in coords],
                            "vehicle_class": self.target_classes[cls_id],
                            "confidence": conf
                        })
                    
        return detections
