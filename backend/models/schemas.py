from pydantic import BaseModel, Field
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

class MeasurementSaveRequest(BaseModel):
    measurementData: List[Dict[str, Any]]  # measurementData is actually a list of locations

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

class JobsiteAddress(BaseModel):
    full_address: Optional[str] = None
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zipcode: Optional[str] = None

class CompanyInfo(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class PreEstimateSessionResponse(BaseModel):
    id: int
    session_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    project_name: Optional[str] = None
    jobsite: Optional[str] = None
    occupancy: Optional[str] = None
    company: Optional[CompanyInfo] = None
    kitchen_cabinetry_enabled: Optional[bool] = False

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
class CreateProjectRequest(BaseModel):
    project_name: Optional[str] = None
    jobsite: Optional[JobsiteAddress] = None
    occupancy: Optional[str] = None
    company: Optional[CompanyInfo] = None

class ProjectUpdateRequest(BaseModel):
    project_name: Optional[str] = None
    jobsite: Optional[str] = None
    occupancy: Optional[str] = None
    company: Optional[CompanyInfo] = None

class ProjectListResponse(BaseModel):
    projects: List[PreEstimateSessionResponse]

# Final Estimate JSON schemas - Updated to match required format
class FinalOpeningData(BaseModel):
    type: str  # 'door', 'window', 'missing_wall'
    size: str  # e.g., "5' X 6' 8\""

class FinalMeasurementData(BaseModel):
    height: float
    wall_area_sqft: float
    ceiling_area_sqft: float
    floor_area_sqft: float
    walls_and_ceiling_area_sqft: float
    flooring_area_sy: float
    ceiling_perimeter_lf: float
    floor_perimeter_lf: float
    openings: List[FinalOpeningData]

class FinalWorkScopeData(BaseModel):
    use_default: str  # "Y" or "N"
    work_scope_override: Dict[str, str]
    protection: List[str]
    detach_reset: List[str]
    cleaning: List[str]

class FinalDemoScopeData(BaseModel):
    ceiling_drywall_sqft: float = Field(alias="Ceiling Drywall(sq_ft)")
    wall_drywall_sqft: float = Field(alias="Wall Drywall(sq_ft)")
    
    class Config:
        populate_by_name = True

class FinalRoomData(BaseModel):
    name: str
    material_override: Dict[str, str]
    measurements: FinalMeasurementData
    work_scope: FinalWorkScopeData
    demo_scope_already_demod: FinalDemoScopeData = Field(alias="demo_scope(already demo'd)")
    
    class Config:
        populate_by_name = True

class FinalLocationData(BaseModel):
    location: str
    rooms: List[FinalRoomData]

class FinalDefaultScope(BaseModel):
    material: Dict[str, str]
    scope_of_work: Dict[str, str]

class FinalHeaderData(BaseModel):
    jobsite: str = Field(alias="Jobsite")
    occupancy: str
    company: CompanyInfo
    
    class Config:
        populate_by_name = True

class FinalEstimateResponse(BaseModel):
    success: bool
    data: List[Any]  # Will contain mixed types: header, default_scope, locations
    download_url: Optional[str] = None

# AI Area Calculation schemas
class AreaCalculationRequest(BaseModel):
    description: str
    surface_type: str
    existing_dimensions: Optional[Dict[str, float]] = None