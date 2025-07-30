import json
import uuid
import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

from models.database import execute_insert, execute_query, execute_update
from models.schemas import (
    MeasurementDataResponse, DemoScopeRequest, DemoScopeResponse,
    WorkScopeRequest, WorkScopeResponse, PreEstimateSessionResponse,
    CompletePreEstimateResponse, RoomOpeningUpdate, RoomOpeningResponse
)
from services.ai_service import ai_service
from services.ocr_service import ocr_service
from services.file_service import file_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pre-estimate", tags=["pre-estimate"])

@router.post("/session", response_model=PreEstimateSessionResponse)
async def create_session(project_name: Optional[str] = None):
    """Create a new pre-estimate session"""
    session_id = str(uuid.uuid4())
    
    try:
        insert_id = execute_insert(
            "INSERT INTO pre_estimate_sessions (session_id, status, project_name) VALUES (?, ?, ?)",
            (session_id, "in_progress", project_name)
        )
        
        # Fetch the created session
        session = execute_query(
            "SELECT * FROM pre_estimate_sessions WHERE id = ?",
            (insert_id,)
        )[0]
        
        return PreEstimateSessionResponse(
            id=session['id'],
            session_id=session['session_id'],
            status=session['status'],
            created_at=session['created_at'],
            updated_at=session['updated_at'],
            project_name=session['project_name'] if 'project_name' in session.keys() else None
        )
        
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail="Failed to create session")

@router.get("/session/{session_id}", response_model=PreEstimateSessionResponse)
async def get_session(session_id: str):
    """Get session information"""
    try:
        sessions = execute_query(
            "SELECT * FROM pre_estimate_sessions WHERE session_id = ?",
            (session_id,)
        )
        
        if not sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = sessions[0]
        return PreEstimateSessionResponse(
            id=session['id'],
            session_id=session['session_id'],
            status=session['status'],
            created_at=session['created_at'],
            updated_at=session['updated_at'],
            project_name=session['project_name'] if 'project_name' in session.keys() else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session: {e}")
        raise HTTPException(status_code=500, detail="Failed to get session")

@router.post("/measurement")
async def process_measurement_data(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    file_type: str = Form(...)
):
    """Process measurement data from uploaded file"""
    from utils.logger import logger
    
    logger.info(f"Processing measurement file: {file.filename}", 
                file_name=file.filename, 
                file_type=file_type,
                session_id=session_id)
    
    try:
        # Create session if not provided
        if not session_id:
            session_response = await create_session()
            session_id = session_response.session_id
        
        # Read file content
        file_content = await file.read()
        logger.info(f"File read successfully, size: {len(file_content)} bytes")
        
        # Save uploaded file
        saved_path = file_service.save_uploaded_file(file_content, file.filename)
        logger.info(f"File saved to: {saved_path}")
        
        # Process based on file type
        if file_type.lower() == 'image':
            # Check if it's actually a PDF file
            if file.filename and file.filename.lower().endswith('.pdf'):
                logger.info("Processing PDF file directly")
                from services.pdf_parser_service import pdf_parser_service
                # Process PDF with dedicated parser
                locations = pdf_parser_service.process_pdf_for_measurements(file_content)
                
                # Save to database
                insert_id = execute_insert(
                    """INSERT INTO measurement_data 
                       (session_id, file_name, file_type, raw_data, parsed_json) 
                       VALUES (?, ?, ?, ?, ?)""",
                    (session_id, file.filename, "pdf", f"PDF processed - {len(file_content)} bytes", json.dumps(locations))
                )
                
                # Clean up saved file
                file_service.cleanup_file(saved_path)
                
                # Return processed data directly without AI parsing
                return {
                    "id": insert_id,
                    "session_id": session_id,
                    "file_name": file.filename,
                    "file_type": "pdf",
                    "raw_data": f"PDF processed - {len(file_content)} bytes",
                    "data": locations
                }
            else:
                logger.info("Processing image with OCR")
                # Use OCR to extract text
                raw_data = ocr_service.extract_text_from_image(file_content)
        elif file_type.lower() == 'csv':
            logger.info("Processing CSV file")
            # Process CSV content
            raw_data = file_service.process_csv_content(file_content)
        else:
            logger.error(f"Unsupported file type: {file_type}")
            raise HTTPException(status_code=400, detail="Unsupported file type")
        
        logger.info(f"Raw data extracted, length: {len(raw_data)} characters")
        
        # Parse with AI (with timeout protection)
        logger.info("Starting AI parsing")
        parsed_data = ai_service.parse_measurement_data(raw_data, file_type)
        logger.info("AI parsing completed successfully")
        
        # Save to database
        insert_id = execute_insert(
            """INSERT INTO measurement_data 
               (session_id, file_name, file_type, raw_data, parsed_json) 
               VALUES (?, ?, ?, ?, ?)""",
            (session_id, file.filename, file_type, raw_data, json.dumps(parsed_data))
        )
        
        # Clean up saved file
        file_service.cleanup_file(saved_path)
        
        return {
            "id": insert_id,
            "session_id": session_id,
            "file_name": file.filename,
            "file_type": file_type,
            "raw_data": raw_data,
            "data": parsed_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing measurement data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process measurement data: {str(e)}")

@router.post("/demo-scope", response_model=DemoScopeResponse)
async def process_demo_scope(request: DemoScopeRequest):
    """Process demolition scope text"""
    try:
        # Create session if not provided
        session_id = request.session_id
        if not session_id:
            session_response = await create_session()
            session_id = session_response.session_id
        
        # Parse with AI
        parsed_data = ai_service.parse_demo_scope(request.input_text)
        
        # Save to database
        insert_id = execute_insert(
            """INSERT INTO demo_scope_data 
               (session_id, input_text, parsed_json) 
               VALUES (?, ?, ?)""",
            (session_id, request.input_text, json.dumps(parsed_data))
        )
        
        return {
            "id": insert_id,
            "session_id": session_id,
            "input_text": request.input_text,
            "data": parsed_data
        }
        
    except Exception as e:
        logger.error(f"Error processing demo scope: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process demo scope: {str(e)}")

@router.post("/work-scope", response_model=WorkScopeResponse)
async def process_work_scope(request: WorkScopeRequest):
    """Process work scope data"""
    try:
        # Create session if not provided
        session_id = request.session_id
        if not session_id:
            session_response = await create_session()
            session_id = session_response.session_id
        
        # Parse with AI
        parsed_data = ai_service.parse_work_scope(request.input_data)
        
        # Save to database
        insert_id = execute_insert(
            """INSERT INTO work_scope_data 
               (session_id, input_data, parsed_json) 
               VALUES (?, ?, ?)""",
            (session_id, request.input_data, json.dumps(parsed_data))
        )
        
        return {
            "id": insert_id,
            "session_id": session_id,
            "input_data": request.input_data,
            "data": parsed_data
        }
        
    except Exception as e:
        logger.error(f"Error processing work scope: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process work scope: {str(e)}")

@router.get("/complete/{session_id}", response_model=CompletePreEstimateResponse)
async def get_complete_data(session_id: str):
    """Get all completed pre-estimate data for a session"""
    try:
        # Check if session exists
        sessions = execute_query(
            "SELECT * FROM pre_estimate_sessions WHERE session_id = ?",
            (session_id,)
        )
        
        if not sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = sessions[0]
        
        # Get measurement data
        measurement_data = None
        measurements = execute_query(
            "SELECT * FROM measurement_data WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
            (session_id,)
        )
        if measurements:
            measurement_data = json.loads(measurements[0]['parsed_json'])
        
        # Get demo scope data
        demo_scope_data = None
        demo_scopes = execute_query(
            "SELECT * FROM demo_scope_data WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
            (session_id,)
        )
        if demo_scopes:
            demo_scope_data = json.loads(demo_scopes[0]['parsed_json'])
        
        # Get work scope data
        work_scope_data = None
        work_scopes = execute_query(
            "SELECT * FROM work_scope_data WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
            (session_id,)
        )
        if work_scopes:
            work_scope_data = json.loads(work_scopes[0]['parsed_json'])
        
        # Update session status to completed if all data exists
        if measurement_data and demo_scope_data and work_scope_data:
            execute_update(
                "UPDATE pre_estimate_sessions SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE session_id = ?",
                (session_id,)
            )
            status = "completed"
        else:
            status = session['status']
        
        return CompletePreEstimateResponse(
            session_id=session_id,
            measurement_data=measurement_data,
            demo_scope_data=demo_scope_data,
            work_scope_data=work_scope_data,
            status=status
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting complete data: {e}")
        raise HTTPException(status_code=500, detail="Failed to get complete data")

@router.put("/room-openings", response_model=RoomOpeningResponse)
async def update_room_openings(request: RoomOpeningUpdate):
    """Update openings for a specific room and recalculate measurements"""
    try:
        # Get current measurement data
        measurements = execute_query(
            "SELECT * FROM measurement_data WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
            (request.session_id,)
        )
        
        if not measurements:
            raise HTTPException(status_code=404, detail="No measurement data found for session")
        
        # Parse current data
        current_data = json.loads(measurements[0]['parsed_json'])
        
        # Find and update the specific room
        room_updated = False
        for location in current_data:
            if location.get('location') == request.location:
                for room in location.get('rooms', []):
                    if room.get('name') == request.room_name:
                        # Update openings
                        room['openings'] = [
                            {
                                "type": opening.type,
                                "width": opening.width,
                                "height": opening.height
                            }
                            for opening in request.openings
                        ]
                        
                        # Recalculate measurements for this room
                        from services.room_calculator import RoomCalculator
                        
                        # Create room data structure for recalculation
                        # Try to get original dimensions or calculate from area
                        floor_area = room['measurements'].get('floor_area_sqft', 100.0)
                        height = room['measurements'].get('height', 8.0)
                        
                        # Try to get original dimensions or estimate from area
                        original_length = room['measurements'].get('length')
                        original_width = room['measurements'].get('width')
                        
                        if not original_length or not original_width:
                            # Estimate dimensions from area (assume square room)
                            original_length = (floor_area ** 0.5)
                            original_width = (floor_area ** 0.5)
                        
                        room_data = {
                            "name": room['name'],
                            "raw_dimensions": {
                                "length": float(original_length),
                                "width": float(original_width),
                                "height": float(height),
                                "area": float(floor_area)
                            },
                            "openings": room['openings']
                        }
                        
                        # Recalculate measurements
                        updated_room = RoomCalculator.calculate_room_measurements(room_data)
                        room['measurements'] = updated_room['measurements']
                        
                        room_updated = True
                        break
                
                if room_updated:
                    break
        
        if not room_updated:
            raise HTTPException(status_code=404, detail=f"Room '{request.room_name}' not found in location '{request.location}'")
        
        # Save updated data back to database
        execute_update(
            "UPDATE measurement_data SET parsed_json = ? WHERE session_id = ? AND id = ?",
            (json.dumps(current_data), request.session_id, measurements[0]['id'])
        )
        
        # Return the updated room data
        updated_room_data = None
        for location in current_data:
            if location.get('location') == request.location:
                for room in location.get('rooms', []):
                    if room.get('name') == request.room_name:
                        updated_room_data = room
                        break
                if updated_room_data:
                    break
        
        return RoomOpeningResponse(
            session_id=request.session_id,
            location=request.location,
            room_name=request.room_name,
            openings=request.openings,
            updated_measurements=updated_room_data['measurements'] if updated_room_data else {}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating room openings: {e}", exc_info=True)
        logger.error(f"Request data: session_id={request.session_id}, location={request.location}, room_name={request.room_name}")
        logger.error(f"Openings: {request.openings}")
        raise HTTPException(status_code=500, detail=f"Failed to update room openings: {str(e)}")