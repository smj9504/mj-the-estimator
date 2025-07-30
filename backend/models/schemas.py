from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

# Request/Response schemas for API

class MeasurementDataRequest(BaseModel):
    session_id: Optional[str] = None
    file_type: str  # 'image' or 'csv'

class MeasurementDataResponse(BaseModel):
    id: int
    session_id: str
    file_name: str
    file_type: str
    raw_data: str
    parsed_json: Dict[str, Any]
    created_at: datetime

class DemoScopeRequest(BaseModel):
    session_id: Optional[str] = None
    input_text: str

class DemoScopeResponse(BaseModel):
    id: int
    session_id: str
    input_text: str
    parsed_json: Dict[str, Any]
    created_at: datetime

class WorkScopeRequest(BaseModel):
    session_id: Optional[str] = None
    input_data: str  # JSON string or text

class WorkScopeResponse(BaseModel):
    id: int
    session_id: str
    input_data: str
    parsed_json: Dict[str, Any]
    created_at: datetime

class PreEstimateSessionResponse(BaseModel):
    id: int
    session_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    project_name: Optional[str] = None

class CompletePreEstimateResponse(BaseModel):
    session_id: str
    measurement_data: Optional[Dict[str, Any]]
    demo_scope_data: Optional[Dict[str, Any]]
    work_scope_data: Optional[Dict[str, Any]]
    status: str

# Data models for AI processing

class MeasurementItem(BaseModel):
    elevation: str
    room: str
    dimensions: Dict[str, float]

class MeasurementParsed(BaseModel):
    measurements: List[MeasurementItem]

class DemoLocation(BaseModel):
    name: str
    demo_locations: List[str]

class DemoFloor(BaseModel):
    elevation: str
    rooms: List[DemoLocation]

class DemoScopeParsed(BaseModel):
    demolition_scope: List[DemoFloor]

class MaterialScope(BaseModel):
    Floor: str
    wall: str
    ceiling: str
    Baseboard: str
    Quarter_Round: str = "wood"

class WorkScopeDetails(BaseModel):
    Flooring: str
    Wall: str
    Ceiling: str
    Baseboard: str
    Quarter_Round: str
    Paint_Scope: str

class DefaultScope(BaseModel):
    material: MaterialScope
    scope_of_work: WorkScopeDetails

class RoomWorkScope(BaseModel):
    use_default: str
    work_scope_override: Dict[str, str]
    protection: List[str]
    detach_reset: List[str]
    cleaning: List[str]
    note: str

class Room(BaseModel):
    name: str
    material_override: Dict[str, str]
    work_scope: RoomWorkScope

class Location(BaseModel):
    location: str
    rooms: List[Room]

class WorkScopeParsed(BaseModel):
    default_scope: DefaultScope
    locations: List[Location]

# Opening management schemas
class Opening(BaseModel):
    type: str  # 'door', 'window', 'open_wall'
    width: float
    height: float

class RoomOpeningUpdate(BaseModel):
    session_id: str
    location: str  # floor/elevation
    room_name: str
    openings: List[Opening]

class RoomOpeningResponse(BaseModel):
    session_id: str
    location: str
    room_name: str
    openings: List[Opening]
    updated_measurements: Dict[str, Any]

# Project management schemas
class ProjectUpdateRequest(BaseModel):
    project_name: str

class ProjectListResponse(BaseModel):
    projects: List[PreEstimateSessionResponse]