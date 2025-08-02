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

# Demo analysis prompt for demolition area detection
DEMO_ANALYSIS_PROMPT = PromptTemplate(
    input_variables=["room_context"],
    template="""
{room_context}Analyze this construction/demolition image and identify demolished areas with precise measurements.

TASK: Identify all demolished/removed areas and estimate their dimensions using visible reference objects.

REFERENCE OBJECTS (use for scale):
- Standard doors: 3 feet wide × 7 feet tall (36" × 84")
- Electrical outlets: 4.5" × 2.75"
- Light switches: 4.5" × 2.75" 
- Floor tiles: typically 12" × 12" or 24" × 24"
- Standard windows: vary, but estimate based on visible frames
- Baseboards: typically 3-6 inches tall
- People (if visible): average 5'6" tall

FOR EACH DEMOLISHED AREA, PROVIDE:
1. Surface type: floor, wall, ceiling, cabinet, vanity, countertop, etc.
2. Material: tile, drywall, wood, carpet, etc.
3. Description: clear description of what was removed
4. Boundaries: polygon coordinates as [[x1,y1], [x2,y2], ...]
5. Estimated area in square feet
6. Confidence level (0.0 to 1.0)
7. Reference objects used for measurement

RESPOND IN THIS EXACT JSON FORMAT:
{{
  "demolished_areas": [
    {{
      "surface_type": "floor",
      "material": "tile",
      "description": "Kitchen floor tile removed in main area",
      "boundaries": [[100,200], [400,200], [400,500], [100,500]],
      "estimated_area_sqft": 45.5,
      "confidence": 0.85,
      "reference_objects": ["door", "outlet"]
    }}
  ],
  "reference_objects": [
    {{
      "type": "door",
      "boundaries": [[50,100], [86,184]],
      "estimated_dimensions": {{"width_inches": 36, "height_inches": 84}}
    }}
  ]
}}

IMPORTANT:
- Only identify areas that are clearly demolished/removed
- Be conservative with area estimates
- Use multiple reference objects when possible
- Provide polygon coordinates that outline the demolished area precisely
- If unsure about an area, mark confidence < 0.6
"""
)

# Demo analysis user message template
DEMO_ANALYSIS_USER_MESSAGE = "Analyze these demolition images and identify all demolished areas with precise measurements."

# Material analysis prompt template for OpenAI/Claude vision
MATERIAL_ANALYSIS_VISION_PROMPT = PromptTemplate(
    input_variables=["base_prompt"],
    template="""
{base_prompt}

Please analyze the image and identify building materials. Return a JSON array with the following structure for each material found:
[
    {{
        "material_type": "floor|wall|ceiling|baseboard|trim|other",
        "material_name": "specific material name",
        "confidence_score": 0-10,
        "description": "detailed description of the material",
        "underlayment_needed": true|false,
        "recommended_underlayment": "type of underlayment or null",
        "color": "material color",
        "texture": "material texture description"
    }}
]
"""
)

# Area calculation prompt for AI estimation
AREA_CALCULATION_PROMPT = PromptTemplate(
    input_variables=["surface_type", "description", "existing_dimensions"],
    template="""
You are an expert construction estimator. Calculate the area from the following description.

Surface Type: {surface_type}
Description: {description}

{existing_dimensions}

Instructions:
1. Analyze the text description carefully
2. Extract any measurements, percentages, or area references
3. If the description mentions "partial" areas, calculate based on context
4. If percentages are mentioned (e.g., "30% of wall"), calculate accordingly
5. For descriptions like "2 feet from bottom of wall", calculate the partial area
6. Return ONLY a numeric value (the calculated area in square feet)
7. If linear measurements are involved (like trim), return linear feet
8. If counting items (like doors/windows), return the count

Examples:
- "entire wall" → calculate full wall area
- "30% of ceiling" → calculate 30% of total ceiling area  
- "2 feet from bottom of wall" → calculate area of 2-foot high strip
- "upper cabinets only" → estimate cabinet face area
- "trim around window" → calculate linear feet of trim

IMPORTANT: Return ONLY the numeric value, no text or explanation.
"""
)

# Legacy scope prompt for main.py compatibility
LEGACY_SCOPE_PROMPT = PromptTemplate(
    input_variables=["scope"],
    template="작업 범위: {scope}\n주요 작업 항목을 나열하고 간단히 설명해:"
)

# PDF parsing prompt for extracting room measurements
PDF_MEASUREMENT_EXTRACTION_PROMPT = PromptTemplate(
    input_variables=["pdf_text"],
    template="""
Extract interior room measurements from this insurance estimate PDF text.
Focus only on interior rooms and their measurements.

Return JSON format with locations and rooms containing:
- name: room name
- measurements: with wall_area_sqft, ceiling_area_sqft, floor_area_sqft, height, 
  floor_perimeter_lf, ceiling_perimeter_lf, walls_and_ceiling_area_sqft, 
  flooring_area_sy, and openings (doors/windows with sizes)

PDF Text:
{pdf_text}
"""
)

# Room classification prompt for AI-based room detection
ROOM_CLASSIFICATION_PROMPT = PromptTemplate(
    input_variables=["candidates_text"],
    template="""
Analyze these potential room names from a building floor plan and determine which are actual rooms:

{candidates_text}

For each item, consider:
- Is it a real living/functional space?
- Is the area reasonable for a room?
- Could it be an abbreviation or typo? (e.g., "Bthrm" → "Bathroom", "BR" → "Bedroom")
- Is it summary/aggregate data like "Total Area", "Plan Attributes"?

Respond with only a JSON array of true/false values in order:
Example: [true, false, true, false, true]
"""
)

# Single room classification prompt for individual room analysis
SINGLE_ROOM_CLASSIFICATION_PROMPT = PromptTemplate(
    input_variables=["room_name", "area_info"],
    template="""
Is "{room_name}"{area_info} a actual room in a building?

Consider:
- Is it a real living/functional space?
- Is the area reasonable for a room?
- Could it be an abbreviation or typo? (e.g., "Bthrm" → "Bathroom")
- Is it summary/aggregate data like "Total Area", "Plan Attributes"?

Respond with only "YES" or "NO".
"""
)