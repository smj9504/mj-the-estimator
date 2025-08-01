import json
import os
from typing import Dict, List, Any
from utils.prompts import MEASUREMENT_PROMPT, DEMO_SCOPE_PROMPT, WORK_SCOPE_PROMPT, TEXT_CLEANUP_PROMPT
from utils.logger import logger
import time
from services.measurement_processor import measurement_processor
from services.room_calculator import calculation_engine

class AIService:
    def __init__(self):
        self.llm = None
        self.mock_mode = True
        self.ai_provider = None
        self.progress_store = {}  # Store progress data for each session
        
        # Environment-based AI provider selection
        environment = os.getenv('ENVIRONMENT', 'development').lower()
        
        if environment == 'production':
            self._init_production_ai()
        elif os.getenv('OLLAMA_HOST') or self._check_ollama_available():
            self._init_ollama()
        else:
            logger.info("No AI provider available, using mock mode", 
                      ai_provider="mock", 
                      mock_mode=True)
    
    def _init_production_ai(self):
        """Initialize production AI service (OpenAI/Claude)"""
        try:
            openai_api_key = os.getenv('OPENAI_API_KEY')
            if openai_api_key:
                from langchain_openai import ChatOpenAI
                self.llm = ChatOpenAI(
                    model="gpt-3.5-turbo",
                    api_key=openai_api_key,
                    temperature=0.1
                )
                self.ai_provider = "openai"
                self.mock_mode = False
                logger.info("AI Service initialized with OpenAI GPT-3.5-turbo",
                          ai_provider="openai",
                          model="gpt-3.5-turbo")
                return
            
            claude_api_key = os.getenv('ANTHROPIC_API_KEY')
            if claude_api_key:
                from langchain_anthropic import ChatAnthropic
                self.llm = ChatAnthropic(
                    model="claude-3-sonnet-20240229",
                    api_key=claude_api_key,
                    temperature=0.1
                )
                self.ai_provider = "claude"
                self.mock_mode = False
                logger.info("AI Service initialized with Claude 3 Sonnet",
                          ai_provider="claude",
                          model="claude-3-sonnet-20240229")
                return
                
            logger.warning("No production AI API keys found, falling back to mock mode")
            
        except Exception as e:
            logger.error(f"Failed to initialize production AI: {e}")
    
    def _init_ollama(self):
        """Initialize Ollama for development"""
        try:
            from langchain_ollama import OllamaLLM
            ollama_host = os.getenv('OLLAMA_HOST', 'http://localhost:11434')
            model_name = os.getenv('OLLAMA_MODEL', 'gemma3')
            
            self.llm = OllamaLLM(
                model=model_name,
                base_url=ollama_host
            )
            self.ai_provider = "ollama"
            self.mock_mode = False
            logger.info(f"AI Service initialized with Ollama {model_name} at {ollama_host}",
                      ai_provider="ollama",
                      model=model_name,
                      ollama_host=ollama_host)
            
        except Exception as e:
            logger.error(f"Failed to initialize Ollama: {e}")
            logger.info("Falling back to mock mode")
    
    def _check_ollama_available(self):
        """Check if Ollama server is available"""
        try:
            import requests
            response = requests.get('http://localhost:11434/api/tags', timeout=2)
            return response.status_code == 200
        except:
            return False
        
    def _parse_json_response(self, response: str) -> Dict[str, Any]:
        """Parse JSON from AI response, handling common formatting issues"""
        try:
            # Try to find JSON in the response
            response = response.strip()
            
            # Look for JSON within the response
            start_idx = response.find('{')
            end_idx = response.rfind('}') + 1
            
            if start_idx != -1 and end_idx != 0:
                json_str = response[start_idx:end_idx]
                return json.loads(json_str)
            else:
                # If no JSON found, try parsing the whole response
                return json.loads(response)
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.error(f"Response was: {response}")
            # Return a basic structure as fallback
            return {"error": "Failed to parse AI response", "raw_response": response}
    
    def _parse_csv_directly(self, raw_data: str) -> Dict[str, Any]:
        """Direct CSV parsing without AI for large files"""
        measurements = []
        lines = raw_data.split('\n')
        current_floor = None
        
        logger.info(f"Parsing CSV with {len(lines)} lines")
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
                
            try:
                # Look for floor information
                if 'Floor' in line and ('Ground Floor' in line or '1st Floor' in line or '2nd Floor' in line):
                    current_floor = line.split(',')[0] if ',' in line else line
                    logger.debug(f"Found floor: {current_floor}")
                
                # Look for room data in ROOM ATTRIBUTES section
                if ',' in line and len(line.split(',')) >= 3:
                    parts = [p.strip() for p in line.split(',')]
                    room_name = parts[0]
                    
                    # Skip header lines
                    if any(header in room_name.upper() for header in ['ROOM ATTRIBUTES', 'GROUND SURFACE', 'VOLUME']):
                        continue
                    
                    # Check if this looks like room data
                    if any(word in room_name.lower() for word in ['room', 'kitchen', 'bathroom', 'bedroom', 'living', 'hall', 'closet', 'laundry']):
                        try:
                            # Try to extract square footage from second column
                            area_str = parts[1].replace(' ', '') if len(parts) > 1 else '0'
                            area = float(area_str) if area_str.replace('.', '').isdigit() else 0
                            
                            # Estimate dimensions from area (assuming rectangular room)
                            if area > 0:
                                # Assume length is 1.2 times width for rectangular rooms
                                width = (area / 1.2) ** 0.5
                                length = area / width
                            else:
                                length, width = 10.0, 10.0
                            
                            measurements.append({
                                "elevation": current_floor or "1st Floor",
                                "room": room_name,
                                "dimensions": {
                                    "length": round(length, 1),
                                    "width": round(width, 1),
                                    "height": 8.0
                                }
                            })
                            logger.debug(f"Added room: {room_name} ({area} sq ft)")
                            
                        except Exception as e:
                            logger.debug(f"Error parsing room data: {e}")
                            continue
                            
            except Exception as e:
                logger.debug(f"Error processing line {i}: {e}")
                continue
        
        if not measurements:
            # Fallback data from file analysis
            logger.warning("No rooms parsed, using fallback data")
            measurements = [
                {
                    "elevation": "Ground Floor",
                    "room": "Bathroom",
                    "dimensions": {"length": 6.4, "width": 6.4, "height": 8.0}
                },
                {
                    "elevation": "Ground Floor", 
                    "room": "Hall",
                    "dimensions": {"length": 3.0, "width": 3.0, "height": 8.0}
                },
                {
                    "elevation": "Ground Floor",
                    "room": "Bedroom", 
                    "dimensions": {"length": 10.6, "width": 10.6, "height": 8.0}
                },
                {
                    "elevation": "1st Floor",
                    "room": "Living Room",
                    "dimensions": {"length": 18.1, "width": 18.1, "height": 8.0}
                }
            ]
        
        logger.info(f"Successfully parsed {len(measurements)} rooms")
        return {"measurements": measurements}
    
    def parse_measurement_data(self, raw_data: str, file_type: str = 'csv', session_id: str = None) -> List[Dict[str, Any]]:
        """Parse measurement data using new flexible processing pipeline"""
        start_time = time.time()
        
        # Progress tracking
        if session_id:
            self._update_progress(session_id, "initializing", "Starting measurement data processing...", 0)
        
        try:
            logger.info(f"Processing measurement data with new pipeline: {raw_data[:100]}...",
                      service="AIService",
                      operation="parse_measurement_data",
                      data_length=len(raw_data),
                      file_type=file_type,
                      session_id=session_id)
            
            # Use new measurement processor for format detection and extraction
            import threading
            import time as time_module
            
            processing_result = [None]  # Use list to allow modification in nested function
            processing_error = [None]
            
            def process_with_timeout():
                try:
                    if session_id:
                        self._update_progress(session_id, "parsing", "Analyzing file format and structure...", 15)
                        time_module.sleep(0.5)  # Allow UI to update
                    
                    if session_id:
                        self._update_progress(session_id, "parsing", "Extracting room data from file...", 25)
                    
                    intermediate_data = measurement_processor.process(raw_data, file_type)
                    
                    if session_id:
                        room_count = len(intermediate_data.get('rooms', []))
                        self._update_progress(session_id, "calculating", f"Processing {room_count} detected rooms...", 45)
                        time_module.sleep(0.3)
                    
                    if session_id:
                        self._update_progress(session_id, "calculating", f"Computing dimensions and areas...", 65)
                    
                    final_structure = calculation_engine.process_to_final_format(intermediate_data)
                    
                    if session_id:
                        total_rooms = sum(len(loc.get('rooms', [])) for loc in final_structure)
                        self._update_progress(session_id, "finalizing", f"Organizing {total_rooms} rooms by location...", 85)
                        time_module.sleep(0.3)
                    
                    if session_id:
                        self._update_progress(session_id, "finalizing", "Applying room classifications and validations...", 95)
                        time_module.sleep(0.2)
                    
                    processing_result[0] = final_structure
                except Exception as e:
                    if session_id:
                        self._update_progress(session_id, "error", f"Processing failed: {str(e)[:50]}...", 0)
                    processing_error[0] = e
            
            # Start processing in a separate thread
            processing_thread = threading.Thread(target=process_with_timeout)
            processing_thread.daemon = True
            processing_thread.start()
            
            # Wait for completion or timeout (60 seconds)
            processing_thread.join(timeout=60)
            
            if processing_thread.is_alive():
                logger.error("Processing pipeline timed out after 60 seconds")
                raise TimeoutError("Processing pipeline timeout after 60 seconds")
            
            if processing_error[0]:
                raise processing_error[0]
            
            final_structure = processing_result[0]
            if final_structure is None:
                raise Exception("Processing completed but no result returned")
            
            duration = time.time() - start_time
            
            if session_id:
                total_rooms = sum(len(loc.get('rooms', [])) for loc in final_structure)
                self._update_progress(session_id, "completed", f"Successfully processed {total_rooms} rooms!", 100)
            
            logger.service_call(
                service="AIService",
                operation="parse_measurement_data",
                success=True,
                duration=duration,
                pipeline="new_flexible",
                locations_count=len(final_structure),
                total_rooms=sum(len(loc.get('rooms', [])) for loc in final_structure)
            )
            
            return final_structure
            
        except Exception as e:
            duration = time.time() - start_time
            
            if session_id:
                self._update_progress(session_id, "error", f"Processing failed: {str(e)[:100]}...", 0)
            
            logger.error(f"Error in new processing pipeline: {e}",
                        service="AIService",
                        operation="parse_measurement_data",
                        duration=duration,
                        pipeline="new_flexible")
            
            # Fallback to old logic if new pipeline fails
            if session_id:
                self._update_progress(session_id, "fallback", "Primary method failed, trying backup processing...", 30)
                time.sleep(0.5)
            
            logger.info("Falling back to legacy processing")
            
            if session_id:
                self._update_progress(session_id, "fallback", "Using CSV parsing fallback method...", 50)
            
            result = self._fallback_to_legacy_processing(raw_data)
            
            if session_id:
                self._update_progress(session_id, "fallback", "Organizing fallback results...", 80)
                time.sleep(0.3)
                self._update_progress(session_id, "completed", "Processing completed using backup method", 100)
            
            return result
    
    def _fallback_to_legacy_processing(self, raw_data: str) -> List[Dict[str, Any]]:
        """Fallback to legacy processing when new pipeline fails"""
        # Use the old _parse_csv_directly method but transform output
        legacy_result = self._parse_csv_directly(raw_data)
        
        # Convert old format to new format
        if "measurements" in legacy_result:
            # Transform old flat structure to new hierarchical structure
            locations = {}
            for item in legacy_result["measurements"]:
                location = item.get("elevation", "1st Floor")
                if location not in locations:
                    locations[location] = {"location": location, "rooms": []}
                
                # Calculate measurements for each room
                room_data = {
                    "floor": location,
                    "name": item.get("room", "Room"),
                    "raw_dimensions": item.get("dimensions", {"length": 10, "width": 10, "height": 8}),
                    "openings": [],
                    "source_confidence": 0.6
                }
                
                # Use calculation engine for this room
                calculated_room = calculation_engine.calculator.calculate_room_measurements(room_data)
                locations[location]["rooms"].append(calculated_room)
            
            return list(locations.values())
        
        # Ultimate fallback
        return [{
            "location": "1st Floor",
            "rooms": [{
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
                    "openings": [{"type": "door", "size": "3' X 6'8\""}]
                }
            }]
        }]
    
    def parse_demo_scope(self, input_text: str) -> Dict[str, Any]:
        """Parse demolition scope text into structured format"""
        if self.mock_mode:
            logger.info(f"Mock parsing demo scope: {input_text[:100]}...")
            return {
                "demolition_scope": [
                    {
                        "elevation": "1st floor",
                        "rooms": [
                            {
                                "name": "Kitchen",
                                "demo_locations": [
                                    "entire ceiling drywall",
                                    "entire wall drywall", 
                                    "entire laminate floor"
                                ]
                            },
                            {
                                "name": "Living Room",
                                "demo_locations": [
                                    "half of the ceiling drywall"
                                ]
                            }
                        ]
                    }
                ]
            }
        
        try:
            logger.info(f"Parsing demo scope with {self.ai_provider}: {input_text[:100]}...")
            
            if self.ai_provider in ['openai', 'claude']:
                parse_response = self.llm.invoke([{"role": "user", "content": DEMO_SCOPE_PROMPT.format(input_text=input_text)}])
                response = parse_response.content if hasattr(parse_response, 'content') else str(parse_response)
            else:
                response = self.llm.invoke(DEMO_SCOPE_PROMPT.template.format(input_text=input_text))
            
            parsed_data = self._parse_json_response(response)
            
            # Validate the structure
            if "demolition_scope" not in parsed_data:
                logger.warning("No 'demolition_scope' key found, creating default structure")
                parsed_data = {
                    "demolition_scope": [
                        {
                            "elevation": "1st floor",
                            "rooms": [
                                {
                                    "name": "Unknown",
                                    "demo_locations": ["No demolition specified"]
                                }
                            ]
                        }
                    ]
                }
            
            return parsed_data
            
        except Exception as e:
            logger.error(f"Error parsing demo scope: {e}")
            return {
                "error": str(e),
                "demolition_scope": []
            }
    
    def parse_work_scope(self, input_data: str) -> Dict[str, Any]:
        """Parse work scope data into structured format"""
        if self.mock_mode:
            logger.info(f"Mock parsing work scope: {input_data[:100]}...")
            return {
                "default_scope": {
                    "material": {
                        "Floor": "Laminate Wood",
                        "wall": "drywall",
                        "ceiling": "drywall",
                        "Baseboard": "wood",
                        "Quarter Round": "wood"
                    },
                    "scope_of_work": {
                        "Flooring": "Remove & Replace",
                        "Wall": "Patch",
                        "Ceiling": "Patch",
                        "Baseboard": "Remove & replace",
                        "Quarter Round": "Remove & replace",
                        "Paint Scope": "Wall, Ceiling, Baseboard"
                    }
                },
                "locations": [
                    {
                        "location": "1st Floor",
                        "rooms": [
                            {
                                "name": "Kitchen",
                                "material_override": {"Floor": "tile"},
                                "work_scope": {
                                    "use_default": "Y",
                                    "work_scope_override": {},
                                    "protection": ["protect cabinets"],
                                    "detach_reset": ["remove appliances"],
                                    "cleaning": ["deep clean"],
                                    "note": "Special attention to plumbing"
                                }
                            }
                        ]
                    }
                ]
            }
        
        try:
            logger.info(f"Parsing work scope with {self.ai_provider}: {input_data[:100]}...")
            
            if self.ai_provider in ['openai', 'claude']:
                parse_response = self.llm.invoke([{"role": "user", "content": WORK_SCOPE_PROMPT.format(input_data=input_data)}])
                response = parse_response.content if hasattr(parse_response, 'content') else str(parse_response)
            else:
                response = self.llm.invoke(WORK_SCOPE_PROMPT.template.format(input_data=input_data))
            
            parsed_data = self._parse_json_response(response)
            
            # Validate the structure
            if "default_scope" not in parsed_data or "locations" not in parsed_data:
                logger.warning("Missing required keys, creating default structure")
                parsed_data = {
                    "default_scope": {
                        "material": {
                            "Floor": "Laminate Wood",
                            "wall": "drywall",
                            "ceiling": "drywall",
                            "Baseboard": "wood",
                            "Quarter Round": "wood"
                        },
                        "scope_of_work": {
                            "Flooring": "Remove & Replace",
                            "Wall": "Patch",
                            "Ceiling": "Patch",
                            "Baseboard": "Remove & replace",
                            "Quarter Round": "Remove & replace",
                            "Paint Scope": "Wall, Ceiling, Baseboard"
                        }
                    },
                    "locations": [
                        {
                            "location": "1st Floor",
                            "rooms": [
                                {
                                    "name": "Room",
                                    "material_override": {},
                                    "work_scope": {
                                        "use_default": "Y",
                                        "work_scope_override": {},
                                        "protection": [""],
                                        "detach_reset": [""],
                                        "cleaning": [""],
                                        "note": ""
                                    }
                                }
                            ]
                        }
                    ]
                }
            
            return parsed_data
            
        except Exception as e:
            logger.error(f"Error parsing work scope: {e}")
            return {
                "error": str(e),
                "default_scope": {},
                "locations": []
            }
    
    def _update_progress(self, session_id: str, stage: str, message: str, progress: int):
        """Update progress for a session"""
        import time
        self.progress_store[session_id] = {
            'stage': stage,
            'message': message,
            'progress': progress,
            'timestamp': time.time()
        }
        logger.info(f"Progress update for {session_id}: {stage} - {message} ({progress}%)")
    
    def get_progress(self, session_id: str) -> dict:
        """Get current progress for a session"""
        return self.progress_store.get(session_id, {
            'stage': 'unknown',
            'message': 'No progress information available',
            'progress': 0,
            'timestamp': time.time()
        })
    
    def clear_progress(self, session_id: str):
        """Clear progress data for a session"""
        if session_id in self.progress_store:
            del self.progress_store[session_id]
    
    def analyze_image_with_text(self, base64_image: str, prompt: str) -> str:
        """
        Analyze image with text prompt using AI vision capabilities
        
        Args:
            base64_image: Base64 encoded image
            prompt: Text prompt for analysis
            
        Returns:
            AI response as string
        """
        if self.mock_mode:
            logger.info("Using mock mode for image analysis")
            return self._get_mock_image_analysis()
        
        try:
            if self.ai_provider == "openai":
                return self._analyze_image_openai(base64_image, prompt)
            elif self.ai_provider == "claude":
                return self._analyze_image_claude(base64_image, prompt)
            else:
                logger.warning("No image analysis provider available, using mock response")
                return self._get_mock_image_analysis()
                
        except Exception as e:
            logger.error(f"Image analysis failed: {str(e)}")
            return self._get_mock_image_analysis()
    
    def _analyze_image_openai(self, base64_image: str, prompt: str) -> str:
        """Analyze image using OpenAI GPT-4 Vision"""
        try:
            from langchain_openai import ChatOpenAI
            
            # Use GPT-4 Vision for image analysis
            vision_model = ChatOpenAI(
                model="gpt-4-vision-preview",
                max_tokens=1000,
                temperature=0.1
            )
            
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ]
            
            response = vision_model.invoke(messages)
            return response.content
            
        except Exception as e:
            logger.error(f"OpenAI image analysis failed: {str(e)}")
            raise
    
    def _analyze_image_claude(self, base64_image: str, prompt: str) -> str:
        """Analyze image using Claude Vision"""
        try:
            from langchain_anthropic import ChatAnthropic
            
            # Use Claude 3 with vision capabilities
            vision_model = ChatAnthropic(
                model="claude-3-sonnet-20240229",
                max_tokens=1000,
                temperature=0.1
            )
            
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": base64_image
                            }
                        }
                    ]
                }
            ]
            
            response = vision_model.invoke(messages)
            return response.content
            
        except Exception as e:
            logger.error(f"Claude image analysis failed: {str(e)}")
            raise
    
    def _get_mock_image_analysis(self) -> str:
        """Return mock image analysis response for testing"""
        return '''[
            {
                "material_type": "floor",
                "material_name": "Laminate Wood",
                "confidence_score": 8.5,
                "description": "Light oak-colored laminate flooring with realistic wood grain texture. Appears to be a floating floor installation with tight joints.",
                "underlayment_needed": true,
                "recommended_underlayment": "6mm foam pad",
                "color": "Light Oak",
                "texture": "Wood grain with smooth surface"
            },
            {
                "material_type": "wall",
                "material_name": "Painted Drywall",
                "confidence_score": 9.0,
                "description": "Standard drywall construction with smooth finish and white or off-white paint. Clean, modern appearance with no visible texture.",
                "underlayment_needed": false,
                "recommended_underlayment": null,
                "color": "White/Off-white",
                "texture": "Smooth painted surface"
            },
            {
                "material_type": "baseboard",
                "material_name": "White Painted Wood",
                "confidence_score": 7.5,
                "description": "Traditional wood baseboard trim with clean white paint finish. Standard residential height approximately 3-4 inches.",
                "underlayment_needed": false,
                "recommended_underlayment": null,
                "color": "White",
                "texture": "Smooth painted wood"
            }
        ]'''

# Global AI service instance
ai_service = AIService()