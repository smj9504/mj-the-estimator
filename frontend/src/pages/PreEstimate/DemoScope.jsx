import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const DemoScope = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session');
  
  const [measurementData, setMeasurementData] = useState(null);
  const [materialScopeData, setMaterialScopeData] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  // Demo'd scope state
  const [demoedScope, setDemoedScope] = useState({});

  // Load measurement and material scope data
  useEffect(() => {
    if (sessionId) {
      // Load measurement data
      const storedMeasurementData = sessionStorage.getItem(`measurementData_${sessionId}`);
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
          
          // Load existing demo scope data or initialize
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
    }
    setLoading(false);
  }, [sessionId]);

  // Available surface types
  const surfaceTypes = [
    'ceiling', 'floor', 'wall', 'vanity', 'toilet', 'cabinet', 
    'trim', 'door', 'window', 'countertop', 'backsplash'
  ];

  // Surface types that require insulation field
  const surfaceTypesWithInsulation = ['ceiling', 'wall', 'floor'];

  // Get available materials from material scope data
  const getAvailableMaterials = () => {
    const materials = new Set();
    
    // Add default materials from material scope
    if (materialScopeData?.default_scope?.material) {
      Object.values(materialScopeData.default_scope.material).forEach(material => {
        if (material.trim()) materials.add(material.trim());
      });
    }
    
    // Add default underlayments from material scope
    if (materialScopeData?.default_scope?.material_underlayment) {
      Object.values(materialScopeData.default_scope.material_underlayment).forEach(material => {
        if (material.trim()) materials.add(material.trim());
      });
    }
    
    // Add custom materials from selected room if available
    if (selectedRoom && materialScopeData?.locations) {
      const locationData = materialScopeData.locations[selectedRoom.locationIndex];
      const roomData = locationData?.rooms[selectedRoom.roomIndex];
      
      if (roomData?.material_override) {
        Object.values(roomData.material_override).forEach(material => {
          if (material.trim()) materials.add(material.trim());
        });
      }
      
      if (roomData?.material_underlayment_override) {
        Object.values(roomData.material_underlayment_override).forEach(material => {
          if (material.trim()) materials.add(material.trim());
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
      if (overrideMaterial && overrideMaterial !== 'N/A') {
        return overrideMaterial;
      }
    }
    
    // Otherwise, use default material
    const defaultMaterial = materialScopeData.default_scope?.material?.[materialKey];
    if (defaultMaterial && defaultMaterial !== 'N/A') {
      return defaultMaterial;
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

  // Add surface to demo'd scope
  const addDemoedSurface = (locationName, roomIndex) => {
    setDemoedScope(prev => {
      const newScope = { ...prev };
      if (!newScope[locationName]) newScope[locationName] = [];
      if (!newScope[locationName][roomIndex]) return prev;
      
      if (!newScope[locationName][roomIndex].surfaces) {
        newScope[locationName][roomIndex].surfaces = [];
      }
      
      // Get current room's material data
      const roomMaterialData = getCurrentRoomMaterialData();
      
      // Get auto-filled material for default surface type (floor)
      const autoMaterial = getMaterialForSurfaceType('floor', roomMaterialData);
      
      const newSurface = {
        id: generateSurfaceId(), // Use unique ID generator
        type: 'floor',
        name: '',
        material: autoMaterial, // Auto-fill material from Material Scope
        area_sqft: 0.00
      };
      
      // Add insulation field only for specific surface types
      if (surfaceTypesWithInsulation.includes('floor')) {
        newSurface.insulation_sqft = 0.00;
      }
      
      newScope[locationName][roomIndex].surfaces.push(newSurface);
      
      return newScope;
    });
  };

  // Update demo'd surface
  const updateDemoedSurface = (locationName, roomIndex, surfaceId, field, value) => {
    setDemoedScope(prev => {
      const newScope = { ...prev };
      if (!newScope[locationName]?.[roomIndex]?.surfaces) return prev;
      
      const surfaceIndex = newScope[locationName][roomIndex].surfaces.findIndex(s => s.id === surfaceId);
      if (surfaceIndex === -1) return prev;
      
      const surface = newScope[locationName][roomIndex].surfaces[surfaceIndex];
      
      // If changing surface type, handle insulation field and auto-fill material
      if (field === 'type') {
        const needsInsulation = surfaceTypesWithInsulation.includes(value);
        const hasInsulation = 'insulation_sqft' in surface;
        
        if (needsInsulation && !hasInsulation) {
          surface.insulation_sqft = 0.00;
        } else if (!needsInsulation && hasInsulation) {
          delete surface.insulation_sqft;
        }
        
        // Auto-fill material from Material Scope when surface type changes
        const roomMaterialData = getCurrentRoomMaterialData();
        const autoMaterial = getMaterialForSurfaceType(value, roomMaterialData);
        if (autoMaterial) {
          surface.material = autoMaterial;
        }
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

  const handleRoomSelect = (location, locationIndex, room, roomIndex) => {
    setSelectedRoom({
      location,
      locationIndex,
      room,
      roomIndex
    });
  };

  const saveData = () => {
    sessionStorage.setItem(`demoScope_${sessionId}`, JSON.stringify(demoedScope));
  };

  const handleNext = () => {
    saveData();
    
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
            <div className="text-sm text-gray-500">
              Session: {sessionId?.slice(-8)}
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
                            onClick={() => addDemoedSurface(locationName, roomIndex)}
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
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
                                
                                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${surfaceTypesWithInsulation.includes(surface.type) ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
                                  {/* Surface Type */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Type
                                    </label>
                                    <select
                                      value={surface.type || 'floor'}
                                      onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'type', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    >
                                      {surfaceTypes.map(type => (
                                        <option key={type} value={type} className="capitalize">
                                          {type}
                                        </option>
                                      ))}
                                    </select>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Material
                                      {(() => {
                                        // Check if this material comes from Material Scope
                                        const roomMaterialData = getCurrentRoomMaterialData();
                                        const autoMaterial = getMaterialForSurfaceType(surface.type, roomMaterialData);
                                        const isAutoFilled = autoMaterial && surface.material === autoMaterial;
                                        
                                        return isAutoFilled ? (
                                          <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                            From Material Scope
                                          </span>
                                        ) : null;
                                      })()}
                                    </label>
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
                                      // Show helper text for auto-filled materials
                                      const roomMaterialData = getCurrentRoomMaterialData();
                                      const autoMaterial = getMaterialForSurfaceType(surface.type, roomMaterialData);
                                      const isAutoFilled = autoMaterial && surface.material === autoMaterial;
                                      
                                      return isAutoFilled ? (
                                        <p className="text-xs text-blue-600 mt-1">
                                          This material was automatically filled from your Material Scope configuration.
                                        </p>
                                      ) : autoMaterial && surface.material !== autoMaterial ? (
                                        <p className="text-xs text-gray-500 mt-1">
                                          Available from Material Scope: <span className="font-medium text-blue-600">{autoMaterial}</span>
                                          <button
                                            type="button"
                                            onClick={() => updateDemoedSurface(locationName, roomIndex, surface.id, 'material', autoMaterial)}
                                            className="ml-2 text-blue-600 hover:text-blue-800 underline"
                                          >
                                            Apply
                                          </button>
                                        </p>
                                      ) : null;
                                    })()}
                                  </div>
                                  
                                  {/* Area */}
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Area (sq ft)
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={surface.area_sqft || 0}
                                      onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'area_sqft', parseFloat(e.target.value) || 0)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                      placeholder="0.00"
                                    />
                                  </div>
                                  
                                  {/* Insulation - Only show for specific surface types */}
                                  {surfaceTypesWithInsulation.includes(surface.type) && (
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Insulation (sq ft)
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={surface.insulation_sqft || 0}
                                        onChange={(e) => updateDemoedSurface(locationName, roomIndex, surface.id, 'insulation_sqft', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                        placeholder="0.00"
                                      />
                                    </div>
                                  )}
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
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-md"
          >
            Continue to Work Scope →
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoScope;