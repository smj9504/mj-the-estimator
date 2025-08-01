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

# Material analysis prompt for image analysis
MATERIAL_ANALYSIS_PROMPT = PromptTemplate(
    input_variables=["room_context", "focus_text"],
    template="""
{room_context}Analyze this image of a room/building interior to identify building materials. 
{focus_text}

For each material you can identify, determine:
1. Material type (floor, wall, ceiling, baseboard, quarter_round, trim, countertop, cabinet)
2. Specific material name (e.g., "Laminate Wood", "Ceramic Tile", "Painted Drywall")
3. Confidence level (1-10, where 10 is completely certain)
4. Detailed description
5. Whether underlayment is needed (for flooring materials)
6. Recommended underlayment if needed
7. Color/finish description
8. Texture description

Common material types to look for:
- Floor: laminate, hardwood, tile, carpet, vinyl, luxury vinyl plank, engineered hardwood
- Wall: drywall, brick, wood paneling, wallpaper, paint, stone, tile
- Ceiling: drywall, acoustic tile, wood, exposed beam, drop ceiling
- Trim: wood, MDF, PVC, painted wood, stained wood

Be conservative with confidence scores - only use 8-10 for materials you're very certain about.

Respond with a JSON array of objects, each with these fields:
{{
    "material_type": "floor|wall|ceiling|baseboard|quarter_round|trim|countertop|cabinet",
    "material_name": "specific material name",
    "confidence_score": 1-10,
    "description": "detailed description",
    "underlayment_needed": true/false,
    "recommended_underlayment": "underlayment type or null",
    "color": "color description",
    "texture": "texture description"
}}
"""
)