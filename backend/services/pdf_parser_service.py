import logging
import re
from typing import Dict, List, Any, Optional
from PyPDF2 import PdfReader
from io import BytesIO
from utils.logger import logger
from utils.prompts import PDF_MEASUREMENT_EXTRACTION_PROMPT

class PDFParserService:
    """Service for parsing and extracting measurement data from PDF documents"""
    
    def __init__(self):
        pass
    
    def extract_text_from_pdf(self, pdf_content: bytes) -> str:
        """Extract text from PDF file"""
        try:
            pdf_reader = PdfReader(BytesIO(pdf_content))
            text = ""
            
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            
            logger.info(f"Extracted text from PDF: {len(text)} characters")
            return text
            
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            raise
    
    def extract_room_measurements(self, pdf_text: str) -> List[Dict[str, Any]]:
        """Extract room measurements from PDF text using improved pattern matching"""
        rooms = []
        
        # Enhanced patterns for insurance estimates (Travelers, etc.)
        patterns = {
            'room_with_height': r'([A-Za-z\s]+)\s*Height:\s*([^\n]*?)(?:\n|$)',
            'wall_area': r'(\d+(?:\.\d+)?)\s*SF\s*Walls(?!\s*&\s*Ceiling)',
            'ceiling_area': r'(\d+(?:\.\d+)?)\s*SF\s*Ceiling(?!\s*&\s*Walls)',
            'floor_area': r'(\d+(?:\.\d+)?)\s*SF\s*Floor(?:\s|$)',
            'wall_ceiling_combined': r'(\d+(?:\.\d+)?)\s*SF\s*Walls\s*&\s*Ceiling',
            'floor_perimeter': r'(\d+(?:\.\d+)?)\s*LF\s*Floor\s*Perimeter',
            'ceiling_perimeter': r'(\d+(?:\.\d+)?)\s*LF\s*(?:Ceil\.?|Ceiling)\s*Perimeter',
            'door_pattern': r'Door\s+([^O\n]+?)(?:\s+Opens|\n|$)',
            'window_pattern': r'Window\s+([^O\n]+?)(?:\s+Opens|\n|$)',
            'missing_wall_pattern': r'Missing Wall(?:\s*-\s*Goes to Floor)?\s+([^O\n]+?)(?:\s+Opens|\n|$)',
            'opening_context': r'(Door|Window|Missing Wall)[\s\S]*?(?=Door|Window|Missing Wall|QUANTITY|DESCRIPTION|Total:|$)'
        }
        
        lines = pdf_text.split('\n')
        current_location = "Main Level"
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Check for room name with height (various formats)
            height_match = re.search(patterns['room_with_height'], line)
            if height_match:
                room_name = height_match.group(1).strip()
                height_str = height_match.group(2).strip()
                
                # Parse height: handle "8' 8"", "Sloped", etc.
                if height_str.lower() in ['sloped', 'peaked']:
                    height = height_str.title()
                else:
                    # Try to extract numeric height
                    height_numeric = re.search(r"(\d+)'\s*(\d+)?", height_str)
                    if height_numeric:
                        feet = int(height_numeric.group(1))
                        inches = height_numeric.group(2)
                        if inches:
                            height = round(feet + (int(inches) / 12.0), 2)
                        else:
                            height = float(feet)
                    else:
                        # Fallback to default height
                        height = 8.0
                
                # Extract measurements from the following lines (expand context for openings)
                context_lines = lines[i:i+30]  # More context for openings
                measurements = self._extract_detailed_measurements(context_lines, patterns)
                
                if measurements:
                    measurements['height'] = height
                    room_data = {
                        'location': current_location,
                        'name': room_name,
                        'measurements': measurements
                    }
                    rooms.append(room_data)
                    logger.debug(f"Found room: {room_name} with height {height} in {current_location}")
            
            # Update location if found - look for more location patterns
            location_patterns = [
                "Main Level", "Level 1", "Level 2", "Level 3", "Basement", 
                "First Floor", "Second Floor", "Third Floor", "Ground Floor",
                "SKETCH1", "Level 1"  # Handle PDF-specific patterns
            ]
            
            for location in location_patterns:
                if location in line:
                    # Special handling for sketch patterns
                    if "SKETCH" in location or location == "Level 1":
                        current_location = "Level 1"
                    else:
                        current_location = location
                    break
            
            i += 1
        
        return rooms
    
    def _extract_detailed_measurements(self, context_lines: List[str], patterns: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """Extract detailed measurements from context lines using improved patterns"""
        context_text = '\n'.join(context_lines)
        
        # Initialize measurements dict
        measurements = {
            "wall_area_sqft": 0.0,
            "ceiling_area_sqft": 0.0,
            "floor_area_sqft": 0.0,
            "walls_and_ceiling_area_sqft": 0.0,
            "floor_perimeter_lf": 0.0,
            "ceiling_perimeter_lf": 0.0,
            "openings": []
        }
        
        # Extract combined walls & ceiling first (to avoid conflicts with individual patterns)
        wall_ceiling_match = re.search(patterns['wall_ceiling_combined'], context_text)
        if wall_ceiling_match:
            measurements["walls_and_ceiling_area_sqft"] = round(float(wall_ceiling_match.group(1)), 2)
        
        # Extract wall area (excluding combined patterns)
        wall_match = re.search(patterns['wall_area'], context_text)
        if wall_match:
            measurements["wall_area_sqft"] = round(float(wall_match.group(1)), 2)
        
        # Extract ceiling area (excluding combined patterns)
        ceiling_match = re.search(patterns['ceiling_area'], context_text)
        if ceiling_match:
            measurements["ceiling_area_sqft"] = round(float(ceiling_match.group(1)), 2)
        
        # Extract floor area
        floor_match = re.search(patterns['floor_area'], context_text)
        if floor_match:
            measurements["floor_area_sqft"] = round(float(floor_match.group(1)), 2)
        
        # Calculate combined walls & ceiling if not already extracted
        if measurements["walls_and_ceiling_area_sqft"] == 0.0:
            measurements["walls_and_ceiling_area_sqft"] = round(measurements["wall_area_sqft"] + measurements["ceiling_area_sqft"], 2)
        
        # Extract floor perimeter
        floor_perimeter_match = re.search(patterns['floor_perimeter'], context_text)
        if floor_perimeter_match:
            measurements["floor_perimeter_lf"] = round(float(floor_perimeter_match.group(1)), 2)
        
        # Extract ceiling perimeter
        ceiling_perimeter_match = re.search(patterns['ceiling_perimeter'], context_text)
        if ceiling_perimeter_match:
            measurements["ceiling_perimeter_lf"] = round(float(ceiling_perimeter_match.group(1)), 2)
        
        # Extract openings with improved pattern matching
        self._extract_openings(context_text, measurements["openings"])
        
        # Calculate additional measurements
        measurements["flooring_area_sy"] = round(measurements["floor_area_sqft"] / 9.0, 2)  # Convert sq ft to sq yards
        
        # Return None if no valid measurements found
        if measurements["wall_area_sqft"] == 0 and measurements["floor_area_sqft"] == 0:
            return None
            
        return measurements
    
    def _extract_openings(self, context_text: str, openings_list: List[Dict[str, str]]):
        """Extract openings (doors, windows, missing walls) from context text with improved parsing for complex formats"""
        
        logger.debug(f"Extracting openings from context text: {context_text[:500]}...")  # Log first 500 chars
        
        # Process line by line for accurate extraction
        lines = context_text.split('\n')
        
        for line in lines:
            line_clean = line.strip()
            if not line_clean:
                continue
                
            # Log lines that might contain opening information
            if any(keyword in line_clean.lower() for keyword in ['door', 'window', 'missing', 'wall', 'opening']):
                logger.debug(f"Potential opening line: '{line_clean}'")
                
            # Door extraction - handle complex measurement formats and "Opens into" information
            if line_clean.startswith('Door '):
                logger.debug(f"Processing door line: '{line_clean}'")
                # Use simpler regex for known PDF format
                door_match = re.search(r'Door\s+([^O]+?)(?:\s+(Opens\s+into\s+[^\n]+))?(?:\n|$)', line_clean)
                if door_match:
                    size = door_match.group(1).strip()
                    opens_info = door_match.group(2) if door_match.group(2) else None
                    opens_to = None
                    is_external = False
                    is_internal = True
                    
                    if opens_info:
                        # Extract destination from "Opens into DESTINATION"
                        dest_match = re.search(r'Opens\s+into\s+(.+)', opens_info)
                        if dest_match:
                            opens_to = dest_match.group(1).strip()
                            is_external = 'exterior' in opens_to.lower()
                            is_internal = not is_external
                    
                    size = self._clean_measurement_string(size)
                    logger.debug(f"Door extracted - size: '{size}', opens_to: '{opens_to}', external: {is_external}")
                    
                    if size:
                        # Check for duplicates
                        existing = any(
                            opening['type'] == 'door' and 
                            opening['size'] == size and
                            opening.get('opens_to') == opens_to
                            for opening in openings_list
                        )
                        if not existing:
                            opening_entry = {
                                "type": "door",
                                "size": size,
                                "opens_to": opens_to,
                                "is_external": is_external,
                                "is_internal": is_internal
                            }
                            openings_list.append(opening_entry)
                            logger.debug(f"Added door opening: {opening_entry}")
                        else:
                            logger.debug(f"Skipped duplicate door: size={size}, opens_to={opens_to}")
            
            # Window extraction - handle complex measurement formats and "Opens into" information
            elif line_clean.startswith('Window '):
                logger.debug(f"Processing window line: '{line_clean}'")
                # Use simpler regex for known PDF format
                window_match = re.search(r'Window\s+([^O]+?)(?:\s+(Opens\s+into\s+[^\n]+))?(?:\n|$)', line_clean)
                if window_match:
                    size = window_match.group(1).strip()
                    opens_info = window_match.group(2) if window_match.group(2) else None
                    opens_to = None
                    is_external = True  # Windows default to external
                    is_internal = False
                    
                    if opens_info:
                        # Extract destination from "Opens into DESTINATION"
                        dest_match = re.search(r'Opens\s+into\s+(.+)', opens_info)
                        if dest_match:
                            opens_to = dest_match.group(1).strip()
                            is_external = 'exterior' in opens_to.lower()
                            is_internal = not is_external
                    
                    size = self._clean_measurement_string(size)
                    logger.debug(f"Window extracted - size: '{size}', opens_to: '{opens_to}', external: {is_external}")
                    
                    if size:
                        # Check for duplicates
                        existing = any(
                            opening['type'] == 'window' and 
                            opening['size'] == size and
                            opening.get('opens_to') == opens_to
                            for opening in openings_list
                        )
                        if not existing:
                            opening_entry = {
                                "type": "window",
                                "size": size,
                                "opens_to": opens_to,
                                "is_external": is_external,
                                "is_internal": is_internal
                            }
                            openings_list.append(opening_entry)
                            logger.debug(f"Added window opening: {opening_entry}")
                        else:
                            logger.debug(f"Skipped duplicate window: size={size}, opens_to={opens_to}")
            
            # Missing Wall extraction - handle complex formats and "Opens into" information
            elif line_clean.startswith('Missing Wall'):
                logger.debug(f"Processing missing wall line: '{line_clean}'")
                # Use simpler regex for known PDF format
                missing_match = re.search(r'Missing Wall(?:\s*-\s*Goes to Floor)?\s+([^O]+?)(?:\s+(Opens\s+into\s+[^\n]+))?(?:\n|$)', line_clean)
                if missing_match:
                    size = missing_match.group(1).strip()
                    opens_info = missing_match.group(2) if missing_match.group(2) else None
                    opens_to = None
                    is_external = False  # Missing walls default to internal
                    is_internal = True
                    
                    if opens_info:
                        # Extract destination from "Opens into DESTINATION"
                        dest_match = re.search(r'Opens\s+into\s+(.+)', opens_info)
                        if dest_match:
                            opens_to = dest_match.group(1).strip()
                            is_external = 'exterior' in opens_to.lower()
                            is_internal = not is_external
                    
                    size = self._clean_measurement_string(size)
                    logger.debug(f"Missing wall extracted - size: '{size}', opens_to: '{opens_to}', external: {is_external}")
                    
                    if size:
                        # Check for duplicates
                        existing = any(
                            opening['type'] == 'open_wall' and 
                            opening['size'] == size and
                            opening.get('opens_to') == opens_to
                            for opening in openings_list
                        )
                        if not existing:
                            opening_entry = {
                                "type": "open_wall",
                                "size": size,
                                "opens_to": opens_to,
                                "is_external": is_external,
                                "is_internal": is_internal
                            }
                            openings_list.append(opening_entry)
                            logger.debug(f"Added missing wall opening: {opening_entry}")
                        else:
                            logger.debug(f"Skipped duplicate missing wall: size={size}, opens_to={opens_to}")
            
            # Try alternative patterns for openings that might not start with exact keywords
            else:
                # Check for alternative door patterns
                door_patterns = [
                    r'(\d+\'\s*\d*"?\s*[Xx]\s*\d+\'\s*\d*"?)\s+[Dd]oor',
                    r'[Dd]oor\s+(\d+\'\s*\d*"?\s*[Xx]\s*\d+\'\s*\d*"?)',
                    r'(\d+\'\s*[Xx]\s*\d+\'\s*\d*"?).*[Dd]oor'
                ]
                
                for pattern in door_patterns:
                    match = re.search(pattern, line_clean)
                    if match:
                        size = match.group(1).strip()
                        size = self._clean_measurement_string(size)
                        if size and not any(opening['type'] == 'door' and opening['size'] == size for opening in openings_list):
                            opening_entry = {
                                "type": "door",
                                "size": size,
                                "opens_to": None,
                                "is_external": False,
                                "is_internal": True
                            }
                            openings_list.append(opening_entry)
                            logger.debug(f"Added door from alternative pattern: {opening_entry}")
                        break
                
                # Check for alternative window patterns
                window_patterns = [
                    r'(\d+\'\s*\d*"?\s*[Xx]\s*\d+\'\s*\d*"?)\s+[Ww]indow',
                    r'[Ww]indow\s+(\d+\'\s*\d*"?\s*[Xx]\s*\d+\'\s*\d*"?)',
                    r'(\d+\'\s*[Xx]\s*\d+\'\s*\d*"?).*[Ww]indow'
                ]
                
                for pattern in window_patterns:
                    match = re.search(pattern, line_clean)
                    if match:
                        size = match.group(1).strip()
                        size = self._clean_measurement_string(size)
                        if size and not any(opening['type'] == 'window' and opening['size'] == size for opening in openings_list):
                            opening_entry = {
                                "type": "window",
                                "size": size,
                                "opens_to": None,
                                "is_external": True,
                                "is_internal": False
                            }
                            openings_list.append(opening_entry)
                            logger.debug(f"Added window from alternative pattern: {opening_entry}")
                        break
        
        logger.debug(f"Total openings extracted: {len(openings_list)}")
        for i, opening in enumerate(openings_list):
            logger.debug(f"Opening {i+1}: {opening}")
    
    def _parse_opening_line(self, line: str, opening_type: str) -> Optional[Dict[str, Any]]:
        """Parse opening line to extract size, opens_to, and classification information"""
        try:
            # Handle different opening type patterns - Updated for "Opens into" format
            if opening_type == 'Door':
                pattern = r'Door\s+([^O\n]*?)(?:\s+Opens\s+into\s+([^\n]*?))?(?:\n|$)'
            elif opening_type == 'Window':
                pattern = r'Window\s+([^O\n]*?)(?:\s+Opens\s+into\s+([^\n]*?))?(?:\n|$)'
            elif opening_type == 'Missing Wall':
                pattern = r'Missing Wall(?:\s*-\s*Goes to Floor)?\s+([^O\n]*?)(?:\s+Opens\s+into\s+([^\n]*?))?(?:\n|$)'
            else:
                return None
            
            match = re.search(pattern, line, re.IGNORECASE)
            if not match:
                return None
                
            size = match.group(1).strip() if match.group(1) else ''
            opens_to = match.group(2).strip() if match.group(2) else None
            
            # Clean the size string
            size = self._clean_measurement_string(size)
            
            if not size:
                return None
            
            # Determine if opening is external vs internal
            is_external = False
            is_internal = True
            
            if opens_to:
                # Clean up opens_to string
                opens_to = opens_to.strip().rstrip('.')
                
                # Determine if it's external based on keywords (including "Exterior")
                external_keywords = ['exterior', 'outside', 'outdoor', 'yard', 'patio', 'deck', 'balcony']
                is_external = any(keyword in opens_to.lower() for keyword in external_keywords)
                is_internal = not is_external
            else:
                # Default classification based on opening type
                if opening_type == 'Window':
                    is_external = True
                    is_internal = False
                elif opening_type == 'Door':
                    is_external = False  # Assume internal unless specified
                    is_internal = True
                elif opening_type == 'Missing Wall':
                    is_external = False
                    is_internal = True
            
            return {
                'size': size,
                'opens_to': opens_to,
                'is_external': is_external,
                'is_internal': is_internal
            }
            
        except Exception as e:
            logger.error(f"Error parsing opening line '{line}': {e}")
            return None
    
    def _clean_measurement_string(self, size: str) -> str:
        """Clean up measurement strings, handling fractions and complex formats"""
        if not size:
            return size
            
        # Handle fractions like "5' 9 13/16"" -> "5' 9 13/16\""
        # Remove extra quotes and clean up formatting
        size = re.sub(r'"+$', '"', size)  # Remove trailing quotes
        size = re.sub(r'\s+', ' ', size)   # Normalize spaces
        size = size.strip()
        
        return size
    
    def process_pdf_for_measurements(self, pdf_content: bytes) -> List[Dict[str, Any]]:
        """Complete PDF processing pipeline for room measurements"""
        try:
            # Extract text from PDF
            pdf_text = self.extract_text_from_pdf(pdf_content)
            
            # Extract room measurements using pattern matching
            rooms = self.extract_room_measurements(pdf_text)
            
            if not rooms:
                logger.warning("No rooms found in PDF, using AI fallback")
                return self._ai_fallback_processing(pdf_text)
            
            # Group rooms by location
            locations = {}
            for room in rooms:
                location = room['location']
                if location not in locations:
                    locations[location] = {
                        'location': location,
                        'rooms': []
                    }
                
                locations[location]['rooms'].append({
                    'name': room['name'],
                    'measurements': room['measurements']
                })
            
            result = list(locations.values())
            logger.info(f"Successfully extracted measurements for {len(rooms)} rooms in {len(result)} locations")
            return result
            
        except Exception as e:
            logger.error(f"Error processing PDF: {e}")
            raise
    
    def _ai_fallback_processing(self, pdf_text: str) -> List[Dict[str, Any]]:
        """Fallback to AI processing when pattern matching fails"""
        try:
            from services.ai_service import ai_service
            
            logger.info("Using AI fallback for PDF processing")
            
            # Create prompt for AI to extract room measurements using template
            prompt = PDF_MEASUREMENT_EXTRACTION_PROMPT.format(pdf_text=pdf_text[:3000])
            
            # Use AI service to extract measurements
            ai_result = ai_service.process_text(prompt)
            
            # Parse AI response (assuming it returns structured data)
            if ai_result and isinstance(ai_result, list):
                return ai_result
            
            # Fallback to manual pattern matching if AI fails
            logger.warning("AI processing failed, using manual fallback")
            return self._manual_fallback_processing(pdf_text)
            
        except ImportError:
            logger.warning("AI service not available, using manual fallback")
            return self._manual_fallback_processing(pdf_text)
        except Exception as e:
            logger.error(f"AI fallback processing failed: {e}")
            return self._manual_fallback_processing(pdf_text)
    
    def _manual_fallback_processing(self, pdf_text: str) -> List[Dict[str, Any]]:
        """Manual fallback when AI processing is not available"""
        logger.info("Using manual fallback for PDF processing")
        
        # Try to extract basic information using simple patterns
        rooms = []
        
        # Look for room patterns in a more flexible way
        room_patterns = [
            r'Living Room.*?(\d+(?:\.\d+)?)\s*SF',
            r'Bedroom.*?(\d+(?:\.\d+)?)\s*SF',
            r'Kitchen.*?(\d+(?:\.\d+)?)\s*SF',
            r'Bathroom.*?(\d+(?:\.\d+)?)\s*SF',
            r'Hallway.*?(\d+(?:\.\d+)?)\s*SF'
        ]
        
        for pattern in room_patterns:
            matches = re.finditer(pattern, pdf_text, re.IGNORECASE)
            for match in matches:
                room_name = match.group(0).split()[0]
                area = float(match.group(1))
                
                rooms.append({
                    "name": room_name,
                    "measurements": {
                        "height": 9.0,  # Default height
                        "wall_area_sqft": area * 2,  # Estimate
                        "ceiling_area_sqft": area,
                        "floor_area_sqft": area,
                        "walls_and_ceiling_area_sqft": area * 3,
                        "flooring_area_sy": area / 9.0,
                        "ceiling_perimeter_lf": area ** 0.5 * 4,  # Rough estimate
                        "floor_perimeter_lf": area ** 0.5 * 4,
                        "openings": []
                    }
                })
        
        if not rooms:
            # Return minimal default structure
            rooms = [{
                "name": "Unknown Room",
                "measurements": {
                    "height": 9.0,
                    "wall_area_sqft": 0.0,
                    "ceiling_area_sqft": 0.0,
                    "floor_area_sqft": 0.0,
                    "walls_and_ceiling_area_sqft": 0.0,
                    "flooring_area_sy": 0.0,
                    "ceiling_perimeter_lf": 0.0,
                    "floor_perimeter_lf": 0.0,
                    "openings": []
                }
            }]
        
        return [{
            "location": "Main Level",
            "rooms": rooms
        }]

# Global PDF parser service instance
pdf_parser_service = PDFParserService()