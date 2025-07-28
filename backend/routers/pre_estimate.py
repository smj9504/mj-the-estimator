import json
import uuid
import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

from models.database import execute_insert, execute_query, execute_update
from models.schemas import (
    MeasurementDataResponse, DemoScopeRequest, DemoScopeResponse,
    WorkScopeRequest, WorkScopeResponse, PreEstimateSessionResponse,
    CompletePreEstimateResponse
)
from services.ai_service import ai_service
from services.ocr_service import ocr_service
from services.file_service import file_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pre-estimate", tags=["pre-estimate"])

@router.post("/session", response_model=PreEstimateSessionResponse)
async def create_session():
    """Create a new pre-estimate session"""
    session_id = str(uuid.uuid4())
    
    try:
        insert_id = execute_insert(
            "INSERT INTO pre_estimate_sessions (session_id, status) VALUES (?, ?)",
            (session_id, "in_progress")
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
            updated_at=session['updated_at']
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
            updated_at=session['updated_at']
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
    try:
        # Create session if not provided
        if not session_id:
            session_response = await create_session()
            session_id = session_response.session_id
        
        # Read file content
        file_content = await file.read()
        
        # Save uploaded file
        saved_path = file_service.save_uploaded_file(file_content, file.filename)
        
        # Process based on file type
        if file_type.lower() == 'image':
            # Use OCR to extract text
            raw_data = ocr_service.extract_text_from_image(file_content)
        elif file_type.lower() == 'csv':
            # Process CSV content
            raw_data = file_service.process_csv_content(file_content)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
        
        # Parse with AI
        parsed_data = ai_service.parse_measurement_data(raw_data)
        
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