import json
import uuid
import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

from models.database import execute_insert, execute_query, execute_update
from models.schemas import (
    MeasurementDataResponse, DemoScopeRequest, DemoScopeResponse,
    WorkScopeRequest, WorkScopeResponse, PreEstimateSessionResponse,
    CompletePreEstimateResponse, RoomOpeningUpdate, RoomOpeningResponse,
    ProjectUpdateRequest, ProjectListResponse, FinalEstimateResponse,
    CreateProjectRequest, CompanyInfo, JobsiteAddress, MeasurementSaveRequest,
    AreaCalculationRequest
)
from services.ai_service import ai_service
from services.ocr_service import ocr_service
from services.file_service import file_service
from services.final_estimate_service import final_estimate_service
from services.demolition_scope_service import demolition_scope_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pre-estimate", tags=["pre-estimate"])

@router.post("/session", response_model=PreEstimateSessionResponse)
async def create_session(request: Optional[CreateProjectRequest] = None):
    """Create a new pre-estimate session"""
    session_id = str(uuid.uuid4())
    
    try:
        # Prepare values
        project_name = request.project_name if request else None
        occupancy = request.occupancy if request else None
        
        # Handle jobsite address structure
        jobsite_full_address = request.jobsite.full_address if request and request.jobsite else None
        jobsite_street = request.jobsite.street if request and request.jobsite else None
        jobsite_city = request.jobsite.city if request and request.jobsite else None
        jobsite_state = request.jobsite.state if request and request.jobsite else None
        jobsite_zipcode = request.jobsite.zipcode if request and request.jobsite else None
        
        company_name = request.company.name if request and request.company else None
        company_address = request.company.address if request and request.company else None
        company_city = request.company.city if request and request.company else None
        company_state = request.company.state if request and request.company else None
        company_zip = request.company.zip if request and request.company else None
        company_phone = request.company.phone if request and request.company else None
        company_email = request.company.email if request and request.company else None
        
        insert_id = execute_insert(
            """INSERT INTO pre_estimate_sessions 
               (session_id, status, project_name, jobsite_full_address, jobsite_street, 
                jobsite_city, jobsite_state, jobsite_zipcode, occupancy,
                company_name, company_address, company_city, company_state, 
                company_zip, company_phone, company_email) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (session_id, "in_progress", project_name, jobsite_full_address, jobsite_street,
             jobsite_city, jobsite_state, jobsite_zipcode, occupancy,
             company_name, company_address, company_city, company_state,
             company_zip, company_phone, company_email)
        )
        
        # Fetch the created session
        session = execute_query(
            "SELECT * FROM pre_estimate_sessions WHERE id = ?",
            (insert_id,)
        )[0]
        
        # Build company info
        company = None
        if session['company_name']:
            company = CompanyInfo(
                name=session['company_name'],
                address=session['company_address'],
                city=session['company_city'],
                state=session['company_state'],
                zip=session['company_zip'],
                phone=session['company_phone'],
                email=session['company_email']
            )
        
        return PreEstimateSessionResponse(
            id=session['id'],
            session_id=session['session_id'],
            status=session['status'],
            created_at=session['created_at'],
            updated_at=session['updated_at'],
            project_name=session['project_name'] if session['project_name'] is not None else None,
            jobsite=session['jobsite_full_address'] if session['jobsite_full_address'] is not None else None,
            occupancy=session['occupancy'] if session['occupancy'] is not None else None,
            company=company
        )
        
    except Exception as e:
        logger.error(f"Error creating session: {e}", exc_info=True)
        logger.error(f"Request data: {request}")
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")

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
        
        # Convert sqlite3.Row to dict for easier access
        session_dict = dict(session)
        
        # Build company info
        company = None
        if session_dict.get('company_name'):
            company = CompanyInfo(
                name=session_dict['company_name'],
                address=session_dict.get('company_address'),
                city=session_dict.get('company_city'),
                state=session_dict.get('company_state'),
                zip=session_dict.get('company_zip'),
                phone=session_dict.get('company_phone'),
                email=session_dict.get('company_email')
            )
        
        # Handle jobsite - use new structure if available, fallback to old
        jobsite_value = None
        if session_dict.get('jobsite_full_address'):
            jobsite_value = session_dict['jobsite_full_address']
        elif session_dict.get('jobsite'):
            jobsite_value = session_dict['jobsite']
        
        return PreEstimateSessionResponse(
            id=session_dict['id'],
            session_id=session_dict['session_id'],
            status=session_dict['status'],
            created_at=session_dict['created_at'],
            updated_at=session_dict['updated_at'],
            project_name=session_dict['project_name'] if session_dict['project_name'] is not None else None,
            jobsite=jobsite_value,
            occupancy=session_dict.get('occupancy'),
            company=company
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session: {e}", exc_info=True)
        logger.error(f"Session ID: {session_id}")
        raise HTTPException(status_code=500, detail=f"Failed to get session: {str(e)}")

@router.get("/measurement/data/{session_id}")
async def get_measurement_data(session_id: str):
    """Get measurement data for a session"""
    try:
        # Get measurement data from database
        measurements = execute_query(
            "SELECT parsed_json FROM measurement_data WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
            (session_id,)
        )
        
        if not measurements or not measurements[0]['parsed_json']:
            raise HTTPException(status_code=404, detail="No measurement data found for session")
        
        # Parse and return the data
        measurement_data = json.loads(measurements[0]['parsed_json'])
        
        return {
            "success": True,
            "data": measurement_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting measurement data: {e}")
        raise HTTPException(status_code=500, detail="Failed to get measurement data")

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
        parsed_data = ai_service.parse_measurement_data(raw_data, file_type, session_id)
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

# Project Management Endpoints
@router.get("/projects", response_model=ProjectListResponse)
async def get_all_projects():
    """Get all projects (pre-estimate sessions)"""
    try:
        projects = execute_query(
            "SELECT * FROM pre_estimate_sessions ORDER BY created_at DESC"
        )
        
        project_list = []
        for project in projects:
            # Convert sqlite3.Row to dict for easier access
            project_dict = dict(project)
            
            # Build company info
            company = None
            if project_dict.get('company_name'):
                company = CompanyInfo(
                    name=project_dict['company_name'],
                    address=project_dict.get('company_address'),
                    city=project_dict.get('company_city'),
                    state=project_dict.get('company_state'),
                    zip=project_dict.get('company_zip'),
                    phone=project_dict.get('company_phone'),
                    email=project_dict.get('company_email')
                )
            
            # Handle jobsite - use new structure if available, fallback to old
            jobsite_value = None
            if project_dict.get('jobsite_full_address'):
                jobsite_value = project_dict['jobsite_full_address']
            elif project_dict.get('jobsite'):
                jobsite_value = project_dict['jobsite']
            
            project_list.append(PreEstimateSessionResponse(
                id=project_dict['id'],
                session_id=project_dict['session_id'],
                status=project_dict['status'],
                created_at=project_dict['created_at'],
                updated_at=project_dict['updated_at'],
                project_name=project_dict['project_name'] if project_dict['project_name'] is not None else None,
                jobsite=jobsite_value,
                occupancy=project_dict.get('occupancy'),
                company=company
            ))
        
        return ProjectListResponse(projects=project_list)
        
    except Exception as e:
        logger.error(f"Error getting projects: {e}")
        raise HTTPException(status_code=500, detail="Failed to get projects")

@router.put("/projects/{session_id}", response_model=PreEstimateSessionResponse)
async def update_project(session_id: str, request: ProjectUpdateRequest):
    """Update project name"""
    try:
        # Check if project exists
        existing_project = execute_query(
            "SELECT * FROM pre_estimate_sessions WHERE session_id = ?",
            (session_id,)
        )
        
        if not existing_project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Build update query dynamically
        update_fields = []
        update_values = []
        
        if request.project_name is not None:
            update_fields.append("project_name = ?")
            update_values.append(request.project_name)
            
        if request.jobsite is not None:
            update_fields.append("jobsite = ?")
            update_values.append(request.jobsite)
            
        if request.occupancy is not None:
            update_fields.append("occupancy = ?")
            update_values.append(request.occupancy)
            
        if request.company is not None:
            update_fields.extend([
                "company_name = ?", "company_address = ?", "company_city = ?",
                "company_state = ?", "company_zip = ?", "company_phone = ?", "company_email = ?"
            ])
            update_values.extend([
                request.company.name, request.company.address, request.company.city,
                request.company.state, request.company.zip, request.company.phone, request.company.email
            ])
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        update_fields.append("updated_at = CURRENT_TIMESTAMP")
        update_values.append(session_id)
        
        query = f"UPDATE pre_estimate_sessions SET {', '.join(update_fields)} WHERE session_id = ?"
        execute_update(query, tuple(update_values))
        
        # Get updated project
        updated_project = execute_query(
            "SELECT * FROM pre_estimate_sessions WHERE session_id = ?",
            (session_id,)
        )[0]
        
        # Build company info
        company = None
        if updated_project.get('company_name'):
            company = CompanyInfo(
                name=updated_project['company_name'],
                address=updated_project.get('company_address'),
                city=updated_project.get('company_city'),
                state=updated_project.get('company_state'),
                zip=updated_project.get('company_zip'),
                phone=updated_project.get('company_phone'),
                email=updated_project.get('company_email')
            )
        
        return PreEstimateSessionResponse(
            id=updated_project['id'],
            session_id=updated_project['session_id'],
            status=updated_project['status'],
            created_at=updated_project['created_at'],
            updated_at=updated_project['updated_at'],
            project_name=updated_project['project_name'],
            jobsite=updated_project.get('jobsite'),
            occupancy=updated_project.get('occupancy'),
            company=company
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating project: {e}")
        raise HTTPException(status_code=500, detail="Failed to update project")

@router.delete("/projects/{session_id}")
async def delete_project(session_id: str):
    """Delete a project and all related data"""
    try:
        # Check if project exists
        existing_project = execute_query(
            "SELECT * FROM pre_estimate_sessions WHERE session_id = ?",
            (session_id,)
        )
        
        if not existing_project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Delete related data first (due to foreign key constraints)
        execute_update(
            "DELETE FROM measurement_data WHERE session_id = ?",
            (session_id,)
        )
        
        execute_update(
            "DELETE FROM demo_scope_data WHERE session_id = ?",
            (session_id,)
        )
        
        execute_update(
            "DELETE FROM work_scope_data WHERE session_id = ?",
            (session_id,)
        )
        
        # Delete the project
        execute_update(
            "DELETE FROM pre_estimate_sessions WHERE session_id = ?",
            (session_id,)
        )
        
        return {"message": "Project deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting project: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete project")

@router.get("/final-estimate/{session_id}", response_model=FinalEstimateResponse)
async def get_final_estimate(session_id: str):
    """Generate final estimate JSON combining all data sources"""
    try:
        # Generate final estimate
        final_data = final_estimate_service.generate_final_estimate(session_id)
        
        # Save to file for download
        import os
        os.makedirs("outputs", exist_ok=True)
        
        filename = f"final_estimate_{session_id}.json"
        filepath = os.path.join("outputs", filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(final_data, f, indent=2, ensure_ascii=False, default=str)
        
        # Generate download URL
        download_url = f"/api/pre-estimate/download/{filename}"
        
        return FinalEstimateResponse(
            success=True,
            data=final_data,
            download_url=download_url
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating final estimate: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate final estimate: {str(e)}")

@router.get("/demolition-scope/{session_id}")
async def get_demolition_scope(session_id: str):
    """Generate demolition scope JSON by combining Material Scope and Demo Scope data"""
    try:
        # Generate demolition scope
        demolition_data = demolition_scope_service.generate_demolition_scope(session_id)
        
        # Save to file for download
        import os
        os.makedirs("outputs", exist_ok=True)
        
        filename = f"demolition_scope_{session_id}.json"
        filepath = os.path.join("outputs", filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(demolition_data, f, indent=2, ensure_ascii=False, default=str)
        
        # Generate download URL
        download_url = f"/api/pre-estimate/download/{filename}"
        
        return {
            "success": True,
            "data": demolition_data,
            "download_url": download_url,
            "message": "Demolition scope generated successfully"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating demolition scope: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate demolition scope: {str(e)}")

@router.get("/measurement/progress/{session_id}")
async def get_measurement_progress(session_id: str):
    """Get real-time progress for measurement data processing"""
    try:
        progress_data = ai_service.get_progress(session_id)
        return {
            "session_id": session_id,
            "stage": progress_data.get('stage', 'unknown'),
            "message": progress_data.get('message', 'No progress information available'),
            "progress": progress_data.get('progress', 0),
            "timestamp": progress_data.get('timestamp')
        }
    except Exception as e:
        logger.error(f"Error getting measurement progress: {e}")
        raise HTTPException(status_code=500, detail="Failed to get progress information")

@router.delete("/measurement/progress/{session_id}")
async def clear_measurement_progress(session_id: str):
    """Clear progress data for a session"""
    try:
        ai_service.clear_progress(session_id)
        return {"message": "Progress data cleared successfully"}
    except Exception as e:
        logger.error(f"Error clearing measurement progress: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear progress data")

@router.get("/download/{filename}")
async def download_final_estimate(filename: str):
    """Download final estimate JSON file"""
    import os
    from fastapi.responses import FileResponse
    
    filepath = os.path.join("outputs", filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=filepath,
        filename=filename,
        media_type='application/json',
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

# Auto-save endpoints
@router.put("/auto-save/material-scope/{session_id}")
async def auto_save_material_scope(session_id: str, data: dict):
    """Auto-save material scope data"""
    try:
        # Check if session exists
        sessions = execute_query(
            "SELECT * FROM pre_estimate_sessions WHERE session_id = ?",
            (session_id,)
        )
        
        if not sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Extract data
        scope_data = json.dumps(data.get('scopeData', {}))
        room_openings = json.dumps(data.get('roomOpenings', {}))
        merged_rooms = json.dumps(data.get('mergedRooms', {}))
        
        # Check if material scope data exists
        existing_data = execute_query(
            "SELECT * FROM material_scope_data WHERE session_id = ?",
            (session_id,)
        )
        
        if existing_data:
            # Update existing data
            execute_update(
                """UPDATE material_scope_data 
                   SET scope_data = ?, room_openings = ?, merged_rooms = ?, 
                       updated_at = CURRENT_TIMESTAMP 
                   WHERE session_id = ?""",
                (scope_data, room_openings, merged_rooms, session_id)
            )
        else:
            # Insert new data
            execute_insert(
                """INSERT INTO material_scope_data 
                   (session_id, scope_data, room_openings, merged_rooms) 
                   VALUES (?, ?, ?, ?)""",
                (session_id, scope_data, room_openings, merged_rooms)
            )
        
        return {"success": True, "message": "Material scope auto-saved"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error auto-saving material scope: {e}")
        raise HTTPException(status_code=500, detail="Failed to auto-save material scope")

@router.get("/auto-save/material-scope/{session_id}")
async def get_saved_material_scope(session_id: str):
    """Get saved material scope data"""
    try:
        # Get saved data
        saved_data = execute_query(
            "SELECT * FROM material_scope_data WHERE session_id = ?",
            (session_id,)
        )
        
        if not saved_data:
            return {"scopeData": {}, "roomOpenings": {}, "mergedRooms": {}}
        
        data = saved_data[0]
        return {
            "scopeData": json.loads(data['scope_data']) if data['scope_data'] else {},
            "roomOpenings": json.loads(data['room_openings']) if data['room_openings'] else {},
            "mergedRooms": json.loads(data['merged_rooms']) if data['merged_rooms'] else {},
            "lastSaved": data['updated_at']
        }
        
    except Exception as e:
        logger.error(f"Error getting saved material scope: {e}")
        raise HTTPException(status_code=500, detail="Failed to get saved material scope")

@router.put("/auto-save/progress/{session_id}")
async def auto_save_progress(session_id: str, data: dict):
    """Auto-save progress data"""
    try:
        # Check if session exists
        sessions = execute_query(
            "SELECT * FROM pre_estimate_sessions WHERE session_id = ?",
            (session_id,)
        )
        
        if not sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        current_step = data.get('currentStep', '')
        step_statuses = json.dumps(data.get('stepStatuses', {}))
        
        # Check if progress data exists
        existing_progress = execute_query(
            "SELECT * FROM pre_estimate_progress WHERE session_id = ?",
            (session_id,)
        )
        
        if existing_progress:
            # Update existing progress
            execute_update(
                """UPDATE pre_estimate_progress 
                   SET current_step = ?, step_statuses = ?, 
                       last_saved_at = CURRENT_TIMESTAMP 
                   WHERE session_id = ?""",
                (current_step, step_statuses, session_id)
            )
        else:
            # Insert new progress
            execute_insert(
                """INSERT INTO pre_estimate_progress 
                   (session_id, current_step, step_statuses) 
                   VALUES (?, ?, ?)""",
                (session_id, current_step, step_statuses)
            )
        
        return {"success": True, "message": "Progress auto-saved"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error auto-saving progress: {e}")
        raise HTTPException(status_code=500, detail="Failed to auto-save progress")

@router.get("/auto-save/progress/{session_id}")
async def get_saved_progress(session_id: str):
    """Get saved progress data"""
    try:
        # Get saved progress
        saved_progress = execute_query(
            "SELECT * FROM pre_estimate_progress WHERE session_id = ?",
            (session_id,)
        )
        
        if not saved_progress:
            return {"currentStep": "", "stepStatuses": {}}
        
        progress = saved_progress[0]
        return {
            "currentStep": progress['current_step'] or "",
            "stepStatuses": json.loads(progress['step_statuses']) if progress['step_statuses'] else {},
            "lastSaved": progress['last_saved_at']
        }
        
    except Exception as e:
        logger.error(f"Error getting saved progress: {e}")
        raise HTTPException(status_code=500, detail="Failed to get saved progress")

@router.put("/auto-save/measurement/{session_id}")
async def auto_save_measurement_edits(session_id: str, request: MeasurementSaveRequest):
    """Auto-save measurement data edits (room merges, opening updates)"""
    try:
        logger.info(f"Auto-saving measurement edits for session {session_id}")
        logger.debug(f"Request data: {request}")
        
        # Validate request data
        if not request.measurementData:
            raise HTTPException(status_code=400, detail="measurementData is required")
        
        # Get current measurement data
        measurements = execute_query(
            "SELECT * FROM measurement_data WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
            (session_id,)
        )
        
        if not measurements:
            raise HTTPException(status_code=404, detail="No measurement data found")
        
        # Update the measurement data with edits
        edited_data = request.measurementData
        
        logger.debug(f"Updating measurement data for session {session_id}, record ID: {measurements[0]['id']}")
        
        execute_update(
            "UPDATE measurement_data SET parsed_json = ? WHERE session_id = ? AND id = ?",
            (json.dumps(edited_data), session_id, measurements[0]['id'])
        )
        
        logger.info(f"Successfully auto-saved measurement edits for session {session_id}")
        return {"success": True, "message": "Measurement edits auto-saved"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error auto-saving measurement edits for session {session_id}: {e}")
        logger.error(f"Request data was: {request}")
        raise HTTPException(status_code=500, detail=f"Failed to auto-save measurement edits: {str(e)}")

@router.put("/measurement/save/{session_id}")
async def save_measurement_edits(session_id: str, request: MeasurementSaveRequest):
    """Save measurement data edits (manual save)"""
    try:
        logger.info(f"Saving measurement edits for session {session_id}")
        logger.debug(f"Request data: {request}")
        
        # Validate request data
        if not request.measurementData:
            raise HTTPException(status_code=400, detail="measurementData is required")
        
        # Get current measurement data
        measurements = execute_query(
            "SELECT * FROM measurement_data WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
            (session_id,)
        )
        
        if not measurements:
            raise HTTPException(status_code=404, detail="No measurement data found")
        
        # Update the measurement data with edits
        edited_data = request.measurementData
        
        logger.debug(f"Updating measurement data for session {session_id}, record ID: {measurements[0]['id']}")
        
        execute_update(
            "UPDATE measurement_data SET parsed_json = ? WHERE session_id = ? AND id = ?",
            (json.dumps(edited_data), session_id, measurements[0]['id'])
        )
        
        logger.info(f"Successfully saved measurement edits for session {session_id}")
        return {"success": True, "message": "Measurement edits saved successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving measurement edits for session {session_id}: {e}")
        logger.error(f"Request data was: {request}")
        raise HTTPException(status_code=500, detail=f"Failed to save measurement edits: {str(e)}")

# Demo Scope Auto-save endpoints
@router.put("/auto-save/demo-scope/{session_id}")
async def auto_save_demo_scope(session_id: str, data: dict):
    """Auto-save demo scope data"""
    try:
        # Check if session exists
        sessions = execute_query(
            "SELECT * FROM pre_estimate_sessions WHERE session_id = ?",
            (session_id,)
        )
        
        if not sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        demo_scope_data = json.dumps(data)
        
        # Check if demo scope data exists
        existing_demo = execute_query(
            "SELECT * FROM demo_scope_data WHERE session_id = ?",
            (session_id,)
        )
        
        if existing_demo:
            # Update existing demo scope data
            execute_update(
                "UPDATE demo_scope_data SET parsed_json = ? WHERE session_id = ?",
                (demo_scope_data, session_id)
            )
        else:
            # Insert new demo scope data
            execute_insert(
                "INSERT INTO demo_scope_data (session_id, parsed_json) VALUES (?, ?)",
                (session_id, demo_scope_data)
            )
        
        return {"success": True, "message": "Demo scope auto-saved"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error auto-saving demo scope: {e}")
        raise HTTPException(status_code=500, detail="Failed to auto-save demo scope")

@router.get("/auto-save/demo-scope/{session_id}")
async def get_saved_demo_scope(session_id: str):
    """Get saved demo scope data"""
    try:
        # Check if session exists
        sessions = execute_query(
            "SELECT * FROM pre_estimate_sessions WHERE session_id = ?",
            (session_id,)
        )
        
        if not sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        demo_scope = execute_query(
            "SELECT * FROM demo_scope_data WHERE session_id = ?",
            (session_id,)
        )
        
        if demo_scope:
            parsed_data = demo_scope[0]['parsed_json']
            return {
                "success": True,
                "demoScopeData": json.loads(parsed_data) if parsed_data else {},
                "lastUpdated": demo_scope[0]['created_at']  # Use created_at since there's no updated_at column
            }
        else:
            return {
                "success": True,
                "demoScopeData": {},
                "lastUpdated": None
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting saved demo scope: {e}")
        raise HTTPException(status_code=500, detail="Failed to get saved demo scope")

@router.post("/calculate-area")
async def calculate_partial_area(request: AreaCalculationRequest):
    """Calculate area for partial descriptions using AI"""
    try:
        logger.info(f"🎯 API: Received area calculation request")
        logger.info(f"📝 Description: '{request.description}'")
        logger.info(f"🏷️ Surface type: '{request.surface_type}'")
        logger.info(f"📐 Existing dimensions: {request.existing_dimensions}")
        
        # Use AI service to calculate area from description
        logger.info("🚀 Calling AI service for area calculation...")
        calculated_area = ai_service.calculate_area_from_description(
            description=request.description,
            surface_type=request.surface_type,
            existing_dimensions=request.existing_dimensions
        )
        
        logger.info(f"📊 AI service returned: {calculated_area}")
        
        response_data = {
            "success": True,
            "calculated_area": calculated_area,
            "description": request.description,
            "surface_type": request.surface_type
        }
        
        logger.info(f"✅ API: Sending response: {response_data}")
        return response_data
        
    except Exception as e:
        logger.error(f"❌ API: Error calculating area: {e}")
        logger.error(f"🔍 Error type: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=f"Failed to calculate area: {str(e)}")