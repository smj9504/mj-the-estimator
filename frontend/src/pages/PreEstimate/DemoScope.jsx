import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DemoAnalysisModule from '../../components/DemoAnalysis/DemoAnalysisModule';
import { autoSaveManager, autoSaveAPI } from '../../utils/autoSave';
import AutoSaveIndicator from '../../components/AutoSaveIndicator';

const DemoScope = () => {
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
  const [analysisResults, setAnalysisResults] = useState(null);
  const [appliedAnalyses, setAppliedAnalyses] = useState(new Set());

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');

  // Setup auto-save
  useEffect(() => {
    if (sessionId) {
      const autoSave = autoSaveManager.register(
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
            console.log('Loaded measurement data from database');
          }
        }
      } catch (error) {
        console.log('Could not load measurement data from API:', error);
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
              console.log('Loaded demo scope from database');
            }
          } catch (error) {
            console.log('Could not load demo scope from database, trying sessionStorage');
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
              console.log('Loaded demo scope from sessionStorage');
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
              console.log('Initialized new demo scope structure');
            }
          }
          
          // Auto-select first room
          if (parsedMeasurementData.length > 0 && parsedMeasurementData[0].rooms.length > 0) {
            setSelectedRoom({
              location: parsedMeasurementData[0].location,
              locationIndex: 0,
              room: parsedMeasurementData[0].rooms[0],
              roomIndex: 0
            });
          }
        } catch (error) {
          console.error('Error parsing stored data:', error);
        }
      }
  };

  // Available surface types
  const surfaceTypes = [
    'ceiling', 'floor', 'wall', 'vanity', 'toilet', 'cabinet', 
    'trim', 'door', 'window', 'countertop', 'backsplash'
  ];

  // Get appropriate unit for surface type
  const getSurfaceUnit = (surfaceType) => {
    const unitMapping = {
      'floor': 'sq ft',
      'ceiling': 'sq ft', 
      'wall': 'sq ft',
      'countertop': 'sq ft',
      'backsplash': 'sq ft',
      'trim': 'linear ft',
      'baseboard': 'linear ft',
      'quarter_round': 'linear ft',
      'door': 'each',
      'window': 'each',
      'cabinet': 'each',
      'vanity': 'each',
      'toilet': 'each'
    };
    
    return unitMapping[surfaceType?.toLowerCase()] || 'sq ft';
  };

  // Helper function to ensure array format for materials
  const ensureArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === '') return [];
    return [value];
  };

  // Get available materials from material scope data
  const getAvailableMaterials = () => {
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
  };

  // Get material for specific surface type from Material Scope data
  const getMaterialForSurfaceType = (surfaceType, roomData) => {
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
  };

  // Get current room's material data
  const getCurrentRoomMaterialData = () => {
    if (!selectedRoom || !materialScopeData?.locations) return null;
    
    const locationData = materialScopeData.locations[selectedRoom.locationIndex];
    return locationData?.rooms[selectedRoom.roomIndex] || null;
  };

  // Generate unique ID for surfaces
  const generateSurfaceId = () => {
    return `surface_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Track pending surface additions to prevent React Strict Mode duplicates
  const pendingAdditionsRef = useRef(new Set());
  
  const addDemoedSurface = (locationName, roomIndex) => {
    const executionId = `${locationName}_${roomIndex}_${Date.now()}_${Math.random()}`;
    console.log('🔵 addDemoedSurface called - executionId:', executionId);
    
    // Create a unique key for this add operation
    const addKey = `${locationName}_${roomIndex}`;
    
    // Check if an addition is already pending for this location/room
    if (pendingAdditionsRef.current.has(addKey)) {
      console.log('🟡 Addition already pending for:', addKey, '- ignoring duplicate');
      return;
    }
    
    // Mark this addition as pending
    pendingAdditionsRef.current.add(addKey);
    console.log('🟢 Added to pending set:', addKey);
    
    // Get current room's material data outside of setState
    const roomMaterialData = getCurrentRoomMaterialData();
    const autoMaterial = getMaterialForSurfaceType('floor', roomMaterialData);
    const surfaceId = generateSurfaceId();
    
    const newSurface = {
      id: surfaceId,
      type: 'floor',
      name: '',
      material: autoMaterial,
      area_sqft: 0.00,
      calc_method: 'full',
      full_area: 0.00,
      percentage: 100,
      percentage_area: 0.00,
      partial_description: '',
      partial_area: 0.00
    };
    
    console.log('✅ Creating new surface with ID:', surfaceId);
    
    setDemoedScope(prev => {
      console.log('🔍 Current surfaces count before add:', prev[locationName]?.[roomIndex]?.surfaces?.length || 0);
      
      const newScope = { ...prev };
      if (!newScope[locationName]) newScope[locationName] = [];
      if (!newScope[locationName][roomIndex]) {
        console.log('🔴 Room not found, removing from pending and cancelling');
        pendingAdditionsRef.current.delete(addKey);
        return prev;
      }
      
      if (!newScope[locationName][roomIndex].surfaces) {
        newScope[locationName][roomIndex].surfaces = [];
      }
      
      // Double-check: ensure no duplicate IDs exist
      const existingSurface = newScope[locationName][roomIndex].surfaces.find(s => s.id === surfaceId);
      if (existingSurface) {
        console.log('🚫 Surface with same ID already exists, removing from pending and skipping');
        pendingAdditionsRef.current.delete(addKey);
        return prev;
      }
      
      newScope[locationName][roomIndex].surfaces.push(newSurface);
      console.log('📊 New surfaces count after add:', newScope[locationName][roomIndex].surfaces.length);
      
      return newScope;
    });
    
    // Remove from pending set after state update
    setTimeout(() => {
      console.log('🔄 Removing from pending set:', addKey);
      pendingAdditionsRef.current.delete(addKey);
    }, 50);
  };

  // Update demo'd surface
  const updateDemoedSurface = (locationName, roomIndex, surfaceId, field, value) => {
    setDemoedScope(prev => {
      const newScope = { ...prev };
      if (!newScope[locationName]?.[roomIndex]?.surfaces) return prev;
      
      const surfaceIndex = newScope[locationName][roomIndex].surfaces.findIndex(s => s.id === surfaceId);
      if (surfaceIndex === -1) return prev;
      
      const surface = newScope[locationName][roomIndex].surfaces[surfaceIndex];
      
      // If changing surface type, auto-fill material
      if (field === 'type') {
        // Auto-fill material from Material Scope when surface type changes
        const roomMaterialData = getCurrentRoomMaterialData();
        const autoMaterial = getMaterialForSurfaceType(value, roomMaterialData);
        if (autoMaterial) {
          surface.material = autoMaterial;
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
        }
        
        // Restore area_sqft from the new method's storage
        if (value === 'full') {
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
  };

  // Remove demo'd surface
  const removeDemoedSurface = (locationName, roomIndex, surfaceId) => {
    setDemoedScope(prev => {
      const newScope = { ...prev };
      if (!newScope[locationName]?.[roomIndex]?.surfaces) return prev;
      
      newScope[locationName][roomIndex].surfaces = newScope[locationName][roomIndex].surfaces.filter(s => s.id !== surfaceId);
      return newScope;
    });
  };

  const calculatePartialArea = async (description, surfaceType, roomMeasurements, surfaceId) => {
    try {
      console.log('Calculating area for:', { description, surfaceType, roomMeasurements });
      
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
      
      console.log('Sending request body:', requestBody);
      
      const response = await fetch('http://localhost:8001/api/pre-estimate/calculate-area', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }

      const result = await response.json();
      console.log('AI calculation result:', result);
      
      if (result.success) {
        console.log('✅ AI calculation successful');
        console.log('📊 Calculated area:', result.calculated_area);
        if (result.calculated_area > 0) {
          return result.calculated_area;
        } else {
          console.warn('⚠️ AI returned 0 area - description might be unclear or AI couldn\'t parse it');
          console.log('🔍 Original description:', result.description);
          console.log('🏷️ Surface type:', result.surface_type);
          return 0;
        }
      } else {
        console.error('❌ AI calculation failed');
        console.error('📋 Full response:', result);
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
  };

  const handleRoomSelect = (location, locationIndex, room, roomIndex) => {
    setSelectedRoom({
      location,
      locationIndex,
      room,
      roomIndex
    });
  };

  // AI Analysis handlers
  const handleAnalysisComplete = (results) => {
    setAnalysisResults(results);
  };

  const applyAnalysisToForm = useCallback((analysisData) => {
    console.log('🔧 applyAnalysisToForm called with:', analysisData.analysis_id);
    console.log('📊 Full analysis data:', analysisData);
    console.log('🔍 Areas data:', analysisData.final_data?.areas);
    
    if (!selectedRoom || !analysisData.final_data?.areas) {
      console.log('❌ Missing data - selectedRoom or areas');
      return;
    }

    // Check if this analysis was already applied
    if (appliedAnalyses.has(analysisData.analysis_id)) {
      console.log('⚠️ Analysis already applied:', analysisData.analysis_id);
      alert('이 분석 결과는 이미 적용되었습니다.');
      return;
    }

    const locationName = selectedRoom.location;
    const roomIndex = selectedRoom.roomIndex;
    
    console.log('📍 Applying to:', locationName, 'room index:', roomIndex);
    console.log('🔢 Areas to add:', analysisData.final_data.areas.length);
    
    // Mark this analysis as applied FIRST to prevent double execution
    setAppliedAnalyses(prev => {
      const newSet = new Set([...prev, analysisData.analysis_id]);
      console.log('🔒 Marked as applied:', analysisData.analysis_id);
      return newSet;
    });
    
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
        console.log('⚠️ Surfaces with this analysis_id already exist, skipping');
        return prev; // Return previous state without changes
      }
      
      // Add all surfaces in one batch to prevent multiple re-renders
      const newSurfaces = analysisData.final_data.areas.map(area => {
        const surfaceId = generateSurfaceId();
        // Try multiple possible field names for area value
        const areaValue = parseFloat(area.area_sqft) || parseFloat(area.ai_estimated_area) || parseFloat(area.area) || 0;
        console.log('➕ Creating surface:', surfaceId, 'for area:', area.type, 'area_sqft:', areaValue);
        console.log('🔍 Raw area data:', area);
        return {
          id: surfaceId,
          type: area.type,
          name: area.description || `AI detected ${area.type}`,
          material: area.material || '',
          area_sqft: areaValue, // This is the current display value
          calc_method: 'partial',
          full_area: 0,
          percentage: 100,
          percentage_area: 0,
          partial_description: `AI analysis: ${area.description}`,
          partial_area: areaValue, // Store the AI calculated value
          ai_analysis_ref: analysisData.analysis_id
        };
      });
      
      const beforeCount = newScope[locationName][roomIndex].surfaces.length;
      newScope[locationName][roomIndex].surfaces.push(...newSurfaces);
      const afterCount = newScope[locationName][roomIndex].surfaces.length;
      
      console.log('📊 Surface count before:', beforeCount, 'after:', afterCount);
      console.log('✅ Added surfaces with area values:', newSurfaces.map(s => ({
        id: s.id,
        type: s.type,
        area_sqft: s.area_sqft,
        partial_area: s.partial_area,
        calc_method: s.calc_method
      })));
      return newScope;
    });
    
    // Show success message
    alert(`AI 분석 결과가 적용되었습니다!\n${analysisData.final_data.areas.length}개 영역이 추가되었습니다.`);
    
    // Close AI analysis panel
    setShowAIAnalysis(false);
  }, [selectedRoom, appliedAnalyses]);

  const handleFeedbackSubmit = async (feedbackData) => {
    try {
      const response = await fetch('http://localhost:8001/api/demo-analysis/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(feedbackData)
      });

      if (response.ok) {
        console.log('Feedback submitted successfully');
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const saveData = async () => {
    // Save to sessionStorage for backward compatibility
    sessionStorage.setItem(`demoScope_${sessionId}`, JSON.stringify(demoedScope));
    
    // Force save to database
    try {
      await autoSaveManager.forceSave(`demoScope_${sessionId}`, demoedScope);
      console.log('Demo scope saved to database successfully');
    } catch (error) {
      console.error('Failed to save demo scope to database:', error);
    }
  };

  const handleNext = async () => {
    await saveData();
    
    // Mark demo scope as completed
    const completionStatus = JSON.parse(sessionStorage.getItem(`completionStatus_${sessionId}`) || '{}');
    completionStatus.demoScope = true;
    sessionStorage.setItem(`completionStatus_${sessionId}`, JSON.stringify(completionStatus));
    
    // Navigate to work scope
    navigate(`/pre-estimate/work-scope?session=${sessionId}`);
  };

  const handleBack = () => {
    navigate(`/pre-estimate/material-scope?session=${sessionId}`);
  };

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
                          roomData={selectedRoom.room}
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
                            debugMode: false
                          }}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Demo'd Scope Form */}
                  {(() => {
                    const locationName = selectedRoom.location;
                    const roomIndex = selectedRoom.roomIndex;
                    const currentDemoedRoom = demoedScope[locationName]?.[roomIndex];
                    const availableMaterials = getAvailableMaterials();
                    
                    if (!currentDemoedRoom) return <div>No demo scope data available</div>;
                    
                    return (
                      <div className="space-y-6">
                        {/* Add Surface Button */}
                        <div className="flex justify-between items-center">
                          <h4 className="text-base font-medium text-gray-900">Demolished Surfaces</h4>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              addDemoedSurface(locationName, roomIndex);
                            }}
                            className="px-4 py-2 bg-green-600 text-gray-900 text-sm rounded-md hover:bg-green-700 font-medium transition-colors"
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
                                  <h5 className="text-sm font-medium text-gray-900">
                                    Surface {surfaceIndex + 1}
                                  </h5>
                                  <button
                                    onClick={() => removeDemoedSurface(locationName, roomIndex, surface.id)}
                                    className="text-sm text-red-600 hover:text-red-800"
                                  >
                                    Remove
                                  </button>
                                </div>
                                
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {/* Surface Type */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Type
                                    </label>
                                    <input
                                      type="text"
                                      list={`surface-types-${surface.id}`}
                                      value={surface.type || 'floor'}
                                      onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'type', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm capitalize"
                                      placeholder="Select or type surface type"
                                    />
                                    <datalist id={`surface-types-${surface.id}`}>
                                      {surfaceTypes.map(type => (
                                        <option key={type} value={type} />
                                      ))}
                                    </datalist>
                                  </div>
                                  
                                  {/* Surface Name */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Name/Description
                                    </label>
                                    <input
                                      type="text"
                                      value={surface.name || ''}
                                      onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'name', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                      placeholder="e.g., Tile Floor, Oak Vanity"
                                    />
                                  </div>
                                  
                                  {/* Material */}
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <label className="text-sm font-medium text-gray-700">
                                        Material
                                      </label>
                                      {(() => {
                                        // Show "From Material Scope" tag when auto-filled
                                        const roomMaterialData = getCurrentRoomMaterialData();
                                        const autoMaterial = getMaterialForSurfaceType(surface.type, roomMaterialData);
                                        const isAutoFilled = autoMaterial && surface.material === autoMaterial;
                                        
                                        return isAutoFilled ? (
                                          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                            From Material Scope
                                          </span>
                                        ) : null;
                                      })()}
                                    </div>
                                    <div className="relative">
                                      <input
                                        type="text"
                                        list={`materials-${surface.id}`}
                                        value={surface.material || ''}
                                        onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'material', e.target.value)}
                                        className={`w-full px-3 py-2 border rounded-md text-sm ${
                                          (() => {
                                            const roomMaterialData = getCurrentRoomMaterialData();
                                            const autoMaterial = getMaterialForSurfaceType(surface.type, roomMaterialData);
                                            const isAutoFilled = autoMaterial && surface.material === autoMaterial;
                                            return isAutoFilled 
                                              ? 'border-blue-300 bg-blue-50' 
                                              : 'border-gray-300';
                                          })()
                                        }`}
                                        placeholder="Select or type material"
                                      />
                                      <datalist id={`materials-${surface.id}`}>
                                        {availableMaterials.map(material => (
                                          <option key={material} value={material} />
                                        ))}
                                      </datalist>
                                      {(() => {
                                        // Show refresh button to re-apply material from Material Scope
                                        const roomMaterialData = getCurrentRoomMaterialData();
                                        const autoMaterial = getMaterialForSurfaceType(surface.type, roomMaterialData);
                                        
                                        return autoMaterial && surface.material !== autoMaterial ? (
                                          <button
                                            type="button"
                                            onClick={() => updateDemoedSurface(locationName, roomIndex, surface.id, 'material', autoMaterial)}
                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-600 hover:text-blue-800 p-1"
                                            title={`Apply material from Material Scope: ${autoMaterial}`}
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                          </button>
                                        ) : null;
                                      })()}
                                    </div>
                                    {(() => {
                                      // Show available material from Material Scope if not auto-filled
                                      const roomMaterialData = getCurrentRoomMaterialData();
                                      const autoMaterial = getMaterialForSurfaceType(surface.type, roomMaterialData);
                                      const isAutoFilled = autoMaterial && surface.material === autoMaterial;
                                      
                                      return autoMaterial && !isAutoFilled ? (
                                        <div className="mt-1 text-xs text-gray-500">
                                          Available from Material Scope: <span className="font-medium text-blue-600">{autoMaterial}</span>
                                          <button
                                            type="button"
                                            onClick={() => updateDemoedSurface(locationName, roomIndex, surface.id, 'material', autoMaterial)}
                                            className="ml-2 text-blue-600 hover:text-blue-800 underline"
                                          >
                                            Apply
                                          </button>
                                        </div>
                                      ) : null;
                                    })()}
                                  </div>
                                  
                                  </div>
                                  
                                  {/* Removal Scope Section */}
                                  <div>
                                    {/* Removal Scope */}
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Removal Scope
                                      </label>
                                      
                                      {/* Calculation Method Selection */}
                                      <div className="space-y-3">
                                        <div className="flex flex-wrap gap-2 mb-3">
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
                                          const surfaceUnit = getSurfaceUnit(surface.type);
                                          const baseValue = (() => {
                                            const measurements = selectedRoom.room.measurements;
                                            
                                            switch (surfaceUnit) {
                                              case 'sq ft':
                                                if (surface.type === 'floor') {
                                                  return measurements?.floor_area_sqft || 0;
                                                } else if (surface.type === 'ceiling') {
                                                  return measurements?.ceiling_area_sqft || measurements?.floor_area_sqft || 0;
                                                } else if (surface.type === 'wall') {
                                                  return measurements?.wall_area_sqft || 0;
                                                } else if (surface.type === 'countertop') {
                                                  return measurements?.floor_area_sqft * 0.1 || 0; // estimate countertop area
                                                } else if (surface.type === 'backsplash') {
                                                  return measurements?.floor_perimeter_lf * 2 || 0; // 2ft height backsplash
                                                }
                                                return 0;
                                                
                                              case 'linear ft':
                                                if (surface.type === 'trim' || surface.type === 'baseboard' || surface.type === 'quarter_round') {
                                                  return measurements?.floor_perimeter_lf || 0;
                                                }
                                                return 0;
                                                
                                              case 'each':
                                                if (surface.type === 'door') {
                                                  return measurements?.openings?.filter(o => o.type === 'door').length || 2;
                                                } else if (surface.type === 'window') {
                                                  return measurements?.openings?.filter(o => o.type === 'window').length || 3;
                                                } else if (surface.type === 'cabinet' || surface.type === 'vanity') {
                                                  return 1; // typically 1 set per room
                                                }
                                                return 1;
                                                
                                              default:
                                                return 0;
                                            }
                                          })();
                                          
                                          switch (method) {
                                            case 'full':
                                              // Auto-calculate and show
                                              if (surface.area_sqft !== baseValue) {
                                                updateDemoedSurface(locationName, roomIndex, surface.id, 'area_sqft', baseValue);
                                              }
                                              return (
                                                <div className="bg-gray-50 p-3 rounded border">
                                                  <div className="text-sm text-gray-700">
                                                    <strong>Full {surface.type}:</strong> {baseValue.toFixed(surfaceUnit === 'each' ? 0 : 1)} {surfaceUnit}
                                                  </div>
                                                </div>
                                              );
                                              
                                            case 'percentage':
                                              const percentage = surface.percentage || 100;
                                              const percentageValue = (baseValue * percentage / 100);
                                              if (surface.area_sqft !== percentageValue) {
                                                updateDemoedSurface(locationName, roomIndex, surface.id, 'area_sqft', percentageValue);
                                              }
                                              return (
                                                <div className="flex items-center space-x-2">
                                                  <input
                                                    type="range"
                                                    min="1"
                                                    max="100"
                                                    value={percentage}
                                                    onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'percentage', parseInt(e.target.value))}
                                                    className="flex-1"
                                                  />
                                                  <input
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    value={percentage}
                                                    onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'percentage', parseInt(e.target.value) || 1)}
                                                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                                                  />
                                                  <span className="text-sm text-gray-600">% = {percentageValue.toFixed(surfaceUnit === 'each' ? 0 : 1)} {surfaceUnit}</span>
                                                </div>
                                              );
                                              
                                            case 'partial':
                                              return (
                                                <div className="space-y-2">
                                                  <div className="flex gap-2">
                                                    <textarea
                                                      value={surface.partial_description || ''}
                                                      onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'partial_description', e.target.value)}
                                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                                      rows="2"
                                                      placeholder="Describe the partial area (e.g., '2 feet from bottom', 'around windows and doors', 'damaged area only')"
                                                    />
                                                    <button
                                                      type="button"
                                                      onClick={async () => {
                                                        if (surface.partial_description?.trim()) {
                                                          // Call AI to calculate area from description
                                                          const calculatedValue = await calculatePartialArea(
                                                            surface.partial_description,
                                                            surface.type,
                                                            selectedRoom.room.measurements,
                                                            surface.id
                                                          );
                                                          if (calculatedValue > 0) {
                                                            updateDemoedSurface(locationName, roomIndex, surface.id, 'area_sqft', calculatedValue);
                                                          }
                                                        }
                                                      }}
                                                      disabled={!surface.partial_description?.trim() || aiCalcLoading[surface.id]}
                                                      className="px-3 py-1 bg-purple-600 text-gray-900 text-sm rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                                                      title="Use AI to calculate area from description"
                                                    >
                                                      {aiCalcLoading[surface.id] ? (
                                                        <>
                                                          <svg className="w-4 h-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                          </svg>
                                                          Processing...
                                                        </>
                                                      ) : (
                                                        <>
                                                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                                                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                          </svg>
                                                          AI Calc
                                                        </>
                                                      )}
                                                    </button>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <input
                                                      type="number"
                                                      step={surfaceUnit === 'each' ? '1' : '0.01'}
                                                      value={(() => {
                                                        const value = surface.area_sqft !== undefined && surface.area_sqft !== null ? surface.area_sqft.toString() : '';
                                                        if (surface.ai_analysis_ref) {
                                                          console.log(`🎯 Rendering AI surface ${surface.id} (${surface.type}): area_sqft=${surface.area_sqft}, partial_area=${surface.partial_area}, input_value="${value}"`);
                                                        }
                                                        return value;
                                                      })()}
                                                      onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'area_sqft', parseFloat(e.target.value) || 0)}
                                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                                      placeholder={`Enter calculated ${surfaceUnit}`}
                                                    />
                                                    <span className="text-sm text-gray-600 min-w-[60px]">{surfaceUnit}</span>
                                                  </div>
                                                </div>
                                              );
                                              
                                            default:
                                              // Default to full area calculation
                                              const defaultValue = baseValue;
                                              if (surface.area_sqft !== defaultValue) {
                                                updateDemoedSurface(locationName, roomIndex, surface.id, 'area_sqft', defaultValue);
                                              }
                                              return (
                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm text-gray-600">Full area:</span>
                                                  <span className="text-sm font-medium">{defaultValue.toFixed(surfaceUnit === 'each' ? 0 : 1)} {surfaceUnit}</span>
                                                </div>
                                              );
                                          }
                                        })()}
                                      </div>
                                    </div>
                                    </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
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
};

export default DemoScope;