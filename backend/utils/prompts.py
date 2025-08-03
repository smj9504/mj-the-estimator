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

# Principle-based demo analysis prompt for intelligent demolition detection
DEMO_ANALYSIS_PROMPT = PromptTemplate(
    input_variables=["room_context"],
    template="""
{room_context}Analyze these renovation/construction images to identify demolished areas using intelligent, adaptive principles that encourage creative and comprehensive thinking.

## CORE ANALYSIS PHILOSOPHY

**PRINCIPLE-BASED DETECTION**: Detect demolition through universal patterns rather than specific item lists. Focus on "what was there vs what's there now" and evidence of removal.

**ADAPTIVE INTELLIGENCE**: Let room type and renovation context guide expectations. Different spaces have different standard components that may be removed.

**EVIDENCE-BASED REASONING**: Look for proof of removal rather than assuming specific items were present.

**CREATIVE EXPLORATION**: Think beyond obvious patterns. Consider subtle indicators, logical connections, and unexpected evidence that reveals demolition activity.

## SYSTEMATIC VISUAL SCANNING METHODOLOGY

### **Multi-Layer Visual Analysis Process**
1. **ARCHITECTURAL FOUNDATION SCAN**: Start with structural elements (walls, floors, ceilings) to establish baseline
2. **FUNCTIONAL ELEMENT SURVEY**: Identify missing or altered functional components for the room type
3. **SURFACE CONDITION ANALYSIS**: Examine all visible surfaces for transition evidence, mounting points, or preparation states
4. **UTILITY INFRASTRUCTURE REVIEW**: Track plumbing, electrical, and mechanical system evidence
5. **DETAIL EVIDENCE COLLECTION**: Look for subtle clues like fastener holes, adhesive residue, paint lines, or material fragments
6. **SPATIAL RELATIONSHIP MAPPING**: Understand how different elements connect and what their removal might indicate

### **Enhanced Pattern Recognition Framework**
- **Logical Inference Chains**: If you see X, then Y is likely, which means Z probably occurred
- **System Interdependencies**: Removal of one element often necessitates removal of connected elements
- **Industry Standard Practices**: Apply knowledge of typical renovation sequences and requirements
- **Material Transition Logic**: Different materials require different removal approaches, leaving different evidence patterns

## UNIVERSAL DEMOLITION DETECTION PRINCIPLES

### 1. **FUNCTIONAL ANALYSIS PRINCIPLE**
**Core Concept**: Every room type has expected functional elements. Missing functionality indicates removal.

**Enhanced Detection Strategy**:
- **Room Function Baseline**: Establish what a fully functional room of this type requires
- **Missing Function Identification**: Identify what functional capabilities are absent or compromised
- **Utility Evidence Analysis**: Trace utility connections to understand what was served
- **Access Pattern Recognition**: Consider what removal would be needed for observed access work
- **Sequential Logic Application**: Think about what removal steps would logically precede current state

**Adaptive Reasoning Process**:
- **Question-Based Analysis**: Ask "What should be here?" → "What evidence suggests it was here?" → "What evidence suggests it was removed?"
- **Contextual Expectation**: Let room size, layout, and style guide expectations rather than rigid checklists
- **Evidence Triangulation**: Use multiple types of evidence to confirm removal conclusions
- **Logical Deduction Chains**: Build connected reasoning rather than isolated observations

**ENHANCED BATHROOM FIXTURE DETECTION**:
- **Toilet Evidence Exploration**: Floor patterns, utility connections, mounting evidence, drainage indicators - think beyond obvious visual absence
- **Shower/Bath System Analysis**: Consider the entire wet area as a system - tiles, waterproofing, fixtures, enclosures, ventilation all interconnect
- **Light Fixture Investigation**: Look for electrical evidence, mounting patterns, switch relationships, and aesthetic interruptions
- **Vanity System Evaluation**: Counter connections, plumbing service, electrical features, and storage integration patterns
- **Fixture Interdependency Logic**: Understanding how fixture removal affects surrounding materials and systems

### 2. **STRUCTURAL TRANSITION PRINCIPLE**
**Core Concept**: Renovations create transitions between old and new materials/structures.

**Enhanced Substrate Analysis**:
- **Layer Revelation Logic**: When you see deeper structural layers, trace backward to understand what was removed to expose them
- **Material Archaeology**: Each visible layer tells a story of what was removed and in what sequence
- **Preparation Evidence Recognition**: Surface conditions that indicate removal and preparation for new installation
- **Construction Logic Application**: Use knowledge of how things are built to understand how they were taken apart

**Advanced Pattern Recognition**:
- **Transition Edge Intelligence**: Clean cuts vs. torn edges reveal different removal methods and thoroughness
- **Selective Removal Patterns**: Understand why some areas were removed while adjacent areas remained
- **Access-Driven Logic**: Consider what needed to be removed to accomplish visible work
- **System Integration Thinking**: How does removal in one area affect connected systems and materials

**INSULATION DETECTION LOGIC**:
- **Structural Exposure Inference**: When interior structural elements are visible, systematically consider what envelope components were removed
- **Cavity Analysis**: Look at wall and ceiling cavities to determine what thermal barriers were disturbed
- **Thermal System Logic**: Understanding how insulation integrates with vapor barriers, air sealing, and finish materials
- **Climate Control Evidence**: Consider HVAC system modifications that might indicate insulation work

**PARTIAL DEMOLITION PATTERN INTELLIGENCE**:
- **Strategic Removal Logic**: Understand why certain areas were selectively demolished based on renovation goals
- **Boundary Analysis**: Study transition zones to understand demolition decision-making and execution methods
- **Phased Work Evidence**: Recognize signs of work completed in phases or stages
- **Protection vs. Removal**: Distinguish between protected areas and areas planned for future demolition

### 3. **RENOVATION CONTEXT PRINCIPLE**
**Core Concept**: Scope of visible work suggests scope of removal. Think like a contractor planning the work sequence.

**Enhanced Contextual Intelligence**:
- **Work Sequence Logic**: Understand what must be removed first to accomplish what you see being done
- **Access Requirement Analysis**: Consider all the removal needed to achieve the level of access observed
- **Quality Standard Inference**: Deduce removal scope from the quality level of renovation work visible
- **Efficiency Pattern Recognition**: Contractors remove materials in logical groupings - apply this thinking

**Adaptive Project Scope Analysis**:
- **Scale Proportionality**: Small visible changes might indicate larger hidden scope
- **System Modernization Logic**: If one system is being updated, connected systems likely affected
- **Code Compliance Requirements**: Current building codes might drive more extensive removal than initially apparent
- **Integration Challenges**: New work often requires more removal than expected to properly integrate

**Creative Renovation Logic Application**:
- **Budget-Driven Decisions**: Consider economic factors that influence removal scope decisions
- **Timing and Phasing**: Some removal might be planned for later phases or different trades
- **Protection vs. Demolition**: Distinguish between temporarily protected elements and permanent preservation
- **Future Work Preparation**: Current removal might be preparing for work not yet visible

**WET AREA RENOVATION INTELLIGENCE**:
- **Waterproofing System Logic**: Modern wet area renovation often requires complete system replacement
- **Fixture Integration Requirements**: New fixtures often demand changes to surrounding systems and finishes
- **Ventilation and Moisture Management**: Updates to one element often cascade through the entire moisture management system

### 4. **EVIDENCE PRESERVATION PRINCIPLE**
**Core Concept**: Removal leaves traces that can be detected and measured. Be a detective - look for clues others might miss.

**Enhanced Evidence Detection Strategy**:
- **Micro-Evidence Awareness**: Train your eye to notice small details that reveal larger removal patterns
- **Shadow and Outline Analysis**: Look for subtle color, texture, or wear pattern differences that indicate former presence
- **Hardware Archaeology**: Every fixture and fitting leaves connection evidence when removed
- **Surface Disturbance Patterns**: Removal activities create characteristic surface disturbances

**Advanced Evidence Categories**:
- **Physical Trace Evidence**: Material residue, mounting points, wear patterns, adhesive remains
- **Geometric Evidence**: Spacing patterns, alignment marks, dimensional relationships that indicate missing elements
- **System Connection Evidence**: Utility terminations, capped connections, orphaned switches or controls
- **Environmental Evidence**: Lighting patterns, ventilation impacts, acoustical changes suggesting removal
- **Temporal Evidence**: Fresh patches, clean areas, or new materials adjacent to older surfaces

**Creative Evidence Recognition**:
- **Negative Space Analysis**: What should be occupying empty spaces based on room function and layout
- **Pattern Interruption Detection**: Look for breaks in expected patterns (tile layouts, trim continuity, lighting schemes)
- **Proportional Relationships**: Use room proportions and standard sizing to identify missing elements
- **Aesthetic Logic**: Missing elements often create visual imbalances or functional gaps

**ENHANCED FIXTURE EVIDENCE INTELLIGENCE**:
- **Toilet System Evidence**: Beyond obvious floor impacts, consider ventilation, privacy, and accessibility evidence
- **Light Fixture Comprehensive Traces**: Electrical circuits, switch relationships, room illumination patterns, interior design integration
- **Shower System Evidence**: Drainage, waterproofing, ventilation, fixture support, and accessibility modifications
- **Storage and Cabinet Evidence**: Wall attachment points, interior electrical, ventilation considerations, and space utilization patterns

## INTELLIGENT AREA CALCULATION

### **Reference-Based Scaling**
Use consistent architectural elements for measurement:
- Standard doors: 3' × 7' (universal reference)
- Electrical outlets: 4.5" × 2.75" (common scaling reference) 
- Window frames: Use proportions for area estimation
- Room proportions: Apply standard room dimension ratios

### **Contextual Area Estimation**
- **Floor Areas**: Calculate based on room geometry and visible boundaries
- **Wall Areas**: Use room height × affected wall length
- **Surface Areas**: Apply removal evidence to calculate affected surface area
- **Fixture Areas**: Use standard dimensions for typical fixtures when exact measurement unavailable

### **Adaptive Scaling**
- Cross-validate measurements using multiple reference objects
- Account for camera angle distortion
- Provide range estimates when precision is limited
- Scale estimates to match detected room size category

## ROOM-ADAPTIVE ANALYSIS

### **Dynamic Room Classification**
Automatically determine room type from visual cues:
- **Architectural Features**: Windows, doors, ceiling height, built-ins
- **Utility Locations**: Plumbing fixtures, electrical outlets, ventilation
- **Space Proportions**: Typical dimensional ratios for different room types
- **Functional Elements**: Purpose-specific installations

### **Context-Driven Expectations**
Adjust detection sensitivity based on room type:
- **Wet Rooms** (bathrooms, kitchens): Higher expectation for fixture removal
- **Living Spaces**: Focus on surface finishes and architectural elements
- **Utility Spaces**: Emphasis on infrastructure and storage elements
- **Multi-Purpose**: Flexible analysis based on mixed indicators

## INTELLIGENT CATEGORIZATION SYSTEM

### **Surface Categories** (instead of specific materials)
- **Floor Coverings**: Any finish material over subfloor
- **Wall Finishes**: Surface treatments over structural wall
- **Ceiling Treatments**: Finish materials below structural ceiling
- **Fixed Furnishings**: Built-in or permanently attached functional elements

### **ENHANCED BATHROOM FIXTURE CATEGORIES**
- **Toilet**: Include associated flooring impact area (2.5 sq ft typical)
- **Shower Booth**: Wall tiles, glass doors, fixtures, insulation behind tile walls
- **Light Fixtures**: Wall-mounted vanity lights, ceiling fixtures, electrical boxes
- **Insulation**: Behind tile walls when brick/structure exposed, around plumbing penetrations

### **Removal Evidence Patterns**
- **Complete Removal**: No trace of original material/fixture
- **Partial Removal**: Section removed with clean boundaries
- **Preparation Removal**: Material removed for access or new installation
- **Protective Removal**: Temporary removal to protect during construction

### **WET AREA SPECIFIC PATTERNS**
- **Selective Tile Removal**: Shower area tiles removed, other wall tiles intact
- **Plumbing-Access Removal**: Material removed around valve locations
- **Waterproofing Prep**: Complete removal of materials in wet areas for new waterproofing
- **Fixture-Driven Removal**: Material removal following fixture replacement patterns

### **Functional Impact Assessment**
- **Essential Functions**: Core room functionality affected
- **Aesthetic Elements**: Decorative or finish components
- **Infrastructure**: Utilities, structural, or system components
- **Accessibility**: Elements affecting room access or use

### **INSULATION DETECTION MATRIX**
- **Exposed Interior Masonry**: High probability of removed insulation (confidence: 0.8-0.9)
- **Exposed Studs with Cavity**: Moderate probability of insulation removal (confidence: 0.6-0.8)
- **Behind Wet Area Tiles**: When tile removed from exterior wall, assume insulation impact (confidence: 0.7-0.9)
- **Around Utility Work**: Insulation disturbed/removed for plumbing/electrical access (confidence: 0.5-0.7)

## ANALYSIS METHODOLOGY

### **Multi-Angle Spatial Correlation**
1. **Room Mapping**: Identify consistent architectural features across images
2. **Viewpoint Triangulation**: Use multiple angles to confirm findings
3. **Coverage Assessment**: Determine analysis completeness
4. **Evidence Cross-Validation**: Verify findings across different perspectives

### **Progressive Evidence Building**
1. **Obvious Evidence**: Clear, indisputable removal signs
2. **Contextual Evidence**: Missing expected elements for room type
3. **Indirect Evidence**: Mounting points, utility stubs, preparation work
4. **Inferential Evidence**: Logical deductions from renovation scope

### **Confidence Calibration**
- **High Confidence (0.9+)**: Direct visual evidence of removal
- **Good Confidence (0.7-0.9)**: Strong contextual/indirect evidence
- **Moderate Confidence (0.5-0.7)**: Reasonable inference from patterns
- **Low Confidence (<0.5)**: Speculative based on limited evidence

## RESPONSE FORMAT

Respond in this exact JSON structure:

{{
  "room_analysis": {{
    "detected_room_type": "bathroom|kitchen|bedroom|living_room|other",
    "functional_assessment": "description of room's intended function and current state",
    "room_dimensions": {{"length_ft": 0, "width_ft": 0, "height_ft": 0}},
    "confidence_in_room_type": 0.0
  }},
  "demolished_areas": [
    {{
      "surface_type": "floor|wall|ceiling|cabinet|vanity|countertop|fixture|backsplash|mirror|toilet|bathtub|shower|appliance|light_fixture|insulation|shower_tiles|vanity_light",
      "material_removed": "tile|drywall|wood|carpet|laminate|granite|ceramic|cabinet|toilet_fixture|light_fixture|insulation|shower_door|etc",
      "description": "detailed description of evidence supporting removal conclusion and extent",
      "estimated_area_sqft": 0.0,
      "demolition_completeness": "total|partial",
      "completion_percentage": 100,
      "confidence": 0.85,
      "detection_basis": "direct_visual|missing_expected|utility_evidence|preparation_signs|contextual_inference|exposed_substrate|fixture_absence|insulation_evidence",
      "calculation_method": "reference_scaling|proportional_estimate|standard_assumption|room_geometry|fixture_standard_size",
      "reference_objects_used": ["objects used for scaling"],
      "spatial_description": "location and extent description"
    }}
  ],
  "analysis_summary": {{
    "total_demolished_area_sqft": 0.0,
    "renovation_scope_assessment": "comprehensive|moderate|limited|surface_only",
    "primary_detection_methods": ["methods used"],
    "room_functionality_impact": "major|moderate|minor|none",
    "evidence_quality": "excellent|good|fair|limited",
    "analysis_completeness": 0.0
  }}
}}

## SPECIFIC DETECTION EXAMPLES

### **TOILET DETECTION PATTERNS**
- **Positive Evidence**: Floor outline/indentation, bolt holes in floor, water supply valve present, drain opening visible
- **Negative Evidence**: Absent fixture with plumbing evidence present
- **Area Impact**: Standard toilet: 2.5 sq ft floor impact, plus surrounding flooring if removed
- **Confidence**: High (0.8-0.9) with multiple evidence types, Moderate (0.6-0.8) with single evidence type

### **SHOWER BOOTH WALL TILE DETECTION**
- **Wet Area Focus**: Look specifically in shower enclosure area vs rest of bathroom
- **Transition Evidence**: Clean lines where wet area tiles removed, dry area tiles remain
- **Insulation Inference**: If exterior wall tile removed, assume insulation behind also removed
- **Area Calculation**: Shower surround typically 32-50 sq ft depending on size

### **LIGHT FIXTURE DETECTION**
- **Wall-Mounted Evidence**: Electrical box exposure, mounting bracket holes, wire caps visible
- **Patching Evidence**: Fresh drywall patches around former fixture locations
- **Paint Lines**: Color/texture differences where fixtures were mounted
- **Standard Locations**: Vanity area lighting, overhead ceiling fixtures

### **INSULATION DETECTION TRIGGERS**
- **Exposed Brick Interior**: High probability (0.8-0.9) insulation removed from interior side
- **Behind Removed Tile**: When exterior wall tiles removed, include insulation area
- **Exposed Stud Cavities**: Moderate probability (0.6-0.8) insulation removed with drywall
- **Area Calculation**: Match wall area where substrate exposed

## KEY DIRECTIVES FOR ENHANCED ANALYTICAL THINKING

1. **CREATIVE EXPLORATION OVER RIGID CHECKING**: Use your intelligence to think beyond obvious patterns. Consider "what if" scenarios and explore multiple possibilities before concluding
2. **EVIDENCE-DRIVEN DISCOVERY**: Build conclusions from evidence, but let creativity guide what evidence you look for and how you interpret it
3. **SYSTEMATIC CURIOSITY**: Approach each image with genuine curiosity. Ask probing questions and pursue interesting patterns you notice
4. **ADAPTIVE INTELLIGENCE APPLICATION**: Let room context guide your thinking, but don't limit yourself to standard expectations. Be open to unexpected findings
5. **FLEXIBLE PATTERN RECOGNITION**: Look for patterns in removal, installation, protection, and preparation. Consider both obvious and subtle indicators
6. **LOGICAL INFERENCE CHAINS**: Build connected reasoning from multiple observations. If you see A and B, creatively consider what C, D, and E might be
7. **CONTEXTUAL SCALING INTELLIGENCE**: Use room type and renovation scope to calibrate expectations, but remain open to variations and surprises
8. **COMPREHENSIVE SYSTEMS THINKING**: When you identify one element of removal, explore what other connected elements might be affected
9. **TRANSPARENT ANALYTICAL REASONING**: Document not just what you found, but how you found it and what made you look there
10. **COMPLETE JSON ACCURACY**: Always include ALL required fields in the JSON response - never omit any fields
11. **ENHANCED FIXTURE DETECTION**: Think holistically about fixtures as systems with connections, impacts, and relationships to surrounding elements
12. **INSULATION AND SUBSTRATE AWARENESS**: When structural elements are exposed, systematically consider what envelope and insulation impacts occurred

## CRITICAL JSON REQUIREMENTS

- **MANDATORY FIELDS**: Every demolished area MUST include: surface_type, material_removed, description, estimated_area_sqft, demolition_completeness, completion_percentage, confidence
- **NO MISSING FIELDS**: The JSON parser expects all fields to be present. Missing fields will cause parsing errors.
- **PROPER VALUES**: Use appropriate values for each field type (strings for text, numbers for areas/percentages, 0.0-1.0 for confidence)
- **CONSISTENT FORMAT**: Follow the exact JSON structure shown above with proper field names and data types

This enhanced approach encourages comprehensive, intelligent detection of any type of demolition in any room type through adaptive reasoning, creative exploration, and systematic evidence analysis - rather than limiting analysis to predefined checklists or rigid detection rules.
"""
)

# Principle-based demo analysis user message template
DEMO_ANALYSIS_USER_MESSAGE = "Analyze these renovation images using intelligent detection principles. Focus on evidence of removal rather than predefined checklists. Look for: (1) Direct evidence of demolition (exposed substrates, debris, work in progress), (2) Missing functional elements expected for this room type, (3) Indirect evidence (mounting holes, utility stubs, clean material boundaries), (4) Context clues suggesting removal scope. Use adaptive reasoning based on room type and renovation context. Provide evidence-based area calculations with appropriate confidence scores. CRITICAL: Return complete JSON with ALL required fields - surface_type, material_removed, description, estimated_area_sqft, demolition_completeness, completion_percentage, confidence."

# Multi-stage demolition analysis prompts for enhanced detection accuracy

# Stage 1: Photo Classification to determine before/after demo state
PHOTO_CLASSIFICATION_PROMPT = PromptTemplate(
    input_variables=["image_context", "total_photos"],
    template="""
{image_context}Classify these {total_photos} photos as BEFORE or AFTER demolition by looking for clear visual indicators.

## SIMPLE CLASSIFICATION RULES

**BEFORE DEMOLITION (Intact/Finished Spaces):**
- ✅ Fixtures installed and complete (toilet, sink, cabinets, etc.)
- ✅ Finished surfaces (painted walls, installed tile, flooring)
- ✅ Clean, usable appearance
- ✅ Room looks ready for normal use
- ✅ All expected elements present for room type

**AFTER DEMOLITION (Demolished/Exposed Spaces):**
- ❌ Missing fixtures (no toilet, removed cabinets, etc.)
- ❌ Exposed structural elements (studs, subfloor, bare walls)
- ❌ Construction debris or dust
- ❌ Rough, unfinished surfaces
- ❌ Room unusable in current state
- ❌ Visible demolition work (holes, removed materials)

## QUICK VISUAL CHECKS

For BATHROOMS:
- BEFORE: Toilet, sink, mirror installed; tiles complete; clean appearance
- AFTER: Missing toilet/sink; exposed pipes; removed tiles; bare walls/floors

For KITCHENS:
- BEFORE: Cabinets, countertops installed; appliances in place; clean surfaces
- AFTER: No cabinets; exposed walls; removed countertops; visible rough-ins

For LIVING SPACES:
- BEFORE: Finished floors; painted walls; trim installed; clean appearance
- AFTER: Exposed subfloor; bare/damaged walls; removed trim; construction mess

## RESPONSE FORMAT

Return exactly this JSON structure:

{{
  "photo_classifications": [
    {{
      "photo_id": "photo_1",
      "classification": "before_demo|after_demo|unclear",
      "confidence": 0.85,
      "key_indicators": ["toilet_installed", "clean_tiles", "finished_walls"],
      "brief_reasoning": "Toilet and sink present, tiles intact, clean appearance"
    }}
  ],
  "summary": {{
    "before_photos": 0,
    "after_photos": 0,
    "unclear_photos": 0,
    "overall_confidence": 0.85
  }}
}}

## CLASSIFICATION APPROACH

1. Look at each photo quickly - is the space FINISHED or TORN UP?
2. Check for key room elements - are main fixtures/finishes present or missing?
3. Assess cleanliness - does it look livable or like a construction zone?
4. When in doubt, focus on whether someone could use the room normally today

Keep it simple - you're just sorting photos into "finished space" vs "construction zone".
"""
)

# Stage 2: Before-Demo Inventory - Comprehensive element documentation
BEFORE_DEMO_INVENTORY_PROMPT = PromptTemplate(
    input_variables=["room_context"],
    template="""
{room_context}Conduct a comprehensive inventory of all existing elements in these before-demolition photos to establish a complete baseline.

## SYSTEMATIC INVENTORY METHODOLOGY

### **ROOM-ADAPTIVE INVENTORY CATEGORIES**

**Bathroom Elements:**
- **Fixtures**: Toilet, bathtub, shower, sink, vanity, mirror, medicine cabinet
- **Finishes**: Floor tiles, wall tiles, ceiling material, paint, grout, caulk
- **Systems**: Plumbing fixtures, electrical outlets, lighting, ventilation fan, heating
- **Accessories**: Towel bars, toilet paper holder, soap dispensers, shower hardware
- **Structural**: Windows, doors, trim, baseboards, thresholds

**Kitchen Elements:**
- **Cabinetry**: Upper cabinets, lower cabinets, pantry, islands, built-ins
- **Countertops**: Material type, backsplash, edge treatments, cutouts
- **Appliances**: Range, refrigerator, dishwasher, microwave, disposer, hood
- **Systems**: Plumbing, electrical, gas lines, lighting, ventilation
- **Finishes**: Flooring, wall finishes, ceiling, paint, trim

**Living Space Elements:**
- **Architectural**: Walls, ceilings, floors, windows, doors, trim, moldings
- **Built-ins**: Shelving, closets, fireplace, entertainment centers
- **Systems**: Electrical outlets, switches, lighting, HVAC, security
- **Finishes**: Paint, wallpaper, flooring materials, ceiling treatments

### **DETAILED MATERIAL IDENTIFICATION PRINCIPLES**

**Visual Material Analysis:**
- **Surface Characteristics**: Texture, pattern, color, finish type
- **Installation Evidence**: Seams, fasteners, trim details, transitions
- **Age/Condition Indicators**: Wear patterns, damage, maintenance history
- **Quality Assessment**: Material grade, craftsmanship level

**Measurement and Scaling Methodology:**
- **Reference Objects**: Use doors (3'×7'), outlets (4.5"×2.75"), standard fixtures
- **Proportional Analysis**: Room dimensions, fixture relationships, spatial context
- **Area Calculations**: Floor, wall, ceiling areas with appropriate detail
- **Linear Measurements**: Trim, edges, perimeters, runs

## RESPONSE FORMAT

Respond in this exact JSON structure:

{
  "room_inventory": {
    "room_type": "bathroom|kitchen|bedroom|living_room|other",
    "overall_condition": "excellent|good|fair|poor",
    "estimated_age": "new|recent|mature|old|vintage",
    "renovation_history": "original|updated|partially_renovated|recently_renovated"
  },
  "structural_elements": [
    {
      "element_type": "wall|ceiling|floor|window|door",
      "material": "drywall|tile|wood|concrete|etc",
      "condition": "excellent|good|fair|poor",
      "area_sqft": 45.5,
      "location": "north wall|center ceiling|entire floor",
      "connection_points": ["adjacent_walls", "structural_supports"],
      "removal_complexity": "simple|moderate|complex|structural_concern"
    }
  ],
  "fixtures_and_equipment": [
    {
      "fixture_type": "toilet|sink|bathtub|cabinet|appliance|lighting",
      "brand_model": "identified brand/model if visible",
      "material": "porcelain|stainless|wood|plastic|metal",
      "condition": "excellent|good|fair|poor|needs_replacement",
      "dimensions": {"width": 24, "depth": 18, "height": 32},
      "mounting_method": "floor_mounted|wall_mounted|cabinet_mounted|ceiling_mounted",
      "utility_connections": ["water_supply", "drain", "electrical", "gas"],
      "removal_accessibility": "easy|moderate|difficult|requires_specialty_tools"
    }
  ],
  "finish_materials": [
    {
      "surface_type": "floor|wall|ceiling|countertop|backsplash",
      "material_type": "tile|hardwood|carpet|paint|wallpaper|laminate",
      "material_details": "12x12 ceramic tile, subway tile pattern, etc",
      "area_sqft": 85.0,
      "condition": "excellent|good|fair|poor",
      "installation_quality": "professional|adequate|poor|diy",
      "removal_difficulty": "easy|moderate|difficult|requires_abatement"
    }
  ],
  "system_elements": [
    {
      "system_type": "plumbing|electrical|hvac|gas",
      "component_type": "outlet|switch|valve|vent|fixture",
      "location": "specific location description",
      "condition": "functional|needs_service|non_functional|obsolete",
      "code_compliance": "current|needs_update|non_compliant|unknown",
      "modification_required": "none|minor|major|complete_replacement"
    }
  ],
  "measurement_data": {
    "room_dimensions": {"length_ft": 12, "width_ft": 10, "height_ft": 9},
    "total_floor_area": 120.0,
    "total_wall_area": 350.0,
    "total_ceiling_area": 120.0,
    "perimeter_linear_ft": 44.0,
    "measurement_confidence": 0.85,
    "reference_objects_used": ["standard_door", "electrical_outlet", "toilet"]
  },
  "baseline_summary": {
    "total_elements_counted": 25,
    "estimated_total_value": "rough_estimate_range",
    "removal_complexity_overall": "simple|moderate|complex|requires_specialists",
    "special_considerations": ["asbestos_era", "load_bearing_concerns", "utility_complexity"],
    "inventory_completeness": 0.9
  }
}

## KEY INVENTORY PRINCIPLES

1. **COMPREHENSIVE DOCUMENTATION**: Catalog every visible element systematically
2. **BASELINE ESTABLISHMENT**: Create complete reference for comparison analysis
3. **REMOVAL PLANNING**: Assess removal complexity and requirements for each element
4. **SYSTEM INTEGRATION**: Understand how elements connect and depend on each other
5. **QUALITY ASSESSMENT**: Evaluate condition and replacement necessity
6. **MEASUREMENT ACCURACY**: Provide reliable dimensions for estimation purposes
"""
)

# Stage 3: After-Demo Analysis - Forensic detection of removed elements
AFTER_DEMO_ANALYSIS_PROMPT = PromptTemplate(
    input_variables=["room_context"],
    template="""
You are a construction expert analyzing renovation photos. Your goal is to identify removed elements and estimate their areas using intelligent, adaptive analysis. {room_context}

## CORE ANALYSIS PHILOSOPHY

**EVIDENCE-DRIVEN INTELLIGENCE**: Base conclusions on observable evidence while remaining open to unexpected patterns and non-standard scenarios.

**ADAPTIVE REASONING**: Let room characteristics, renovation context, and visual evidence guide your analysis rather than rigid assumptions.

**CONTEXTUAL SIZING**: Use proportional relationships, visible evidence, and professional judgment to estimate areas rather than fixed dimensions.

## ANALYTICAL METHODOLOGY

### **Evidence Evaluation Framework**
1. **Direct Visual Evidence**: Clear signs of removal, exposed substrates, mounting evidence
2. **Room Dimensions Utilization**: USE PROVIDED ROOM DIMENSIONS for major surfaces
   - Wall area: Use provided wall_area_sqft when drywall removed
   - Ceiling area: Use provided ceiling_area_sqft when ceiling removed
   - Floor area: Use provided floor_area_sqft when flooring removed
3. **Contextual Logic**: Missing elements expected for room type and function
4. **Professional Inference**: Industry knowledge applied to ambiguous situations

### **Flexible Area Estimation Approaches**
- **Proportional Scaling**: Use room elements and proportions for realistic sizing
- **Evidence-Based Boundaries**: Calculate based on visible removal boundaries
- **Contextual Standards**: Apply typical ranges while adapting to specific conditions
- **Multi-Method Validation**: Cross-check estimates using different approaches

### **Sizing Guidelines (Adaptive Ranges)**
These are starting points - adjust based on actual evidence:
- **Toilets**: 2-4 sqft (scale to visible proportions)
- **Vanities**: 6-20 sqft (consider actual cabinet size indicators)
- **Bathtubs**: 12-25 sqft (standard to soaking tubs)
- **Shower stalls**: 9-25 sqft (corner units to walk-ins)
- **Floor/Wall tiles**: Based on actual removal boundaries
- **Drywall**: Calculate affected wall/ceiling areas from exposed framing
- **Light fixtures**: 1-4 sqft (sconces to chandeliers)

## DETECTION PRINCIPLES

### **Key Removal Indicators - BE PRECISE**
- **Exposed Structure**: Wood studs, joists, or framing indicate surface removal
  - VISIBLE WOOD STUDS = WALL DRYWALL REMOVED (use full wall area)
  - VISIBLE CEILING JOISTS = CEILING DRYWALL REMOVED (use full ceiling area)
  - EXPOSED BRICK/BLOCK = INTERIOR FINISH + INSULATION REMOVED
- **Utility Evidence**: Capped pipes, electrical boxes, HVAC openings
- **Surface Transitions**: Clean edges where materials were removed
- **Mounting Evidence**: Brackets, holes, adhesive patterns
- **Floor Assessment - BE VERY CAREFUL**:
  - ONLY mark flooring as removed if you see: bare concrete, plywood subfloor, or floor joists
  - If you see ANY finished flooring (tile, wood, vinyl, carpet) = NOT removed
  - Dirty or damaged flooring ≠ removed flooring

### **Room-Adaptive Analysis**
**For Bathrooms**: Consider typical fixtures but adapt to actual room layout
- Plumbing locations suggest fixture positions and sizes
- Wall damage patterns indicate tile or surround removal
- Floor patterns reveal fixture footprints

**For Kitchens**: Scale to actual space and configuration
- Cabinet mounting evidence and wall damage patterns
- Countertop support structures and backsplash boundaries
- Appliance connections and spacing

**For Living Spaces**: Focus on surfaces and built-ins
- Wall and ceiling surface removal patterns
- Built-in furniture or shelving evidence
- Flooring transition lines

### **Critical Visual Patterns to Detect**
**MUST CHECK for these major demolition indicators**:
1. **Exposed Wood Framing** = Major surface removal
   - Vertical wood studs visible = Wall covering removed
   - Horizontal ceiling joists visible = Ceiling covering removed
   - Calculate using provided room dimensions

2. **Floor Assessment - VERIFY CAREFULLY**
   - **REMOVED**: Bare concrete slab, exposed plywood, visible floor joists
   - **NOT REMOVED**: Any tile (even if dirty), wood flooring, vinyl, carpet
   - **Common mistake**: Don't confuse dirty/old flooring with removed flooring
   - Example: Bathroom tiles covered in dust/debris = NOT removed

3. **Insulation Removal Evidence**
   - Empty stud cavities = Insulation removed
   - Exposed masonry/brick = Insulation + finish removed

### **Creative Problem-Solving**
When standard patterns don't apply:
- Consider custom installations or vintage fixtures
- Look for partial renovations or phased work
- Account for non-standard room configurations
- Evaluate unusual material combinations
- **Appliance Detection**: Utility connections, ventilation, mounting evidence, code requirements
- **Countertop Detection**: Support evidence, plumbing cutouts, backsplash attachment lines

**Insulation Detection Triggers:**
- **Exposed Interior Masonry**: Likely indicates insulation removal (confidence 0.8-0.9)
- **Exposed Studs/Framing**: May indicate insulation removal (confidence 0.6-0.8)  
- **HVAC System Exposure**: Often requires insulation removal for access (confidence 0.7-0.8)
- **Utility Rough-in Work**: May require insulation removal/replacement (confidence 0.5-0.7)

**Insulation Detection Matrix:**
- **Wall Insulation**: Cavity depth, vapor barrier evidence, installation age
- **Ceiling Insulation**: Attic access, blown-in vs. batt evidence, R-value estimation
- **Floor Insulation**: Crawl space access, rim joist treatment, moisture concerns

## RESPONSE FORMAT

Respond in this exact JSON structure:

{
  "forensic_analysis": {
    "demolition_type": "selective|comprehensive|emergency|partial",
    "demolition_quality": "professional|adequate|rough|damage_based",
    "work_sequence": "systematic|random|emergency|in_progress",
    "safety_evidence": "proper|adequate|minimal|concerning"
  },
  "detected_removed_elements": [
    {
      "element_type": "toilet|sink|cabinet|tile|insulation|lighting|etc",
      "original_material": "inferred material type",
      "removal_evidence": ["floor_flange", "supply_valve", "mounting_holes"],
      "confidence_level": 0.85,
      "detection_method": "utility_evidence|mounting_evidence|boundary_evidence|pattern_inference",
      "original_dimensions": {"width": 24, "depth": 18, "height": 32},
      "original_location": "specific location description",
      "area_affected": 15.5,  // REQUIRED: MUST be > 0, use standard sizes from above
      "evidence_description": "Clear description of what evidence was found", // REQUIRED: NEVER leave empty
      "removal_completeness": "complete|partial|damaged_during_removal",
      "replacement_indication": "definitely_planned|likely_planned|unclear|may_not_replace"
    }
  ],
  "utility_system_evidence": [
    {
      "system_type": "plumbing|electrical|hvac|gas",
      "evidence_type": "capped_line|rough_in|shut_off|electrical_box",
      "location": "specific location",
      "original_connection": "toilet|sink|outlet|fixture|appliance",
      "current_status": "capped|exposed|prepared_for_new|abandoned",
      "code_compliance": "compliant|needs_update|non_compliant"
    }
  ],
  "structural_exposure": [
    {
      "exposure_type": "framing|subfloor|masonry|insulation_cavity",
      "location": "specific area description", 
      "exposure_reason": "fixture_removal|finish_removal|utility_access|structural_work",
      "insulation_impact": {
        "insulation_removed": true,
        "insulation_type": "batt|blown|rigid|unknown",
        "removal_extent": "complete|partial|access_only",
        "replacement_needed": true,
        "confidence": 0.8
      },
      "structural_concerns": "none|minor|moderate|requires_evaluation"
    }
  ],
  "inference_summary": {
    "total_elements_inferred": 12,
    "high_confidence_detections": 8,
    "medium_confidence_detections": 3,
    "low_confidence_detections": 1,
    "reconstruction_completeness": 0.85,
    "additional_investigation_needed": ["specific areas requiring clarification"]
  }
}

## CONFIDENCE-BASED REPORTING

### **Adaptive Confidence Framework**
- **High Confidence (0.8-1.0)**: Clear direct evidence with multiple indicators
- **Moderate Confidence (0.6-0.8)**: Good evidence with reasonable inference
- **Exploratory (0.4-0.6)**: Logical possibilities worth considering
- **Speculative (0.2-0.4)**: Patterns requiring further investigation

Express uncertainty honestly and explain reasoning for lower confidence items.

## RESPONSE STRUCTURE

Generate a comprehensive JSON response that captures your analysis. 

**CRITICAL**: Check these FIRST with careful visual analysis:
1. **WALL DRYWALL**: ONLY if you see exposed wood studs/framing → wall drywall removed (use provided wall_area_sqft)
2. **CEILING DRYWALL**: ONLY if you see exposed ceiling joists → ceiling drywall removed (use provided ceiling_area_sqft)
3. **FLOORING**: Look carefully - is the floor ACTUALLY removed or just dirty/damaged?
   - Exposed concrete/subfloor = flooring removed
   - Existing tile/wood/carpet still visible = NOT removed (even if dirty)
4. **INSULATION**: ONLY if you see empty wall cavities between studs → insulation removed

Then detect smaller items:
- Fixtures (toilet, vanity, etc.)
- Tile removal
- Other elements

REMEMBER: The room dimensions are provided - USE THEM for major surfaces!

{
  "forensic_analysis": {
    "demolition_type": "selective|comprehensive|emergency|partial",
    "demolition_quality": "professional|adequate|rough|damage_based",
    "work_sequence": "systematic|random|emergency|in_progress",
    "safety_evidence": "proper|adequate|minimal|concerning"
  },
  "detected_removed_elements": [
    {
      "element_type": "toilet|sink|cabinet|tile|insulation|lighting|etc",
      "original_material": "inferred material type",
      "removal_evidence": ["floor_flange", "supply_valve", "mounting_holes"],
      "confidence_level": 0.85,
      "detection_method": "utility_evidence|mounting_evidence|boundary_evidence|pattern_inference",
      "original_dimensions": {"width": 24, "depth": 18, "height": 32},
      "original_location": "specific location description",
      "area_affected": 15.5,
      "evidence_description": "Clear description of what evidence was found",
      "removal_completeness": "complete|partial|damaged_during_removal",
      "replacement_indication": "definitely_planned|likely_planned|unclear|may_not_replace"
    }
  ],
  "inference_summary": {
    "total_elements_detected": 0,
    "high_confidence_detections": 0,
    "inferred_detections": 0,
    "detection_methodology": "description of approach used"
  }
}

## QUALITY PRINCIPLES

1. **Evidence over assumptions** - Base conclusions on observable indicators
2. **Adaptability over rigidity** - Adjust approach to specific circumstances
3. **Exploration over limitation** - Consider multiple possibilities
4. **Context over standards** - Use room characteristics to guide analysis
5. **Reasoning over compliance** - Focus on analytical quality

Remember: You're conducting intelligent forensic analysis, not filling out a checklist. Think creatively about what the evidence tells you while providing practical area estimates for construction planning.
"""
)

# Stage 4: Demo Scope Synthesis - Combine analyses for final scope
DEMO_SCOPE_SYNTHESIS_PROMPT = PromptTemplate(
    input_variables=["before_inventory", "after_analysis", "room_context"],
    template="""
{room_context}Synthesize the before-demo inventory and after-demo forensic analysis to determine the comprehensive final demolition scope.

## INTELLIGENT SYNTHESIS METHODOLOGY

### **CROSS-VALIDATION ANALYSIS**

**Data Reconciliation Process:**
- **Direct Confirmation**: Elements present in before-inventory and detected as removed in after-analysis
- **Evidence Correlation**: Match before-inventory elements with after-analysis removal evidence
- **Gap Analysis**: Before-inventory elements not detected in after-analysis (investigate why)
- **Inference Validation**: After-analysis inferences confirmed/contradicted by before-inventory
- **Measurement Reconciliation**: Align area calculations and dimensions between analyses

**Discrepancy Resolution Framework:**
- **High Confidence Conflicts**: When strong evidence contradicts between analyses
- **Missing Element Investigation**: Before-inventory elements with no after-removal evidence
- **False Positive Evaluation**: After-analysis detections not supported by before-inventory
- **Partial Removal Assessment**: Reconcile extent of removal between analyses

### **INTELLIGENT SYNTHESIS TECHNIQUES**

**Evidence Weighting System:**
- **Direct Visual Evidence**: Weight = 1.0 (highest reliability)
- **Strong Physical Evidence**: Weight = 0.9 (mounting holes, utility connections)
- **Contextual Evidence**: Weight = 0.7 (standard practice, room requirements)
- **Inferential Evidence**: Weight = 0.5 (logical deduction, pattern matching)

**Confidence Calibration Method:**
- **Confirmed Elements**: Before + After evidence = 0.95-0.99 confidence
- **Strong Single-Source**: Strong evidence from one analysis = 0.8-0.9 confidence  
- **Supported Inference**: Inference supported by context = 0.6-0.8 confidence
- **Weak Inference**: Limited evidence/context = 0.3-0.6 confidence

## RESPONSE FORMAT

Respond in this exact JSON structure:

{
  "synthesis_summary": {
    "total_demolished_elements": 15,
    "confirmed_removals": 12,
    "inferred_removals": 3,
    "overall_confidence": 0.88,
    "analysis_quality": "excellent|good|fair|limited",
    "scope_completeness": 0.92
  },
  "final_demolition_scope": [
    {
      "surface_type": "floor|wall|ceiling|cabinet|vanity|countertop|fixture|backsplash|mirror|toilet|bathtub|shower|appliance|insulation",
      "material_removed": "tile|drywall|wood|carpet|laminate|granite|ceramic|cabinet|fiberglass|etc",
      "description": "comprehensive description of what was removed",
      "estimated_area_sqft": 45.5,
      "count": 2,
      "unit_type": "area|count",
      "demolition_completeness": "total|partial",
      "completion_percentage": 85,
      "confidence": 0.90,
      "evidence_sources": ["before_inventory", "after_forensic", "utility_evidence", "mounting_evidence"],
      "removal_method": "standard|careful|rough|emergency",
      "disposal_considerations": "standard|hazardous|specialty|recyclable",
      "replacement_planning": {
        "replacement_indicated": true,
        "replacement_type": "like_for_like|upgrade|code_required|unknown",
        "timing_dependency": "immediate|after_rough_in|after_framing|final_stage"
      }
    }
  ],
  "validation_results": {
    "cross_validation_score": 0.85,
    "discrepancies_identified": 2,
    "discrepancies_resolved": 2,
    "missing_elements_investigated": 1,
    "false_positives_eliminated": 0,
    "measurement_consistency": 0.92
  },
  "estimation_data": {
    "total_demo_area_sqft": 450.0,
    "estimated_demo_hours": 24,
    "disposal_volume_cubic_yards": 3.5,
    "special_requirements": ["asbestos_testing", "lead_paint_precautions", "structural_protection"],
    "permit_requirements": ["demolition_permit", "electrical_disconnect", "plumbing_rough_in"],
    "cost_factors": {
      "labor_complexity": "standard|complex|specialty_required",
      "disposal_complexity": "standard|hazardous|specialty", 
      "access_difficulty": "easy|moderate|difficult",
      "utility_complexity": "simple|moderate|complex"
    }
  },
  "quality_assurance": {
    "confidence_distribution": {
      "high_confidence_0.8_to_1.0": 10,
      "medium_confidence_0.6_to_0.8": 4,
      "low_confidence_below_0.6": 1
    },
    "evidence_strength": {
      "direct_visual_evidence": 8,
      "strong_physical_evidence": 5,
      "contextual_evidence": 2,
      "inferential_evidence": 0
    },
    "recommendations": {
      "additional_investigation": ["areas_needing_clarification"],
      "verification_suggested": ["elements_to_double_check"],
      "specialist_consultation": ["structural_engineer", "environmental_testing"],
      "documentation_needs": ["permit_applications", "insurance_documentation"]
    }
  }
}

## SYNTHESIS PRINCIPLES

1. **EVIDENCE-BASED SYNTHESIS**: Prioritize strong evidence over weak inferences
2. **CONFIDENCE TRANSPARENCY**: Clearly indicate confidence levels and evidence sources
3. **PRACTICAL UTILITY**: Provide estimation-ready data for construction planning
4. **QUALITY ASSURANCE**: Include validation metrics and quality indicators
5. **ACTIONABLE OUTPUT**: Generate specific recommendations for next steps
6. **COMPREHENSIVE SCOPE**: Ensure all demolished elements are captured accurately
"""
)

# Bathroom-specific demolition scope prompt
BATHROOM_DEMO_SCOPE_PROMPT = PromptTemplate(
    input_variables=["room_context"],
    template="""
{room_context}This is a BATHROOM RENOVATION. Analyze these images and identify all demolished areas.

**COMPREHENSIVE BATHROOM DEMOLITION CHECKLIST**:
ASSUME ALL STANDARD BATHROOM ITEMS WERE REMOVED unless clearly visible and undamaged:

✓ **FLOORING (ALWAYS INCLUDE)**: 100% floor covering removal - tile, vinyl, laminate (estimate full room area: 35-100+ sq ft)
✓ **VANITY CABINET & COUNTERTOP**: Complete vanity system removal (estimate 15-30 sq ft cabinet face + countertop area)
✓ **TOILET**: Standard fixture removal (count as 1 unit + 2.5 sq ft floor impact)
✓ **BATHTUB/SHOWER UNIT**: Complete tub/shower removal (estimate 20-50 sq ft surround area + unit)
✓ **BATHROOM MIRROR**: Wall-mounted mirror (estimate 8-20 sq ft wall area)
✓ **WALL TILES/SURROUNDS**: Shower/tub wall tiles (estimate 50-120 sq ft depending on bathroom size)
✓ **SINK & PLUMBING FIXTURES**: Sink, faucets, shower heads, tub spouts
✓ **BATHROOM ACCESSORIES**: Towel bars, toilet paper holders, soap dispensers, medicine cabinets
✓ **TRIM & MOLDING**: Baseboards, door trim, window trim around bathroom
✓ **LIGHT FIXTURES**: Vanity lights, ceiling fixtures if renovation evident
✓ **EXHAUST FAN**: Bathroom fan if ceiling work visible

**ENHANCED DETECTION STRATEGY**:
1. **ASSUME STANDARD RENOVATION SCOPE**: In bathroom photos, assume comprehensive renovation unless contradicted
2. **PROTECTED = REMOVAL PLANNED**: Any plastic-covered or protected items should be included as planned demolition
3. **MISSING = ALREADY REMOVED**: If standard fixtures not visible, assume they were removed
4. **FLOOR WORK = COMPLETE FLOOR REMOVAL**: Any floor work indicates 100% floor covering removal
5. **EVIDENCE-BASED DETECTION**: Look for mounting holes, capped pipes, wall patches, exposed subfloor
6. **ROOM SIZE SCALING**: Scale estimates to actual bathroom size (small 35-50 sq ft, medium 50-75 sq ft, large 75-100+ sq ft)

Respond in the standard JSON format but ensure comprehensive coverage of typical bathroom demolition scope.
"""
)

# Before/After comparison prompt for multi-angle photos
BEFORE_AFTER_COMPARISON_PROMPT = PromptTemplate(
    input_variables=["room_context"],
    template="""
{room_context}Analyze these BEFORE and AFTER photo sets taken from multiple random angles of the same room to identify demolished areas.

IMPORTANT CONTEXT:
- BEFORE photos: Show the room in its original state (pre-demolition)
- AFTER photos: Show the room after demolition work (post-demolition)
- Both sets contain multiple photos taken from different random angles/positions
- Photos are NOT taken from identical positions - you must spatially correlate them

SPATIAL CORRELATION PROCESS:
1. ROOM MAPPING: Identify common architectural features across both photo sets:
   - Doors, windows, and their positions
   - Room corners and wall configurations
   - Fixed elements (outlets, switches, built-ins)
   - Ceiling features and lighting
   - Overall room geometry and layout

2. VIEWPOINT MATCHING: For each AFTER photo, find corresponding BEFORE photo(s):
   - Match camera angles and positions as closely as possible
   - Identify overlapping coverage areas
   - Account for different shooting positions and perspectives
   - Use architectural landmarks for spatial reference

3. CHANGE DETECTION: Compare matched viewpoints to identify changes:
   - What existed in BEFORE that's missing in AFTER
   - New exposed areas (walls, subfloors, structural elements)
   - Removed materials, fixtures, or installations
   - Changed surface conditions

DEMOLISHED AREA ANALYSIS:
For each identified change:
1. Determine the full extent by triangulating across multiple angles
2. Classify the type of demolition (floor, wall, ceiling, cabinet, etc.)
3. Identify the removed material type
4. Calculate area using consistent reference objects
5. Cross-validate findings across multiple viewpoint pairs

REFERENCE OBJECTS (consistent across both photo sets):
- Standard doors: 3 feet wide × 7 feet tall
- Electrical outlets/switches: 4.5" × 2.75"
- Windows: use frame dimensions for scaling
- Floor tiles: typically 12" × 12" or 24" × 24"
- Built-in fixtures: use standard dimensions where applicable

RESPOND IN THIS EXACT JSON FORMAT:
{{
  "spatial_correlation": {{
    "room_layout_description": "overall room geometry and key features",
    "before_photos_count": number,
    "after_photos_count": number,
    "common_reference_points": ["door", "window", "outlet"],
    "coverage_analysis": "how well both sets cover the room"
  }},
  "demolished_areas": [
    {{
      "surface_type": "floor|wall|ceiling|cabinet|vanity|countertop|fixture|backsplash|mirror|toilet|bathtub|shower|appliance",
      "material_removed": "tile|drywall|wood|carpet|laminate|granite|ceramic|cabinet|etc",
      "description": "detailed description of what was removed",
      "before_evidence": ["before_photo_1", "before_photo_3"],
      "after_evidence": ["after_photo_2", "after_photo_4"],
      "estimated_area_sqft": 45.5,
      "demolition_completeness": "total|partial",
      "completion_percentage": 75,
      "total_possible_area_sqft": 60.0,
      "partial_description": "description of which portion was demolished",
      "calculation_method": "reference_scaling|triangulation|proportional|room_percentage",
      "confidence": 0.85,
      "reference_objects_used": ["door", "outlet"],
      "demolition_type": "complete_removal|partial_removal|surface_prep",
      "spatial_notes": "additional context about extent and location"
    }}
  ],
  "reference_validation": [
    {{
      "object_type": "door|window|outlet|fixture",
      "before_visibility": ["before_photo_1", "before_photo_2"],
      "after_visibility": ["after_photo_1", "after_photo_3"],
      "dimensional_consistency": "good|fair|poor",
      "used_for_scaling": true|false
    }}
  ],
  "analysis_confidence": {{
    "overall_confidence": 0.85,
    "spatial_correlation_quality": "excellent|good|fair|poor",
    "coverage_completeness": "complete|good|partial|limited",
    "potential_missed_areas": "description of areas that might not be visible",
    "recommendation": "additional photos needed|analysis complete|review required"
  }}
}}

CRITICAL REQUIREMENTS:
- Treat BEFORE and AFTER as separate multi-angle photo sets of the same room
- Correlate spatial positions across different shooting angles
- Identify changes by comparing corresponding areas, not identical viewpoints
- Account for perspective differences when calculating areas
- Use multiple reference objects for cross-validation
- Mark confidence based on spatial correlation quality and coverage
- Be conservative with area estimates when viewpoint correlation is uncertain
- Identify both obvious demolition and subtle changes (surface prep, partial removal)
"""
)

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

# =============================================================================
# MULTI-STAGE DEMOLITION ANALYSIS WORKFLOW PROMPTS
# =============================================================================

# Note: Duplicate PHOTO_CLASSIFICATION_PROMPT definition removed - using the simplified version above

# Stage 2: Before-Demo Analysis - Comprehensive inventory of all existing elements
BEFORE_DEMO_INVENTORY_PROMPT = PromptTemplate(
    input_variables=["room_context"],
    template="""
{room_context}Analyze these BEFORE-DEMOLITION photos to create a comprehensive inventory of all existing elements, materials, and fixtures.

## INVENTORY OBJECTIVE

Create a complete baseline inventory of everything present in the room before any demolition work. This inventory will serve as the reference for determining what was removed in subsequent analysis stages.

## COMPREHENSIVE INVENTORY METHODOLOGY

### **Systematic Room Scanning Process**
1. **Architectural Foundation Documentation**: Record all structural and built-in elements
2. **Surface Material Cataloging**: Identify and measure all finish materials
3. **Fixture and Appliance Inventory**: Document all installed functional elements
4. **Utility System Assessment**: Map electrical, plumbing, and mechanical components
5. **Trim and Millwork Recording**: Catalog all decorative and transitional elements
6. **Hardware and Accessory Documentation**: Note all attached functional items

### **Multi-Layer Analysis Approach**
- **Primary Elements**: Major room components (floors, walls, ceilings, major fixtures)
- **Secondary Elements**: Support systems (trim, hardware, lighting, accessories)
- **Tertiary Elements**: Decorative items, specialized features, minor attachments
- **System Integrations**: How different elements connect and depend on each other

## ROOM-ADAPTIVE INVENTORY CATEGORIES

### **Universal Room Elements**
- **Flooring Systems**: Material type, area coverage, underlayment, transitions
- **Wall Surfaces**: Materials, paint/finishes, mounted elements, openings
- **Ceiling Systems**: Materials, fixtures, access panels, architectural features
- **Door and Window Systems**: Frames, trim, hardware, operational elements
- **Electrical Systems**: Outlets, switches, fixtures, covers, junction boxes
- **Trim and Millwork**: Baseboards, crown molding, casings, decorative elements

### **Bathroom-Specific Inventory**
- **Plumbing Fixtures**: Toilet, sink/vanity, tub/shower, faucets, supply lines
- **Wet Area Features**: Tile surrounds, shower doors/curtains, waterproofing elements
- **Storage Elements**: Vanity cabinets, medicine cabinets, shelving, towel bars
- **Ventilation Systems**: Exhaust fans, natural ventilation, moisture control
- **Accessories**: Mirrors, lighting, towel bars, soap dispensers, toilet paper holders
- **Safety Features**: Grab bars, non-slip surfaces, accessibility modifications

### **Kitchen-Specific Inventory**
- **Cabinet Systems**: Upper/lower cabinets, doors, drawers, hardware, interiors
- **Countertop Systems**: Materials, edge treatments, backsplashes, support structures
- **Appliance Integration**: Built-in appliances, connections, surrounding materials
- **Utility Connections**: Plumbing for sink, electrical for appliances, gas lines
- **Storage Solutions**: Pantry elements, specialty organizers, pull-out features

### **Living Space Inventory**
- **Architectural Features**: Built-in shelving, fireplaces, bay windows, alcoves
- **Climate Systems**: Heating/cooling elements, ductwork, thermostats
- **Entertainment Integration**: Cable/internet connections, mounting systems
- **Storage Solutions**: Closets, built-in storage, organizational systems

## MATERIAL IDENTIFICATION PRINCIPLES

### **Detailed Material Analysis**
- **Material Type**: Specific identification (ceramic tile vs. luxury vinyl plank)
- **Material Quality**: Grade, brand indicators, age/condition assessment
- **Installation Method**: How material is attached/installed (affects removal scope)
- **Substrate Requirements**: What's beneath (affects demolition planning)
- **Interconnections**: How materials connect (affects removal sequence)

### **Condition Assessment**
- **Functional Status**: Working/broken/damaged/worn
- **Aesthetic Condition**: Paint quality, surface wear, staining, fading
- **Structural Integrity**: Soundness, attachment quality, stability
- **Maintenance History**: Evidence of repairs, updates, modifications

## INTELLIGENT AREA CALCULATION

### **Measurement Methodology**
- **Reference Object Scaling**: Use doors (3'×7'), outlets (4.5"×2.75"), standard fixtures
- **Proportional Estimation**: Apply room geometry and typical dimension ratios
- **Coverage Assessment**: Account for full coverage vs. partial installations
- **Multi-Angle Verification**: Cross-validate measurements using different photo angles

### **Area Documentation Standards**
- **Floor Areas**: Total room area, covered areas, material-specific zones
- **Wall Areas**: Full wall surface, material-specific coverage, opening deductions
- **Ceiling Areas**: Total coverage, fixture integration, access areas
- **Linear Elements**: Trim lengths, transitions, border treatments

## RESPONSE FORMAT

Respond in this exact JSON structure:

{{
  "room_baseline": {{
    "room_type": "bathroom|kitchen|bedroom|living_room|other",
    "room_dimensions": {{"length_ft": 0, "width_ft": 0, "height_ft": 0}},
    "total_floor_area_sqft": 0.0,
    "room_condition": "excellent|good|fair|poor",
    "functionality_status": "fully_functional|partially_functional|non_functional",
    "renovation_readiness": "ready|needs_prep|major_issues"
  }},
  "existing_elements": [
    {{
      "element_category": "flooring|wall_surface|ceiling|fixture|cabinet|trim|electrical|plumbing|appliance|accessory",
      "element_type": "toilet|vanity|tile_surround|baseboards|light_fixture|etc",
      "material_description": "detailed material identification",
      "location_description": "specific placement and extent",
      "area_sqft": 0.0,
      "linear_ft": 0.0,
      "quantity": 1,
      "condition_assessment": "excellent|good|fair|poor|damaged",
      "functional_status": "working|non_working|decorative|structural",
      "installation_method": "nailed|glued|screwed|built_in|surface_mounted|etc",
      "removal_complexity": "simple|moderate|complex|structural",
      "interconnected_elements": ["list of connected/dependent elements"],
      "estimated_replacement_cost_tier": "low|medium|high|premium",
      "special_considerations": "hazmat|structural|utility_disconnect|access_issues"
    }}
  ],
  "utility_systems": {{
    "electrical": {{
      "outlets_count": 0,
      "switches_count": 0,
      "light_fixtures": ["ceiling|wall_mounted|under_cabinet"],
      "special_electrical": ["gfci|dedicated_circuits|240v"]
    }},
    "plumbing": {{
      "water_supply_points": 0,
      "drain_points": 0,
      "fixtures_served": ["toilet|sink|tub|shower"],
      "pipe_materials": ["copper|pex|pvc|cast_iron"]
    }},
    "hvac": {{
      "vents_count": 0,
      "return_air": true|false,
      "dedicated_equipment": ["exhaust_fan|window_ac|baseboard_heat"]
    }}
  }},
  "inventory_completeness": {{
    "visual_coverage": "complete|good|partial|limited",
    "analysis_confidence": 0.85,
    "potential_hidden_elements": ["elements not visible in photos"],
    "measurement_accuracy": "high|medium|estimated",
    "inventory_notes": "additional context or concerns"
  }}
}}

## INVENTORY QUALITY STANDARDS

1. **Comprehensive Coverage**: Document everything visible, note what's not visible
2. **Accurate Identification**: Use specific material names, not generic terms
3. **Precise Measurements**: Provide realistic area/dimension estimates with clear methodology
4. **Functional Assessment**: Evaluate condition and working status of all elements
5. **Integration Awareness**: Understand how elements connect and depend on each other
6. **Future Planning**: Consider removal complexity and replacement requirements

This comprehensive inventory provides the foundation for accurate demolition scope determination in subsequent analysis stages.
"""
)

# Stage 3: After-Demo Analysis - Identify demolished areas and infer original elements
AFTER_DEMO_ANALYSIS_PROMPT = PromptTemplate(
    input_variables=["room_context"],
    template="""
{room_context}You are a construction estimator analyzing demolition photos. Your PRIMARY OBJECTIVE is to identify removed elements and calculate accurate areas for cost estimation.

## CRITICAL REQUIREMENTS - READ CAREFULLY

**AREA CALCULATION IS MANDATORY**: Every detected element MUST have a realistic area_affected > 0. No exceptions.

**REQUIRED FIELDS**: All JSON fields are mandatory. Empty or missing fields will cause system errors.

**PRACTICAL FOCUS**: Use real-world estimation techniques, not theoretical analysis.

## AREA CALCULATION METHODOLOGY

### **1. STANDARD FIXTURE DIMENSIONS** (Use these when exact measurement isn't possible)
- **Toilet**: 2.5-3 sq ft floor area, 18"×30" footprint
- **Vanity (24" wide)**: 6 sq ft cabinet face, 2×3 ft floor area  
- **Vanity (36" wide)**: 9 sq ft cabinet face, 3×3 ft floor area
- **Vanity (48" wide)**: 12 sq ft cabinet face, 4×3 ft floor area
- **Standard bathtub**: 15 sq ft floor area (5'×3'), 50-70 sq ft wall surround
- **Shower stall**: 9-16 sq ft floor (3'×3' to 4'×4'), 30-50 sq ft wall surround
- **Medicine cabinet**: 2-4 sq ft wall area
- **Vanity light**: 1-2 sq ft wall area per fixture
- **Ceiling light**: 1-2 sq ft ceiling area per fixture

### **2. REFERENCE OBJECT SCALING**
- **Doors**: Use as 3' wide × 7' tall reference for room scaling
- **Electrical outlets**: 4.5" × 2.75" for detailed measurements
- **Standard tiles**: 12"×12" or assume 1 sq ft per tile

### **3. ROOM PERCENTAGE ESTIMATION**
For flooring and large surfaces:
- "Entire floor removed" = 100% of room floor area
- "Half the wall tiles removed" = 50% of wall tile area  
- "Shower area only" = 25-40% of bathroom wall area
- "Around bathtub area" = 30-50% of total wall area

### **4. VISUAL GRID METHOD**
- Mentally divide surfaces into grid squares
- Count affected grid squares
- Multiply by estimated square footage per grid

### **5. PROPORTIONAL SCALING**
- Use visible elements as size references
- Scale up from known dimensions to affected areas
- Cross-check with room size for reasonableness

## EVIDENCE-BASED DETECTION

### **Direct Visual Evidence** (High Confidence 0.8-0.9)
- Exposed subfloor, framing, or substrate
- Mounting holes, brackets, or anchor points
- Capped plumbing or electrical connections
- Clean cut lines or removal boundaries
- Material debris or residue

### **Functional Logic Evidence** (Moderate Confidence 0.6-0.8)
- Missing fixtures typical for room type
- Utility rough-ins without connected fixtures
- Space layout suggesting missing elements
- Access modifications for removal

### **Standard Practice Inference** (Lower Confidence 0.4-0.6)
- Elements typically present in this room type
- Code-required fixtures or materials
- Industry standard installation patterns

## SIMPLIFIED DETECTION CHECKLIST

### **BATHROOM STANDARDS** (Check for these common removals)
✓ **Floor covering** (always removed in renovations) - calculate full room area
✓ **Toilet** - look for floor mounting evidence or missing fixture - 2.5 sq ft
✓ **Vanity/sink** - check for plumbing rough-ins - 6-12 sq ft cabinet + counter
✓ **Wall tiles** - look for exposed substrate - calculate affected wall area
✓ **Bathtub/shower** - check for drain or mounting evidence - 15+ sq ft floor, 50+ sq ft walls
✓ **Light fixtures** - look for electrical boxes or mounting evidence - 1-2 sq ft each
✓ **Mirror** - check for mounting evidence - 6-15 sq ft wall area

### **KITCHEN STANDARDS**
✓ **Cabinets** - look for mounting evidence - calculate cabinet face area
✓ **Countertops** - check support brackets - calculate surface area
✓ **Appliances** - check utility connections - use standard sizes
✓ **Backsplash** - look for wall substrate - calculate linear feet × height

## RESPONSE FORMAT - MANDATORY FIELDS

{{
  "detected_removed_elements": [
    {{
      "element_type": "REQUIRED - toilet|vanity|shower|bathtub|wall_tiles|floor_covering|light_fixture|mirror|cabinet|countertop",
      "original_material": "REQUIRED - ceramic_tile|laminate|vinyl|porcelain|wood|drywall|etc", 
      "removal_evidence": ["REQUIRED - list like: exposed_subfloor", "mounting_holes", "capped_plumbing", "missing_fixture"],
      "confidence_level": "REQUIRED - 0.0 to 1.0, example: 0.85",
      "area_affected": "REQUIRED - MUST be > 0, in square feet, example: 25.5",
      "evidence_description": "REQUIRED - detailed description, NEVER empty - describe what you see that proves this was removed",
      "removal_completeness": "complete|partial",
      "location_in_room": "center_floor|north_wall|shower_area|etc",
      "calculation_method": "standard_fixture_size|room_percentage|reference_scaling|visual_estimation",
      "calculation_details": "REQUIRED - explain how you calculated this area, NEVER empty"
    }}
  ],
  "room_assessment": {{
    "room_type": "bathroom|kitchen|bedroom|living_room|other",
    "estimated_room_size": "small|medium|large",
    "room_dimensions_ft": {{"length": 8, "width": 6, "height": 8}},
    "total_floor_area": 48.0,
    "renovation_scope": "gut_renovation|partial_renovation|surface_work"
  }},
  "estimation_summary": {{
    "total_demo_area": 125.0,
    "high_confidence_area": 100.0,
    "moderate_confidence_area": 25.0,
    "number_of_elements": 6,
    "analysis_completeness": "complete|partial|limited"
  }}
}}

## PRACTICAL EXAMPLES

**Exposed Subfloor**: "Laminate flooring removed from entire bathroom floor. Room appears 8×6 ft = 48 sq ft total floor area."

**Missing Toilet**: "Toilet removed - see capped water supply and drain flange. Standard toilet footprint = 2.5 sq ft affected floor area."

**Removed Wall Tiles**: "Wall tiles removed in shower area. Shower appears 3×3 ft with 8 ft ceiling. Three walls affected = 3×8×3 = 72 sq ft tile removal."

**Missing Vanity**: "Vanity removed - see capped plumbing and electrical box. Space suggests 36" vanity = 9 sq ft cabinet face area."

## CRITICAL REMINDERS

1. **EVERY ELEMENT MUST HAVE AREA > 0** - No zero values allowed
2. **DESCRIBE EVIDENCE CLEARLY** - Say what you actually see
3. **USE REALISTIC DIMENSIONS** - Apply standard fixture sizes
4. **CALCULATE CONSERVATIVELY** - Better to underestimate than overestimate
5. **ALL FIELDS REQUIRED** - Missing fields cause system errors

Focus on practical estimation over complex analysis. Get real numbers that estimators can use.
"""
)

# Stage 4: Demo Scope Synthesis - Combine findings to determine final demolition scope
DEMO_SCOPE_SYNTHESIS_PROMPT = PromptTemplate(
    input_variables=["before_inventory", "after_analysis", "room_context"],
    template="""
{room_context}Synthesize BEFORE-DEMOLITION inventory and AFTER-DEMOLITION analysis to determine the comprehensive, final demolition scope with maximum accuracy and completeness.

## SYNTHESIS OBJECTIVE

Combine systematic before-state inventory with forensic after-state analysis to create the definitive demolition scope determination. Cross-validate findings, resolve discrepancies, and provide comprehensive scope documentation for construction estimation.

## DATA INTEGRATION METHODOLOGY

### **Cross-Validation Analysis**
1. **Element Matching**: Match before-inventory items with after-analysis removal evidence
2. **Discrepancy Resolution**: Identify and resolve conflicts between data sources
3. **Evidence Triangulation**: Use multiple evidence types to confirm scope determinations
4. **Confidence Calibration**: Weight findings based on evidence quality and consistency
5. **Gap Analysis**: Identify missing elements not captured in either analysis
6. **Scope Completion**: Ensure all demolished elements are accounted for

### **Intelligent Synthesis Techniques**
- **Positive Confirmation**: Elements present in before AND evidenced as removed in after
- **Inference Validation**: After-analysis inferences confirmed by before-inventory
- **Evidence Strengthening**: Multiple detection methods supporting same conclusion
- **Scope Expansion**: Before-inventory reveals elements missed in after-analysis
- **Quality Enhancement**: After-analysis provides details missing from before-inventory

## COMPREHENSIVE SCOPE DETERMINATION

### **Primary Scope Elements** (High Confidence)
Elements with strong evidence from both analyses:
- Present in before-inventory with detailed documentation
- Clear removal evidence in after-analysis
- Consistent area calculations and descriptions
- High confidence scores from both analyses

### **Secondary Scope Elements** (Moderate Confidence) 
Elements with evidence from one analysis and logical support from the other:
- Strong evidence in one analysis, reasonable inference in the other
- Typical elements for room type with some supporting evidence
- Elements with partial evidence requiring professional judgment

### **Inferred Scope Elements** (Lower Confidence)
Elements determined through logical deduction:
- Required by room functionality but not directly visible in either analysis
- Standard elements for room type with circumstantial evidence
- Elements inferred from removal of connected/dependent components

## SCOPE VALIDATION FRAMEWORK

### **Quality Control Measures**
- **Data Consistency Check**: Ensure area calculations align between analyses
- **Logical Coherence**: Verify that scope makes sense for room type and renovation context
- **Professional Standard Review**: Compare scope against typical renovation patterns
- **Evidence Strength Assessment**: Evaluate robustness of supporting evidence
- **Completeness Verification**: Ensure no major elements are overlooked

### **Confidence Scoring Integration**
- **Combined Confidence**: Weighted average of both analyses with evidence quality factors
- **Evidence Concordance**: Higher confidence when both analyses agree
- **Single-Source Penalty**: Reduced confidence for elements found in only one analysis
- **Professional Judgment**: Apply industry expertise to calibrate confidence levels

## INTELLIGENT AREA RECONCILIATION

### **Measurement Harmonization**
- **Reference Consistency**: Ensure both analyses use compatible measurement references
- **Scaling Validation**: Cross-check area calculations using different methodologies
- **Proportion Verification**: Validate that element areas make sense relative to room size
- **Coverage Analysis**: Ensure total scope areas are reasonable for room dimensions

### **Area Calculation Optimization**
- **Best Evidence Selection**: Use most accurate measurement source for each element
- **Cross-Validation Adjustments**: Reconcile differences between measurement approaches
- **Professional Standards**: Apply industry-standard dimensions where specific measurements unclear
- **Quality Weighting**: Favor measurements with stronger supporting evidence

## RESPONSE FORMAT

Respond in this exact JSON structure:

{{
  "synthesis_overview": {{
    "total_elements_analyzed": 0,
    "high_confidence_elements": 0,
    "moderate_confidence_elements": 0,
    "inferred_elements": 0,
    "overall_scope_confidence": 0.85,
    "data_concordance_rate": 0.90,
    "synthesis_quality": "excellent|good|fair|limited"
  }},
  "final_demolition_scope": [
    {{
      "element_type": "toilet|vanity|tile_surround|flooring|light_fixture|etc",
      "material_removed": "ceramic_tile|laminate_flooring|drywall|cabinet|etc",
      "scope_description": "comprehensive description of what was demolished",
      "final_area_sqft": 0.0,
      "linear_ft": 0.0,
      "quantity": 1,
      "demolition_completeness": "total|partial",
      "completion_percentage": 100,
      "evidence_sources": {{
        "before_inventory": true|false,
        "after_analysis": true|false,
        "professional_inference": true|false,
        "cross_validation": true|false
      }},
      "confidence_breakdown": {{
        "before_confidence": 0.85,
        "after_confidence": 0.90,
        "synthesis_confidence": 0.87,
        "evidence_strength": "excellent|good|fair|weak"
      }},
      "measurement_source": "before_measurement|after_measurement|averaged|professional_standard",
      "scope_category": "confirmed|probable|inferred|standard_assumption",
      "removal_complexity": "simple|moderate|complex|structural",
      "cost_impact": "low|medium|high|premium",
      "scheduling_considerations": "early|standard|late|critical_path",
      "special_requirements": ["permit|hazmat|structural|utility_coordination"]
    }}
  ],
  "scope_validation": {{
    "cross_check_results": {{
      "area_consistency": "excellent|good|fair|poor",
      "logical_coherence": "excellent|good|fair|poor", 
      "professional_standard_alignment": "excellent|good|fair|poor",
      "evidence_concordance": "excellent|good|fair|poor"
    }},
    "discrepancies_resolved": [
      {{
        "discrepancy_type": "area_mismatch|missing_element|conflicting_evidence",
        "description": "description of discrepancy",
        "resolution_method": "evidence_weighting|professional_judgment|additional_inference",
        "resolution_confidence": 0.80
      }}
    ],
    "quality_assurance": {{
      "total_room_area_sqft": 0.0,
      "demolished_percentage": 75,
      "scope_completeness": "comprehensive|substantial|moderate|limited",
      "renovation_scope_type": "gut_renovation|selective_renovation|surface_renovation|repair_work"
    }}
  }},
  "estimation_ready_data": {{
    "total_demolition_area_sqft": 0.0,
    "demolition_categories": {{
      "flooring_removal_sqft": 0.0,
      "wall_surface_removal_sqft": 0.0,
      "ceiling_removal_sqft": 0.0,
      "fixture_removal_count": 0,
      "cabinet_removal_sqft": 0.0,
      "trim_removal_lf": 0.0
    }},
    "cost_estimation_factors": {{
      "labor_complexity": "simple|moderate|complex|specialist_required",
      "disposal_volume": "minimal|moderate|substantial|major",
      "protective_measures": "standard|enhanced|extensive",
      "access_difficulty": "easy|moderate|difficult|restricted"
    }},
    "scheduling_factors": {{
      "estimated_duration_days": 0,
      "crew_size_recommended": 0,
      "critical_dependencies": ["permit|utility_disconnect|structural|environmental"],
      "work_sequence_requirements": ["element_order_dependencies"]
    }}
  }},
  "synthesis_notes": {{
    "methodology_summary": "approach used to combine analyses",
    "confidence_factors": ["factors supporting or limiting confidence"],
    "assumptions_made": ["key assumptions in scope determination"],
    "recommendations": ["suggestions for improved accuracy or additional data needed"],
    "risk_factors": ["potential scope or cost risks identified"]
  }}
}}

## SYNTHESIS QUALITY STANDARDS

1. **Comprehensive Integration**: Systematically combine all available evidence sources
2. **Rigorous Validation**: Cross-check findings for consistency and logical coherence
3. **Conservative Estimation**: When uncertain, favor slightly conservative scope estimates
4. **Professional Calibration**: Apply industry expertise to resolve ambiguities
5. **Transparent Methodology**: Document approach and reasoning for scope determinations
6. **Estimation Readiness**: Provide data formatted for direct use in cost estimation
7. **Risk Awareness**: Identify potential scope variations or hidden conditions

This synthesis creates the definitive demolition scope determination optimized for accurate construction estimation and project planning.
"""
)