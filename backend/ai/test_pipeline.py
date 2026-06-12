import cv2
import numpy as np
import urllib.request
import os

from detection_manager import DetectionManager

# Download a sample Indian motorcycle image with a license plate
url = "https://upload.wikimedia.org/wikipedia/commons/4/4b/Indian_license_plate_on_a_motorcycle.jpg" 
# Let's use a simpler way: I'll use a direct image of an Indian number plate.
# Actually, let's just generate a synthetic image of an Indian number plate to test the OCR engine first.
def create_synthetic_plate():
    img = np.ones((200, 600, 3), dtype=np.uint8) * 255
    font = cv2.FONT_HERSHEY_SIMPLEX
    text = "MH 13 EJ 3339"
    # add some black border
    cv2.rectangle(img, (10, 10), (590, 190), (0, 0, 0), 4)
    cv2.putText(img, text, (50, 130), font, 2.5, (0, 0, 0), 6, cv2.LINE_AA)
    return img

def test_ocr():
    print("Testing OCR on synthetic plate...")
    from ocr_engine import OcrEngine
    ocr = OcrEngine()
    img = create_synthetic_plate()
    cv2.imwrite("synthetic_plate.jpg", img)
    res = ocr.run_ocr(img)
    print("OCR Result:", res)

test_ocr()
