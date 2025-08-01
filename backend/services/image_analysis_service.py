"""
Image analysis service for material identification
"""

import json
import base64
import time
import logging
from typing import List, Optional, Dict, Any
from io import BytesIO
from PIL import Image

from models.material_analysis import (
    MaterialAnalysisResult, 
    MaterialAnalysisResponse, 
    MaterialType,
    MaterialSuggestion,
    MaterialScopeIntegration
)
from services.ai_service import ai_service
from utils.logger import logger
from utils.prompts import MATERIAL_ANALYSIS_PROMPT

class ImageAnalysisService:
    """Service for analyzing images to identify building materials"""
    
    def __init__(self):
        self.max_image_size = (1024, 1024)  # Max dimensions for processing
        self.supported_formats = ['JPEG', 'PNG', 'WebP', 'BMP']
        
    def analyze_materials(
        self, 
        image_data: bytes, 
        analysis_focus: Optional[List[MaterialType]] = None,
        room_type: Optional[str] = None
    ) -> MaterialAnalysisResponse:
        """
        Analyze image to identify building materials
        
        Args:
            image_data: Raw image bytes
            analysis_focus: Specific material types to focus on
            room_type: Room context for better analysis
            
        Returns:
            MaterialAnalysisResponse with detected materials
        """
        start_time = time.time()
        
        try:
            # Validate and process image
            processed_image = self._process_image(image_data)
            if not processed_image:
                return MaterialAnalysisResponse(
                    success=False,
                    materials=[],
                    overall_confidence=0.0,
                    image_quality_score=0.0,
                    processing_time=time.time() - start_time,
                    error_message="Invalid image format or corrupted image data"
                )
            
            # Assess image quality
            quality_score = self._assess_image_quality(processed_image)
            if quality_score < 3.0:
                logger.warning(f"Low image quality detected: {quality_score}/10")
            
            # Convert image to base64 for AI analysis
            base64_image = self._image_to_base64(processed_image)
            
            # Perform AI analysis
            materials = self._analyze_with_ai(
                base64_image, 
                analysis_focus, 
                room_type
            )
            
            # Calculate overall confidence
            overall_confidence = self._calculate_overall_confidence(materials)
            
            processing_time = time.time() - start_time
            
            return MaterialAnalysisResponse(
                success=True,
                materials=materials,
                overall_confidence=overall_confidence,
                image_quality_score=quality_score,
                processing_time=processing_time,
                analysis_notes=self._generate_analysis_notes(materials, quality_score)
            )
            
        except Exception as e:
            logger.error(f"Material analysis failed: {str(e)}")
            return MaterialAnalysisResponse(
                success=False,
                materials=[],
                overall_confidence=0.0,
                image_quality_score=0.0,
                processing_time=time.time() - start_time,
                error_message=f"Analysis failed: {str(e)}"
            )
    
    def _process_image(self, image_data: bytes) -> Optional[Image.Image]:
        """Process and validate image data"""
        try:
            image = Image.open(BytesIO(image_data))
            
            # Validate format
            if image.format not in self.supported_formats:
                logger.error(f"Unsupported image format: {image.format}")
                return None
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Resize if too large
            if image.size[0] > self.max_image_size[0] or image.size[1] > self.max_image_size[1]:
                image.thumbnail(self.max_image_size, Image.Resampling.LANCZOS)
                logger.info(f"Image resized to {image.size}")
            
            return image
            
        except Exception as e:
            logger.error(f"Image processing failed: {str(e)}")
            return None
    
    def _assess_image_quality(self, image: Image.Image) -> float:
        """Assess image quality for analysis (1-10 scale)"""
        try:
            width, height = image.size
            
            # Size score (larger is better, up to a point)
            size_score = min(10.0, (width * height) / 50000)  # 50k pixels = score 10
            
            # Basic sharpness assessment using variance of Laplacian
            import numpy as np
            from scipy import ndimage
            
            # Convert to grayscale array
            gray_array = np.array(image.convert('L'))
            
            # Calculate Laplacian variance (measure of sharpness)
            laplacian_var = ndimage.laplace(gray_array).var()
            sharpness_score = min(10.0, laplacian_var / 100)  # Normalize to 0-10
            
            # Combine scores
            quality_score = (size_score * 0.3 + sharpness_score * 0.7)
            
            return max(1.0, min(10.0, quality_score))
            
        except Exception as e:
            logger.warning(f"Quality assessment failed: {str(e)}")
            return 5.0  # Default medium quality
    
    def _image_to_base64(self, image: Image.Image) -> str:
        """Convert PIL Image to base64 string"""
        buffer = BytesIO()
        image.save(buffer, format='JPEG', quality=85)
        image_bytes = buffer.getvalue()
        return base64.b64encode(image_bytes).decode('utf-8')
    
    def _analyze_with_ai(
        self, 
        base64_image: str, 
        analysis_focus: Optional[List[MaterialType]], 
        room_type: Optional[str]
    ) -> List[MaterialAnalysisResult]:
        """Perform AI analysis of the image"""
        
        # Build focus text
        focus_text = ""
        if analysis_focus:
            focus_list = [f.value for f in analysis_focus]
            focus_text = f"Focus specifically on these material types: {', '.join(focus_list)}. "
        
        # Build room context
        room_context = ""
        if room_type:
            room_context = f"This image is from a {room_type}. "
        
        # Generate prompt using template
        prompt = MATERIAL_ANALYSIS_PROMPT.format(
            room_context=room_context,
            focus_text=focus_text
        )
        
        try:
            if ai_service.mock_mode:
                # Return mock data for testing
                return self._get_mock_analysis_results()
            
            # Call AI service with image
            response = ai_service.analyze_image_with_text(base64_image, prompt)
            
            # Parse response
            return self._parse_ai_response(response)
            
        except Exception as e:
            logger.error(f"AI analysis failed: {str(e)}")
            return []
    
    def _parse_ai_response(self, response: str) -> List[MaterialAnalysisResult]:
        """Parse AI response into MaterialAnalysisResult objects"""
        try:
            # Clean up the response to extract JSON
            response_clean = response.strip()
            
            # Find JSON array in response
            start_idx = response_clean.find('[')
            end_idx = response_clean.rfind(']') + 1
            
            if start_idx == -1 or end_idx == 0:
                logger.error("No JSON array found in AI response")
                return []
            
            json_str = response_clean[start_idx:end_idx]
            data = json.loads(json_str)
            
            materials = []
            for item in data:
                try:
                    material = MaterialAnalysisResult(
                        material_type=MaterialType(item['material_type']),
                        material_name=item['material_name'],
                        confidence_score=float(item['confidence_score']),
                        description=item['description'],
                        underlayment_needed=item.get('underlayment_needed', False),
                        recommended_underlayment=item.get('recommended_underlayment'),
                        color=item.get('color'),
                        texture=item.get('texture')
                    )
                    materials.append(material)
                except Exception as e:
                    logger.warning(f"Failed to parse material item: {e}")
                    continue
            
            return materials
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
            return []
        except Exception as e:
            logger.error(f"Failed to parse AI response: {e}")
            return []
    
    def _get_mock_analysis_results(self) -> List[MaterialAnalysisResult]:
        """Return mock analysis results for testing"""
        return [
            MaterialAnalysisResult(
                material_type=MaterialType.FLOOR,
                material_name="Laminate Wood",
                confidence_score=8.5,
                description="Light oak-colored laminate flooring with wood grain texture",
                underlayment_needed=True,
                recommended_underlayment="6mm foam pad",
                color="Light Oak",
                texture="Wood grain with smooth surface"
            ),
            MaterialAnalysisResult(
                material_type=MaterialType.WALL,
                material_name="Painted Drywall",
                confidence_score=9.0,
                description="Standard drywall with white/off-white paint finish",
                underlayment_needed=False,
                color="White/Off-white",
                texture="Smooth painted surface"
            ),
            MaterialAnalysisResult(
                material_type=MaterialType.BASEBOARD,
                material_name="White Painted Wood",
                confidence_score=7.5,
                description="Traditional wood baseboard with white paint finish",
                underlayment_needed=False,
                color="White",
                texture="Smooth painted wood"
            )
        ]
    
    def _calculate_overall_confidence(self, materials: List[MaterialAnalysisResult]) -> float:
        """Calculate overall confidence score"""
        if not materials:
            return 0.0
        
        # Weight by confidence scores
        total_weighted = sum(m.confidence_score ** 2 for m in materials)
        total_weights = sum(m.confidence_score for m in materials)
        
        if total_weights == 0:
            return 0.0
        
        return min(10.0, total_weighted / total_weights)
    
    def _generate_analysis_notes(self, materials: List[MaterialAnalysisResult], quality_score: float) -> str:
        """Generate analysis notes"""
        notes = []
        
        if quality_score < 5.0:
            notes.append("Image quality is below optimal - consider taking a clearer photo for better results.")
        
        high_confidence = [m for m in materials if m.confidence_score >= 8.0]
        medium_confidence = [m for m in materials if 5.0 <= m.confidence_score < 8.0]
        low_confidence = [m for m in materials if m.confidence_score < 5.0]
        
        if high_confidence:
            notes.append(f"High confidence identifications: {len(high_confidence)} materials")
        if medium_confidence:
            notes.append(f"Medium confidence identifications: {len(medium_confidence)} materials")
        if low_confidence:
            notes.append(f"Low confidence identifications: {len(low_confidence)} materials - please review carefully")
        
        return " | ".join(notes) if notes else "Analysis completed successfully"
    
    def generate_material_scope_suggestions(
        self, 
        materials: List[MaterialAnalysisResult],
        room_type: Optional[str] = None
    ) -> MaterialScopeIntegration:
        """Generate suggestions for MaterialScope integration"""
        
        suggestions = []
        user_review_required = []
        
        # Map materials to MaterialScope fields
        material_mapping = {
            MaterialType.FLOOR: "Floor",
            MaterialType.WALL: "wall", 
            MaterialType.CEILING: "ceiling",
            MaterialType.BASEBOARD: "Baseboard",
            MaterialType.QUARTER_ROUND: "Quarter Round"
        }
        
        for material in materials:
            if material.material_type in material_mapping:
                field_name = material_mapping[material.material_type]
                
                # Main material suggestion
                suggestion = MaterialSuggestion(
                    category="material",
                    field_name=field_name,
                    suggested_value=material.material_name,
                    confidence=material.confidence_score,
                    reasoning=f"AI identified {material.material_name} with {material.confidence_score}/10 confidence: {material.description}"
                )
                suggestions.append(suggestion)
                
                # Underlayment suggestion if needed
                if material.underlayment_needed and material.recommended_underlayment:
                    underlayment_suggestion = MaterialSuggestion(
                        category="material_underlayment",
                        field_name=field_name,
                        suggested_value=material.recommended_underlayment,
                        confidence=material.confidence_score * 0.8,  # Slightly lower confidence for underlayment
                        reasoning=f"Recommended underlayment for {material.material_name}"
                    )
                    suggestions.append(underlayment_suggestion)
                
                # Mark for user review if low confidence
                if material.confidence_score < 7.0:
                    user_review_required.append(field_name)
        
        # Auto-apply only high-confidence suggestions
        auto_apply = all(s.confidence >= 8.0 for s in suggestions) and len(user_review_required) == 0
        
        return MaterialScopeIntegration(
            suggestions=suggestions,
            auto_apply=auto_apply,
            user_review_required=user_review_required
        )

# Global instance
image_analysis_service = ImageAnalysisService()