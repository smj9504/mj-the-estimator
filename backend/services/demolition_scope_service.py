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
        Generate demolition scope JSON by combining Material Scope and Demo Scope data
        """
        try:
            # Get Material Scope data
            material_scope_data = self._get_material_scope_data(session_id)
            if not material_scope_data:
                raise ValueError("Material Scope data not found for session")
            
            # Get Demo Scope data  
            demo_scope_data = self._get_demo_scope_data(session_id)
            if not demo_scope_data:
                raise ValueError("Demo Scope data not found for session")
            
            # Combine data to create demolition scope
            demolition_scope = self._combine_scopes(material_scope_data, demo_scope_data)
            
            return {
                "demolition_scope": demolition_scope
            }
            
        except Exception as e:
            logger.error(f"Error generating demolition scope: {e}", exc_info=True)
            raise
    
    def _get_material_scope_data(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get material scope data from database"""
        try:
            # Check if there's a material_scope table or if it's stored in work_scope_data
            material_data = execute_query(
                "SELECT parsed_json FROM work_scope_data WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
                (session_id,)
            )
            
            if material_data:
                material_json = json.loads(material_data[0]['parsed_json'])
                # Look for material scope in the work scope data
                if 'material_scope' in material_json:
                    return material_json['material_scope']
                return material_json
            
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
    
    def _combine_scopes(self, material_scope: Dict[str, Any], demo_scope: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Combine material scope and demo scope data into the required format
        """
        demolition_scope = {}
        
        # Process each floor/level
        for floor_name, floor_data in material_scope.items():
            if not isinstance(floor_data, dict):
                continue
                
            floor_rooms = []
            
            # Process each room in the floor
            for room_name, room_data in floor_data.items():
                if not isinstance(room_data, dict):
                    continue
                
                room_surfaces = {}
                
                # Get demo scope data for this room if available
                demo_room_data = self._find_demo_data_for_room(demo_scope, floor_name, room_name)
                
                # Process surfaces (floor, ceiling, walls)
                surfaces_to_process = ['floor', 'ceiling', 'walls']
                
                for surface_type in surfaces_to_process:
                    if surface_type in room_data:
                        surface_data = room_data[surface_type]
                        
                        # Get material info
                        material = surface_data.get('material', 'unknown')
                        area_sqft = float(surface_data.get('area_sqft', 0))
                        insulation_sqft = float(surface_data.get('insulation_sqft', 0))
                        
                        # Apply demo scope modifications if available
                        if demo_room_data and surface_type in demo_room_data:
                            demo_surface = demo_room_data[surface_type]
                            # Apply demo scope calculations (e.g., areas already demolished)
                            demo_area = float(demo_surface.get('area_sqft', 0))
                            area_sqft = max(0, area_sqft - demo_area)  # Subtract already demo'd area
                        
                        # Only include surface if it has non-zero values
                        surface_info = {}
                        if material and material != 'unknown':
                            surface_info['material'] = material
                        if area_sqft > 0:
                            surface_info['area_sqft'] = round(area_sqft, 2)
                        if insulation_sqft > 0:
                            surface_info['insulation_sqft'] = round(insulation_sqft, 2)
                        
                        # Only add surface if it has content
                        if surface_info:
                            room_surfaces[surface_type] = surface_info
                
                # Only add room if it has surfaces
                if room_surfaces:
                    floor_rooms.append({
                        "location": room_name,
                        "surfaces": room_surfaces
                    })
            
            # Only add floor if it has rooms
            if floor_rooms:
                demolition_scope[floor_name] = floor_rooms
        
        return demolition_scope
    
    def _find_demo_data_for_room(self, demo_scope: Dict[str, Any], floor_name: str, room_name: str) -> Optional[Dict[str, Any]]:
        """Find demo scope data for a specific room"""
        try:
            # Demo scope might be structured differently, try to find the room data
            if floor_name in demo_scope and isinstance(demo_scope[floor_name], dict):
                floor_demo = demo_scope[floor_name]
                if room_name in floor_demo:
                    return floor_demo[room_name]
            
            # Try alternative structures
            if 'rooms' in demo_scope:
                for room in demo_scope['rooms']:
                    if room.get('name') == room_name or room.get('location') == room_name:
                        return room
            
            return None
            
        except Exception as e:
            logger.error(f"Error finding demo data for room {room_name}: {e}")
            return None

# Create singleton instance
demolition_scope_service = DemolitionScopeService()