import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from models.database import execute_query
from models.schemas import (
    CompanyInfo, FinalOpeningData, FinalMeasurementData, 
    FinalWorkScopeData, FinalDemoScopeData, FinalRoomData, 
    FinalLocationData, FinalDefaultScope, FinalHeaderData
)
from utils.logger import logger

class FinalEstimateService:
    """Service for generating final estimate JSON by combining all data sources"""
    
    @staticmethod
    def generate_final_estimate(session_id: str) -> List[Any]:
        """Generate final estimate by combining measurement, demo, and work scope data"""
        try:
            # Get session info
            sessions = execute_query(
                "SELECT * FROM pre_estimate_sessions WHERE session_id = ?",
                (session_id,)
            )
            
            if not sessions:
                raise ValueError(f"Session {session_id} not found")
            
            session = sessions[0]
            
            # Get all data sources
            measurement_data = FinalEstimateService._get_measurement_data(session_id)
            demo_scope_data = FinalEstimateService._get_demo_scope_data(session_id)
            work_scope_data = FinalEstimateService._get_work_scope_data(session_id)
            
            # Prepare final JSON array
            final_json = []
            
            # 1. Add header with company info
            company_info = CompanyInfo(
                name=session['company_name'],
                address=session['company_address'],
                city=session['company_city'],
                state=session['company_state'],
                zip=session['company_zip'],
                phone=session['company_phone'],
                email=session['company_email']
            )
            
            header = {
                "Jobsite": session['jobsite'] or "",
                "occupancy": session['occupancy'] or "",
                "company": company_info.dict(exclude_none=True)
            }
            final_json.append(header)
            
            # 2. Add default scope
            default_scope_obj = FinalEstimateService._get_default_scope(work_scope_data)
            if default_scope_obj:
                final_json.append({"default_scope": default_scope_obj})
            
            # 3. Add locations with rooms
            locations = FinalEstimateService._combine_data_by_location(
                measurement_data, demo_scope_data, work_scope_data
            )
            
            for location_data in locations:
                final_json.append(location_data)
            
            return final_json
            
        except Exception as e:
            logger.error(f"Error generating final estimate: {e}")
            raise
    
    @staticmethod
    def _get_measurement_data(session_id: str) -> Optional[List[Dict[str, Any]]]:
        """Get latest measurement data for session"""
        measurements = execute_query(
            "SELECT parsed_json FROM measurement_data WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
            (session_id,)
        )
        
        if measurements and measurements[0]['parsed_json']:
            return json.loads(measurements[0]['parsed_json'])
        return None
    
    @staticmethod
    def _get_demo_scope_data(session_id: str) -> Optional[Dict[str, Any]]:
        """Get latest demo scope data for session"""
        demo_scopes = execute_query(
            "SELECT parsed_json FROM demo_scope_data WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
            (session_id,)
        )
        
        if demo_scopes and demo_scopes[0]['parsed_json']:
            return json.loads(demo_scopes[0]['parsed_json'])
        return None
    
    @staticmethod
    def _get_work_scope_data(session_id: str) -> Optional[Dict[str, Any]]:
        """Get latest work scope data for session"""
        work_scopes = execute_query(
            "SELECT parsed_json FROM work_scope_data WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
            (session_id,)
        )
        
        if work_scopes and work_scopes[0]['parsed_json']:
            return json.loads(work_scopes[0]['parsed_json'])
        return None
    
    @staticmethod
    def _get_default_scope(work_scope_data: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Extract default scope from work scope data"""
        if work_scope_data and 'default_scope' in work_scope_data:
            return work_scope_data['default_scope']
        return None
    
    @staticmethod
    def _combine_data_by_location(
        measurement_data: Optional[List[Dict[str, Any]]],
        demo_scope_data: Optional[Dict[str, Any]],
        work_scope_data: Optional[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Combine all data sources by location and room"""
        locations_map = {}
        
        # Get default scope for reference
        default_scope = None
        if work_scope_data and 'default_scope' in work_scope_data:
            default_scope = work_scope_data['default_scope']
        
        # Process measurement data (primary source for structure)
        if measurement_data:
            for location_data in measurement_data:
                location_name = location_data.get('location', 'Unknown')
                if location_name not in locations_map:
                    locations_map[location_name] = {}
                
                for room in location_data.get('rooms', []):
                    room_name = room.get('name', 'Unknown')
                    
                    # Format openings
                    openings = []
                    for opening in room.get('openings', []):
                        # Convert dimensions to feet and inches format
                        width = opening.get('width', 0)
                        height = opening.get('height', 0)
                        size = FinalEstimateService._format_dimension(width, height)
                        
                        openings.append({
                            "type": opening.get('type', 'door'),
                            "size": size
                        })
                    
                    # Format measurements
                    measurements = room.get('measurements', {})
                    formatted_measurements = {
                        "height": measurements.get('height', 0.0),
                        "wall_area_sqft": measurements.get('wall_area_sqft', 0.0),
                        "ceiling_area_sqft": measurements.get('ceiling_area_sqft', 0.0),
                        "floor_area_sqft": measurements.get('floor_area_sqft', 0.0),
                        "walls_and_ceiling_area_sqft": measurements.get('wall_area_sqft', 0.0) + measurements.get('ceiling_area_sqft', 0.0),
                        "flooring_area_sy": measurements.get('floor_area_sqft', 0.0) / 9.0,  # Convert sqft to square yards
                        "ceiling_perimeter_lf": measurements.get('ceiling_perimeter_lf', 0.0),
                        "floor_perimeter_lf": measurements.get('floor_perimeter_lf', 0.0),
                        "openings": openings
                    }
                    
                    locations_map[location_name][room_name] = {
                        'name': room_name,
                        'material_override': {},
                        'measurements': formatted_measurements,
                        'work_scope': {
                            'use_default': 'Y',
                            'work_scope_override': {},
                            'protection': [],
                            'detach_reset': [],
                            'cleaning': []
                        },
                        'demo_scope(already demo\'d)': {
                            'Ceiling Drywall(sq_ft)': 0,
                            'Wall Drywall(sq_ft)': 0
                        }
                    }
        
        # Add demo scope data
        if demo_scope_data and 'demolition_scope' in demo_scope_data:
            for floor_data in demo_scope_data['demolition_scope']:
                location_name = floor_data.get('elevation', 'Unknown')
                if location_name not in locations_map:
                    locations_map[location_name] = {}
                
                for room_data in floor_data.get('rooms', []):
                    room_name = room_data.get('name', 'Unknown')
                    demo_locations = room_data.get('demo_locations', [])
                    
                    if room_name in locations_map.get(location_name, {}):
                        # Calculate demo'd areas based on demo locations
                        ceiling_sqft = 0
                        wall_sqft = 0
                        
                        for demo_item in demo_locations:
                            if 'ceiling' in demo_item.lower():
                                ceiling_sqft = locations_map[location_name][room_name]['measurements'].get('ceiling_area_sqft', 0)
                            if 'wall' in demo_item.lower():
                                wall_sqft = locations_map[location_name][room_name]['measurements'].get('wall_area_sqft', 0)
                        
                        locations_map[location_name][room_name]['demo_scope(already demo\'d)'] = {
                            'Ceiling Drywall(sq_ft)': ceiling_sqft,
                            'Wall Drywall(sq_ft)': wall_sqft
                        }
        
        # Add work scope data
        if work_scope_data:            
            for location_data in work_scope_data.get('locations', []):
                location_name = location_data.get('location', 'Unknown')
                if location_name not in locations_map:
                    locations_map[location_name] = {}
                
                for room_data in location_data.get('rooms', []):
                    room_name = room_data.get('name', 'Unknown')
                    
                    # Get material override
                    material_override = room_data.get('material_override', {})
                    
                    # Get work scope details
                    work_scope_info = room_data.get('work_scope', {})
                    use_default = work_scope_info.get('use_default', 'yes')
                    
                    # Format work scope
                    formatted_work_scope = {
                        'use_default': 'Y' if use_default == 'yes' else 'N',
                        'work_scope_override': work_scope_info.get('work_scope_override', {}),
                        'protection': work_scope_info.get('protection', []),
                        'detach_reset': work_scope_info.get('detach_reset', []),
                        'cleaning': work_scope_info.get('cleaning', [])
                    }
                    
                    if room_name in locations_map.get(location_name, {}):
                        locations_map[location_name][room_name]['material_override'] = material_override
                        locations_map[location_name][room_name]['work_scope'] = formatted_work_scope
        
        # Convert to final structure
        final_locations = []
        for location_name, rooms_map in locations_map.items():
            location_dict = {
                "location": location_name,
                "rooms": list(rooms_map.values())
            }
            final_locations.append(location_dict)
        
        return final_locations
    
    @staticmethod
    def _format_dimension(width: float, height: float) -> str:
        """Convert decimal feet to feet and inches format"""
        def feet_to_ft_in(decimal_feet):
            feet = int(decimal_feet)
            inches = round((decimal_feet - feet) * 12)
            if inches == 12:
                feet += 1
                inches = 0
            
            if inches > 0:
                return f"{feet}' {inches}\""
            else:
                return f"{feet}'"
        
        width_str = feet_to_ft_in(width)
        height_str = feet_to_ft_in(height)
        
        return f"{width_str} X {height_str}"

# Create singleton instance
final_estimate_service = FinalEstimateService()