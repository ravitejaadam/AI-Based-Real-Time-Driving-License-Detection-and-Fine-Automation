import cv2
import re
import numpy as np
import torch
import easyocr

class OcrEngine:
    def __init__(self):
        # Determine if GPU is available
        use_gpu = torch.cuda.is_available()
        print(f"Initializing EasyOCR with GPU={use_gpu}...")
        self.reader = easyocr.Reader(['en'], gpu=use_gpu)
        
        # Correction maps
        self.char_to_digit = {
            'O': '0', 'I': '1', 'L': '1', 'B': '8', 'S': '5', 'Z': '2', 'G': '6', 'T': '1'
        }
        self.digit_to_char = {
            '0': 'O', '1': 'I', '8': 'B', '5': 'S', '2': 'Z', '6': 'G'
        }
        
        # Regex for Indian number plates (standard formats: MH12AB1234, DL3CA1234, etc.)
        self.strict_plate_pattern = re.compile(r'^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$')
        
    def preprocess_plate(self, plate_img):
        """
        Runs preprocessing steps on the cropped plate image for better OCR.
        :param plate_img: cropped license plate BGR image
        :return: preprocessed grayscale image ready for OCR
        """
        if plate_img is None or plate_img.size == 0:
            return None
            
        # Step 3: Convert to grayscale
        gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
        
        # Resize to standard height (100px) maintaining aspect ratio
        h, w = gray.shape[:2]
        if h > 0:
            new_h = 100
            new_w = int(w * (new_h / h))
            if new_w < 10:
                new_w = 10
            gray = cv2.resize(gray, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
        
        # Step 6: CLAHE contrast enhancement BEFORE binarization (on grayscale)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        contrast = clahe.apply(gray)
        
        # Step 4: Denoise with gentler bilateral filter (preserve thin text strokes)
        denoised = cv2.bilateralFilter(contrast, 9, 75, 75)
        
        # Step 5: Adaptive thresholding (better than Otsu for uneven plate lighting)
        thresh = cv2.adaptiveThreshold(
            denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 11, 2
        )
        
        return thresh
        
    def normalize_text(self, text):
        """
        Cleans and formats OCR text into standard Indian plate format.
        Fixes common OCR letter/digit confusions based on character position.
        """
        # Clean text: uppercase and remove all non-alphanumeric chars
        cleaned = re.sub(r'[^A-Z0-9]', '', text.upper())
        
        # If the string is too long (contains dealership name, etc.), try to extract the actual plate
        if len(cleaned) > 10:
            state_codes = ["AP", "AR", "AS", "BR", "CG", "CH", "DD", "DL", "DN", "GA", 
                           "GJ", "HR", "HP", "JH", "JK", "KA", "KL", "LA", "LD", "MH", 
                           "ML", "MN", "MP", "MZ", "NL", "OD", "OR", "PB", "PY", "RJ", 
                           "SK", "TN", "TR", "TS", "UK", "UP", "WB"]
            for code in state_codes:
                idx = cleaned.find(code)
                if idx != -1:
                    # Extract up to 10 chars from the state code
                    potential_plate = cleaned[idx:idx+10]
                    if len(potential_plate) >= 9:
                        cleaned = potential_plate
                        break
        
        if len(cleaned) < 9 or len(cleaned) > 10:
            return cleaned  # Too short/long to map reliably, return raw text to avoid corrupting it
            
        normalized = list(cleaned)
        
        # 1. First 2 characters MUST be letters
        for i in range(2):
            if normalized[i].isdigit():
                normalized[i] = self.digit_to_char.get(normalized[i], normalized[i])
                
        # 2. Next 1 character MUST be digit
        if normalized[2].isalpha():
            normalized[2] = self.char_to_digit.get(normalized[2], normalized[2])
            
        if len(normalized) == 10:
            # MH12AB1234
            if normalized[3].isalpha():
                normalized[3] = self.char_to_digit.get(normalized[3], normalized[3])
            for i in [4, 5]:
                if normalized[i].isdigit():
                    normalized[i] = self.digit_to_char.get(normalized[i], normalized[i])
        elif len(normalized) == 9:
            # DL3CA1234 or AP05A1234
            if normalized[3].isdigit():
                if normalized[4].isdigit():
                    normalized[4] = self.digit_to_char.get(normalized[4], normalized[4])
            else:
                if normalized[4].isdigit():
                    normalized[4] = self.digit_to_char.get(normalized[4], normalized[4])
                    
        # 3. Last 4 characters MUST be digits
        for i in range(len(normalized) - 4, len(normalized)):
            if normalized[i].isalpha():
                normalized[i] = self.char_to_digit.get(normalized[i], normalized[i])
                
        return "".join(normalized)
        
    def validate_plate(self, plate_number):
        """
        Validates the plate number format against strict Indian patterns.
        """
        if self.strict_plate_pattern.match(plate_number):
            return "PASS"
            
        # Loose validation check (at least 2 letters at start, and at least 3 digits at end)
        loose_pattern = re.compile(r'^[A-Z]{2}[A-Z0-9]{1,4}[0-9]{3,4}$')
        if loose_pattern.match(plate_number):
            return "PASS"
            
        return "FAIL"
        
    def run_ocr(self, plate_img):
        """
        Runs OCR character extraction, text normalization, and validation on cropped plate image.
        Tries multiple image variants and picks the best result.
        :param plate_img: cropped license plate BGR image
        :return: dict: {"plate_number": str, "confidence": float, "validation": str}
        """
        empty_result = {"plate_number": "", "confidence": 0.0, "validation": "FAIL"}
        
        if plate_img is None or plate_img.size == 0:
            return empty_result
        
        # Prepare multiple image variants for OCR attempts
        candidates = []
        
        # Variant 1: Preprocessed image
        preprocessed = self.preprocess_plate(plate_img)
        if preprocessed is not None and preprocessed.size > 0:
            candidates.append(preprocessed)
        
        # Variant 2: Plain grayscale (no heavy processing)
        try:
            gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
            h, w = gray.shape[:2]
            if h > 0:
                new_h = 100
                new_w = max(10, int(w * (new_h / h)))
                gray = cv2.resize(gray, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
            candidates.append(gray)
        except Exception:
            pass
        
        # Variant 3: Raw color image
        candidates.append(plate_img)
        
        best_result = empty_result
        best_score = -1.0
        
        for img_variant in candidates:
            try:
                results = self.reader.readtext(img_variant)
                if not results:
                    continue
                
                # Do NOT sort strictly by X coordinate; this scrambles 2-line motorcycle plates!
                # EasyOCR returns them in roughly reading order by default.
                raw_text = " ".join([res[1] for res in results])
                confidences = [res[2] for res in results]
                avg_confidence = float(np.mean(confidences)) if confidences else 0.0
                
                # Debug logging: write raw OCR reading to a file
                with open("ocr_debug.txt", "a") as f:
                    f.write(f"Raw OCR: {raw_text} | Conf: {avg_confidence:.2f}\n")
                
                # Step 8: Normalize text
                normalized_number = self.normalize_text(raw_text)
                
                # Step 9: Validate regex
                validation_status = self.validate_plate(normalized_number)
                
                # Score: prioritize PASS validation, then confidence
                score = avg_confidence + (1.0 if validation_status == "PASS" else 0.0)
                
                if score > best_score and len(normalized_number) >= 3:
                    best_score = score
                    best_result = {
                        "plate_number": normalized_number,
                        "confidence": avg_confidence,
                        "validation": validation_status
                    }
            except Exception as e:
                print(f"EasyOCR error on variant: {e}")
                continue
        
        return best_result
