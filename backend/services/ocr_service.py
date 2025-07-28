import logging
from google.cloud import vision
from typing import Optional

logger = logging.getLogger(__name__)

class OCRService:
    def __init__(self):
        self.client = None
        
    def _get_client(self):
        """Lazy initialization of Vision client"""
        if self.client is None:
            try:
                self.client = vision.ImageAnnotatorClient()
            except Exception as e:
                logger.error(f"Failed to initialize Vision client: {e}")
                raise
        return self.client
    
    def extract_text_from_image(self, image_content: bytes) -> str:
        """Extract text from image using Google Cloud Vision API"""
        try:
            client = self._get_client()
            
            image = vision.Image(content=image_content)
            response = client.text_detection(image=image)
            
            if response.error.message:
                raise Exception(f"Vision API error: {response.error.message}")
            
            texts = response.text_annotations
            if texts:
                return texts[0].description
            else:
                return ""
                
        except Exception as e:
            logger.error(f"Error extracting text from image: {e}")
            return f"OCR Error: {str(e)}"

# Global OCR service instance
ocr_service = OCRService()