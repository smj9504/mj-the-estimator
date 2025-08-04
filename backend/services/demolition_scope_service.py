import json
import logging
from typing import Dict, Any, List, Optional
from models.database import execute_query

logger = logging.getLogger(__name__)

class DemolitionScopeService:
    def __init__(self):
        pass
    
    def generate_demolition_scope(self, session_id: str) -> Dict[str, Any]:
        """
        Generate demolition scope JSON by combining Measurement data and Demo Scope data
        """
        try:
            # Get Measurement data (this contains the room dimensions and areas)
            measurement_data = self._get_measurement_data(session_id)
            if not measurement_data:
                raise ValueError("Measurement data not found for session")
            
            # Get Demo Scope data  
            demo_scope_data = self._get_demo_scope_data(session_id)
            if not demo_scope_data:
                raise ValueError("Demo Scope data not found for session")
            
            # Combine data to create demolition scope
            demolition_scope = self._combine_measurement_and_demo(measurement_data, demo_scope_data)
            
            return {
                "demolition_scope": demolition_scope
            }
            
        except Exception as e:
            logger.error(f"Error generating demolition scope: {e}", exc_info=True)
            raise
    
    def _get_measurement_data(self, session_id: str) -> Optional[List[Dict[str, Any]]]:
        """Get measurement data from database"""
        try:
            measurements = execute_query(
                "SELECT parsed_json FROM measurement_data WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
                (session_id,)
            )
            
            if measurements and measurements[0]['parsed_json']:
                return json.loads(measurements[0]['parsed_json'])
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting measurement data: {e}")
            return None
    
    def _get_material_scope_data(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get material scope data from database"""
        try:
            # First try to get from material_scope_data table
            material_data = execute_query(
                "SELECT scope_data FROM material_scope_data WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1",
                (session_id,)
            )
            
            if material_data and material_data[0]['scope_data']:
                return json.loads(material_data[0]['scope_data'])
            
            # Fallback: try to get from work_scope_data if material_scope_data not found
            work_data = execute_query(
                "SELECT parsed_json FROM work_scope_data WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
                (session_id,)
            )
            
            if work_data:
                work_json = json.loads(work_data[0]['parsed_json'])
                # Look for material scope in the work scope data
                if 'material_scope' in work_json:
                    return work_json['material_scope']
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting material scope data: {e}")
            return None
    
    def _get_demo_scope_data(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get demo scope data from database"""
        try:
            demo_data = execute_query(
                "SELECT parsed_json FROM demo_scope_data WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
                (session_id,)
            )
            
            if demo_data:
                return json.loads(demo_data[0]['parsed_json'])
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting demo scope data: {e}")
            return None
    
    def _combine_measurement_and_demo(self, measurement_data: List[Dict[str, Any]], demo_scope: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Combine measurement data and demo scope data into the required format
        """
        demolition_scope = {}
        
        # Process each location in measurement data
        for location in measurement_data:
            location_name = location.get('location', 'Unknown Location')
            location_rooms = []
            
            # Process each room in the location
            rooms = location.get('rooms', [])
            for room in rooms:
                room_name = room.get('name', 'Unknown Room')
                measurements = room.get('measurements', {})
                
                # Get demo scope data for this room
                demo_room_data = self._find_demo_data_for_room(demo_scope, location_name, room_name)
                
                # Skip this room if no demo scope data exists
                if not demo_room_data:
                    continue
                
                room_demo_info = {
                    "room": room_name,
                    "surfaces_to_demo": []
                }
                
                # Get surfaces marked for demolition
                surfaces = demo_room_data.get('surfaces', [])
                
                # Process each surface from demo scope
                for surface in surfaces:
                    # Frontend uses 'type' instead of 'surfaceType'
                    surface_type = (surface.get('type') or surface.get('surfaceType', '')).lower()
                    
                    if not surface_type:
                        continue  # Skip surfaces without type
                    
                    # Calculate area based on method used in frontend
                    calc_method = surface.get('calc_method', 'full')
                    demo_area = 0
                    
                    if calc_method == 'count':
                        # For count-based surfaces, we'll represent as count instead of area
                        count = surface.get('count', 1)
                        surface_info = {
                            "surface": surface_type,
                            "count": count,
                            "unit_type": "count"
                        }
                    else:
                        # Calculate area based on method
                        if calc_method == 'full':
                            # Use measurement data for full area
                            if surface_type == 'floor':
                                demo_area = measurements.get('floor_area_sqft', 0)
                            elif surface_type == 'ceiling':
                                demo_area = measurements.get('ceiling_area_sqft', 0)
                            elif surface_type in ['walls', 'wall']:
                                demo_area = measurements.get('wall_area_sqft', 0) or measurements.get('net_wall_area_sqft', 0)
                            else:
                                demo_area = 0
                        elif calc_method == 'percentage':
                            # Calculate percentage of measurement area
                            percentage = surface.get('percentage', 0)
                            if surface_type == 'floor':
                                base_area = measurements.get('floor_area_sqft', 0)
                            elif surface_type == 'ceiling':
                                base_area = measurements.get('ceiling_area_sqft', 0)
                            elif surface_type in ['walls', 'wall']:
                                base_area = measurements.get('wall_area_sqft', 0) or measurements.get('net_wall_area_sqft', 0)
                            else:
                                base_area = 0
                            demo_area = (base_area * percentage) / 100
                        elif calc_method == 'partial':
                            # Use the partial area specified
                            demo_area = float(surface.get('partial_area', 0))
                        else:
                            # Legacy: try to get area from old field names
                            demo_area = float(surface.get('areaSqFt', 0) or surface.get('area_sqft', 0))
                        
                        surface_info = {
                            "surface": surface_type,
                            "area_sqft": round(demo_area, 2)
                        }
                    
                    # Add description if available
                    description = surface.get('description') or surface.get('name', '')
                    if description:
                        surface_info["description"] = description
                    
                    # Add material if available
                    material = surface.get('material', '')
                    if material and material != 'N/A':
                        surface_info["material"] = material
                        
                    room_demo_info["surfaces_to_demo"].append(surface_info)
                
                # Add additional demo info if available
                if demo_room_data.get('demo_method'):
                    room_demo_info["demo_method"] = demo_room_data['demo_method']
                
                if demo_room_data.get('notes'):
                    room_demo_info["notes"] = demo_room_data['notes']
                
                # Only add room if it has surfaces to demo
                if room_demo_info["surfaces_to_demo"]:
                    location_rooms.append(room_demo_info)
            
            # Only add location if it has rooms
            if location_rooms:
                demolition_scope[location_name] = location_rooms
        
        return demolition_scope
    
    def _find_demo_data_for_room(self, demo_scope: Dict[str, Any], location_name: str, room_name: str) -> Optional[Dict[str, Any]]:
        """Find demo scope data for a specific room"""
        try:
            # Demo scope structure from frontend is: 
            # {
            #   "Main Level": [
            #     {
            #       "location": "Kitchen",
            #       "surfaces": [...]
            #     }
            #   ]
            # }
            
            # Check if location exists in demo scope
            if location_name not in demo_scope:
                # Try case variations
                for key in demo_scope.keys():
                    if key.lower() == location_name.lower():
                        location_name = key
                        break
                else:
                    return None
            
            # Get rooms for this location
            location_rooms = demo_scope.get(location_name, [])
            if not isinstance(location_rooms, list):
                return None
            
            # Find the specific room - frontend uses 'location' field instead of 'roomName'
            for room_data in location_rooms:
                # Check both 'location' (frontend format) and 'roomName' (legacy format)
                room_data_name = room_data.get('location') or room_data.get('roomName')
                if room_data_name == room_name:
                    # Convert surfaces array to surfaces_to_demo list
                    surfaces = room_data.get('surfaces', [])
                    surfaces_to_demo = []
                    
                    for surface in surfaces:
                        # Frontend uses 'type' instead of 'surfaceType'
                        surface_type = surface.get('type') or surface.get('surfaceType', '')
                        if surface_type:
                            surfaces_to_demo.append(surface_type)
                    
                    return {
                        'surfaces_to_demo': surfaces_to_demo,
                        'surfaces': surfaces,
                        'roomName': room_name
                    }
            
            return None
            
        except Exception as e:
            logger.error(f"Error finding demo data for room {room_name} in {location_name}: {e}")
            return None

# Create singleton instance
demolition_scope_service = DemolitionScopeService()