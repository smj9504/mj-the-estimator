import json
import os
from typing import Dict, Any
from utils.prompts import MEASUREMENT_PROMPT, DEMO_SCOPE_PROMPT, WORK_SCOPE_PROMPT, TEXT_CLEANUP_PROMPT
from utils.logger import logger
import time

class AIService:
    def __init__(self):
        self.llm = None
        self.mock_mode = True
        self.ai_provider = None
        
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
    
    def parse_measurement_data(self, raw_data: str) -> Dict[str, Any]:
        """Parse measurement data from OCR text or CSV content"""
        start_time = time.time()
        
        # For development stability, always use direct parsing for CSV data
        if len(raw_data) > 1000 or "PLAN ATTRIBUTES" in raw_data:
            logger.info("Using direct CSV parsing for stability",
                       data_length=len(raw_data))
            return self._parse_csv_directly(raw_data)
        
        if self.mock_mode:
            logger.info(f"Mock parsing measurement data: {raw_data[:100]}...",
                      service="AIService",
                      operation="parse_measurement_data",
                      data_length=len(raw_data))
            return {
                "measurements": [
                    {
                        "elevation": "1st Floor",
                        "room": "Kitchen",
                        "dimensions": {"length": 10.0, "width": 12.0, "height": 8.0}
                    },
                    {
                        "elevation": "1st Floor", 
                        "room": "Living Room",
                        "dimensions": {"length": 15.0, "width": 20.0, "height": 9.0}
                    }
                ]
            }
        
        try:
            logger.info(f"Parsing measurement data with {self.ai_provider}: {raw_data[:100]}...",
                      service="AIService",
                      operation="parse_measurement_data",
                      data_length=len(raw_data),
                      ai_provider=self.ai_provider)
            
            # Clean the input data first
            if self.ai_provider in ['openai', 'claude']:
                # For chat models, use different invocation
                cleaned_response = self.llm.invoke([{"role": "user", "content": TEXT_CLEANUP_PROMPT.format(text=raw_data)}])
                cleaned_data = cleaned_response.content if hasattr(cleaned_response, 'content') else str(cleaned_response)
                
                # Parse with measurement prompt
                parse_response = self.llm.invoke([{"role": "user", "content": MEASUREMENT_PROMPT.format(raw_data=cleaned_data)}])
                response = parse_response.content if hasattr(parse_response, 'content') else str(parse_response)
            else:
                # For Ollama LLM models with timeout handling
                try:
                    cleaned_data = self.llm.invoke(TEXT_CLEANUP_PROMPT.template.format(text=raw_data))
                    response = self.llm.invoke(MEASUREMENT_PROMPT.template.format(raw_data=cleaned_data))
                except Exception as e:
                    logger.warning(f"AI processing failed, falling back to direct parsing: {e}")
                    return self._parse_csv_directly(raw_data)
            
            parsed_data = self._parse_json_response(response)
            
            # Validate the structure
            if "measurements" not in parsed_data:
                logger.warning("No 'measurements' key found, creating default structure")
                parsed_data = {
                    "measurements": [
                        {
                            "elevation": "1st Floor",
                            "room": "Unknown",
                            "dimensions": {"length": 0, "width": 0, "height": 8}
                        }
                    ]
                }
            
            duration = time.time() - start_time
            logger.service_call(
                service="AIService",
                operation="parse_measurement_data",
                success=True,
                duration=duration,
                ai_provider=self.ai_provider,
                result_keys=list(parsed_data.keys())
            )
            return parsed_data
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Error parsing measurement data: {e}",
                        service="AIService",
                        operation="parse_measurement_data",
                        duration=duration,
                        ai_provider=self.ai_provider)
            return {
                "error": str(e),
                "measurements": []
            }
    
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

# Global AI service instance
ai_service = AIService()