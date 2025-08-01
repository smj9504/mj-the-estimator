"""
Material analysis data models
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum

class MaterialType(str, Enum):
    """Material type categories"""
    FLOOR = "floor"
    WALL = "wall" 
    CEILING = "ceiling"
    BASEBOARD = "baseboard"
    QUARTER_ROUND = "quarter_round"
    TRIM = "trim"
    COUNTERTOP = "countertop"
    CABINET = "cabinet"

class MaterialAnalysisResult(BaseModel):
    """Individual material analysis result"""
    material_type: MaterialType = Field(..., description="Type of material (floor, wall, ceiling, etc.)")
    material_name: str = Field(..., description="Specific material name (e.g., 'Laminate Wood', 'Ceramic Tile')")
    confidence_score: float = Field(..., ge=0.0, le=10.0, description="Confidence score from 1-10")
    description: str = Field(..., description="Detailed description of the material")
    underlayment_needed: bool = Field(default=False, description="Whether underlayment is needed")
    recommended_underlayment: Optional[str] = Field(None, description="Recommended underlayment if needed")
    color: Optional[str] = Field(None, description="Material color/finish")
    texture: Optional[str] = Field(None, description="Material texture description")

class MaterialAnalysisRequest(BaseModel):
    """Request model for material analysis"""
    analysis_focus: Optional[List[MaterialType]] = Field(
        default=None, 
        description="Specific material types to focus on. If None, analyze all visible materials"
    )
    room_type: Optional[str] = Field(None, description="Room type context (kitchen, bathroom, etc.)")
    
class MaterialAnalysisResponse(BaseModel):
    """Response model for material analysis"""
    success: bool = Field(..., description="Whether analysis was successful")
    materials: List[MaterialAnalysisResult] = Field(default=[], description="List of detected materials")
    overall_confidence: float = Field(..., ge=0.0, le=10.0, description="Overall analysis confidence")
    analysis_notes: Optional[str] = Field(None, description="Additional analysis notes")
    image_quality_score: float = Field(..., ge=0.0, le=10.0, description="Image quality assessment")
    processing_time: float = Field(..., description="Processing time in seconds")
    error_message: Optional[str] = Field(None, description="Error message if analysis failed")

class MaterialSuggestion(BaseModel):
    """Material suggestion for MaterialScope integration"""
    category: str = Field(..., description="Material category (material, material_underlayment)")
    field_name: str = Field(..., description="Field name in MaterialScope")
    suggested_value: str = Field(..., description="Suggested material value")
    confidence: float = Field(..., ge=0.0, le=10.0, description="Confidence in suggestion")
    reasoning: str = Field(..., description="Reasoning for the suggestion")

class MaterialScopeIntegration(BaseModel):
    """Integration model for MaterialScope"""
    suggestions: List[MaterialSuggestion] = Field(..., description="Material suggestions for MaterialScope")
    auto_apply: bool = Field(default=False, description="Whether to auto-apply high-confidence suggestions")
    user_review_required: List[str] = Field(default=[], description="Fields requiring user review")