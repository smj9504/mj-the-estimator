import logging
import re
from typing import Dict, List, Any, Optional
from PyPDF2 import PdfReader
from io import BytesIO
from utils.logger import logger

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
        
        # Enhanced patterns for insurance estimates (State Farm, etc.)
        patterns = {
            'room_with_height': r'([A-Za-z\s\d]+?)\s+Height:\s*(\d+)[\'"]?(?:\s*(\d+)[\'"]?)?|([A-Za-z\s\d]+?)\s+Height:\s*(Peaked|peaked)',
            'wall_area': r'(\d+(?:\.\d+)?)\s*SF\s*Walls(?:\s*&\s*Ceiling)?',
            'ceiling_area': r'(\d+(?:\.\d+)?)\s*SF\s*(?:Walls\s*&\s*)?Ceiling',
            'floor_area': r'(\d+(?:\.\d+)?)\s*SF\s*Floor(?:\s|$)',
            'wall_ceiling_combined': r'(\d+(?:\.\d+)?)\s*SF\s*Walls\s*&\s*Ceiling',
            'perimeter': r'(\d+(?:\.\d+)?)\s*LF\s*(?:Floor|Ceil\.?)\s*Perimeter',
            'door_pattern': r'Door\s+(\d+[\'"]?\s*[xX×]\s*\d+[\'"]?(?:\s*\d+[\'"]?)?)',
            'window_pattern': r'Window\s+(\d+[\'"]?\s*[xX×]\s*\d+[\'"]?(?:\s*\d+[\'"]?)?)',
            'missing_wall_pattern': r'Missing Wall\s+(\d+[\'"]?\s*[xX×]?\s*\d+[\'"]?(?:\s*[xX×]?\s*\d+[\'"]?)?)',
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
                # Handle different height patterns
                if height_match.group(4):  # Peaked ceiling case
                    room_name = height_match.group(4).strip()
                    height = "Peaked"
                elif height_match.group(5) and height_match.group(5).lower() == 'peaked':
                    room_name = height_match.group(4).strip()
                    height = "Peaked"
                else:
                    room_name = height_match.group(1).strip()
                    feet = int(height_match.group(2))
                    inches = height_match.group(3)  # Could be None
                    
                    # Calculate height in feet with decimal inches
                    if inches:
                        height = feet + (int(inches) / 12.0)
                    else:
                        height = float(feet)
                
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
            
            # Update location if found
            if "Main Level" in line or "Level 2" in line or "Basement" in line:
                for level in ["Main Level", "Level 2", "Basement"]:
                    if level in line:
                        current_location = level
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
        
        # Extract wall area
        wall_match = re.search(patterns['wall_area'], context_text)
        if wall_match:
            measurements["wall_area_sqft"] = round(float(wall_match.group(1)), 2)
        
        # Extract ceiling area
        ceiling_match = re.search(patterns['ceiling_area'], context_text)
        if ceiling_match:
            measurements["ceiling_area_sqft"] = round(float(ceiling_match.group(1)), 2)
        
        # Extract floor area
        floor_match = re.search(patterns['floor_area'], context_text)
        if floor_match:
            measurements["floor_area_sqft"] = round(float(floor_match.group(1)), 2)
        
        # Extract combined walls & ceiling if available
        wall_ceiling_match = re.search(patterns['wall_ceiling_combined'], context_text)
        if wall_ceiling_match:
            measurements["walls_and_ceiling_area_sqft"] = round(float(wall_ceiling_match.group(1)), 2)
        else:
            measurements["walls_and_ceiling_area_sqft"] = round(measurements["wall_area_sqft"] + measurements["ceiling_area_sqft"], 2)
        
        # Extract perimeter
        perimeter_match = re.search(patterns['perimeter'], context_text)
        if perimeter_match:
            measurements["floor_perimeter_lf"] = round(float(perimeter_match.group(1)), 2)
            measurements["ceiling_perimeter_lf"] = round(float(perimeter_match.group(1)), 2)
        
        # Extract openings with improved pattern matching
        self._extract_openings(context_text, measurements["openings"])
        
        # Calculate additional measurements
        measurements["flooring_area_sy"] = round(measurements["floor_area_sqft"] / 9.0, 2)  # Convert sq ft to sq yards
        
        # Return None if no valid measurements found
        if measurements["wall_area_sqft"] == 0 and measurements["floor_area_sqft"] == 0:
            return None
            
        return measurements
    
    def _extract_openings(self, context_text: str, openings_list: List[Dict[str, str]]):
        """Extract openings (doors, windows, missing walls) from context text with improved line-by-line parsing"""
        
        # Process line by line for accurate extraction
        lines = context_text.split('\n')
        
        for line in lines:
            line_clean = line.strip()
            if not line_clean:
                continue
                
            # Door extraction - handle all door formats
            if line_clean.startswith('Door '):
                # Extract everything between "Door " and " Opens" (or end of line)
                door_match = re.search(r'Door\s+([^O\n]+?)(?=\s+Opens|$)', line_clean)
                if door_match:
                    size = door_match.group(1).strip()
                    # Clean up any trailing characters
                    size = re.sub(r'\s+$', '', size)
                    
                    # Check for duplicates
                    existing = any(
                        opening['type'] == 'door' and opening['size'] == size
                        for opening in openings_list
                    )
                    if not existing and size:
                        openings_list.append({
                            "type": "door",
                            "size": size
                        })
            
            # Window extraction - handle all window formats  
            elif line_clean.startswith('Window '):
                # Extract everything between "Window " and " Opens" (or end of line)
                window_match = re.search(r'Window\s+([^O\n]+?)(?=\s+Opens|$)', line_clean)
                if window_match:
                    size = window_match.group(1).strip()
                    # Clean up any trailing characters
                    size = re.sub(r'\s+$', '', size)
                    
                    # Check for duplicates
                    existing = any(
                        opening['type'] == 'window' and opening['size'] == size
                        for opening in openings_list
                    )
                    if not existing and size:
                        openings_list.append({
                            "type": "window",
                            "size": size
                        })
            
            # Missing Wall extraction - handle complex formats
            elif line_clean.startswith('Missing Wall'):
                # Extract everything between "Missing Wall" and " Opens" (or end of line)
                # Handle both "Missing Wall " and "Missing Wall - Goes to Floor "
                missing_match = re.search(r'Missing Wall(?:\s*-\s*Goes to Floor)?\s+([^O\n]+?)(?=\s+Opens|$)', line_clean)
                if missing_match:
                    size = missing_match.group(1).strip()
                    # Clean up any trailing characters
                    size = re.sub(r'\s+$', '', size)
                    
                    # Check for duplicates
                    existing = any(
                        opening['type'] == 'open_wall' and opening['size'] == size
                        for opening in openings_list
                    )
                    if not existing and size:
                        openings_list.append({
                            "type": "open_wall",
                            "size": size
                        })
    
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
            
            # Create prompt for AI to extract room measurements
            prompt = f"""
            Extract interior room measurements from this insurance estimate PDF text.
            Focus only on interior rooms and their measurements.
            
            Return JSON format with locations and rooms containing:
            - name: room name
            - measurements: with wall_area_sqft, ceiling_area_sqft, floor_area_sqft, height, 
              floor_perimeter_lf, ceiling_perimeter_lf, walls_and_ceiling_area_sqft, 
              flooring_area_sy, and openings (doors/windows with sizes)
            
            PDF Text:
            {pdf_text[:3000]}  # Limit text to avoid token limits
            """
            
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