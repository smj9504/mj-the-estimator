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
from utils.prompts import ROOM_CLASSIFICATION_PROMPT, SINGLE_ROOM_CLASSIFICATION_PROMPT

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
        text_clean = text.strip()
        patterns = [
            r'^(\d+(?:st|nd|rd|th)?\s*floor)$',
            r'^(ground\s*floor)$',
            r'^(basement)$',
            r'^(main\s*level)$',
            r'^(upper\s*level)$',
            r'^(lower\s*level)$'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text_clean, re.IGNORECASE)
            if match:
                return match.group(1).title()
        
        return None

class CSVTableProcessor(BaseProcessor):
    """Processes CSV table format measurement data"""
    
    def __init__(self, use_ai_classification: bool = True):
        self._use_ai_classification = use_ai_classification
    
    def extract_room_data(self, raw_data: str) -> Dict[str, Any]:
        """Extract room data from CSV table format"""
        rooms = []
        lines = raw_data.split('\n')
        current_floor = None
        
        # Use batch processing if AI is enabled
        if self._use_ai_classification:
            return self._extract_room_data_batch(raw_data)
        
        logger.info(f"Processing CSV table with {len(lines)} lines")
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            
            try:
                # Detect floor information (single line floor markers)
                floor_name = self._extract_floor_name(line)
                if floor_name:
                    current_floor = floor_name
                    logger.debug(f"Found floor: {current_floor}")
                    continue
                
                # Also check for floor markers that are part of room data section
                line_clean = line.strip().rstrip(',')
                if line_clean in ['1st Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor',
                                'Ground Floor', 'Main Floor', 'Upper Floor', 'Lower Floor', 'Basement']:
                    current_floor = line_clean
                    logger.debug(f"Found floor marker: {current_floor}")
                    continue
                
                # Process room data lines
                if ',' in line and len(line.split(',')) >= 2:
                    parts = [p.strip() for p in line.split(',')]
                    room_name = parts[0]
                    
                    # Skip header lines
                    if any(header in room_name.upper() for header in [
                        'ROOM ATTRIBUTES', 'GROUND SURFACE', 'VOLUME', 'PLAN ATTRIBUTES',
                        'FLOOR ATTRIBUTES', 'WALL ATTRIBUTES', 'OBJECT COUNT'
                    ]):
                        continue
                    
                    # Pre-parse to get area for AI classification
                    area = None
                    if len(parts) > 1:
                        area_str = parts[1].replace(' ', '').replace('sq', '').replace('ft', '')
                        try:
                            area = float(area_str) if area_str.replace('.', '').replace('-', '').isdigit() else None
                        except:
                            area = None
                    
                    # Check if this looks like room data (without AI for non-batch mode)
                    if self._is_room_data(room_name, area, use_ai=False):
                        room_data = self._parse_room_line(parts, current_floor)
                        if room_data:
                            rooms.append(room_data)
                            logger.debug(f"Added room: {room_data['name']} in {current_floor}")
                            
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
    
    def _extract_room_data_batch(self, raw_data: str) -> Dict[str, Any]:
        """Extract room data using batch AI processing for efficiency"""
        logger.info("Using batch AI processing mode")
        
        # Step 1: Collect all potential room candidates
        candidates = []
        rooms = []
        lines = raw_data.split('\n')
        current_floor = None
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            
            try:
                # Detect floor markers
                floor_name = self._extract_floor_name(line)
                if floor_name:
                    current_floor = floor_name
                    continue
                
                line_clean = line.strip().rstrip(',')
                if line_clean in ['1st Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor',
                                'Ground Floor', 'Main Floor', 'Upper Floor', 'Lower Floor', 'Basement']:
                    current_floor = line_clean
                    continue
                
                # Collect potential room data
                if ',' in line and len(line.split(',')) >= 2:
                    parts = [p.strip() for p in line.split(',')]
                    room_name = parts[0]
                    
                    # Skip header lines
                    if any(header in room_name.upper() for header in [
                        'ROOM ATTRIBUTES', 'GROUND SURFACE', 'VOLUME', 'PLAN ATTRIBUTES',
                        'FLOOR ATTRIBUTES', 'WALL ATTRIBUTES', 'OBJECT COUNT'
                    ]):
                        continue
                    
                    # Extract area
                    area = None
                    if len(parts) > 1:
                        area_str = parts[1].replace(' ', '').replace('sq', '').replace('ft', '')
                        try:
                            area = float(area_str) if area_str.replace('.', '').replace('-', '').isdigit() else None
                        except:
                            area = None
                    
                    candidates.append({
                        'name': room_name,
                        'area': area,
                        'floor': current_floor,
                        'parts': parts,
                        'line_index': i
                    })
                    
            except Exception as e:
                logger.debug(f"Error processing line {i}: {e}")
                continue
        
        # Step 2: Pre-classify using traditional logic
        confirmed_rooms = []
        ambiguous_candidates = []
        
        for candidate in candidates:
            room_name = candidate['name']
            area = candidate['area']
            
            # Clearly not a room
            if self._is_clearly_not_room(room_name):
                logger.debug(f"Rejected (clearly not room): {room_name}")
                continue
            
            # Traditional keywords
            if self._is_room_data_traditional(room_name):
                confirmed_rooms.append(candidate)
                logger.debug(f"Confirmed (traditional): {room_name}")
                continue
            
            # Ambiguous - needs AI
            ambiguous_candidates.append(candidate)
            logger.debug(f"Ambiguous (needs AI): {room_name}")
        
        # Step 3: Batch AI classification for ambiguous cases
        if ambiguous_candidates:
            ai_results = self._batch_ai_room_classification(ambiguous_candidates)
            
            for i, candidate in enumerate(ambiguous_candidates):
                if i < len(ai_results) and ai_results[i]:
                    confirmed_rooms.append(candidate)
                    logger.debug(f"AI confirmed: {candidate['name']}")
        
        # Step 4: Parse confirmed rooms
        for candidate in confirmed_rooms:
            room_data = self._parse_room_line(candidate['parts'], candidate['floor'])
            if room_data:
                rooms.append(room_data)
        
        if not rooms:
            logger.warning("No rooms found in CSV, using fallback data")
            rooms = self._get_fallback_rooms()
        
        # Remove duplicates and filter out dummy data
        rooms = self._deduplicate_and_filter_rooms(rooms)
        
        logger.info(f"Successfully extracted {len(rooms)} rooms from CSV using batch processing")
        return {"rooms": rooms}
    
    def _batch_ai_room_classification(self, candidates: List[Dict]) -> List[bool]:
        """Classify multiple room candidates using AI in batch"""
        if not candidates:
            return []
        
        try:
            from services.ai_service import ai_service
            
            # AI가 사용 불가능하면 모두 False
            if ai_service.mock_mode:
                logger.debug("AI in mock mode, returning False for all candidates")
                return [False] * len(candidates)
            
            # Prepare batch prompt
            candidate_list = []
            for i, candidate in enumerate(candidates):
                name = candidate['name']
                area = candidate.get('area', 0)
                area_info = f" ({area} sq ft)" if area else ""
                candidate_list.append(f"{i+1}. {name}{area_info}")
            
            candidates_text = '\n'.join(candidate_list)
            
            prompt = ROOM_CLASSIFICATION_PROMPT.format(candidates_text=candidates_text)
            
            if ai_service.ai_provider in ['openai', 'claude']:
                response = ai_service.llm.invoke([{"role": "user", "content": prompt}])
                result = response.content if hasattr(response, 'content') else str(response)
            else:
                result = ai_service.llm.invoke(prompt)
            
            # Parse AI response
            try:
                import json
                result_clean = result.strip()
                
                # Extract JSON array from response
                start_idx = result_clean.find('[')
                end_idx = result_clean.rfind(']') + 1
                
                if start_idx != -1 and end_idx != 0:
                    json_str = result_clean[start_idx:end_idx]
                    ai_results = json.loads(json_str)
                    
                    # Ensure we have the right number of results
                    if len(ai_results) == len(candidates):
                        logger.info(f"AI batch classification successful: {ai_results}")
                        return ai_results
                    else:
                        logger.warning(f"AI returned {len(ai_results)} results, expected {len(candidates)}")
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse AI batch response: {e}")
                logger.debug(f"AI response was: {result}")
            
            # Fallback: return False for all
            return [False] * len(candidates)
            
        except Exception as e:
            logger.error(f"Batch AI classification failed: {e}")
            return [False] * len(candidates)
    
    def _is_room_data(self, room_name: str, area: float = None, use_ai: bool = True) -> bool:
        """Check if a line contains room data using hybrid approach"""
        
        # 1단계: 명확히 방이 아닌 것들 먼저 제외 (우선순위 높음)
        if self._is_clearly_not_room(room_name):
            return False
        
        # 2단계: 빠른 키워드 기반 필터링
        if self._is_room_data_traditional(room_name):
            return True
        
        # 3단계: AI 기반 판별 (활성화된 경우)
        if use_ai and hasattr(self, '_use_ai_classification') and self._use_ai_classification:
            return self._ai_room_classification(room_name, area)
        
        # AI 없이는 보수적으로 False 반환
        return False
    
    def _is_room_data_traditional(self, room_name: str) -> bool:
        """Traditional keyword-based room detection"""
        room_keywords = [
            'room', 'kitchen', 'bathroom', 'bedroom', 'living', 'dining',
            'hall', 'closet', 'laundry', 'office', 'study', 'family',
            'master', 'guest', 'powder', 'utility', 'entry', 'foyer',
            'stairway', 'stairs', 'furnace', 'furnace room', 'den', 'loft',
            'pantry', 'mudroom', 'sunroom', 'basement', 'attic', 'garage'
        ]
        
        room_name_lower = room_name.lower()
        return any(keyword in room_name_lower for keyword in room_keywords)
    
    def _is_clearly_not_room(self, room_name: str) -> bool:
        """Check if this is clearly not a room (summary data, etc.)"""
        room_name_lower = room_name.lower()
        
        # Skip summary/aggregate data that's not actual rooms
        summary_patterns = [
            r'^above\s+grade.*area$',
            r'^below\s+grade.*area$', 
            r'^total.*area$',
            r'^ground\s+surface.*$',
            r'^rooms$',
            r'^bedrooms$',
            r'^bathrooms$',
            r'^floors?$',
            r'^windows?$',
            r'^plan\s+attributes$',
            r'^room\s+attributes$',
            r'^object\s+count$',
            r'^wall\s+attributes$',
            r'^floor\s+attributes$'
        ]
        
        # Check if this is summary data to skip
        for pattern in summary_patterns:
            if re.search(pattern, room_name_lower):
                return True
        
        return False
    
    def _auto_detect_room_type(self, room_name: str, area: float = None) -> Dict[str, Any]:
        """Auto-detect room type and sub-area classification"""
        room_name_lower = room_name.lower()
        
        # Room type detection
        room_types = {
            'bathroom': ['bathroom', 'bath', 'toilet', 'washroom', 'powder'],
            'kitchen': ['kitchen', 'cook', 'culinary'],
            'bedroom': ['bedroom', 'bed room', 'master', 'guest room'],
            'living': ['living', 'family', 'great room', 'sitting'],
            'dining': ['dining', 'eat', 'breakfast'],
            'office': ['office', 'study', 'den', 'library'],
            'utility': ['utility', 'laundry', 'mechanical', 'furnace'],
            'hallway': ['hall', 'corridor', 'passage', 'entry', 'foyer'],
            'storage': ['storage', 'closet', 'pantry']
        }
        
        detected_room_type = 'room'  # default
        for room_type, patterns in room_types.items():
            if any(pattern in room_name_lower for pattern in patterns):
                detected_room_type = room_type
                break
        
        # Sub-area detection based on size and name patterns
        is_sub_area = False
        sub_area_type = None
        material_applicable = True
        confidence = 'low'
        
        # Size-based detection
        if area and area < 15:  # Very small areas
            is_sub_area = True
            confidence = 'medium'
            
            # Specific sub-area type detection for small spaces
            if detected_room_type == 'bathroom' and area < 10:
                sub_area_type = 'bathtub'
                material_applicable = False  # Bathtub area doesn't need flooring
                confidence = 'high'
            elif 'cabinet' in room_name_lower:
                sub_area_type = 'cabinet'
                material_applicable = False
                confidence = 'high'
            elif 'closet' in room_name_lower:
                sub_area_type = 'closet'
                confidence = 'high'
            elif area < 5:
                sub_area_type = 'fixture'
                material_applicable = False
                confidence = 'medium'
        
        # Name pattern detection with detailed material applicability and opening rules
        explicit_sub_areas = {
            # Sub-areas that NEED flooring materials (same as parent room)
            'closet': {
                'patterns': ['closet', 'walk-in closet', 'wardrobe'],
                'material_applicable': True,
                'reason': 'Walking space requires flooring',
                'valid_opening_types': ['door']  # Closets have doors but no windows
            },
            'pantry': {
                'patterns': ['pantry', 'storage room', 'storage closet'],
                'material_applicable': True,
                'reason': 'Walking space requires flooring',
                'valid_opening_types': ['door']  # Pantries have doors but no windows
            },
            'alcove': {
                'patterns': ['alcove', 'nook', 'reading nook'],
                'material_applicable': True,
                'reason': 'Living space requires flooring',
                'valid_opening_types': ['window']  # Alcoves might have windows but no separate doors
            },
            'walk_in_shower': {
                'patterns': ['walk-in shower', 'walk in shower'],
                'material_applicable': True,
                'reason': 'Requires specialized shower flooring',
                'valid_opening_types': []  # Walk-in showers are open, no doors/windows
            },
            # Sub-areas that DON'T need flooring materials (separate treatment)
            'bathtub': {
                'patterns': ['bathtub', 'tub', 'bath tub', 'tub area'],
                'material_applicable': False,
                'reason': 'Has built-in tub surface, no additional flooring',
                'valid_opening_types': []  # Bathtubs don't have doors or windows
            },
            'shower_booth': {
                'patterns': ['shower booth', 'shower stall', 'shower enclosure'],
                'material_applicable': False,
                'reason': 'Has built-in shower pan, separate from room flooring',
                'valid_opening_types': []  # Shower booths are enclosed but don't have separate openings
            },
            'cabinet': {
                'patterns': ['cabinet', 'cabinets', 'kitchen cabinet', 'cabinet area'],
                'material_applicable': False,
                'reason': 'Interior cabinet surfaces, not floor area',
                'valid_opening_types': []  # Cabinets don't have doors/windows to outside
            },
            'fixture': {
                'patterns': ['fixture', 'built-in', 'vanity area'],
                'material_applicable': False,
                'reason': 'Fixed equipment area, no flooring needed',
                'valid_opening_types': []  # Other fixtures don't have openings
            }
        }
        
        for sub_type, config in explicit_sub_areas.items():
            if any(pattern in room_name_lower for pattern in config['patterns']):
                is_sub_area = True
                sub_area_type = sub_type
                material_applicable = config['material_applicable']
                confidence = 'high'
                break
        
        return {
            'room_type': detected_room_type,
            'is_sub_area': is_sub_area,
            'sub_area_type': sub_area_type,
            'material_applicable': material_applicable,
            'detection_confidence': confidence,
            'user_confirmed': False  # 사용자가 확인하지 않음
        }
    
    def _ai_room_classification(self, room_name: str, area: float = None) -> bool:
        """AI-based room classification"""
        try:
            from services.ai_service import ai_service
            
            # AI가 사용 불가능하면 False 반환
            if ai_service.mock_mode:
                return False
            
            area_info = f" (Area: {area} sq ft)" if area else ""
            
            prompt = SINGLE_ROOM_CLASSIFICATION_PROMPT.format(room_name=room_name, area_info=area_info)
            
            if ai_service.ai_provider in ['openai', 'claude']:
                response = ai_service.llm.invoke([{"role": "user", "content": prompt}])
                result = response.content if hasattr(response, 'content') else str(response)
            else:
                result = ai_service.llm.invoke(prompt)
            
            # AI 응답에서 YES/NO 추출
            result_clean = result.strip().upper()
            is_room = 'YES' in result_clean and 'NO' not in result_clean
            
            logger.debug(f"AI room classification for '{room_name}': {is_room} (response: {result_clean})")
            return is_room
            
        except Exception as e:
            logger.debug(f"AI room classification failed for '{room_name}': {e}")
            # AI 실패시 보수적으로 False 반환
            return False
    
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
            
            # Auto-detect room type and sub-area
            room_classification = self._auto_detect_room_type(room_name, area)
            
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
                "source_confidence": 0.8,
                "room_classification": room_classification
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
    
    def __init__(self, use_ai_classification: bool = True):
        self.detectors = DataFormatDetector()
        self.use_ai_classification = use_ai_classification
        self.processors = {
            'csv_table': CSVTableProcessor(use_ai_classification),
            'image_ocr': ImageOCRProcessor(),
            'pdf_table': CSVTableProcessor(use_ai_classification),  # Use CSV processor for PDF tables
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

# Global instance with AI classification enabled
measurement_processor = MeasurementDataProcessor(use_ai_classification=True)