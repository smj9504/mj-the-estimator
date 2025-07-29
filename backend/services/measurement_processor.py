"""
Flexible measurement data processing system
Handles various input formats and converts to standardized output
"""

import json
import re
import logging
from typing import Dict, List, Any, Optional
from abc import ABC, abstractmethod
from utils.logger import logger

class DataFormatDetector:
    """Detects the format of measurement data"""
    
    @staticmethod
    def detect_format(raw_data: str, file_type: str) -> str:
        """Detect the format of measurement data"""
        raw_data_upper = raw_data.upper()
        
        # CSV table format detection
        if any(pattern in raw_data_upper for pattern in [
            "ROOM ATTRIBUTES", "PLAN ATTRIBUTES", "GROUND SURFACE", 
            "VOLUME", "ROOM SCHEDULE"
        ]):
            return "csv_table"
        
        # PDF table format
        if file_type.lower() == 'pdf' or any(pattern in raw_data_upper for pattern in [
            "AREA CALCULATIONS", "ROOM SCHEDULE", "TAKEOFF"
        ]):
            return "pdf_table"
        
        # OCR from image
        if file_type.lower() == 'image' or len(raw_data.split('\n')) < 10:
            return "image_ocr"
        
        # JSON data
        try:
            json.loads(raw_data)
            return "json_data"
        except:
            pass
        
        # Default to CSV table
        return "csv_table"

class BaseProcessor(ABC):
    """Base class for measurement data processors"""
    
    @abstractmethod
    def extract_room_data(self, raw_data: str) -> Dict[str, Any]:
        """Extract room data to intermediate format"""
        pass
    
    def _clean_room_name(self, name: str) -> str:
        """Clean and standardize room names"""
        name = name.strip()
        # Remove common prefixes/suffixes
        name = re.sub(r'^(room\s*\d+\s*[:-]?\s*)', '', name, flags=re.IGNORECASE)
        name = re.sub(r'\s*:\s*sq\s*ft.*$', '', name, flags=re.IGNORECASE)
        return name.title()
    
    def _extract_floor_name(self, text: str) -> Optional[str]:
        """Extract floor/elevation name from text"""
        patterns = [
            r'(\d+(?:st|nd|rd|th)?\s*floor)',
            r'(ground\s*floor)',
            r'(basement)',
            r'(main\s*level)',
            r'(upper\s*level)',
            r'(lower\s*level)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).title()
        
        return None

class CSVTableProcessor(BaseProcessor):
    """Processes CSV table format measurement data"""
    
    def extract_room_data(self, raw_data: str) -> Dict[str, Any]:
        """Extract room data from CSV table format"""
        rooms = []
        lines = raw_data.split('\n')
        current_floor = None
        
        logger.info(f"Processing CSV table with {len(lines)} lines")
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            
            try:
                # Detect floor information
                floor_name = self._extract_floor_name(line)
                if floor_name:
                    current_floor = floor_name
                    logger.debug(f"Found floor: {current_floor}")
                    continue
                
                # Process room data lines
                if ',' in line and len(line.split(',')) >= 2:
                    parts = [p.strip() for p in line.split(',')]
                    room_name = parts[0]
                    
                    # Skip header lines
                    if any(header in room_name.upper() for header in [
                        'ROOM ATTRIBUTES', 'GROUND SURFACE', 'VOLUME', 'PLAN ATTRIBUTES'
                    ]):
                        continue
                    
                    # Check if this looks like room data
                    if self._is_room_data(room_name):
                        room_data = self._parse_room_line(parts, current_floor)
                        if room_data:
                            rooms.append(room_data)
                            logger.debug(f"Added room: {room_data['name']}")
                            
            except Exception as e:
                logger.debug(f"Error processing line {i}: {e}")
                continue
        
        if not rooms:
            logger.warning("No rooms found in CSV, using fallback data")
            rooms = self._get_fallback_rooms()
        
        # Remove duplicates and filter out dummy data
        rooms = self._deduplicate_and_filter_rooms(rooms)
        
        logger.info(f"Successfully extracted {len(rooms)} rooms from CSV")
        return {"rooms": rooms}
    
    def _is_room_data(self, room_name: str) -> bool:
        """Check if a line contains room data"""
        room_keywords = [
            'room', 'kitchen', 'bathroom', 'bedroom', 'living', 'dining',
            'hall', 'closet', 'laundry', 'office', 'study', 'family',
            'master', 'guest', 'powder', 'utility', 'entry', 'foyer'
        ]
        
        room_name_lower = room_name.lower()
        
        # Skip summary/aggregate data that's not actual rooms
        summary_patterns = [
            r'above\s+grade.*area',
            r'below\s+grade.*area', 
            r'total.*area',
            r'ground\s+surface',
            r'^rooms$',
            r'^bedrooms$',
            r'^bathrooms?$'
        ]
        
        # Check if this is summary data to skip
        for pattern in summary_patterns:
            if re.search(pattern, room_name_lower):
                return False
        
        # Check for actual room keywords
        return any(keyword in room_name_lower for keyword in room_keywords)
    
    def _parse_room_line(self, parts: List[str], current_floor: Optional[str]) -> Optional[Dict[str, Any]]:
        """Parse a single room line from CSV"""
        try:
            room_name = self._clean_room_name(parts[0])
            
            # Try to extract area from second column
            area_str = parts[1].replace(' ', '').replace('sq', '').replace('ft', '') if len(parts) > 1 else '0'
            area = float(area_str) if area_str.replace('.', '').replace('-', '').isdigit() else 0
            
            # Extract dimensions if available in subsequent columns
            length = width = height = None
            
            # Look for dimension patterns in the data
            for part in parts[2:] if len(parts) > 2 else []:
                if 'x' in part.lower() or '×' in part:
                    dims = re.findall(r'[\d.]+', part)
                    if len(dims) >= 2:
                        length, width = float(dims[0]), float(dims[1])
                        if len(dims) >= 3:
                            height = float(dims[2])
                        break
            
            # Estimate dimensions from area if not provided
            if area > 0 and (not length or not width):
                # Assume rectangular room with 1.2:1 length-to-width ratio
                width = (area / 1.2) ** 0.5
                length = area / width
            elif not area and length and width:
                area = length * width
            
            # Default values
            if not length or not width:
                length, width = 10.0, 10.0
                area = 100.0
            if not height:
                height = 8.0
            
            return {
                "floor": current_floor or "1st Floor",
                "name": room_name,
                "raw_dimensions": {
                    "length": round(length, 1),
                    "width": round(width, 1),
                    "height": round(height, 1),
                    "area": round(area, 2) if area else None,
                    "perimeter": None
                },
                "openings": [],
                "source_confidence": 0.8
            }
            
        except Exception as e:
            logger.debug(f"Error parsing room line: {e}")
            return None
    
    def _deduplicate_and_filter_rooms(self, rooms: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicates and filter out invalid/dummy data"""
        if not rooms:
            return rooms
        
        # First pass: filter out invalid rooms and exact duplicates
        valid_rooms = []
        
        for room in rooms:
            floor = room.get("floor", "Unknown")
            name = room.get("name", "Unknown")
            dims = room.get("raw_dimensions", {})
            area = dims.get("area", 0)
            length = dims.get("length", 0)
            width = dims.get("width", 0)
            
            # Skip very small rooms (likely data errors)
            if area < 1 and length * width < 1:
                logger.debug(f"Skipping tiny room: {name} (area: {area})")
                continue
            
            # Skip rooms that are likely not actual rooms
            skip_patterns = [
                'object count', 'kitchen cabinets (24")', 'plan attributes', 
                'ground surface', 'volume', 'room attributes',
                'above grade.*area', 'below grade.*area', 'total.*area'
            ]
            
            should_skip = False
            for pattern in skip_patterns:
                if re.search(pattern, name.lower()):
                    logger.debug(f"Skipping non-room item: {name}")
                    should_skip = True
                    break
                    
            if should_skip:
                continue
            
            # Check for exact duplicates (same dimensions)
            is_exact_duplicate = False
            for existing_room in valid_rooms:
                if (existing_room.get("floor") == floor and 
                    existing_room.get("name") == name):
                    
                    existing_dims = existing_room.get("raw_dimensions", {})
                    
                    # Check if dimensions are exactly the same
                    if (abs(dims.get("length", 0) - existing_dims.get("length", 0)) < 0.1 and
                        abs(dims.get("width", 0) - existing_dims.get("width", 0)) < 0.1 and
                        abs(dims.get("area", 0) - existing_dims.get("area", 0)) < 0.1):
                        is_exact_duplicate = True
                        logger.debug(f"Skipping exact duplicate: {name}")
                        break
                    
                    # Check for 10x10x8 dummy data pattern
                    elif (dims.get("length") == 10.0 and dims.get("width") == 10.0 and 
                          dims.get("height") == 8.0):
                        is_exact_duplicate = True
                        logger.debug(f"Skipping 10x10x8 dummy data: {name}")
                        break
            
            if not is_exact_duplicate:
                valid_rooms.append(room)
        
        # Second pass: add numbering for rooms with same name
        final_rooms = []
        
        # Group rooms by floor and name to identify duplicates
        room_groups = {}
        for room in valid_rooms:
            floor = room.get("floor", "Unknown")
            name = room.get("name", "Unknown")
            key = f"{floor}:{name}"
            
            if key not in room_groups:
                room_groups[key] = []
            room_groups[key].append(room)
        
        # Process each group and add numbering if needed
        for key, rooms_in_group in room_groups.items():
            if len(rooms_in_group) > 1:
                # Multiple rooms with same name - add numbering to all
                for i, room in enumerate(rooms_in_group, 1):
                    original_name = room.get("name", "Unknown")
                    unique_name = f"{original_name} #{i}"
                    room["name"] = unique_name
                    logger.debug(f"Numbered room: {original_name} -> {unique_name}")
                    final_rooms.append(room)
            else:
                # Single room with this name - no numbering needed
                final_rooms.append(rooms_in_group[0])
        
        logger.info(f"Filtered {len(rooms)} rooms down to {len(final_rooms)} unique rooms")
        return final_rooms
    
    def _get_fallback_rooms(self) -> List[Dict[str, Any]]:
        """Fallback room data when parsing fails"""
        return [
            {
                "floor": "1st Floor",
                "name": "Living Room",
                "raw_dimensions": {
                    "length": 15.0, "width": 12.0, "height": 8.0,
                    "area": 180.0, "perimeter": None
                },
                "openings": [],
                "source_confidence": 0.5
            },
            {
                "floor": "1st Floor",
                "name": "Kitchen",
                "raw_dimensions": {
                    "length": 12.0, "width": 10.0, "height": 8.0,
                    "area": 120.0, "perimeter": None
                },
                "openings": [],
                "source_confidence": 0.5
            }
        ]

class ImageOCRProcessor(BaseProcessor):
    """Processes OCR text from images"""
    
    def extract_room_data(self, raw_data: str) -> Dict[str, Any]:
        """Extract room data from OCR text"""
        rooms = []
        lines = raw_data.split('\n')
        current_floor = None
        
        logger.info("Processing OCR text data")
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Extract floor information
            floor_name = self._extract_floor_name(line)
            if floor_name:
                current_floor = floor_name
                continue
            
            # Look for room and dimension patterns
            room_match = self._extract_room_from_text(line)
            if room_match:
                room_data = {
                    "floor": current_floor or "1st Floor",
                    "name": room_match["name"],
                    "raw_dimensions": room_match["dimensions"],
                    "openings": [],
                    "source_confidence": 0.7
                }
                rooms.append(room_data)
        
        if not rooms:
            logger.warning("No rooms found in OCR text, using fallback")
            rooms = self._get_fallback_ocr_rooms()
        
        logger.info(f"Extracted {len(rooms)} rooms from OCR text")
        return {"rooms": rooms}
    
    def _extract_room_from_text(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract room information from a text line"""
        # Pattern for room name followed by dimensions
        pattern = r'(\w+(?:\s+\w+)*)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)'
        match = re.search(pattern, text, re.IGNORECASE)
        
        if match:
            room_name = self._clean_room_name(match.group(1))
            length = float(match.group(2))
            width = float(match.group(3))
            
            return {
                "name": room_name,
                "dimensions": {
                    "length": length,
                    "width": width,
                    "height": 8.0,
                    "area": round(length * width, 2),
                    "perimeter": None
                }
            }
        
        return None
    
    def _get_fallback_ocr_rooms(self) -> List[Dict[str, Any]]:
        """Fallback for OCR processing"""
        return [
            {
                "floor": "1st Floor",
                "name": "Room",
                "raw_dimensions": {
                    "length": 12.0, "width": 10.0, "height": 8.0,
                    "area": 120.0, "perimeter": None
                },
                "openings": [],
                "source_confidence": 0.5
            }
        ]

class JSONProcessor(BaseProcessor):
    """Processes JSON measurement data"""
    
    def extract_room_data(self, raw_data: str) -> Dict[str, Any]:
        """Extract room data from JSON"""
        try:
            data = json.loads(raw_data)
            rooms = []
            
            # Handle different JSON structures
            if "measurements" in data:
                for item in data["measurements"]:
                    room_data = {
                        "floor": item.get("elevation", "1st Floor"),
                        "name": self._clean_room_name(item.get("room", "Room")),
                        "raw_dimensions": {
                            "length": item["dimensions"].get("length", 10.0),
                            "width": item["dimensions"].get("width", 10.0),
                            "height": item["dimensions"].get("height", 8.0),
                            "area": None,
                            "perimeter": None
                        },
                        "openings": [],
                        "source_confidence": 0.9
                    }
                    rooms.append(room_data)
            
            return {"rooms": rooms}
            
        except Exception as e:
            logger.error(f"Error processing JSON data: {e}")
            return {"rooms": []}

class MeasurementDataProcessor:
    """Main processor that coordinates format detection and processing"""
    
    def __init__(self):
        self.detectors = DataFormatDetector()
        self.processors = {
            'csv_table': CSVTableProcessor(),
            'image_ocr': ImageOCRProcessor(),
            'pdf_table': CSVTableProcessor(),  # Use CSV processor for PDF tables
            'json_data': JSONProcessor()
        }
    
    def process(self, raw_data: str, file_type: str) -> Dict[str, Any]:
        """Process measurement data and return intermediate format"""
        try:
            # Detect format
            detected_format = self.detectors.detect_format(raw_data, file_type)
            logger.info(f"Detected format: {detected_format}")
            
            # Get appropriate processor
            processor = self.processors.get(detected_format, self.processors['csv_table'])
            
            # Extract room data to intermediate format
            intermediate_data = processor.extract_room_data(raw_data)
            
            logger.info(f"Processed {len(intermediate_data.get('rooms', []))} rooms")
            return intermediate_data
            
        except Exception as e:
            logger.error(f"Error in measurement processing: {e}")
            return {"rooms": []}

# Global instance
measurement_processor = MeasurementDataProcessor()