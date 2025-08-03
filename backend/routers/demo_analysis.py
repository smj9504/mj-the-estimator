from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import List, Optional
import uuid
import json
from datetime import datetime
import os
import base64
from io import BytesIO
from config import settings
from PIL import Image

import sqlite3
from models.database import get_db_connection
from services.ai_service import OpenAIService
from utils.prompts import DEMO_ANALYSIS_PROMPT, DEMO_ANALYSIS_USER_MESSAGE, BATHROOM_DEMO_SCOPE_PROMPT

router = APIRouter(prefix="/api/demo-analysis", tags=["demo-analysis"])

def get_room_measurement_data(session_id: str, room_id: str) -> dict:
    """Get measurement data for a specific room from the session"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT parsed_json FROM measurement_data 
                WHERE session_id = ? 
                ORDER BY created_at DESC LIMIT 1
            """, (session_id,))
            
            result = cursor.fetchone()
            if not result:
                return {}
            
            measurement_data = json.loads(result[0])
            
            # Find the specific room data
            for location in measurement_data:
                if location.get('location') == room_id:
                    rooms = location.get('rooms', [])
                    if rooms:
                        # Get the first room (main room) dimensions for reference
                        room = rooms[0]
                        raw_dims = room.get('raw_dimensions', {})
                        return {
                            'room_area': raw_dims.get('area', 0),
                            'room_length': raw_dims.get('length', 0),
                            'room_width': raw_dims.get('width', 0),
                            'room_height': raw_dims.get('height', 8),
                            'room_name': room.get('name', 'Unknown'),
                            'floor': room.get('floor', 'Unknown')
                        }
            
            return {}
            
    except Exception as e:
        print(f"Error getting room measurement data: {str(e)}")
        return {}


@router.post("/analyze")
async def analyze_demo_images(
    images: List[UploadFile] = File(...),
    room_id: str = Form(...),
    room_type: str = Form(...),
    project_id: str = Form(...),
    session_id: str = Form(...),
    room_materials: Optional[str] = Form(None)
):
    """
    Analyze uploaded images to detect demolished areas using AI
    """
    try:
        # Generate unique analysis ID
        analysis_id = f"ana_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{str(uuid.uuid4())[:8]}"
        
        # Validate images
        if not images or len(images) == 0:
            raise HTTPException(status_code=400, detail="No images provided")
        
        if len(images) > 10:
            raise HTTPException(status_code=400, detail="Maximum 10 images allowed")
        
        # Process and encode images
        processed_images = []
        for i, image_file in enumerate(images):
            # Validate file type
            if not image_file.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail=f"File {image_file.filename} is not an image")
            
            # Read and process image
            image_data = await image_file.read()
            
            # Resize image if too large (max 2048x2048)
            image = Image.open(BytesIO(image_data))
            
            # Calculate resize dimensions
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
            
            # Convert to JPEG if not already
            if image.mode in ('RGBA', 'LA', 'P'):
                # Convert to RGB
                rgb_image = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                rgb_image.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
                image = rgb_image
            
            # Save to bytes
            img_byte_arr = BytesIO()
            image.save(img_byte_arr, format='JPEG', quality=85)
            img_byte_arr = img_byte_arr.getvalue()
            
            # Encode to base64
            base64_image = base64.b64encode(img_byte_arr).decode('utf-8')
            
            processed_images.append({
                "id": f"img_{i+1}",
                "filename": image_file.filename,
                "size": len(img_byte_arr),
                "dimensions": {"width": image.width, "height": image.height},
                "base64_data": base64_image
            })
        
        # Parse room materials if provided
        material_data = {}
        if room_materials:
            try:
                material_data = json.loads(room_materials)
            except json.JSONDecodeError:
                material_data = {}
        
        # Get measurement data for the specific room to provide area reference
        measurement_data = get_room_measurement_data(session_id, room_id)
        
        # Call AI service for analysis
        ai_service = OpenAIService()
        
        # Analyze images
        analysis_results = await analyze_images_with_ai(ai_service, processed_images, room_type, material_data, measurement_data)
        
        # Save analysis to database
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO demo_ai_analysis (
                    analysis_id, project_id, session_id, room_id,
                    analysis_timestamp, model_version, prompt_version,
                    images, ai_raw_response, ai_parsed_results,
                    quality_score, is_verified, is_applied
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                analysis_id, project_id, session_id, room_id,
                datetime.utcnow().isoformat(), settings.openai_vision_model, "demo_v1",
                json.dumps([{
                    "id": img["id"],
                    "filename": img["filename"],
                    "size": img["size"],
                    "dimensions": img["dimensions"]
                } for img in processed_images]),
                json.dumps(analysis_results["raw_response"]),
                json.dumps(analysis_results["parsed_results"]),
                analysis_results.get("quality_score", 0.8),
                False, False
            ))
            conn.commit()
        
        # Return results
        return JSONResponse(content={
            "success": True,
            "analysis_id": analysis_id,
            "demolished_areas": analysis_results["parsed_results"]["demolished_areas"],
            "reference_objects": analysis_results["parsed_results"].get("reference_objects", []),
            "model_version": settings.openai_vision_model,
            "prompt_version": "demo_v1"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

async def analyze_images_with_ai(ai_service: OpenAIService, images: List[dict], room_type: str, material_data: dict = None, measurement_data: dict = None) -> dict:
    """
    Analyze images using OpenAI Vision API
    """
    try:
        # Prepare context for room type and materials
        room_context = f"This is a {room_type} room. "
        
        # Add room-specific analysis guidance
        if room_type.lower() == "kitchen":
            room_context += "Look for demolished cabinets, countertops, backsplash, flooring, appliances. "
            room_context += "Pay special attention to missing upper cabinets, lower cabinets, kitchen islands, and exposed plumbing/electrical where appliances were removed. "
        elif room_type.lower() == "bathroom":
            room_context += "BATHROOM RENOVATION - COMPREHENSIVE DEMOLITION ANALYSIS: "
            room_context += "Assume these standard fixtures were removed unless clearly visible and undamaged: "
            room_context += "1) Floor tiles/vinyl (100% of floor area), 2) Vanity cabinet (15-25 sq ft), 3) Toilet fixture (count as 1 unit), "
            room_context += "4) Bathtub/shower (20-40 sq ft surround), 5) Bathroom mirror (8-15 sq ft), 6) Wall tiles in shower area (50-80 sq ft), "
            room_context += "7) Plumbing fixtures (sink, faucets, towel bars). "
            room_context += "CRITICAL: Protected fixtures indicate planned removal - include them in demolition scope. "
            room_context += "Look for evidence: plumbing stubs, mounting holes, floor flanges, exposed subflooring, patched wall areas. "
        
        # Add material scope context if provided
        if material_data:
            room_context += f"\n\nMATERIAL SCOPE CONTEXT:\n"
            room_context += "The following materials were expected in this room based on Material Scope data:\n"
            
            # Add floor materials
            if material_data.get('material', {}).get('Floor'):
                floor_materials = material_data['material']['Floor']
                if isinstance(floor_materials, list):
                    floor_materials = ', '.join(floor_materials)
                room_context += f"- Floor: {floor_materials}\n"
            
            # Add wall materials
            if material_data.get('material', {}).get('wall'):
                wall_materials = material_data['material']['wall']
                if isinstance(wall_materials, list):
                    wall_materials = ', '.join(wall_materials)
                room_context += f"- Wall: {wall_materials}\n"
            
            # Add ceiling materials
            if material_data.get('material', {}).get('ceiling'):
                ceiling_materials = material_data['material']['ceiling']
                if isinstance(ceiling_materials, list):
                    ceiling_materials = ', '.join(ceiling_materials)
                room_context += f"- Ceiling: {ceiling_materials}\n"
            
            # Add any overridden materials
            if material_data.get('material_override'):
                room_context += "\nRoom-specific material overrides:\n"
                for surface, materials in material_data['material_override'].items():
                    if materials and materials != 'N/A':
                        if isinstance(materials, list):
                            materials = ', '.join(materials)
                        room_context += f"- {surface}: {materials}\n"
            
            room_context += "\nWhen analyzing demolition, consider these expected materials and identify which specific materials were removed.\n"
        
        # Add measurement data context for accurate area calculations
        if measurement_data and measurement_data.get('room_area', 0) > 0:
            room_context += f"\n\nROOM MEASUREMENT REFERENCE:\n"
            room_context += f"- Room Name: {measurement_data.get('room_name', 'Unknown')}\n"
            room_context += f"- Total Room Area: {measurement_data.get('room_area', 0):.1f} sq ft\n"
            room_context += f"- Room Dimensions: {measurement_data.get('room_length', 0):.1f} ft × {measurement_data.get('room_width', 0):.1f} ft\n"
            room_context += f"- Room Height: {measurement_data.get('room_height', 8):.1f} ft\n"
            room_context += f"- Floor: {measurement_data.get('floor', 'Unknown')}\n"
            room_context += "\nIMPORTANT: Use these room dimensions as reference when estimating demolished areas. "
            room_context += "Calculate demolished areas as realistic portions/percentages of the total room area. "
            room_context += "For example, if you see a wall section demolished, estimate what percentage of the total wall area it represents. "
            room_context += "Use logical proportions based on typical room layouts and construction.\n"
        
        # Format the prompt using the template
        formatted_prompt = DEMO_ANALYSIS_PROMPT.format(room_context=room_context)
        
        # Prepare messages for OpenAI
        messages = [
            {
                "role": "system",
                "content": formatted_prompt
            }
        ]
        
        # Add images to message
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
                {"type": "text", "text": DEMO_ANALYSIS_USER_MESSAGE},
                *image_contents
            ]
        })
        
        # Call OpenAI API
        response = await ai_service.analyze_images_for_demo(messages)
        
        # Parse response
        try:
            # Remove markdown code blocks if present
            cleaned_response = response.strip()
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]  # Remove ```json
            elif cleaned_response.startswith("```"):
                cleaned_response = cleaned_response[3:]  # Remove ```
            
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]  # Remove ending ```
            
            cleaned_response = cleaned_response.strip()
            
            parsed_results = json.loads(cleaned_response)
            
            # Debug: Log the parsed results
            print(f"🔍 Parsed AI response: {json.dumps(parsed_results, indent=2)}")
            
            # Validate response structure
            if "demolished_areas" not in parsed_results:
                parsed_results["demolished_areas"] = []
            
            # Add image references to areas
            for i, area in enumerate(parsed_results["demolished_areas"]):
                if "image_ref" not in area:
                    area["image_ref"] = f"img_{(i % len(images)) + 1}"
            
            return {
                "raw_response": response,
                "parsed_results": parsed_results,
                "quality_score": calculate_analysis_quality(parsed_results)
            }
            
        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {e}")
            print(f"Original response: {response}")
            print(f"Cleaned response: {cleaned_response if 'cleaned_response' in locals() else 'N/A'}")
            
            # If JSON parsing fails, return empty results
            return {
                "raw_response": response,
                "parsed_results": {"demolished_areas": [], "reference_objects": []},
                "quality_score": 0.1
            }
        
    except Exception as e:
        print(f"AI analysis error: {str(e)}")
        raise

def calculate_analysis_quality(results: dict) -> float:
    """
    Calculate quality score based on analysis results
    """
    score = 0.5  # Base score
    
    demolished_areas = results.get("demolished_areas", [])
    reference_objects = results.get("reference_objects", [])
    
    # Points for having detected areas
    if demolished_areas:
        score += 0.2
    
    # Points for confidence levels
    if demolished_areas:
        avg_confidence = sum(area.get("confidence", 0.5) for area in demolished_areas) / len(demolished_areas)
        score += avg_confidence * 0.2
    
    # Points for having reference objects
    if reference_objects:
        score += 0.1
    
    return min(1.0, score)

@router.post("/save")
async def save_analysis_results(request_data: dict):
    """
    Save analysis results with user modifications
    """
    try:
        analysis_id = request_data.get("analysis_id")
        if not analysis_id:
            raise HTTPException(status_code=400, detail="analysis_id is required")
        
        # Find and update existing analysis
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check if analysis exists
            cursor.execute("SELECT analysis_id FROM demo_ai_analysis WHERE analysis_id = ?", (analysis_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Analysis not found")
            
            # Update with user modifications
            update_fields = []
            update_values = []
            
            if "modifications" in request_data:
                update_fields.append("user_modifications = ?")
                update_values.append(json.dumps(request_data["modifications"]))
            
            if "final_results" in request_data:
                update_fields.append("quality_score = ?")
                update_values.append(request_data.get("quality_score", 0.8))
                
                update_fields.append("is_verified = ?")
                update_values.append(request_data.get("is_verified", False))
                
                update_fields.append("is_applied = ?")
                update_values.append(request_data.get("is_applied", False))
            
            update_fields.append("updated_at = ?")
            update_values.append(datetime.utcnow().isoformat())
            
            update_values.append(analysis_id)
            
            cursor.execute(f"""
                UPDATE demo_ai_analysis 
                SET {', '.join(update_fields)}
                WHERE analysis_id = ?
            """, update_values)
            
            conn.commit()
        
        return JSONResponse(content={
            "success": True,
            "message": "Analysis results saved successfully"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Save error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save: {str(e)}")

@router.post("/feedback")
async def submit_feedback(request_data: dict):
    """
    Submit user feedback for analysis
    """
    try:
        analysis_id = request_data.get("analysis_id")
        feedback = request_data.get("feedback")
        
        if not analysis_id or not feedback:
            raise HTTPException(status_code=400, detail="analysis_id and feedback are required")
        
        # Find and update existing analysis
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Check if analysis exists
            cursor.execute("SELECT quality_score FROM demo_ai_analysis WHERE analysis_id = ?", (analysis_id,))
            result = cursor.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="Analysis not found")
            
            current_score = result[0] or 0.8
            
            # Add timestamp to feedback
            feedback["timestamp"] = datetime.utcnow().isoformat()
            
            # Recalculate quality score based on feedback
            new_quality_score = current_score
            if "accuracy_rating" in feedback:
                feedback_factor = feedback["accuracy_rating"] / 5.0
                new_quality_score = (current_score + feedback_factor) / 2
            
            # Update feedback and quality score
            cursor.execute("""
                UPDATE demo_ai_analysis 
                SET user_feedback = ?, quality_score = ?, updated_at = ?
                WHERE analysis_id = ?
            """, (
                json.dumps(feedback),
                new_quality_score,
                datetime.utcnow().isoformat(),
                analysis_id
            ))
            
            conn.commit()
        
        return JSONResponse(content={
            "success": True,
            "message": "Feedback submitted successfully"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Feedback error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {str(e)}")

@router.get("/analysis/{analysis_id}/debug")
async def get_analysis_debug(analysis_id: str):
    """
    Get detailed debug information for an analysis including AI raw response
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT analysis_id, project_id, session_id, room_id,
                       analysis_timestamp, model_version, prompt_version,
                       images, ai_raw_response, ai_parsed_results,
                       user_modifications, user_feedback, quality_score
                FROM demo_ai_analysis 
                WHERE analysis_id = ?
            """, (analysis_id,))
            
            analysis = cursor.fetchone()
            
            if not analysis:
                raise HTTPException(status_code=404, detail="Analysis not found")
            
            # Parse JSON fields safely
            try:
                images = json.loads(analysis[7]) if analysis[7] else []
            except:
                images = []
            
            try:
                ai_raw_response = json.loads(analysis[8]) if analysis[8] else {}
            except:
                ai_raw_response = analysis[8]  # Keep as string if not JSON
            
            try:
                ai_parsed_results = json.loads(analysis[9]) if analysis[9] else {}
            except:
                ai_parsed_results = {}
            
            try:
                user_modifications = json.loads(analysis[10]) if analysis[10] else {}
            except:
                user_modifications = {}
            
            try:
                user_feedback = json.loads(analysis[11]) if analysis[11] else {}
            except:
                user_feedback = {}
            
            result = {
                "analysis_id": analysis[0],
                "project_id": analysis[1],
                "session_id": analysis[2],
                "room_id": analysis[3],
                "analysis_timestamp": analysis[4],
                "model_version": analysis[5],
                "prompt_version": analysis[6],
                "images": images,
                "ai_raw_response": ai_raw_response,
                "ai_parsed_results": ai_parsed_results,
                "user_modifications": user_modifications,
                "user_feedback": user_feedback,
                "quality_score": analysis[12]
            }
        
        return JSONResponse(content={
            "success": True,
            "analysis": result
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get analysis debug error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get analysis debug: {str(e)}")

@router.get("/project/{project_id}")
async def get_project_analyses(project_id: str):
    """
    Get all analyses for a project
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT analysis_id, room_id, analysis_timestamp, quality_score, 
                       is_verified, is_applied, user_feedback
                FROM demo_ai_analysis 
                WHERE project_id = ?
                ORDER BY analysis_timestamp DESC
            """, (project_id,))
            
            analyses = cursor.fetchall()
            
            result = []
            for analysis in analyses:
                result.append({
                    "analysis_id": analysis[0],
                    "room_id": analysis[1],
                    "analysis_timestamp": analysis[2],
                    "quality_score": analysis[3],
                    "is_verified": bool(analysis[4]),
                    "is_applied": bool(analysis[5]),
                    "has_feedback": analysis[6] is not None
                })
        
        return JSONResponse(content={
            "success": True,
            "analyses": result,
            "total_count": len(result)
        })
        
    except Exception as e:
        print(f"Get analyses error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get analyses: {str(e)}")