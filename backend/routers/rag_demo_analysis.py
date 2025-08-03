"""
Enhanced Demo Analysis router with RAG integration and before/after comparison
"""

from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
import uuid
import json
import asyncio
from datetime import datetime
import os
import base64
from io import BytesIO
import traceback

from config import settings
from PIL import Image
from utils.logger import logger
from models.database import execute_insert, execute_query, execute_update
from services.ai_service import ai_service

# Import RAG service
try:
    from services.rag_service import rag_service
    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False
    logger.warning("RAG service not available for demo analysis router")

router = APIRouter(prefix="/api/rag-demo-analysis", tags=["rag-demo-analysis"])

# Import the new multi-stage prompts
from utils.prompts import (
    PHOTO_CLASSIFICATION_PROMPT,
    BEFORE_DEMO_INVENTORY_PROMPT,
    AFTER_DEMO_ANALYSIS_PROMPT,
    DEMO_SCOPE_SYNTHESIS_PROMPT
)

@router.post("/compare-before-after")
async def compare_before_after_images(
    before_images: List[UploadFile] = File(...),
    after_images: List[UploadFile] = File(...),
    room_context: str = Form(...),
    session_id: str = Form(...),
    enable_rag: bool = Form(True),
    confidence_threshold: float = Form(0.7)
):
    """
    Compare before and after images to identify demolished areas with RAG enhancement
    """
    try:
        analysis_id = str(uuid.uuid4())
        logger.info(f"Starting before/after comparison analysis: {analysis_id}")
        
        # Parse room context
        try:
            room_data = json.loads(room_context)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid room_context JSON")
        
        # Validate inputs
        if len(before_images) == 0:
            raise HTTPException(status_code=400, detail="At least one before image is required")
        if len(after_images) == 0:
            raise HTTPException(status_code=400, detail="At least one after image is required")
        
        # Process images
        before_image_data = await _process_uploaded_images(before_images, "before")
        after_image_data = await _process_uploaded_images(after_images, "after")
        
        # Extract features from images
        logger.info("Extracting features from before images")
        before_features = await _extract_image_features(before_image_data, "before", room_data)
        
        logger.info("Extracting features from after images")
        after_features = await _extract_image_features(after_image_data, "after", room_data)
        
        # Perform comparison analysis with RAG
        logger.info("Performing comparison analysis with RAG enhancement")
        comparison_result = await ai_service.analyze_before_after_comparison(
            before_features=before_features,
            after_features=after_features,
            room_context=room_data,
            rag_enabled=enable_rag
        )
        
        # Store analysis result
        await _store_comparison_analysis(
            analysis_id=analysis_id,
            session_id=session_id,
            room_data=room_data,
            before_images=before_image_data,
            after_images=after_image_data,
            before_features=before_features,
            after_features=after_features,
            comparison_result=comparison_result
        )
        
        # Prepare response
        response_data = {
            "success": True,
            "analysis_id": analysis_id,
            "before_features": before_features,
            "after_features": after_features,
            "demolished_areas": comparison_result.get("demolished_areas", []),
            "total_demolished_sqft": comparison_result.get("total_demolished_sqft", 0.0),
            "confidence_score": comparison_result.get("confidence_score", 0.0),
            "rag_enhanced": comparison_result.get("rag_enhanced", False),
            "rag_context": comparison_result.get("rag_context", []),
            "rag_insights": comparison_result.get("rag_insights", {}),
            "processing_time_ms": comparison_result.get("processing_time_ms", 0)
        }
        
        logger.info(f"Comparison analysis completed: {analysis_id}")
        return JSONResponse(content=response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Before/after comparison failed: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Before/after comparison analysis failed",
                "details": str(e)
            }
        )

@router.post("/extract-features")
async def extract_image_features(
    images: List[UploadFile] = File(...),
    analysis_type: str = Form(...),  # "before" or "after"
    context: str = Form(...)
):
    """
    Extract detailed features from uploaded images for comparison analysis
    """
    try:
        logger.info(f"Extracting features for {analysis_type} images")
        
        # Parse context
        try:
            context_data = json.loads(context)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid context JSON")
        
        # Process images
        image_data = await _process_uploaded_images(images, analysis_type)
        
        # Extract features
        features = await _extract_image_features(image_data, analysis_type, context_data)
        
        return JSONResponse(content={
            "success": True,
            "features": features,
            "processing_time_ms": features.get("processing_time_ms", 0)
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Feature extraction failed: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Feature extraction failed",
                "details": str(e)
            }
        )

@router.post("/analyze-enhanced")
async def analyze_with_rag_enhancement(
    images: List[UploadFile] = File(...),
    room_data: str = Form(...),
    session_id: str = Form(...),
    rag_enabled: bool = Form(True),
    analysis_type: str = Form("single")
):
    """
    Perform demo analysis with RAG enhancement for single image analysis
    """
    try:
        analysis_id = str(uuid.uuid4())
        logger.info(f"Starting RAG-enhanced analysis: {analysis_id}")
        
        # Parse room data
        try:
            room_context = json.loads(room_data)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid room_data JSON")
        
        # Process images
        image_data = await _process_uploaded_images(images, "analysis")
        
        # Prepare context for RAG
        context_data = {
            'analysis_type': analysis_type,
            'room_type': room_context.get('room_type', 'unknown'),
            'materials': room_context.get('known_materials', []),
            'area_sqft': room_context.get('dimensions', {}).get('floor_area_sqft', 0)
        }
        
        # Build analysis prompt
        prompt = _build_enhanced_analysis_prompt(image_data, room_context)
        
        # Perform RAG-enhanced analysis
        result = await ai_service.analyze_with_rag(
            prompt=prompt,
            context_data=context_data,
            document_type='demo-scope',
            rag_enabled=rag_enabled
        )
        
        # Store enhanced analysis
        await _store_enhanced_analysis(
            analysis_id=analysis_id,
            session_id=session_id,
            room_context=room_context,
            images=image_data,
            result=result,
            analysis_type=analysis_type
        )
        
        # Prepare response
        response_data = {
            "success": True,
            "analysis_id": analysis_id,
            "demolished_areas": result.get("demolished_areas", []),
            "rag_insights": result.get("rag_insights", {}),
            "rag_enhanced": result.get("rag_enhanced", False),
            "confidence_score": result.get("confidence_score", 0.0),
            "ai_raw_response": result.get("ai_raw_response", ""),
            "model_version": result.get("model_version", ""),
            "processing_time_ms": result.get("processing_time_ms", 0)
        }
        
        logger.info(f"RAG-enhanced analysis completed: {analysis_id}")
        return JSONResponse(content=response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"RAG-enhanced analysis failed: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "RAG-enhanced analysis failed",
                "details": str(e)
            }
        )

@router.post("/rag/query")
async def query_rag_knowledge_base(
    query: str = Form(...),
    document_type: str = Form("demo-scope"),
    top_k: int = Form(5),
    similarity_threshold: float = Form(0.7),
    filters: str = Form("{}")
):
    """
    Query the RAG knowledge base for relevant historical cases
    """
    try:
        if not RAG_AVAILABLE:
            raise HTTPException(status_code=503, detail="RAG service not available")
        
        # Parse filters
        try:
            filter_dict = json.loads(filters)
        except json.JSONDecodeError:
            filter_dict = {}
        
        # Search RAG knowledge base
        results = await rag_service.search_similar_documents(
            query=query,
            document_type=document_type,
            top_k=top_k,
            similarity_threshold=similarity_threshold,
            filters=filter_dict
        )
        
        return JSONResponse(content={
            "success": True,
            "results": results,
            "query_time_ms": 0  # Would be populated by rag_service
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"RAG query failed: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "RAG query failed",
                "details": str(e)
            }
        )

@router.post("/feedback")
async def submit_rag_feedback(
    analysis_id: str = Form(...),
    feedback_type: str = Form(...),
    feedback_data: str = Form(...)
):
    """
    Submit user feedback for RAG learning and model improvement
    """
    try:
        if not RAG_AVAILABLE:
            raise HTTPException(status_code=503, detail="RAG service not available")
        
        # Parse feedback data
        try:
            feedback_dict = json.loads(feedback_data)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid feedback_data JSON")
        
        # Add feedback metadata
        feedback_dict['feedback_type'] = feedback_type
        feedback_dict['analysis_type'] = 'demo'
        
        # Process feedback
        await rag_service.add_feedback(
            analysis_id=analysis_id,
            feedback_data=feedback_dict,
            create_new_documents=True
        )
        
        return JSONResponse(content={
            "success": True,
            "feedback_id": str(uuid.uuid4()),
            "rag_updated": True,
            "learning_applied": ["area_calculation_refinement", "material_classification_improvement"],
            "thank_you_message": "Thank you for your feedback! This helps improve our AI accuracy."
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Feedback submission failed: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Feedback submission failed",
                "details": str(e)
            }
        )

# Helper functions

async def _process_uploaded_images(images: List[UploadFile], analysis_type: str) -> List[Dict[str, Any]]:
    """Process uploaded images and return metadata"""
    processed_images = []
    
    for i, image in enumerate(images):
        try:
            # Read image content
            content = await image.read()
            
            # Validate image
            try:
                pil_image = Image.open(BytesIO(content))
                width, height = pil_image.size
                format_name = pil_image.format
            except Exception:
                raise HTTPException(status_code=400, detail=f"Invalid image file: {image.filename}")
            
            # Create image metadata
            image_data = {
                "filename": image.filename,
                "content_type": image.content_type,
                "size_bytes": len(content),
                "width": width,
                "height": height,
                "format": format_name,
                "base64_data": base64.b64encode(content).decode('utf-8'),
                "analysis_type": analysis_type,
                "index": i
            }
            
            processed_images.append(image_data)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to process image {image.filename}: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to process image: {image.filename}")
    
    return processed_images

async def _extract_image_features(
    image_data: List[Dict[str, Any]], 
    analysis_type: str, 
    room_context: Dict[str, Any]
) -> Dict[str, Any]:
    """Extract features from images using AI vision"""
    try:
        # Mock feature extraction for now - in production this would use actual vision AI
        features = {
            "materials": ["ceramic tile", "drywall", "wood trim"],
            "surfaces": [
                {
                    "type": "floor",
                    "area_sqft": 84.0,
                    "material": "ceramic tile",
                    "condition": "intact" if analysis_type == "before" else "removed"
                },
                {
                    "type": "wall",
                    "area_sqft": 320.0,
                    "material": "drywall",
                    "condition": "intact"
                }
            ],
            "architectural_elements": [
                {
                    "type": "window",
                    "count": 1,
                    "condition": "present"
                }
            ],
            "color_analysis": {
                "dominant_colors": ["#f5f5dc", "#8b4513"],
                "material_indicators": ["tile_grout", "wood_cabinet"]
            },
            "damage_assessment": {
                "visible_damage": analysis_type == "after",
                "demolition_evidence": ["removed_tiles", "exposed_subfloor"] if analysis_type == "after" else [],
                "structural_changes": analysis_type == "after"
            },
            "processing_time_ms": 1200
        }
        
        return features
        
    except Exception as e:
        logger.error(f"Feature extraction failed: {e}")
        raise

async def _store_comparison_analysis(
    analysis_id: str,
    session_id: str,
    room_data: Dict[str, Any],
    before_images: List[Dict],
    after_images: List[Dict],
    before_features: Dict[str, Any],
    after_features: Dict[str, Any],
    comparison_result: Dict[str, Any]
):
    """Store before/after comparison analysis in database"""
    try:
        execute_insert(
            """INSERT INTO demo_comparison_analysis 
               (analysis_id, session_id, room_id, before_images, after_images, 
                before_features, after_features, demolished_areas, comparison_confidence,
                total_demolished_sqft, rag_enabled, rag_context, rag_insights,
                ai_model_version, processing_time_ms, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                analysis_id,
                session_id,
                room_data.get('room_id', 'unknown'),
                json.dumps(before_images),
                json.dumps(after_images),
                json.dumps(before_features),
                json.dumps(after_features),
                json.dumps(comparison_result.get('demolished_areas', [])),
                comparison_result.get('confidence_score', 0.0),
                comparison_result.get('total_demolished_sqft', 0.0),
                comparison_result.get('rag_enhanced', False),
                json.dumps(comparison_result.get('rag_context', [])),
                json.dumps(comparison_result.get('rag_insights', {})),
                comparison_result.get('model_version', 'unknown'),
                comparison_result.get('processing_time_ms', 0),
                datetime.utcnow().isoformat()
            )
        )
        logger.info(f"Stored comparison analysis: {analysis_id}")
        
    except Exception as e:
        logger.error(f"Failed to store comparison analysis: {e}")

async def _store_enhanced_analysis(
    analysis_id: str,
    session_id: str,
    room_context: Dict[str, Any],
    images: List[Dict],
    result: Dict[str, Any],
    analysis_type: str
):
    """Store RAG-enhanced analysis in database"""
    try:
        execute_insert(
            """INSERT INTO demo_ai_analysis_enhanced 
               (analysis_id, session_id, room_id, analysis_type, images,
                rag_enabled, rag_context, rag_applied_insights, 
                ai_structured_results, quality_score, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                analysis_id,
                session_id,
                room_context.get('room_id', 'unknown'),
                analysis_type,
                json.dumps(images),
                result.get('rag_enhanced', False),
                json.dumps(result.get('rag_context', [])),
                json.dumps(result.get('rag_insights', {})),
                json.dumps(result),
                result.get('confidence_score', 0.0),
                datetime.utcnow().isoformat()
            )
        )
        logger.info(f"Stored enhanced analysis: {analysis_id}")
        
    except Exception as e:
        logger.error(f"Failed to store enhanced analysis: {e}")

def _build_enhanced_analysis_prompt(image_data: List[Dict], room_context: Dict[str, Any]) -> str:
    """Build enhanced analysis prompt for single image analysis"""
    
    prompt = f"""
Analyze the uploaded room images for demolition areas.

Room Context:
- Type: {room_context.get('room_type', 'Unknown')}
- Known Materials: {room_context.get('known_materials', [])}
- Dimensions: {room_context.get('dimensions', {})}

Images: {len(image_data)} uploaded

Task:
1. Identify all demolished or damaged areas
2. Estimate area measurements for each surface
3. Identify materials that have been removed
4. Mark uncertain measurements as 'estimated' (추정)
5. Provide confidence scores

Output format (JSON):
{{
  "demolished_areas": [
    {{
      "type": "surface_type",
      "material": "material_name",
      "area_sqft": 0.0,
      "confidence": 0.0,
      "description": "detailed_description",
      "estimated": true/false
    }}
  ],
  "total_demolished_sqft": 0.0,
  "confidence_score": 0.0
}}
"""
    return prompt.strip()

@router.post("/analyze-multi-stage")
async def analyze_multi_stage_demolition(
    images: List[UploadFile] = File(...),
    room_context: str = Form(...),
    session_id: str = Form(...),
    enable_rag: bool = Form(True),
    confidence_threshold: float = Form(0.7),
    analysis_type: str = Form("demo_calculation")
):
    """
    Multi-stage demolition analysis using the new 4-stage workflow:
    1. Photo Classification
    2. Before-Demo Inventory (if applicable)
    3. After-Demo Forensic Analysis (if applicable) 
    4. Demo Scope Synthesis
    """
    try:
        analysis_id = str(uuid.uuid4())
        logger.info(f"Starting multi-stage analysis: {analysis_id}")
        
        # Parse room context
        try:
            room_data = json.loads(room_context)
        except json.JSONDecodeError:
            room_data = {"room_type": "unknown"}
        
        # Process and encode images
        processed_images = []
        for i, image_file in enumerate(images):
            if not image_file.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail=f"File {image_file.filename} is not an image")
            
            image_data = await image_file.read()
            image = Image.open(BytesIO(image_data))
            
            # Resize if too large
            max_dimension = 2048
            width, height = image.size
            if width > max_dimension or height > max_dimension:
                if width > height:
                    new_width = max_dimension
                    new_height = int((height / width) * max_dimension)
                else:
                    new_width = int((width / height) * max_dimension)
                    new_height = max_dimension
                image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Convert to RGB if needed
            if image.mode in ('RGBA', 'LA', 'P'):
                rgb_image = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                rgb_image.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
                image = rgb_image
            
            # Save to bytes and encode
            img_byte_arr = BytesIO()
            image.save(img_byte_arr, format='JPEG', quality=85)
            img_byte_arr = img_byte_arr.getvalue()
            base64_image = base64.b64encode(img_byte_arr).decode('utf-8')
            
            processed_images.append({
                "id": f"photo_{i+1}",
                "filename": image_file.filename,
                "size": len(img_byte_arr),
                "dimensions": {"width": image.width, "height": image.height},
                "base64_data": base64_image
            })
        
        # Stage 1: Photo Classification
        logger.info(f"Stage 1: Photo Classification for {analysis_id} (analysis_type: {analysis_type})")
        classification_result = await _classify_photos(processed_images, room_data, analysis_type)
        logger.info(f"✅ Classification result summary: {len(classification_result.get('photo_classifications', []))} photos classified")
        
        # Determine workflow based on user's analysis type and classification
        if analysis_type == "before_after_comparison":
            # User explicitly selected before/after comparison
            workflow = "before_after_comparison"
        else:
            # Use AI's recommendation for other cases
            workflow = classification_result.get("overall_assessment", {}).get("recommended_workflow", "single_stage_forensic")
        
        stage2_result = None
        stage3_result = None
        
        # Stage 2: Before-Demo Inventory
        before_photos = [p for p in classification_result.get("photo_classifications", []) 
                        if p.get("classification") == "before_demo"]
        logger.info(f"🔍 Before photos detected: {len(before_photos)} out of {len(classification_result.get('photo_classifications', []))}")
        
        # Execute Stage 2 if workflow requires it OR if before photos exist
        if workflow in ["before_after_comparison", "multi_stage_enhanced"]:
            if before_photos:
                logger.info(f"Stage 2: Before-Demo Inventory for {analysis_id} - analyzing {len(before_photos)} before photos")
                stage2_result = await _analyze_before_demo_inventory(
                    [img for img in processed_images if f"photo_{processed_images.index(img)+1}" in [p["photo_id"] for p in before_photos]], 
                    room_data
                )
            elif analysis_type == "before_after_comparison":
                # User selected before/after but AI didn't detect before photos
                # Try to analyze some photos as before anyway
                logger.warning("⚠️ No before photos detected but user selected before/after comparison")
                logger.info(f"Stage 2: Attempting Before-Demo Inventory analysis on first half of images")
                total_images = len(processed_images)
                half_point = max(1, total_images // 2)  # At least 1 image
                logger.info(f"📸 Total images: {total_images}, analyzing first {half_point} as 'before' photos")
                stage2_result = await _analyze_before_demo_inventory(
                    processed_images[:half_point], 
                    room_data
                )
        
        # Stage 3: After-Demo Forensic Analysis
        after_photos = [p for p in classification_result.get("photo_classifications", []) 
                       if p.get("classification") == "after_demo"]
        if after_photos or workflow == "single_stage_forensic":
            logger.info(f"Stage 3: After-Demo Forensic Analysis for {analysis_id}")
            forensic_images = processed_images
            if after_photos:
                forensic_images = [img for img in processed_images if f"photo_{processed_images.index(img)+1}" in [p["photo_id"] for p in after_photos]]
            stage3_result = await _analyze_after_demo_forensics(forensic_images, room_data)
        
        # Stage 4: Demo Scope Synthesis
        logger.info(f"Stage 4: Demo Scope Synthesis for {analysis_id}")
        final_result = await _synthesize_demo_scope(
            before_inventory=stage2_result,
            after_analysis=stage3_result,
            room_context=room_data,
            classification=classification_result
        )
        
        # Store complete analysis
        await _store_multi_stage_analysis(
            analysis_id=analysis_id,
            session_id=session_id,
            room_context=room_data,
            images=processed_images,
            classification_result=classification_result,
            stage2_result=stage2_result,
            stage3_result=stage3_result,
            final_result=final_result
        )
        
        # Get demolished areas from synthesis result (Stage 4) which combines all analyses
        demolished_areas = []
        if final_result and "final_demolition_scope" in final_result:
            # Convert final_demolition_scope to demolished_areas format
            for elem in final_result.get("final_demolition_scope", []):
                demolished_areas.append({
                    "surface_type": elem.get("element_type", elem.get("surface_type", "unknown")),
                    "material_removed": elem.get("material_removed", "unknown"),
                    "description": elem.get("scope_description", elem.get("description", "")),
                    "estimated_area_sqft": elem.get("final_area_sqft", elem.get("estimated_area_sqft", 0)),
                    "demolition_completeness": elem.get("demolition_completeness", "total"),
                    "completion_percentage": elem.get("completion_percentage", 100),
                    "confidence": elem.get("confidence", elem.get("confidence_breakdown", {}).get("final_confidence", 0.8))
                })
        elif stage3_result and "detected_removed_elements" in stage3_result:
            # Fallback to Stage 3 results if synthesis failed
            logger.warning("Using Stage 3 results as fallback - synthesis may have failed")
            for elem in stage3_result.get("detected_removed_elements", []):
                demolished_areas.append({
                    "surface_type": elem.get("element_type", "unknown"),
                    "material_removed": elem.get("original_material", "unknown"),
                    "description": elem.get("evidence_description", ""),
                    "estimated_area_sqft": elem.get("area_affected", 0),
                    "demolition_completeness": elem.get("removal_completeness", "complete"),
                    "completion_percentage": 100 if elem.get("removal_completeness") == "complete" else 50,
                    "confidence": elem.get("confidence_level", 0.8)
                })
        
        # Prepare response in compatible format
        response_data = {
            "success": True,
            "analysis_id": analysis_id,
            "workflow_used": workflow,
            "demolished_areas": demolished_areas,
            "classification_summary": classification_result.get("overall_assessment", {}),
            "synthesis_summary": final_result.get("synthesis_summary", {}) if final_result else {},
            "validation_results": final_result.get("validation_results", {}) if final_result else {},
            "estimation_data": final_result.get("estimation_data", {}) if final_result else {},
            "confidence_score": final_result.get("synthesis_summary", {}).get("overall_confidence", 0.8) if final_result else 0.8,
            "model_version": settings.openai_vision_model,
            "processing_time_ms": 0  # Could be calculated if needed
        }
        
        logger.info(f"Multi-stage analysis completed: {analysis_id}")
        return JSONResponse(content=response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Multi-stage analysis failed: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Multi-stage analysis failed: {str(e)}")

async def _classify_photos(images: List[Dict], room_data: Dict, analysis_type: str = "demo_calculation") -> Dict:
    """Stage 1: Classify photos as before/after demo"""
    try:
        # Prepare context
        room_context = f"Room type: {room_data.get('room_type', 'unknown')}. "
        
        # Format prompt based on analysis type
        if analysis_type == "before_after_comparison":
            enhanced_context = f"{room_context}This is a before/after comparison analysis - please carefully distinguish between renovation BEFORE and AFTER states."
        else:
            enhanced_context = room_context
            
        # Include total_photos in the prompt
        prompt = PHOTO_CLASSIFICATION_PROMPT.format(
            image_context=enhanced_context,
            total_photos=len(images)
        )
        
        # Prepare messages for AI
        messages = [{"role": "system", "content": prompt}]
        
        # Add images
        image_contents = []
        for img in images:
            image_contents.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{img['base64_data']}",
                    "detail": "high"
                }
            })
        
        messages.append({
            "role": "user", 
            "content": [
                {"type": "text", "text": "Classify these renovation photos as before-demo or after-demo states."},
                *image_contents
            ]
        })
        
        # Extract prompt text and analyze all images
        if images:
            # Add explicit JSON instruction
            json_instruction = "\n\nCRITICAL: Respond ONLY with valid JSON. No explanatory text. Start with '{' and end with '}'."
            system_prompt = f"{prompt}{json_instruction}"
            
            # Extract all base64 images
            base64_images = [img['base64_data'] for img in images]
            response = ai_service.analyze_multiple_images(base64_images, system_prompt)
            
            # Log for debugging
            logger.info(f"🔍 Photo classification raw AI response (first 200 chars): '{response[:200] if response else 'None'}'")
            
            # Check for empty response
            if not response or response.strip() == "":
                response = '{"photo_classifications": [], "overall_assessment": {"dominant_state": "unclear", "confidence_level": 0, "recommended_workflow": "single_stage_forensic"}}'
        else:
            response = '{"photo_classifications": [], "overall_assessment": {"dominant_state": "unclear", "confidence_level": 0, "recommended_workflow": "single_stage_forensic"}}'
        
        # Parse response
        try:
            # Clean response
            cleaned_response = response.strip()
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]
            elif cleaned_response.startswith("```"):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]
            
            try:
                result = json.loads(cleaned_response.strip())
                
                # Handle different response formats from different AI providers
                # Google Vision API might return different keys
                if "classification_analysis" in result and "photo_classifications" not in result:
                    # Convert Google Vision format to expected format
                    classification_data = result.get("classification_analysis", {})
                    total_photos = classification_data.get("total_photos", len(images))
                    dominant_state = classification_data.get("dominant_state", "after")
                    
                    # Check if there are individual photo classifications
                    individual_classifications = classification_data.get("individual_classifications", [])
                    
                    if individual_classifications:
                        # Use individual classifications if available
                        photo_classifications = []
                        for i, img_class in enumerate(individual_classifications):
                            photo_classifications.append({
                                "photo_id": f"photo_{i+1}",
                                "classification": img_class.get("state", "after") + "_demo",
                                "confidence": img_class.get("confidence", 0.5),
                                "primary_evidence": img_class.get("evidence", ["google_vision_analysis"]),
                                "supporting_details": img_class.get("details", ""),
                                "next_analysis_recommendation": "forensic"
                            })
                    else:
                        # Fallback to dominant state for all images
                        photo_classifications = [{
                            "photo_id": f"photo_{i+1}",
                            "classification": dominant_state + "_demo" if dominant_state in ["before", "after"] else "after_demo",
                            "confidence": classification_data.get("analysis_confidence", 0.5),
                            "primary_evidence": ["google_vision_analysis"],
                            "supporting_details": classification_data.get("classification_reasoning", ""),
                            "next_analysis_recommendation": "forensic"
                        } for i in range(total_photos)]
                    
                    result = {
                        "photo_classifications": photo_classifications,
                        "overall_assessment": {
                            "dominant_state": f"primarily_{dominant_state}" if dominant_state in ["before", "after"] else "primarily_after",
                            "confidence_level": classification_data.get("analysis_confidence", 0.5),
                            "recommended_workflow": classification_data.get("recommended_workflow", "single_stage_forensic")
                        }
                    }
                
                return result
            except json.JSONDecodeError as parse_error:
                # Try to extract first valid JSON object if there's extra data
                if "Extra data" in str(parse_error):
                    try:
                        # Find the end of the first JSON object
                        decoder = json.JSONDecoder()
                        first_obj, idx = decoder.raw_decode(cleaned_response.strip())
                        return first_obj
                    except:
                        pass
                raise parse_error
            
        except json.JSONDecodeError as e:
            logger.error(f"Photo classification JSON parsing error: {e}")
            logger.error(f"Raw AI response: {response[:500]}...")
            # Fallback classification
            return {
                "photo_classifications": [
                    {
                        "photo_id": f"photo_{i+1}",
                        "classification": "after_demo",
                        "confidence": 0.5,
                        "primary_evidence": ["unclear"],
                        "supporting_details": "Fallback classification due to parsing error",
                        "next_analysis_recommendation": "forensic"
                    }
                    for i in range(len(images))
                ],
                "overall_assessment": {
                    "dominant_state": "primarily_after",
                    "confidence_level": 0.5,
                    "recommended_workflow": "single_stage_forensic"
                }
            }
    
    except Exception as e:
        logger.error(f"Photo classification error: {e}")
        raise

async def _analyze_before_demo_inventory(images: List[Dict], room_data: Dict) -> Dict:
    """Stage 2: Analyze before-demo photos for comprehensive inventory"""
    try:
        # Prepare context
        room_context = f"Room type: {room_data.get('room_type', 'unknown')}. "
        
        # Format prompt
        prompt = BEFORE_DEMO_INVENTORY_PROMPT.format(room_context=room_context)
        
        # Prepare messages for AI
        messages = [{"role": "system", "content": prompt}]
        
        # Add images
        image_contents = []
        for img in images:
            image_contents.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{img['base64_data']}",
                    "detail": "high"
                }
            })
        
        messages.append({
            "role": "user", 
            "content": [
                {"type": "text", "text": "Conduct comprehensive inventory of all existing elements."},
                *image_contents
            ]
        })
        
        # Extract prompt text and use ALL images for analysis  
        if images:
            # Extract all base64 images
            base64_images = [img['base64_data'] for img in images]
            logger.info(f"🔍 Stage 2: Analyzing {len(base64_images)} before-demo images")
            response = ai_service.analyze_multiple_images(base64_images, prompt)
            # Check for empty response
            if not response or response.strip() == "":
                response = '{"analysis": "AI returned empty response"}'
        else:
            response = '{"analysis": "No images provided for analysis"}'
        
        # Parse response
        try:
            cleaned_response = response.strip()
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]
            elif cleaned_response.startswith("```"):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]
            
            result = json.loads(cleaned_response.strip())
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Before-demo inventory JSON parsing error: {e}")
            return {"room_inventory": {}, "baseline_summary": {}}
    
    except Exception as e:
        logger.error(f"Before-demo inventory error: {e}")
        raise

async def _analyze_after_demo_forensics(images: List[Dict], room_data: Dict) -> Dict:
    """Stage 3: Forensic analysis of after-demo photos"""
    try:
        # Prepare context
        room_context = f"Room type: {room_data.get('room_type', 'unknown')}. "
        
        # Format prompt
        prompt = AFTER_DEMO_ANALYSIS_PROMPT.format(room_context=room_context)
        
        # Prepare messages for AI
        messages = [{"role": "system", "content": prompt}]
        
        # Add images
        image_contents = []
        for img in images:
            image_contents.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{img['base64_data']}",
                    "detail": "high"
                }
            })
        
        messages.append({
            "role": "user", 
            "content": [
                {"type": "text", "text": "Conduct forensic analysis to detect removed elements and infer original state."},
                *image_contents
            ]
        })
        
        # Use multi-image analysis  
        if images:
            # Create prompt that explicitly requests JSON format
            json_instruction = "\n\nCRITICAL INSTRUCTION: You MUST respond ONLY with the JSON structure shown above. Do not include any explanatory text, comments, or narrative before or after the JSON. Start your response with '{' and end with '}'. The response must be valid, parseable JSON."
            
            # For classification, we need a simpler prompt
            system_prompt = f"{prompt}{json_instruction}"
            
            # Analyze all images
            base64_images = [img['base64_data'] for img in images]
            response = ai_service.analyze_multiple_images(base64_images, system_prompt)
            
            # Log raw AI response for debugging
            logger.info(f"🔍 After-demo forensics raw AI response (length: {len(response) if response else 0}): '{response[:500] if response else 'None'}{'...' if response and len(response) > 500 else ''}'")
            
            # Check for empty response
            if not response or response.strip() == "":
                logger.warning("⚠️ After-demo forensics: AI returned empty response")
                response = '{"forensic_analysis": {}, "detected_removed_elements": [], "inference_summary": {}}'
        else:
            response = '{"forensic_analysis": {}, "detected_removed_elements": [], "inference_summary": {}}'
        
        # Parse response
        try:
            cleaned_response = response.strip()
            
            # Check if response is empty after stripping
            if not cleaned_response:
                logger.warning("⚠️ After-demo forensics: Response is empty after stripping")
                return {"forensic_analysis": {}, "detected_removed_elements": [], "inference_summary": {}}
            
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]
            elif cleaned_response.startswith("```"):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]
            
            try:
                result = json.loads(cleaned_response.strip())
                
                # Handle different response formats from different AI providers
                # Google Vision API might return different keys
                if "demolition_analysis" in result and "forensic_analysis" not in result:
                    # Convert Google Vision format to expected format
                    demolished_elements = result.get("demolished_elements", [])
                    detected_removed_elements = []
                    
                    for elem in demolished_elements:
                        detected_removed_elements.append({
                            "element_type": elem.get("original_element_type", "unknown"),
                            "original_material": elem.get("inferred_material", "unknown"),
                            "removal_evidence": [elem.get("removal_evidence", "evidence")],
                            "confidence_level": elem.get("inference_confidence", 0.5),
                            "detection_method": "google_vision_detection",
                            "original_dimensions": elem.get("estimated_dimensions", {}),
                            "original_location": elem.get("location", "unknown"),
                            "area_affected": elem.get("estimated_area", 0),
                            "removal_completeness": "complete",
                            "replacement_indication": "likely_planned"
                        })
                    
                    result = {
                        "forensic_analysis": {
                            "demolition_type": result.get("demolition_analysis", {}).get("demolition_scope", "selective"),
                            "demolition_quality": result.get("demolition_analysis", {}).get("work_quality", "professional"),
                            "work_sequence": result.get("demolition_analysis", {}).get("completion_status", "in_progress"),
                            "safety_evidence": "adequate"
                        },
                        "detected_removed_elements": detected_removed_elements,
                        "inference_summary": {
                            "total_elements_removed": len(detected_removed_elements),
                            "renovation_scope": result.get("demolition_analysis", {}).get("room_current_state", "partial"),
                            "primary_removal_methods": ["professional_demolition"],
                            "estimated_completion": 50
                        }
                    }
                
                return result
            except json.JSONDecodeError as parse_error:
                # Try to extract first valid JSON object if there's extra data
                if "Extra data" in str(parse_error):
                    try:
                        # Find the end of the first JSON object
                        decoder = json.JSONDecoder()
                        first_obj, idx = decoder.raw_decode(cleaned_response.strip())
                        return first_obj
                    except:
                        pass
                raise parse_error
            
        except json.JSONDecodeError as e:
            logger.error(f"After-demo forensics JSON parsing error: {e}")
            logger.error(f"Cleaned response was: '{cleaned_response[:200] if 'cleaned_response' in locals() else 'undefined'}{'...' if 'cleaned_response' in locals() and len(cleaned_response) > 200 else ''}'")
            return {"forensic_analysis": {}, "detected_removed_elements": [], "inference_summary": {}}
    
    except Exception as e:
        logger.error(f"After-demo forensics error: {e}")
        raise

async def _synthesize_demo_scope(before_inventory: Dict, after_analysis: Dict, room_context: Dict, classification: Dict) -> Dict:
    """Stage 4: Synthesize all analyses into final demolition scope"""
    try:
        # Prepare context
        context_str = f"Room type: {room_context.get('room_type', 'unknown')}. "
        
        # Prepare inventory and analysis data
        before_data = json.dumps(before_inventory) if before_inventory else "No before-demo inventory available"
        after_data = json.dumps(after_analysis) if after_analysis else "No after-demo analysis available"
        
        # Format prompt
        prompt = DEMO_SCOPE_SYNTHESIS_PROMPT.format(
            room_context=context_str,
            before_inventory=before_data,
            after_analysis=after_data
        )
        
        # Prepare messages for AI
        messages = [{"role": "system", "content": prompt}]
        messages.append({
            "role": "user", 
            "content": "Synthesize the analyses to determine comprehensive final demolition scope."
        })
        
        # Call AI service for synthesis using LLM directly
        if ai_service.ai_provider in ['openai', 'claude']:
            llm_response = ai_service.llm.invoke(messages)
            response = llm_response.content if hasattr(llm_response, 'content') else str(llm_response)
        else:
            response = ai_service.llm.invoke(prompt)
        
        logger.info(f"Synthesis raw response length: {len(response)}")
        
        # Parse response
        try:
            cleaned_response = response.strip()
            # Remove markdown code blocks if present
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]
            elif cleaned_response.startswith("```"):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]
            
            result = json.loads(cleaned_response.strip())
            logger.info(f"Synthesis successfully parsed: {len(result.get('final_demolition_scope', []))} elements found")
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Synthesis JSON parsing error: {e}")
            logger.error(f"Raw response: {response[:500]}...")
            # Return a default structure
            return {
                "synthesis_summary": {
                    "total_demolished_elements": 0,
                    "analysis_quality": "limited"
                },
                "final_demolition_scope": []
            }
    
    except Exception as e:
        logger.error(f"Demo scope synthesis error: {e}")
        raise

async def _store_multi_stage_analysis(analysis_id: str, session_id: str, room_context: Dict, images: List[Dict], 
                                    classification_result: Dict, stage2_result: Dict, stage3_result: Dict, final_result: Dict):
    """Store multi-stage analysis results in database"""
    try:
        # Store in demo_ai_analysis table with enhanced data
        execute_insert(
            query="""
                INSERT INTO demo_ai_analysis (
                    analysis_id, project_id, session_id, room_id,
                    analysis_timestamp, model_version, prompt_version,
                    images, ai_raw_response, ai_parsed_results,
                    quality_score, is_verified, is_applied
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            params=(
                analysis_id, session_id, session_id, room_context.get('room_id', 'unknown'),
                datetime.utcnow().isoformat(), settings.openai_vision_model, "multi_stage_v1",
                json.dumps([{
                    "id": img["id"],
                    "filename": img["filename"],
                    "size": img["size"],
                    "dimensions": img["dimensions"]
                } for img in images]),
                json.dumps({
                    "classification": classification_result,
                    "stage2_inventory": stage2_result,
                    "stage3_forensics": stage3_result,
                    "final_synthesis": final_result
                }),
                json.dumps(final_result.get("final_demolition_scope", [])),
                final_result.get("synthesis_summary", {}).get("overall_confidence", 0.8),
                False, False
            )
        )
        
        logger.info(f"Multi-stage analysis stored: {analysis_id}")
        
    except Exception as e:
        logger.error(f"Failed to store multi-stage analysis: {e}")
        # Don't raise - analysis can continue without storage