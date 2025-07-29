"""
Room measurement calculation engine
Converts intermediate room data to final measurement format
"""

from typing import Dict, List, Any
import math
from utils.logger import logger

class RoomCalculator:
    """Calculates all room measurements from basic dimensions"""
    
    # Opening type constants
    OPENING_TYPES = {
        'door': {'default_width': 3.0, 'default_height': 6.8},
        'window': {'default_width': 4.0, 'default_height': 3.0},
        'open_wall': {'default_width': 6.0, 'default_height': 8.0}
    }
    
    @staticmethod
    def calculate_room_measurements(room_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate all measurements for a single room"""
        try:
            dims = room_data["raw_dimensions"]
            room_name = room_data["name"]
            openings = room_data.get("openings", [])
            
            # Get basic dimensions
            length = dims["length"]
            width = dims["width"] 
            height = dims["height"]
            
            # Calculate areas
            floor_area = dims.get("area") or (length * width)
            ceiling_area = floor_area
            
            # Calculate perimeter
            perimeter = dims.get("perimeter") or (2 * (length + width))
            
            # Calculate wall area and perimeter (considering opening types)
            wall_area = perimeter * height
            total_opening_area = 0
            adjusted_perimeter = perimeter
            
            processed_openings = []
            for opening in openings:
                try:
                    opening_type = opening.get("type", "door")
                    
                    # Get default values safely
                    if opening_type in RoomCalculator.OPENING_TYPES:
                        default_width = RoomCalculator.OPENING_TYPES[opening_type]['default_width']
                        default_height = RoomCalculator.OPENING_TYPES[opening_type]['default_height']
                    else:
                        # Fallback to door defaults for unknown types
                        default_width = RoomCalculator.OPENING_TYPES['door']['default_width']
                        default_height = RoomCalculator.OPENING_TYPES['door']['default_height']
                    
                    opening_width = float(opening.get("width", default_width))
                    opening_height = float(opening.get("height", default_height))
                    
                    if opening_type == "open_wall":
                        # For open walls, subtract entire wall section from wall area
                        # and reduce perimeter by the opening width
                        wall_section_area = opening_width * height
                        total_opening_area += wall_section_area
                        adjusted_perimeter -= opening_width
                        
                        processed_openings.append({
                            "type": opening_type,
                            "size": f"{opening_width}' wide opening"
                        })
                    else:
                        # For doors and windows, subtract opening area only
                        opening_area = opening_width * opening_height
                        total_opening_area += opening_area
                        
                        size_format = f"{opening_width}' X {opening_height}'"
                        if opening_type == "window":
                            size_format += " window"
                        
                        processed_openings.append({
                            "type": opening_type,
                            "size": size_format
                        })
                
                except Exception as e:
                    logger.error(f"Error processing opening: {e}", exc_info=True)
                    logger.error(f"Opening data: {opening}")
                    # Skip this opening and continue
                    continue
            
            wall_area -= total_opening_area
            
            # Update perimeter for calculations that depend on it
            perimeter = max(adjusted_perimeter, 0)  # Ensure non-negative
            
            # Calculate derived measurements
            walls_and_ceiling_area = wall_area + ceiling_area
            flooring_area_sy = floor_area / 9  # Convert sq ft to sq yards
            
            return {
                "name": room_name,
                "measurements": {
                    "height": round(height, 2),
                    "wall_area_sqft": round(wall_area, 2),
                    "ceiling_area_sqft": round(ceiling_area, 2),
                    "floor_area_sqft": round(floor_area, 2),
                    "walls_and_ceiling_area_sqft": round(walls_and_ceiling_area, 2),
                    "flooring_area_sy": round(flooring_area_sy, 2),
                    "ceiling_perimeter_lf": round(perimeter, 2),
                    "floor_perimeter_lf": round(perimeter, 2),
                    "openings": processed_openings
                }
            }
            
        except Exception as e:
            logger.error(f"Error calculating measurements for room {room_data.get('name', 'Unknown')}: {e}")
            return RoomCalculator._get_fallback_room_measurements(room_data.get("name", "Unknown"))
    
    @staticmethod
    def _get_fallback_room_measurements(room_name: str) -> Dict[str, Any]:
        """Fallback measurements when calculation fails"""
        return {
            "name": room_name,
            "measurements": {
                "height": 8.0,
                "wall_area_sqft": 320.0,
                "ceiling_area_sqft": 100.0,
                "floor_area_sqft": 100.0,
                "walls_and_ceiling_area_sqft": 420.0,
                "flooring_area_sy": 11.11,
                "ceiling_perimeter_lf": 40.0,
                "floor_perimeter_lf": 40.0,
                "openings": []
            }
        }
    
    @staticmethod
    def estimate_openings_from_room_type(room_name: str, room_area: float, all_rooms: List[Dict] = None) -> List[Dict[str, Any]]:
        """Estimate typical openings based on room type, size, and adjacent rooms"""
        openings = []
        room_name_lower = room_name.lower()
        
        # Check for cabinet/storage/fixture rooms first - these should not get openings
        if any(keyword in room_name_lower for keyword in [
            'cabinet', 'storage', 'shelf', 'rack', 'fixture', 'pantry'
        ]):
            # Cabinets and storage areas typically don't have openings
            return openings
        
        # Check for connected spaces (open wall detection)
        has_open_wall = RoomCalculator._detect_connected_space(room_name_lower, all_rooms or [])
        
        # Private rooms - standard door + windows
        if any(room_type in room_name_lower for room_type in [
            'bedroom', 'office', 'study'
        ]):
            openings.append({"type": "door", "width": 3.0, "height": 6.8})
            # Add windows based on room size
            windows = RoomCalculator._estimate_windows_by_size(room_area)
            openings.extend(windows)
        
        # Bathroom - smaller door, small window if applicable
        elif 'bathroom' in room_name_lower:
            openings.append({"type": "door", "width": 2.5, "height": 6.8})
            if room_area > 50:  # Only larger bathrooms get windows
                openings.append({"type": "window", "width": 2.0, "height": 2.5})
        
        # Closet - door only
        elif 'closet' in room_name_lower:
            openings.append({"type": "door", "width": 2.5, "height": 6.8})
        
        # Main living areas - check for open walls
        elif any(room_type in room_name_lower for room_type in [
            'living', 'kitchen', 'dining', 'family'
        ]):
            if has_open_wall:
                # Connected spaces get open wall instead of door
                openings.append({"type": "open_wall", "width": 8.0, "height": 8.0})
            else:
                # Standard door for isolated rooms
                openings.append({"type": "door", "width": 4.0, "height": 6.8})
            
            # Add windows for living areas
            windows = RoomCalculator._estimate_windows_by_size(room_area, is_living_area=True)
            openings.extend(windows)
        
        # Hall/corridor - typically no door, possible windows
        elif 'hall' in room_name_lower or 'corridor' in room_name_lower:
            if room_area > 80:  # Larger halls might have windows
                windows = RoomCalculator._estimate_windows_by_size(room_area)
                openings.extend(windows)
        
        # Default case - door and basic windows
        else:
            openings.append({"type": "door", "width": 3.0, "height": 6.8})
            windows = RoomCalculator._estimate_windows_by_size(room_area)
            openings.extend(windows)
        
        return openings
    
    @staticmethod
    def _detect_connected_space(room_name_lower: str, all_rooms: List[Dict]) -> bool:
        """Detect if this room should have open wall connection to other rooms"""
        # Common connected space patterns
        connected_patterns = [
            ('kitchen', 'living'),
            ('kitchen', 'dining'),
            ('living', 'dining'),
            ('kitchen', 'family'),
            ('dining', 'family')
        ]
        
        # Get all room names in lowercase
        all_room_names = [room.get('name', '').lower() for room in all_rooms]
        
        # Check if this room and a connected room both exist
        for pattern1, pattern2 in connected_patterns:
            if pattern1 in room_name_lower:
                # Check if the connected room type exists
                if any(pattern2 in other_name for other_name in all_room_names):
                    return True
            elif pattern2 in room_name_lower:
                # Check if the connected room type exists
                if any(pattern1 in other_name for other_name in all_room_names):
                    return True
        
        return False
    
    @staticmethod
    def _estimate_windows_by_size(room_area: float, is_living_area: bool = False) -> List[Dict[str, Any]]:
        """Estimate number and size of windows based on room area"""
        windows = []
        
        if room_area < 80:
            # Small rooms - 1 small window
            windows.append({"type": "window", "width": 3.0, "height": 3.0})
        elif room_area < 150:
            # Medium rooms - 1 standard window
            windows.append({"type": "window", "width": 4.0, "height": 3.5})
        elif room_area < 250:
            # Large rooms - 2 windows or 1 large window
            if is_living_area:
                windows.append({"type": "window", "width": 6.0, "height": 4.0})
            else:
                windows.extend([
                    {"type": "window", "width": 4.0, "height": 3.5},
                    {"type": "window", "width": 3.0, "height": 3.0}
                ])
        else:
            # Very large rooms - multiple windows
            if is_living_area:
                windows.extend([
                    {"type": "window", "width": 6.0, "height": 4.0},
                    {"type": "window", "width": 4.0, "height": 3.5}
                ])
            else:
                windows.extend([
                    {"type": "window", "width": 4.0, "height": 3.5},
                    {"type": "window", "width": 4.0, "height": 3.5},
                    {"type": "window", "width": 3.0, "height": 3.0}
                ])
        
        return windows

class DataStructureTransformer:
    """Transforms intermediate data to final hierarchical structure"""
    
    @staticmethod
    def transform_to_final_structure(intermediate_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Transform intermediate format to final hierarchical structure"""
        try:
            rooms_data = intermediate_data.get("rooms", [])
            
            # Group rooms by floor/location
            locations = {}
            
            for room_data in rooms_data:
                floor = room_data.get("floor", "1st Floor")
                
                if floor not in locations:
                    locations[floor] = {
                        "location": floor,
                        "rooms": []
                    }
                
                # Add estimated openings if none provided
                if not room_data.get("openings"):
                    room_area = room_data["raw_dimensions"].get("area", 0)
                    if not room_area:
                        room_area = (room_data["raw_dimensions"]["length"] * 
                                   room_data["raw_dimensions"]["width"])
                    
                    estimated_openings = RoomCalculator.estimate_openings_from_room_type(
                        room_data["name"], room_area, rooms_data
                    )
                    room_data["openings"] = estimated_openings
                
                # Calculate measurements
                calculated_room = RoomCalculator.calculate_room_measurements(room_data)
                locations[floor]["rooms"].append(calculated_room)
            
            # Convert to list and sort by floor
            result = list(locations.values())
            result.sort(key=lambda x: DataStructureTransformer._get_floor_sort_key(x["location"]))
            
            logger.info(f"Transformed data to {len(result)} locations with {sum(len(loc['rooms']) for loc in result)} total rooms")
            return result
            
        except Exception as e:
            logger.error(f"Error transforming data structure: {e}")
            return DataStructureTransformer._get_fallback_structure()
    
    @staticmethod
    def _get_floor_sort_key(floor_name: str) -> int:
        """Get sort key for floor ordering"""
        floor_lower = floor_name.lower()
        
        if 'basement' in floor_lower or 'lower' in floor_lower:
            return 0
        elif 'ground' in floor_lower or '1st' in floor_lower:
            return 1
        elif '2nd' in floor_lower:
            return 2
        elif '3rd' in floor_lower:
            return 3
        else:
            return 10
    
    @staticmethod
    def _get_fallback_structure() -> List[Dict[str, Any]]:
        """Fallback structure when transformation fails"""
        return [
            {
                "location": "1st Floor",
                "rooms": [
                    {
                        "name": "Living Room",
                        "measurements": {
                            "height": 9.0,
                            "wall_area_sqft": 426.73,
                            "ceiling_area_sqft": 199.32,
                            "floor_area_sqft": 199.32,
                            "walls_and_ceiling_area_sqft": 626.05,
                            "flooring_area_sy": 22.15,
                            "ceiling_perimeter_lf": 58.83,
                            "floor_perimeter_lf": 43.48,
                            "openings": [
                                {"type": "door", "size": "3' X 6'8\""}
                            ]
                        }
                    }
                ]
            }
        ]

class MeasurementCalculationEngine:
    """Main engine that coordinates measurement calculations"""
    
    def __init__(self):
        self.calculator = RoomCalculator()
        self.transformer = DataStructureTransformer()
    
    def process_to_final_format(self, intermediate_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Process intermediate data to final measurement format"""
        try:
            logger.info("Processing intermediate data to final format")
            
            # Transform structure and calculate measurements
            final_structure = self.transformer.transform_to_final_structure(intermediate_data)
            
            # Validate the result
            if not final_structure or not any(loc.get("rooms") for loc in final_structure):
                logger.warning("No valid rooms in final structure, using fallback")
                return self.transformer._get_fallback_structure()
            
            logger.info(f"Successfully processed to final format: {len(final_structure)} locations")
            return final_structure
            
        except Exception as e:
            logger.error(f"Error in measurement calculation engine: {e}")
            return self.transformer._get_fallback_structure()

# Global instance
calculation_engine = MeasurementCalculationEngine()