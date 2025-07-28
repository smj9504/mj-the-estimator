from langchain.prompts import PromptTemplate

# Measurement data parsing prompt
MEASUREMENT_PROMPT = PromptTemplate(
    input_variables=["raw_data"],
    template="""
Convert the following measurement data into a structured JSON format.

Raw data: {raw_data}

Expected JSON format:
{{
    "measurements": [
        {{
            "elevation": "1st Floor",
            "room": "Kitchen", 
            "dimensions": {{
                "length": 10.0,
                "width": 12.0,
                "height": 8.0
            }}
        }}
    ]
}}

Instructions:
- Extract room names, elevations/floors, and dimensions
- Convert measurements to numeric values (feet)
- If measurements are missing, use reasonable defaults
- Return only valid JSON, no additional text

JSON:
"""
)

# Demo scope parsing prompt
DEMO_SCOPE_PROMPT = PromptTemplate(
    input_variables=["input_text"],
    template="""
Parse the following demolition scope description into structured JSON format.

Input text: {input_text}

Expected JSON format:
{{
    "demolition_scope": [
        {{
            "elevation": "1st floor",
            "rooms": [
                {{
                    "name": "Kitchen",
                    "demo_locations": [
                        "entire ceiling drywall",
                        "entire wall drywall",
                        "entire laminate floor"
                    ]
                }}
            ]
        }}
    ]
}}

Instructions:
- Group by elevation/floor level
- List each room with its demolished areas
- Be specific about materials and locations
- Maintain the original wording where possible
- Return only valid JSON, no additional text

JSON:
"""
)

# Work scope parsing prompt
WORK_SCOPE_PROMPT = PromptTemplate(
    input_variables=["input_data"],
    template="""
Convert the following work scope information into structured JSON format.

Input data: {input_data}

Expected JSON format:
{{
    "default_scope": {{
        "material": {{
            "Floor": "Laminate Wood",
            "wall": "drywall", 
            "ceiling": "drywall",
            "Baseboard": "wood",
            "Quarter Round": "wood"
        }},
        "scope_of_work": {{
            "Flooring": "Remove & Replace",
            "Wall": "Patch",
            "Ceiling": "Patch", 
            "Baseboard": "Remove & replace",
            "Quarter Round": "Remove & replace",
            "Paint Scope": "Wall, Ceiling, Baseboard"
        }}
    }},
    "locations": [
        {{
            "location": "1st Floor",
            "rooms": [
                {{
                    "name": "Kitchen",
                    "material_override": {{}},
                    "work_scope": {{
                        "use_default": "Y",
                        "work_scope_override": {{}},
                        "protection": [""],
                        "detach_reset": [""],
                        "cleaning": [""],
                        "note": ""
                    }}
                }}
            ]
        }}
    ]
}}

Instructions:
- Extract default materials and scope of work
- Identify room-specific overrides
- Parse protection, detach_reset, and cleaning arrays
- Include notes for each room
- Return only valid JSON, no additional text

JSON:
"""
)

# Simple text cleaning prompt
TEXT_CLEANUP_PROMPT = PromptTemplate(
    input_variables=["text"],
    template="""
Clean and structure the following text for better processing:

Text: {text}

Instructions:
- Fix obvious typos and formatting issues
- Organize by sections if possible
- Remove unnecessary whitespace
- Keep original meaning intact

Cleaned text:
"""
)