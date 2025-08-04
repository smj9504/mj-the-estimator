import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DemoAnalysisModule from '../../components/DemoAnalysis/DemoAnalysisModule';
import { autoSaveManager, autoSaveAPI } from '../../utils/autoSave';
import AutoSaveIndicator from '../../components/AutoSaveIndicator';

const DemoScope = React.memo(() => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session');
  
  const [measurementData, setMeasurementData] = useState(null);
  const [materialScopeData, setMaterialScopeData] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiCalcLoading, setAiCalcLoading] = useState({}); // Track loading state for each surface

  // Demo'd scope state
  const [demoedScope, setDemoedScope] = useState({});
  
  // AI Analysis state
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');

  // Setup auto-save
  useEffect(() => {
    if (sessionId) {
      autoSaveManager.register(
        `demoScope_${sessionId}`,
        async (data) => {
          await autoSaveAPI.saveDemoScope(sessionId, data);
        },
        {
          debounceTime: 3000,
          onStatusChange: setAutoSaveStatus
        }
      );

      return () => {
        autoSaveManager.unregister(`demoScope_${sessionId}`);
      };
    }
  }, [sessionId]);

  // Auto-save when demoedScope changes
  useEffect(() => {
    if (sessionId && Object.keys(demoedScope).length > 0) {
      autoSaveManager.save(`demoScope_${sessionId}`, demoedScope);
    }
  }, [demoedScope, sessionId]);

  // Load measurement and material scope data
  useEffect(() => {
    if (sessionId) {
      loadData();
    }
    setLoading(false);
  }, [sessionId]);

  // Helper function to ensure array format for materials - memoized
  const ensureArray = useCallback((value) => {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === '') return [];
    return [value];
  }, []);

  // Get available materials from material scope data - memoized
  const availableMaterials = useMemo(() => {
    const materials = new Set();
    
    // Add default materials from material scope
    if (materialScopeData?.default_scope?.material) {
      Object.values(materialScopeData.default_scope.material).forEach(materialValue => {
        const materialArray = ensureArray(materialValue);
        materialArray.forEach(material => {
          if (material && typeof material === 'string' && material.trim()) {
            materials.add(material.trim());
          }
        });
      });
    }
    
    // Add default underlayments from material scope
    if (materialScopeData?.default_scope?.material_underlayment) {
      Object.values(materialScopeData.default_scope.material_underlayment).forEach(materialValue => {
        const materialArray = ensureArray(materialValue);
        materialArray.forEach(material => {
          if (material && typeof material === 'string' && material.trim()) {
            materials.add(material.trim());
          }
        });
      });
    }
    
    // Add custom materials from selected room if available
    if (selectedRoom && materialScopeData?.locations) {
      const locationData = materialScopeData.locations[selectedRoom.locationIndex];
      const roomData = locationData?.rooms[selectedRoom.roomIndex];
      
      if (roomData?.material_override) {
        Object.values(roomData.material_override).forEach(materialValue => {
          const materialArray = ensureArray(materialValue);
          materialArray.forEach(material => {
            if (material && typeof material === 'string' && material.trim()) {
              materials.add(material.trim());
            }
          });
        });
      }
      
      if (roomData?.material_underlayment_override) {
        Object.values(roomData.material_underlayment_override).forEach(materialValue => {
          const materialArray = ensureArray(materialValue);
          materialArray.forEach(material => {
            if (material && typeof material === 'string' && material.trim()) {
              materials.add(material.trim());
            }
          });
        });
      }
    }
    
    return Array.from(materials).sort();
  }, [materialScopeData, selectedRoom, ensureArray]);

  // Check if surface type uses count instead of area
  const isCountBasedSurfaceType = useCallback((surfaceType) => {
    const countBasedTypes = [
      'cabinet', 'vanity', 'fixture',  // Fixtures are always count-based
      'door', 'window'  // Finishes that can be count-based
    ];
    return countBasedTypes.includes(surfaceType);
  }, []);

  // Get unit type for surface (area or count)
  const getSurfaceUnitType = useCallback((surfaceType) => {
    return isCountBasedSurfaceType(surfaceType) ? 'count' : 'area';
  }, [isCountBasedSurfaceType]);

  // Get materials for specific surface type
  const getMaterialsForSurface = useCallback((surfaceType) => {
    if (!surfaceType) return [];
    
    // Base materials from available materials
    let materials = [...availableMaterials];
    
    // Add surface-specific materials
    const surfaceSpecificMaterials = {
      'floor': ['tile', 'hardwood', 'laminate', 'carpet', 'vinyl', 'concrete', 'marble', 'stone'],
      'wall': ['drywall', 'tile', 'paint', 'wallpaper', 'paneling', 'brick', 'stone'],
      'ceiling': ['drywall', 'tile', 'paint', 'popcorn', 'plaster', 'wood'],
      'cabinet': ['wood', 'laminate', 'MDF', 'plywood', 'melamine'],
      'vanity': ['wood', 'laminate', 'MDF', 'marble', 'granite', 'quartz'],
      'countertop': ['granite', 'quartz', 'marble', 'laminate', 'tile', 'wood', 'concrete'],
      'backsplash': ['tile', 'stone', 'glass', 'metal', 'brick'],
      'trim': ['wood', 'MDF', 'PVC', 'metal'],
      'door': ['wood', 'metal', 'fiberglass', 'glass'],
      'window': ['wood', 'vinyl', 'aluminum', 'fiberglass'],
      'fixture': ['metal', 'plastic', 'ceramic', 'glass']
    };
    
    if (surfaceSpecificMaterials[surfaceType]) {
      materials = [...new Set([...materials, ...surfaceSpecificMaterials[surfaceType]])];
    }
    
    return materials.sort();
  }, [availableMaterials]);

  // Available surface types with categories - memoized to prevent recreation
  const surfaceTypeCategories = useMemo(() => ({
    'structural': {
      label: 'Structural Surfaces',
      types: ['ceiling', 'floor', 'wall']
    },
    'finishes': {
      label: 'Finishes',
      types: ['trim', 'door', 'window', 'countertop', 'backsplash']
    },
    'fixtures': {
      label: 'Fixtures & Equipment',
      types: ['cabinet', 'vanity', 'fixture']
    },
    'other': {
      label: 'Other',
      types: ['other']
    }
  }), []);

  // Get description placeholder based on surface type
  const getDescriptionPlaceholder = useCallback((surfaceType) => {
    const placeholders = {
      'fixture': 'e.g., toilet, mirror, bathtub, shower, sink, appliance, light fixture',
      'cabinet': 'e.g., kitchen cabinet, bathroom cabinet, built-in cabinet',
      'vanity': 'e.g., bathroom vanity, powder room vanity',
      'other': 'Describe the specific surface or component',
      'countertop': 'e.g., kitchen countertop, bathroom countertop',
      'backsplash': 'e.g., kitchen backsplash, bathroom backsplash'
    };
    return placeholders[surfaceType] || `Describe the ${surfaceType} details`;
  }, []);

  // Calculate total and demolished areas for visual comparison
  const calculateAreaComparison = useCallback((roomData, demoedSurfaces) => {
    if (!roomData?.measurements || !demoedSurfaces) {
      return { totalArea: 0, demolishedArea: 0, percentage: 0 };
    }

    const measurements = roomData.measurements;
    const totalArea = {
      floor: measurements.floor_area_sqft || 0,
      ceiling: measurements.ceiling_area_sqft || 0,
      wall: measurements.wall_area_sqft || 0
    };

    let demolishedArea = {
      floor: 0,
      ceiling: 0,
      wall: 0,
      other: 0
    };

    demoedSurfaces.forEach(surface => {
      const area = (() => {
        const method = surface.calc_method || 'full';
        if (method === 'full') {
          if (surface.type === 'floor') return totalArea.floor;
          if (surface.type === 'ceiling') return totalArea.ceiling;
          if (surface.type === 'wall') return totalArea.wall;
          return 0;
        } else if (method === 'percentage') {
          let baseValue = 0;
          if (surface.type === 'floor') baseValue = totalArea.floor;
          if (surface.type === 'ceiling') baseValue = totalArea.ceiling;
          if (surface.type === 'wall') baseValue = totalArea.wall;
          return (baseValue * (surface.percentage || 0)) / 100;
        } else if (method === 'partial') {
          return surface.partial_area || 0;
        }
        return 0;
      })();

      if (['floor', 'ceiling', 'wall'].includes(surface.type)) {
        demolishedArea[surface.type] += area;
      } else {
        demolishedArea.other += area;
      }
    });

    const totalStructuralArea = totalArea.floor + totalArea.ceiling + totalArea.wall;
    const totalDemolishedArea = demolishedArea.floor + demolishedArea.ceiling + demolishedArea.wall + demolishedArea.other;
    const percentage = totalStructuralArea > 0 ? (totalDemolishedArea / totalStructuralArea) * 100 : 0;

    return {
      totalArea,
      demolishedArea,
      totalStructuralArea,
      totalDemolishedArea,
      percentage: Math.min(percentage, 100)
    };
  }, []);

  // Get appropriate display unit for surface type - memoized
  const getSurfaceDisplayUnit = useCallback((surfaceType) => {
    const unitMapping = {
      // Structural Surfaces
      'floor': 'sq ft',
      'ceiling': 'sq ft', 
      'wall': 'sq ft',
      
      // Finishes
      'countertop': 'sq ft',
      'backsplash': 'sq ft',
      'trim': 'linear ft',
      'door': 'each',
      'window': 'each',
      
      // Fixtures & Equipment
      'cabinet': 'each',
      'vanity': 'each',
      'fixture': 'each',
      
      // Other
      'other': 'sq ft'
    };
    
    return unitMapping[surfaceType?.toLowerCase()] || 'sq ft';
  }, []);

  // Get material for specific surface type from Material Scope data - memoized
  const getMaterialForSurfaceType = useCallback((surfaceType, roomData) => {
    if (!materialScopeData) return '';
    
    // Surface type to material scope mapping
    const typeMapping = {
      'floor': 'Floor',
      'wall': 'wall',
      'ceiling': 'ceiling',
      'trim': 'Baseboard', // Use baseboard for general trim
      'cabinet': 'cabinet', // If defined in material scope
      'countertop': 'countertop' // If defined in material scope
    };
    
    const materialKey = typeMapping[surfaceType];
    if (!materialKey) return '';
    
    // First, check if this room has material override
    if (roomData && roomData.use_default_material === 'N') {
      const overrideMaterial = roomData.material_override?.[materialKey];
      const overrideMaterialArray = ensureArray(overrideMaterial);
      if (overrideMaterialArray.length > 0 && !overrideMaterialArray.includes('N/A')) {
        return overrideMaterialArray[0]; // Return first material for backward compatibility
      }
    }
    
    // Otherwise, use default material
    const defaultMaterial = materialScopeData.default_scope?.material?.[materialKey];
    const defaultMaterialArray = ensureArray(defaultMaterial);
    if (defaultMaterialArray.length > 0 && !defaultMaterialArray.includes('N/A')) {
      return defaultMaterialArray[0]; // Return first material for backward compatibility
    }
    
    return '';
  }, [materialScopeData, ensureArray]);

  // Get current room's material data - memoized
  const getCurrentRoomMaterialData = useCallback(() => {
    if (!selectedRoom || !materialScopeData?.locations) return null;
    
    const locationData = materialScopeData.locations[selectedRoom.locationIndex];
    return locationData?.rooms[selectedRoom.roomIndex] || null;
  }, [selectedRoom, materialScopeData]);

  // Generate unique ID for surfaces - memoized with counter for uniqueness
  const idCounterRef = useRef(0);
  const generateSurfaceId = useCallback(() => {
    idCounterRef.current += 1;
    return `surface_${Date.now()}_${idCounterRef.current}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Track last add time and prevent duplicate additions
  const lastAddTimeRef = useRef(0);
  const [isAddingSurface, setIsAddingSurface] = useState(false);
  
  const addDemoedSurface = useCallback((locationName, roomIndex) => {
    const now = Date.now();
    
    // Check if already in the process of adding a surface
    if (isAddingSurface) {
      console.log('⏰ Add Surface ignored - already processing');
      return;
    }
    
    // Prevent rapid consecutive clicks (500ms debounce)
    if (now - lastAddTimeRef.current < 500) {
      console.log('⏰ Add Surface ignored - too rapid');
      return;
    }
    
    // Set flags to prevent duplicate processing
    setIsAddingSurface(true);
    lastAddTimeRef.current = now;
    
    console.log('🎯 Add Surface clicked for:', locationName, roomIndex);
    
    // Get current room's material data outside of setState
    const roomMaterialData = getCurrentRoomMaterialData();
    const autoMaterial = getMaterialForSurfaceType('floor', roomMaterialData);
    const surfaceId = generateSurfaceId();
    
    const newSurface = {
      id: surfaceId,
      type: '',  // Start with empty type so user must select
      name: '',
      description: '',
      material: '',  // Start with empty material
      area_sqft: 0.00,
      count: 1,  // Default count for count-based surfaces
      unit_type: 'area',  // Will be updated when type is selected
      calc_method: 'full',
      full_area: 0.00,
      percentage: 100,
      percentage_area: 0.00,
      partial_description: '',
      partial_area: 0.00
    };
    
    setDemoedScope(prev => {
      // Deep clone to ensure React detects changes
      const newScope = JSON.parse(JSON.stringify(prev));
      
      if (!newScope[locationName]) {
        newScope[locationName] = [];
      }
      
      if (!newScope[locationName][roomIndex]) {
        console.log('❌ Room not found at index:', locationName, roomIndex);
        console.log('Current scope:', newScope);
        // Initialize the room if it doesn't exist
        newScope[locationName][roomIndex] = {
          surfaces: []
        };
      }
      
      if (!newScope[locationName][roomIndex].surfaces) {
        newScope[locationName][roomIndex].surfaces = [];
      }
      
      // Check if surface with same ID already exists
      const existingSurface = newScope[locationName][roomIndex].surfaces.find(s => s.id === surfaceId);
      if (existingSurface) {
        console.log('❌ Surface already exists:', surfaceId);
        setIsAddingSurface(false); // Reset flag on duplicate
        return prev;
      }
      
      // Add the new surface
      newScope[locationName][roomIndex].surfaces.push(newSurface);
      console.log('✅ Surface added:', surfaceId, 'Total surfaces:', newScope[locationName][roomIndex].surfaces.length);
      console.log('Updated scope:', newScope);
      
      // Reset flag after successful addition
      setTimeout(() => {
        setIsAddingSurface(false);
      }, 100);
      
      return newScope;
    });
  }, [getCurrentRoomMaterialData, getMaterialForSurfaceType, generateSurfaceId, isAddingSurface]);

  // Update demo'd surface - memoized
  const updateDemoedSurface = useCallback((locationName, roomIndex, surfaceId, field, value) => {
    setDemoedScope(prev => {
      const newScope = { ...prev };
      if (!newScope[locationName]?.[roomIndex]?.surfaces) return prev;
      
      const surfaceIndex = newScope[locationName][roomIndex].surfaces.findIndex(s => s.id === surfaceId);
      if (surfaceIndex === -1) return prev;
      
      const surface = newScope[locationName][roomIndex].surfaces[surfaceIndex];
      
      // If changing surface type, auto-fill material and update unit type
      if (field === 'type') {
        // Auto-fill material from Material Scope when surface type changes
        const roomMaterialData = getCurrentRoomMaterialData();
        const autoMaterial = getMaterialForSurfaceType(value, roomMaterialData);
        if (autoMaterial) {
          surface.material = autoMaterial;
        }
        
        // Update unit type based on surface type
        surface.unit_type = getSurfaceUnitType(value);
        
        // Initialize count for count-based surfaces
        if (isCountBasedSurfaceType(value) && !surface.count) {
          surface.count = 1;
        }
      }
      
      // Handle calculation method changes
      if (field === 'calc_method') {
        const oldMethod = surface.calc_method || 'full';
        
        // Save current area_sqft to the old method's storage
        if (oldMethod === 'full') {
          surface.full_area = surface.area_sqft;
        } else if (oldMethod === 'percentage') {
          surface.percentage_area = surface.area_sqft;
        } else if (oldMethod === 'partial') {
          surface.partial_area = surface.area_sqft;
        } else if (oldMethod === 'count') {
          // Count method doesn't use area_sqft, just ensure count is set
          if (!surface.count) {
            surface.count = 1;
          }
        }
        
        // Restore area_sqft from the new method's storage or set defaults
        if (value === 'count') {
          // For count method, ensure count is set and clear area calculations
          if (!surface.count) {
            surface.count = 1;
          }
          surface.area_sqft = 0; // Count-based surfaces don't use area
        } else if (value === 'full') {
          surface.area_sqft = surface.full_area || 0;
        } else if (value === 'percentage') {
          surface.area_sqft = surface.percentage_area || 0;
        } else if (value === 'partial') {
          // For partial, start with 0 (empty) unless there's already a calculated value
          surface.area_sqft = surface.partial_area || 0;
          // If switching to partial for the first time, clear the description
          if (!surface.partial_description) {
            surface.partial_description = '';
          }
        }
      }
      
      // Handle percentage updates
      if (field === 'percentage') {
        // Don't overwrite the stored percentage value
        surface.percentage = value;
        // The area_sqft will be calculated in the UI
      }
      
      surface[field] = value;
      return newScope;
    });
  }, [getCurrentRoomMaterialData, getMaterialForSurfaceType]);

  // Remove demo'd surface - memoized
  const removeDemoedSurface = useCallback((locationName, roomIndex, surfaceId) => {
    setDemoedScope(prev => {
      const newScope = { ...prev };
      if (!newScope[locationName]?.[roomIndex]?.surfaces) return prev;
      
      newScope[locationName][roomIndex].surfaces = newScope[locationName][roomIndex].surfaces.filter(s => s.id !== surfaceId);
      return newScope;
    });
  }, []);

  // Define calculatePartialArea first
  const calculatePartialArea = useCallback(async (description, surfaceType, roomMeasurements, surfaceId, locationName, roomIndex) => {
    try {
      // Set loading state for this surface
      if (surfaceId) {
        setAiCalcLoading(prev => ({ ...prev, [surfaceId]: true }));
      }
      
      // Ensure roomMeasurements is properly formatted for the API
      const dimensions = roomMeasurements ? {
        floor_area_sqft: parseFloat(roomMeasurements.floor_area_sqft) || 0.0,
        wall_area_sqft: parseFloat(roomMeasurements.wall_area_sqft) || 0.0,
        ceiling_area_sqft: parseFloat(roomMeasurements.ceiling_area_sqft) || 0.0,
        height: parseFloat(roomMeasurements.height) || 8.0
      } : null;
      
      const requestBody = {
        description: description.trim(),
        surface_type: surfaceType,
        existing_dimensions: dimensions
      };
      
      // Validate required fields
      if (!requestBody.description) {
        throw new Error('Description is required');
      }
      if (!requestBody.surface_type) {
        throw new Error('Surface type is required');
      }
      
      
      const response = await fetch('http://localhost:8001/api/pre-estimate/calculate-area', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success && result.calculated_area > 0) {
        // Update the surface with calculated area if locationName and roomIndex are provided
        if (locationName !== undefined && roomIndex !== undefined && surfaceId) {
          updateDemoedSurface(locationName, roomIndex, surfaceId, 'partial_area', result.calculated_area);
        }
        return result.calculated_area;
      } else {
        return 0;
      }
    } catch (error) {
      console.error('Error calculating area:', error);
      alert('Failed to calculate area using AI. Please enter the value manually.');
      return 0;
    } finally {
      // Clear loading state for this surface
      if (surfaceId) {
        setAiCalcLoading(prev => {
          const newState = { ...prev };
          delete newState[surfaceId];
          return newState;
        });
      }
    }
  }, [updateDemoedSurface]);

  // Handle AI calculation for partial area
  const handleAICalculatePartialArea = useCallback(async (locationName, roomIndex, surfaceId) => {
    const surface = demoedScope[locationName]?.[roomIndex]?.surfaces?.find(s => s.id === surfaceId);
    if (!surface || !surface.partial_description) return;

    await calculatePartialArea(
      surface.partial_description,
      surface.type,
      selectedRoom.room.measurements,
      surfaceId,
      locationName,
      roomIndex
    );
  }, [demoedScope, selectedRoom]);

  // Memoized demo scope form - moved outside JSX to fix hooks order
  const demoScopeForm = useMemo(() => {
    if (!selectedRoom) return null;
    
    const locationName = selectedRoom.location;
    const roomIndex = selectedRoom.roomIndex;
    const currentDemoedRoom = demoedScope[locationName]?.[roomIndex] || { surfaces: [] };
    // availableMaterials is now directly available from useMemo

    // Calculate area comparison for visual display
    const areaComparison = calculateAreaComparison(selectedRoom.room, currentDemoedRoom.surfaces || []);
    
    return (
      <div className="space-y-6">
        {/* Area Comparison Visual */}
        {currentDemoedRoom.surfaces?.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-medium text-blue-900 mb-3">Demolition Overview</h5>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-blue-700 mb-1">
                <span>Demolished Area</span>
                <span>{areaComparison.percentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-3">
                <div 
                  className="bg-red-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(areaComparison.percentage, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Area Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-blue-600 font-medium">Total Structural</div>
                <div className="text-blue-900">{areaComparison.totalStructuralArea.toFixed(0)} sq ft</div>
              </div>
              <div>
                <div className="text-red-600 font-medium">Demolished</div>
                <div className="text-red-900">{areaComparison.totalDemolishedArea.toFixed(0)} sq ft</div>
              </div>
              <div>
                <div className="text-green-600 font-medium">Remaining</div>
                <div className="text-green-900">{(areaComparison.totalStructuralArea - areaComparison.totalDemolishedArea).toFixed(0)} sq ft</div>
              </div>
              <div>
                <div className="text-purple-600 font-medium">Surfaces Count</div>
                <div className="text-purple-900">{currentDemoedRoom.surfaces?.length || 0}</div>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="mt-3 pt-3 border-t border-blue-200">
              <div className="grid grid-cols-3 gap-4 text-xs text-blue-700">
                <div>
                  <span className="font-medium">Floor:</span> {areaComparison.demolishedArea.floor.toFixed(0)} / {areaComparison.totalArea.floor.toFixed(0)} sq ft
                </div>
                <div>
                  <span className="font-medium">Wall:</span> {areaComparison.demolishedArea.wall.toFixed(0)} / {areaComparison.totalArea.wall.toFixed(0)} sq ft
                </div>
                <div>
                  <span className="font-medium">Ceiling:</span> {areaComparison.demolishedArea.ceiling.toFixed(0)} / {areaComparison.totalArea.ceiling.toFixed(0)} sq ft
                </div>
              </div>
              {areaComparison.demolishedArea.other > 0 && (
                <div className="mt-1 text-xs text-blue-700">
                  <span className="font-medium">Fixtures & Other:</span> {areaComparison.demolishedArea.other.toFixed(0)} sq ft
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Surface Button */}
        <div className="flex justify-between items-center">
          <h4 className="text-base font-medium text-gray-900">Demolished Surfaces</h4>
          <button
            onClick={() => addDemoedSurface(locationName, roomIndex)}
            disabled={isAddingSurface}
            className="px-4 py-2 bg-green-600 text-gray-900 text-sm rounded-md hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Surface
          </button>
        </div>
        
        {/* Surface List */}
        {currentDemoedRoom.surfaces?.length === 0 ? (
          <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
            No demolished surfaces added yet. Click "Add Surface" to start.
          </div>
        ) : (
          <div className="space-y-4">
            {currentDemoedRoom.surfaces?.map((surface, surfaceIndex) => (
              <div key={surface.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h5 className="text-sm font-medium text-gray-900">
                      Surface {surfaceIndex + 1}
                      {surface.ai_analysis_ref && (
                        <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                          AI Analyzed
                        </span>
                      )}
                    </h5>
                    {surface.ai_demolition_completeness && (
                      <div className="mt-1 text-xs text-gray-600">
                        {surface.ai_demolition_completeness === 'partial' ? (
                          <span className="text-orange-600">
                            🔸 Partial demolition ({surface.ai_completion_percentage}% of total area)
                          </span>
                        ) : (
                          <span className="text-red-600">
                            🔸 Complete demolition
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeDemoedSurface(locationName, roomIndex, surface.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Surface Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Surface Type
                    </label>
                    <select
                      value={surface.type || ''}
                      onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'type', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      required
                    >
                      <option value="">Select surface type</option>
                      {Object.entries(surfaceTypeCategories).map(([categoryKey, category]) => (
                        <optgroup key={categoryKey} label={category.label}>
                          {category.types.map(type => (
                            <option key={type} value={type}>
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={surface.description || ''}
                      onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'description', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder={surface.type ? getDescriptionPlaceholder(surface.type) : 'Select surface type first'}
                    />
                  </div>
                </div>

                {/* Material Row */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Material {!surface.type && <span className="text-xs text-gray-500">(Select surface type first)</span>}
                  </label>
                  <select
                    value={surface.material || ''}
                    onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'material', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    disabled={!surface.type}
                  >
                    <option value="">
                      {surface.type ? 'Select material' : 'Select surface type first'}
                    </option>
                    {surface.type && (
                      <>
                        <option value="N/A">N/A (No material specified)</option>
                        {getMaterialsForSurface(surface.type).map(material => (
                          <option key={material} value={material}>{material}</option>
                        ))}
                        <option value="custom">Custom (specify below)</option>
                      </>
                    )}
                  </select>
                  
                  {/* Custom Material Input */}
                  {surface.material === 'custom' && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={surface.customMaterial || ''}
                        onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'customMaterial', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Enter custom material"
                        required
                      />
                    </div>
                  )}
                </div>


                {/* Quantity Method - Available for all surface types */}
                {surface.type && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantity Method
                    </label>
                    <div className="flex flex-wrap space-x-4 space-y-1">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name={`calc-method-${surface.id}`}
                          value="count"
                          checked={(surface.calc_method || 'full') === 'count'}
                          onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'calc_method', e.target.value)}
                          className="form-radio text-blue-600"
                        />
                        <span className="ml-2 text-sm">Count</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name={`calc-method-${surface.id}`}
                          value="full"
                          checked={(surface.calc_method || 'full') === 'full'}
                          onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'calc_method', e.target.value)}
                          className="form-radio text-blue-600"
                        />
                        <span className="ml-2 text-sm">Full Area</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name={`calc-method-${surface.id}`}
                          value="percentage"
                          checked={(surface.calc_method || 'full') === 'percentage'}
                          onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'calc_method', e.target.value)}
                          className="form-radio text-blue-600"
                        />
                        <span className="ml-2 text-sm">Percentage</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name={`calc-method-${surface.id}`}
                          value="partial"
                          checked={(surface.calc_method || 'full') === 'partial'}
                          onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'calc_method', e.target.value)}
                          className="form-radio text-blue-600"
                        />
                        <span className="ml-2 text-sm">Partial Area</span>
                      </label>
                    </div>
                  
                  {/* Input based on selected method */}
                  {(() => {
                    const method = surface.calc_method || 'full';
                    
                    // Get base measurement based on surface type and unit
                    const surfaceUnit = getSurfaceDisplayUnit(surface.type);
                    const baseValue = (() => {
                      const measurements = selectedRoom.room.measurements;
                      
                      switch (surfaceUnit) {
                        case 'sqft':
                          if (surface.type === 'Floor') return measurements?.floor_area_sqft || 0;
                          if (surface.type === 'Ceiling') return measurements?.ceiling_area_sqft || 0;
                          if (surface.type === 'Wall') return measurements?.wall_area_sqft || 0;
                          return 0;
                        case 'lf':
                          if (surface.type === 'Baseboard' || surface.type === 'Quarter Round') {
                            return measurements?.floor_perimeter_lf || 0;
                          }
                          return 0;
                        default:
                          return 0;
                      }
                    })();

                    if (method === 'count') {
                      return (
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Count
                          </label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="1"
                              value={surface.count || 1}
                              onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'count', parseInt(e.target.value) || 1)}
                              className="w-20 p-2 border border-gray-300 rounded-md"
                              placeholder="1"
                            />
                            <span className="text-sm text-gray-600">
                              {getSurfaceDisplayUnit(surface.type)}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    if (method === 'full') {
                      return (
                        <div className="mt-2">
                          <span className="text-sm text-gray-600">
                            Full area: {baseValue} {surfaceUnit}
                          </span>
                        </div>
                      );
                    }

                    if (method === 'percentage') {
                      return (
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Percentage of Total Area
                          </label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={surface.percentage || ''}
                              onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'percentage', parseFloat(e.target.value) || 0)}
                              className="w-20 p-2 border border-gray-300 rounded-md"
                              placeholder="0"
                            />
                            <span className="text-sm text-gray-600">
                              % of {baseValue} {surfaceUnit} = {((baseValue * (surface.percentage || 0)) / 100).toFixed(2)} {surfaceUnit}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    if (method === 'partial') {
                      return (
                        <div className="mt-2 space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Describe the demolished area
                            </label>
                            <div className="flex items-start space-x-2">
                              <textarea
                                value={surface.partial_description || ''}
                                onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'partial_description', e.target.value)}
                                className="flex-1 p-2 border border-gray-300 rounded-md"
                                rows="2"
                                placeholder="e.g., Lower 4 feet of wall tiles removed, 30% of floor area near entrance..."
                              />
                              <button
                                onClick={() => handleAICalculatePartialArea(locationName, roomIndex, surface.id)}
                                disabled={!surface.partial_description || aiCalcLoading[surface.id]}
                                className="px-3 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center whitespace-nowrap"
                              >
                                {aiCalcLoading[surface.id] ? (
                                  <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Calculating...
                                  </>
                                ) : (
                                  '🤖 AI Calculate'
                                )}
                              </button>
                            </div>
                            {!surface.partial_description && (
                              <p className="text-xs text-gray-500 mt-1">Enter a description first to enable AI calculation</p>
                            )}
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Calculated Area ({surfaceUnit})
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={surface.partial_area || ''}
                                onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'partial_area', parseFloat(e.target.value) || 0)}
                                className="w-32 p-2 border border-gray-300 rounded-md"
                                placeholder="0.00"
                              />
                              <span className="text-sm text-gray-600">{surfaceUnit}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })()}

                  {/* Calculated Area Display */}
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="text-sm">
                      <span className="font-medium text-blue-900">
                        {surface.calc_method === 'count' ? 'Count: ' : 'Calculated Area: '}
                      </span>
                      <span className="text-blue-700">
                        {(() => {
                          const method = surface.calc_method || 'full';
                          const surfaceUnit = getSurfaceDisplayUnit(surface.type);
                          
                          if (method === 'count') {
                            return `${surface.count || 1} ${surfaceUnit}`;
                          }
                          
                          if (method === 'full') {
                            const measurements = selectedRoom.room.measurements;
                            if (surface.type === 'floor') return `${measurements?.floor_area_sqft || 0} ${surfaceUnit}`;
                            if (surface.type === 'ceiling') return `${measurements?.ceiling_area_sqft || 0} ${surfaceUnit}`;
                            if (surface.type === 'wall') return `${measurements?.wall_area_sqft || 0} ${surfaceUnit}`;
                            return `0 ${surfaceUnit}`;
                          }
                          
                          if (method === 'percentage') {
                            const measurements = selectedRoom.room.measurements;
                            let baseValue = 0;
                            if (surface.type === 'floor') baseValue = measurements?.floor_area_sqft || 0;
                            if (surface.type === 'ceiling') baseValue = measurements?.ceiling_area_sqft || 0;
                            if (surface.type === 'wall') baseValue = measurements?.wall_area_sqft || 0;
                            return `${((baseValue * (surface.percentage || 0)) / 100).toFixed(2)} ${surfaceUnit}`;
                          }
                          
                          if (method === 'partial') {
                            return `${surface.partial_area || 0} ${surfaceUnit}`;
                          }
                          
                          return `0 ${surfaceUnit}`;
                        })()} 
                      </span>
                    </div>
                  </div>
                </div>
                )}

                {/* Total Quantity Display - Show for all surfaces */}
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="text-sm">
                    <span className="font-medium text-green-900">
                      Total Quantity: 
                    </span>
                    <span className="text-green-700">
                      {(() => {
                        const method = surface.calc_method || 'full';
                        const surfaceUnit = getSurfaceDisplayUnit(surface.type);
                        
                        // For count method, show the count
                        if (method === 'count') {
                          return `${surface.count || 1} ${surfaceUnit}`;
                        }
                        
                        // For area-based methods, calculate based on method
                        if (method === 'full') {
                          const measurements = selectedRoom.room.measurements;
                          if (surface.type === 'floor') return `${measurements?.floor_area_sqft || 0} ${surfaceUnit}`;
                          if (surface.type === 'ceiling') return `${measurements?.ceiling_area_sqft || 0} ${surfaceUnit}`;
                          if (surface.type === 'wall') return `${measurements?.wall_area_sqft || 0} ${surfaceUnit}`;
                          return `0 ${surfaceUnit}`;
                        }
                        
                        if (method === 'percentage') {
                          const measurements = selectedRoom.room.measurements;
                          let baseValue = 0;
                          if (surface.type === 'floor') baseValue = measurements?.floor_area_sqft || 0;
                          if (surface.type === 'ceiling') baseValue = measurements?.ceiling_area_sqft || 0;
                          if (surface.type === 'wall') baseValue = measurements?.wall_area_sqft || 0;
                          return `${((baseValue * (surface.percentage || 0)) / 100).toFixed(2)} ${surfaceUnit}`;
                        }
                        
                        if (method === 'partial') {
                          return `${surface.partial_area || 0} ${surfaceUnit}`;
                        }
                        
                        return `0 ${surfaceUnit}`;
                      })()} 
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={surface.notes || ''}
                    onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'notes', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    rows="2"
                    placeholder="Additional notes about this surface..."
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [selectedRoom, demoedScope, availableMaterials, addDemoedSurface, updateDemoedSurface, removeDemoedSurface, getCurrentRoomMaterialData, getMaterialForSurfaceType, getSurfaceDisplayUnit, calculatePartialArea, handleAICalculatePartialArea, surfaceTypeCategories, getDescriptionPlaceholder, calculateAreaComparison, getMaterialsForSurface, isCountBasedSurfaceType, aiCalcLoading]);

  const loadData = async () => {
    // Load measurement data from sessionStorage first, then database
    let storedMeasurementData = sessionStorage.getItem(`measurementData_${sessionId}`);
    
    // If not in sessionStorage, try to load from database
    if (!storedMeasurementData) {
      try {
        const response = await fetch(`http://localhost:8001/api/pre-estimate/measurement/data/${sessionId}`);
        if (response.ok) {
          const apiData = await response.json();
          if (apiData.success && apiData.data && Array.isArray(apiData.data) && apiData.data.length > 0) {
            storedMeasurementData = JSON.stringify(apiData.data);
            // Save to sessionStorage for future use
            sessionStorage.setItem(`measurementData_${sessionId}`, storedMeasurementData);
          }
        }
      } catch (error) {
        // Could not load measurement data from API
      }
    }
    
    // Load material scope data
    const storedMaterialData = sessionStorage.getItem(`materialScope_${sessionId}`);
    
    if (storedMeasurementData) {
        try {
          const parsedMeasurementData = JSON.parse(storedMeasurementData);
          setMeasurementData(parsedMeasurementData);
          
          let materialData = null;
          if (storedMaterialData) {
            materialData = JSON.parse(storedMaterialData);
            setMaterialScopeData(materialData);
          }
          
          // Load existing demo scope data from database first, then fallback to sessionStorage
          let demoScopeLoaded = false;
          try {
            const savedDemoScope = await autoSaveAPI.getDemoScope(sessionId);
            if (savedDemoScope.success && savedDemoScope.demoScopeData && Object.keys(savedDemoScope.demoScopeData).length > 0) {
              // Fix any duplicate IDs in existing surfaces
              const fixedDemoScope = {};
              Object.keys(savedDemoScope.demoScopeData).forEach(locationKey => {
                fixedDemoScope[locationKey] = savedDemoScope.demoScopeData[locationKey].map(room => ({
                  ...room,
                  surfaces: (room.surfaces || []).map(surface => ({
                    ...surface,
                    id: surface.id || generateSurfaceId() // Ensure all surfaces have unique IDs
                  }))
                }));
              });
              setDemoedScope(fixedDemoScope);
              demoScopeLoaded = true;
            }
          } catch (error) {
            // Could not load demo scope from database, trying sessionStorage
          }

          if (!demoScopeLoaded) {
            // Fallback to sessionStorage
            const existingDemoScope = sessionStorage.getItem(`demoScope_${sessionId}`);
            if (existingDemoScope) {
              const parsedDemoScope = JSON.parse(existingDemoScope);
              
              // Fix any duplicate IDs in existing surfaces
              const fixedDemoScope = {};
              Object.keys(parsedDemoScope).forEach(locationKey => {
                fixedDemoScope[locationKey] = parsedDemoScope[locationKey].map(room => ({
                  ...room,
                  surfaces: (room.surfaces || []).map(surface => ({
                    ...surface,
                    id: surface.id || generateSurfaceId() // Ensure all surfaces have unique IDs
                  }))
                }));
              });
              
              setDemoedScope(fixedDemoScope);
            } else {
              // Initialize demo'd scope structure
              const initialDemoedScope = {};
              parsedMeasurementData.forEach(location => {
                initialDemoedScope[location.location] = location.rooms?.map(room => ({
                  location: room.name,
                  surfaces: []
                })) || [];
              });
              setDemoedScope(initialDemoedScope);
            }
          }
          
          // Auto-select first room
          if (parsedMeasurementData.length > 0 && parsedMeasurementData[0].rooms.length > 0) {
            const firstLocation = parsedMeasurementData[0].location;
            const firstRoom = parsedMeasurementData[0].rooms[0];
            
            setSelectedRoom({
              location: firstLocation,
              locationIndex: 0,
              room: firstRoom,
              roomIndex: 0
            });
            
            // Initialize demoedScope for the first room
            setDemoedScope(prev => {
              const newScope = { ...prev };
              if (!newScope[firstLocation]) {
                newScope[firstLocation] = [];
              }
              if (!newScope[firstLocation][0]) {
                newScope[firstLocation][0] = {
                  surfaces: []
                };
              }
              return newScope;
            });
          }
        } catch (error) {
          console.error('Error parsing stored data:', error);
        }
      }
  };

  const handleRoomSelect = useCallback((location, locationIndex, room, roomIndex) => {
    setSelectedRoom({
      location,
      locationIndex,
      room,
      roomIndex
    });
    
    // Initialize demoedScope for this room if it doesn't exist
    setDemoedScope(prev => {
      const newScope = { ...prev };
      if (!newScope[location]) {
        newScope[location] = [];
      }
      if (!newScope[location][roomIndex]) {
        newScope[location][roomIndex] = {
          surfaces: []
        };
      }
      return newScope;
    });
  }, []);

  // AI Analysis handlers - memoized
  const handleAnalysisComplete = useCallback((results) => {
    // Analysis completed - results can be handled here if needed
  }, []);

  const applyAnalysisToForm = useCallback((analysisData) => {
    
    if (!selectedRoom || !analysisData.final_data?.areas) {
      return;
    }

    const locationName = selectedRoom.location;
    const roomIndex = selectedRoom.roomIndex;
    
    // Apply each detected area as a new surface in a single update
    setDemoedScope(prev => {
      const newScope = { ...prev };
      if (!newScope[locationName]) newScope[locationName] = [];
      if (!newScope[locationName][roomIndex]) {
        newScope[locationName][roomIndex] = { location: selectedRoom.room.name, surfaces: [] };
      }
      if (!newScope[locationName][roomIndex].surfaces) {
        newScope[locationName][roomIndex].surfaces = [];
      }
      
      // Check if surfaces with this analysis_id already exist
      const existingSurfaces = newScope[locationName][roomIndex].surfaces.filter(
        s => s.ai_analysis_ref === analysisData.analysis_id
      );
      
      if (existingSurfaces.length > 0) {
        return prev; // Return previous state without changes
      }
      
      // Add all surfaces in one batch to prevent multiple re-renders
      const newSurfaces = analysisData.final_data.areas.map(area => {
        const surfaceId = generateSurfaceId();
        // Try multiple possible field names for area value
        const areaValue = parseFloat(area.area_sqft) || parseFloat(area.ai_estimated_area) || parseFloat(area.area) || 0;
        
        // Determine calculation method based on AI analysis
        const isPartialDemo = area.demolition_completeness === 'partial';
        const calcMethod = isPartialDemo ? 'partial' : 'full';
        const completionPercentage = area.completion_percentage || 100;
        const totalPossibleArea = area.total_possible_area_sqft || areaValue;
        
        return {
          id: surfaceId,
          type: area.type || area.surface_type,
          name: area.description || `AI detected ${area.type || area.surface_type}`,
          description: area.partial_description || area.description || '',
          material: area.material || area.material_removed || '',
          area_sqft: areaValue, // This is the current display value
          calc_method: calcMethod,
          full_area: isPartialDemo ? 0 : areaValue,
          percentage: isPartialDemo ? completionPercentage : 100,
          percentage_area: 0,
          partial_description: `AI analysis: ${area.partial_description || area.description}`,
          partial_area: isPartialDemo ? areaValue : 0,
          ai_analysis_ref: analysisData.analysis_id,
          ai_demolition_completeness: area.demolition_completeness || 'total',
          ai_completion_percentage: completionPercentage,
          ai_total_possible_area: totalPossibleArea
        };
      });
      
      newScope[locationName][roomIndex].surfaces.push(...newSurfaces);
      return newScope;
    });
    
    // Show success message
    alert(`AI 분석 결과가 적용되었습니다!\n${analysisData.final_data.areas.length}개 영역이 추가되었습니다.`);
    
    // Close AI analysis panel
    setShowAIAnalysis(false);
  }, [selectedRoom, generateSurfaceId]);

  const handleFeedbackSubmit = useCallback(async (feedbackData) => {
    try {
      const response = await fetch('http://localhost:8001/api/demo-analysis/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(feedbackData)
      });

      if (response.ok) {
        // Feedback submitted successfully
      }
    } catch (error) {
      // Failed to submit feedback
    }
  }, []);

  const saveData = useCallback(async () => {
    // Save to sessionStorage for backward compatibility
    sessionStorage.setItem(`demoScope_${sessionId}`, JSON.stringify(demoedScope));
    
    // Force save to database
    try {
      await autoSaveManager.forceSave(`demoScope_${sessionId}`, demoedScope);
    } catch (error) {
      console.error('Failed to save demo scope to database:', error);
    }
  }, [sessionId, demoedScope]);

  const handleNext = useCallback(async () => {
    await saveData();
    
    // Mark demo scope as completed
    const completionStatus = JSON.parse(sessionStorage.getItem(`completionStatus_${sessionId}`) || '{}');
    completionStatus.demoScope = true;
    sessionStorage.setItem(`completionStatus_${sessionId}`, JSON.stringify(completionStatus));
    
    // Save completion status to database
    try {
      await autoSaveAPI.saveProgress(sessionId, {
        stepStatuses: completionStatus
      });
    } catch (error) {
      console.error('Failed to save completion status to database:', error);
      // Continue anyway - sessionStorage will still work
    }
    
    // Navigate to work scope
    navigate(`/pre-estimate/work-scope?session=${sessionId}`);
  }, [saveData, sessionId, navigate]);

  const handleBack = useCallback(() => {
    navigate(`/pre-estimate/material-scope?session=${sessionId}`);
  }, [navigate, sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading demo scope...</p>
        </div>
      </div>
    );
  }

  if (!measurementData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No measurement data found.</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => {
                const currentSessionId = sessionId || sessionStorage.getItem('currentSessionId');
                if (currentSessionId) {
                  navigate(`/dashboard/${currentSessionId}`);
                } else {
                  navigate('/projects');
                }
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>대시보드로</span>
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Demo Scope</h1>
              <p className="text-gray-600 mt-1">
                Define areas and materials that have already been demolished
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Session: {sessionId?.slice(-8)}
              </div>
              <AutoSaveIndicator status={autoSaveStatus} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Room List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Rooms</h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {measurementData.map((location, locationIndex) => (
                  <div key={locationIndex}>
                    <div className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700 border-b border-gray-100">
                      {location.location}
                    </div>
                    {location.rooms.map((room, roomIndex) => (
                      <button
                        key={roomIndex}
                        onClick={() => handleRoomSelect(location.location, locationIndex, room, roomIndex)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                          selectedRoom?.locationIndex === locationIndex && selectedRoom?.roomIndex === roomIndex
                            ? 'bg-blue-50 border-l-4 border-l-blue-500'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{room.name}</span>
                          <span className="text-xs text-gray-500">
                            {demoedScope[location.location]?.[roomIndex]?.surfaces?.length || 0} surface(s)
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Demo Scope Editor */}
          <div className="lg:col-span-2">
            {selectedRoom ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    {selectedRoom.room.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedRoom.location} - Demolished Surfaces
                  </p>
                </div>
                <div className="p-6 space-y-6">
                  
                  <div className="text-sm text-gray-600 mb-4">
                    Configure demolition scope for surfaces that are already demolished
                  </div>

                  {/* AI Analysis Section */}
                  <div className="border-t pt-4 mt-4">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h4 className="text-base font-medium text-gray-900">
                          AI 사진 분석
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          방 사진을 업로드하여 자동으로 Demo 영역을 분석하세요
                        </p>
                      </div>
                      <button
                        onClick={() => setShowAIAnalysis(!showAIAnalysis)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          showAIAnalysis
                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-sm'
                        }`}
                      >
                        {showAIAnalysis ? '분석 닫기' : 'AI 분석 시작'}
                      </button>
                    </div>
                    
                    {showAIAnalysis && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <DemoAnalysisModule
                          roomId={selectedRoom.room.id || selectedRoom.room.name}
                          roomData={{
                            ...selectedRoom.room,
                            materialScope: getCurrentRoomMaterialData()
                          }}
                          projectId={sessionId} // Using sessionId as projectId for now
                          sessionId={sessionId}
                          onAnalysisComplete={handleAnalysisComplete}
                          onApplyToForm={applyAnalysisToForm}
                          onFeedbackSubmit={handleFeedbackSubmit}
                          mode="production"
                          config={{
                            enableFeedback: true,
                            showConfidence: true,
                            showApplyButton: true,
                            debugMode: false,
                            enableRAG: true,
                            enableBeforeAfter: true
                          }}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Demo'd Scope Form */}
                  {demoScopeForm}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <p className="text-gray-500">Select a room to configure demo scope</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <button
            onClick={handleBack}
            className="px-6 py-2 border-2 border-gray-400 text-gray-700 bg-white rounded-lg font-medium hover:bg-gray-100 shadow-sm"
          >
            ← Back to Material Scope
          </button>
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-blue-600 text-gray-900 rounded-lg font-medium hover:bg-blue-700 shadow-md"
          >
            Continue to Work Scope →
          </button>
        </div>
      </div>
    </div>
  );
});

DemoScope.displayName = 'DemoScope';

export default DemoScope;

