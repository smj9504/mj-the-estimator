"""
Material analysis API endpoints
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from typing import Optional, List
import json
import traceback

from models.material_analysis import (
    MaterialAnalysisRequest,
    MaterialAnalysisResponse, 
    MaterialType,
    MaterialScopeIntegration
)
from services.image_analysis_service import image_analysis_service
from utils.logger import logger

router = APIRouter()

@router.post("/analyze-material", response_model=MaterialAnalysisResponse)
async def analyze_material_image(
    image: UploadFile = File(..., description="Image file to analyze"),
    analysis_focus: Optional[str] = Form(None, description="JSON array of material types to focus on"),  
    room_type: Optional[str] = Form(None, description="Room type context"),
    analysis_areas: Optional[str] = Form(None, description="JSON array of selected areas to analyze")
):
    """
    Analyze uploaded image to identify building materials
    
    Args:
        image: Image file (JPEG, PNG, WebP, BMP)
        analysis_focus: Optional JSON array of material types to focus on
        room_type: Optional room type for context (kitchen, bathroom, etc.)
        analysis_areas: Optional JSON array of selected areas (polygons) to analyze
        
    Returns:
        MaterialAnalysisResponse with detected materials
    """
    try:
        # Validate file type
        if not image.content_type or not image.content_type.startswith('image/'):
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Expected image, got {image.content_type}"
            )
        
        # Read image data
        image_data = await image.read()
        if len(image_data) == 0:
            raise HTTPException(status_code=400, detail="Empty image file")
        
        # Parse analysis focus if provided
        focus_types = None
        if analysis_focus:
            try:
                focus_list = json.loads(analysis_focus)
                focus_types = [MaterialType(item) for item in focus_list]
            except (json.JSONDecodeError, ValueError) as e:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid analysis_focus format: {str(e)}"
                )
        
        # Parse analysis areas if provided
        areas = None
        if analysis_areas:
            try:
                areas = json.loads(analysis_areas)
                logger.info(f"Analysis areas provided: {len(areas)} areas")
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid analysis_areas format: {str(e)}"
                )
        
        logger.info(
            f"Starting material analysis for image: {image.filename}",
            image_size=len(image_data),
            content_type=image.content_type,
            focus_types=focus_types,
            room_type=room_type,
            analysis_areas=len(areas) if areas else 0
        )
        
        # Perform analysis
        result = image_analysis_service.analyze_materials(
            image_data=image_data,
            analysis_focus=focus_types,
            room_type=room_type,
            analysis_areas=areas
        )
        
        logger.info(
            f"Material analysis completed",
            success=result.success,
            materials_found=len(result.materials),
            overall_confidence=result.overall_confidence,
            processing_time=result.processing_time
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Material analysis failed: {str(e)}", 
                    error=str(e), 
                    traceback=traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.post("/analyze-material-base64", response_model=MaterialAnalysisResponse)
async def analyze_material_base64(request: dict):
    """
    Analyze base64 encoded image to identify building materials
    
    Args:
        request: Dict containing:
            - image_data: Base64 encoded image data
            - analysis_focus: Optional list of material types
            - room_type: Optional room type context
    """
    try:
        image_data_b64 = request.get('image_data')
        if not image_data_b64:
            raise HTTPException(status_code=400, detail="Missing image_data")
        
        # Decode base64 image
        import base64
        try:
            # Remove data URL prefix if present
            if ',' in image_data_b64:
                image_data_b64 = image_data_b64.split(',')[1]
            
            image_data = base64.b64decode(image_data_b64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {str(e)}")
        
        # Parse focus types
        focus_types = None
        if request.get('analysis_focus'):
            try:
                focus_types = [MaterialType(item) for item in request['analysis_focus']]
            except ValueError as e:
                raise HTTPException(status_code=400, detail=f"Invalid material type: {str(e)}")
        
        room_type = request.get('room_type')
        
        logger.info(
            "Starting base64 material analysis",
            image_size=len(image_data),
            focus_types=focus_types,
            room_type=room_type
        )
        
        # Perform analysis
        result = image_analysis_service.analyze_materials(
            image_data=image_data,
            analysis_focus=focus_types,
            room_type=room_type
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Base64 material analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.post("/generate-material-suggestions", response_model=MaterialScopeIntegration)
async def generate_material_suggestions(request: dict):
    """
    Generate MaterialScope integration suggestions from analysis results
    
    Args:
        request: Dict containing:
            - materials: List of MaterialAnalysisResult objects
            - room_type: Optional room type context
    """
    try:
        materials_data = request.get('materials', [])
        room_type = request.get('room_type')
        
        if not materials_data:
            raise HTTPException(status_code=400, detail="No materials provided")
        
        # Convert dict data back to MaterialAnalysisResult objects
        from models.material_analysis import MaterialAnalysisResult
        materials = []
        
        for item in materials_data:
            try:
                material = MaterialAnalysisResult(**item)
                materials.append(material)
            except Exception as e:
                logger.warning(f"Failed to parse material item: {e}")
                continue
        
        if not materials:
            raise HTTPException(status_code=400, detail="No valid materials found")
        
        # Generate suggestions
        suggestions = image_analysis_service.generate_material_scope_suggestions(
            materials=materials,
            room_type=room_type
        )
        
        logger.info(
            f"Generated {len(suggestions.suggestions)} material suggestions",
            auto_apply=suggestions.auto_apply,
            review_required=len(suggestions.user_review_required)
        )
        
        return suggestions
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Material suggestions generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Suggestions generation failed: {str(e)}")

@router.get("/material-types")
async def get_material_types():
    """Get list of supported material types"""
    return {
        "material_types": [
            {"value": "floor", "label": "Floor"},
            {"value": "wall", "label": "Wall"}, 
            {"value": "ceiling", "label": "Ceiling"},
            {"value": "baseboard", "label": "Baseboard"},
            {"value": "quarter_round", "label": "Quarter Round"},
            {"value": "trim", "label": "Trim"},
            {"value": "countertop", "label": "Countertop"},
            {"value": "cabinet", "label": "Cabinet"}
        ]
    }

@router.get("/health")
async def health_check():
    """Health check endpoint for material analysis service"""
    try:
        # Quick test of the service
        test_result = image_analysis_service._get_mock_analysis_results()
        
        return {
            "status": "healthy",
            "service": "material_analysis",
            "mock_mode": image_analysis_service.max_image_size is not None,
            "supported_formats": image_analysis_service.supported_formats,
            "max_image_size": image_analysis_service.max_image_size
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Service unhealthy: {str(e)}")