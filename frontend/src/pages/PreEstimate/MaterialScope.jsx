import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const MaterialScope = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session');
  
  const [measurementData, setMeasurementData] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDefaultScopeExpanded, setIsDefaultScopeExpanded] = useState(false);

  // Default scope state
  const [defaultScope, setDefaultScope] = useState({
    material: {
      Floor: "Laminate Wood",
      wall: "drywall",
      ceiling: "drywall",
      Baseboard: "wood",
      "Quarter Round": "wood"
    },
    material_underlayment: {
      Floor: "6mm foam pad"
    }
  });

  // Locations and rooms state
  const [locations, setLocations] = useState([]);

  // Load measurement data and initialize locations
  useEffect(() => {
    if (sessionId) {
      const storedData = sessionStorage.getItem(`measurementData_${sessionId}`);
      if (storedData) {
        try {
          const parsedMeasurementData = JSON.parse(storedData);
          setMeasurementData(parsedMeasurementData);
          
          // Load existing material scope data or initialize
          const existingMaterialScope = sessionStorage.getItem(`materialScope_${sessionId}`);
          if (existingMaterialScope) {
            const parsedMaterialScope = JSON.parse(existingMaterialScope);
            setDefaultScope(parsedMaterialScope.default_scope || defaultScope);
            setLocations(parsedMaterialScope.locations || []);
          } else {
            // Initialize locations based on measurement data
            const initialLocations = parsedMeasurementData.map(location => ({
              location: location.location,
              rooms: location.rooms?.map(room => ({
                name: room.name,
                use_default_material: "Y",
                material_override: {},
                material_underlayment_override: {}
              })) || []
            }));
            setLocations(initialLocations);
          }
          
          // Auto-select first room
          if (locations.length > 0 && locations[0].rooms.length > 0) {
            setSelectedRoom({
              location: locations[0].location,
              locationIndex: 0,
              room: locations[0].rooms[0],
              roomIndex: 0
            });
          }
        } catch (error) {
          console.error('Error parsing measurement data:', error);
        }
      }
    }
    setLoading(false);
  }, [sessionId]);

  // Update locations when they change
  useEffect(() => {
    if (locations.length > 0 && !selectedRoom) {
      setSelectedRoom({
        location: locations[0].location,
        locationIndex: 0,
        room: locations[0].rooms[0],
        roomIndex: 0
      });
    }
  }, [locations]);

  const handleDefaultScopeChange = (category, key, value) => {
    setDefaultScope(prev => {
      const newScope = {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value
        }
      };
      
      // If changing a material that might need underlayment, manage the underlayment field
      if (category === 'material') {
        const materialNeedsUnderlayment = needsUnderlayment(value);
        const hasUnderlayment = prev.material_underlayment && prev.material_underlayment[key];
        
        if (materialNeedsUnderlayment && !hasUnderlayment) {
          // Add default underlayment
          newScope.material_underlayment = {
            ...prev.material_underlayment,
            [key]: key.toLowerCase().includes('floor') ? '6mm foam pad' : 'standard underlayment'
          };
        } else if (!materialNeedsUnderlayment && hasUnderlayment) {
          // Remove underlayment
          const { [key]: removed, ...restUnderlayment } = prev.material_underlayment;
          newScope.material_underlayment = restUnderlayment;
        }
      }
      
      return newScope;
    });
  };

  // Materials that may need underlayment
  const materialsWithUnderlayment = ['carpet', 'laminate', 'vinyl', 'engineered hardwood', 'luxury vinyl plank'];

  // Helper function to check if material needs underlayment
  const needsUnderlayment = (materialValue) => {
    if (!materialValue) return false;
    const lowerMaterial = materialValue.toLowerCase();
    return materialsWithUnderlayment.some(material => lowerMaterial.includes(material));
  };

  const updateRoom = (locationIndex, roomIndex, field, value) => {
    const newLocations = [...locations];
    
    if (field.includes('.')) {
      const parts = field.split('.');
      let current = newLocations[locationIndex].rooms[roomIndex];
      
      // Navigate to the parent object
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      
      // Set the final value
      current[parts[parts.length - 1]] = value;
    } else {
      newLocations[locationIndex].rooms[roomIndex][field] = value;
    }
    
    setLocations(newLocations);
    
    // Update selected room if it's the same room being updated
    if (selectedRoom && selectedRoom.locationIndex === locationIndex && selectedRoom.roomIndex === roomIndex) {
      setSelectedRoom({
        ...selectedRoom,
        room: newLocations[locationIndex].rooms[roomIndex]
      });
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

  const saveData = () => {
    const materialScopeData = {
      default_scope: defaultScope,
      locations: locations
    };
    
    sessionStorage.setItem(`materialScope_${sessionId}`, JSON.stringify(materialScopeData));
  };

  const handleNext = () => {
    saveData();
    
    // Mark material scope as completed
    const completionStatus = JSON.parse(sessionStorage.getItem(`completionStatus_${sessionId}`) || '{}');
    completionStatus.materialScope = true;
    sessionStorage.setItem(`completionStatus_${sessionId}`, JSON.stringify(completionStatus));
    
    // Navigate to demo scope
    navigate(`/pre-estimate/demo-scope?session=${sessionId}`);
  };

  const handleBack = () => {
    navigate(`/pre-estimate/opening-verification?session=${sessionId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading material scope...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Material Scope</h1>
              <p className="text-gray-600 mt-1">
                Configure default materials and room-specific material overrides
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
        {/* Default Material Configuration */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div 
            className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
            onClick={() => setIsDefaultScopeExpanded(!isDefaultScopeExpanded)}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Default Material Configuration</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {isDefaultScopeExpanded 
                    ? "Set default materials that will be applied to all rooms (unless overridden)"
                    : "Click to expand and configure default materials"
                  }
                </p>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isDefaultScopeExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {isDefaultScopeExpanded && (
            <div className="p-6">
              <div className="space-y-6">
                {/* Default Materials */}
                <div>
                  <h4 className="text-base font-medium text-gray-900 mb-4">Default Materials</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(defaultScope.material).map(([key, value]) => (
                      <div key={key}>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-sm font-medium text-gray-700 capitalize">
                            {key.replace('_', ' ')}
                          </label>
                          <button
                            onClick={() => {
                              const newMaterial = { ...defaultScope.material };
                              delete newMaterial[key];
                              setDefaultScope(prev => ({ ...prev, material: newMaterial }));
                            }}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => handleDefaultScopeChange('material', key, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={`Default ${key.replace('_', ' ').toLowerCase()}`}
                        />
                        
                        {/* Show underlayment field if material needs it */}
                        {needsUnderlayment(value) && (
                          <div className="mt-2 pl-4 border-l-2 border-blue-300">
                            <label className="block text-sm font-medium text-blue-700 mb-1">
                              {key.replace('_', ' ')} Underlayment
                            </label>
                            <input
                              type="text"
                              value={defaultScope.material_underlayment?.[key] || ''}
                              onChange={(e) => handleDefaultScopeChange('material_underlayment', key, e.target.value)}
                              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50"
                              placeholder="e.g., 6mm foam pad"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add New Material */}
                <div className="pt-6 border-t border-gray-200">
                  <h5 className="text-sm font-medium text-gray-700 mb-3">Add New Material</h5>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Material name (e.g., Trim, Countertop)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                          const newKey = e.target.value.trim();
                          handleDefaultScopeChange('material', newKey, '');
                          e.target.value = '';
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input = e.target.previousElementSibling;
                        if (input.value.trim()) {
                          const newKey = input.value.trim();
                          handleDefaultScopeChange('material', newKey, '');
                          input.value = '';
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Room-specific Material Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Room List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Rooms</h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {locations.map((location, locationIndex) => (
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
                          <div className="text-xs text-gray-500">
                            {room.use_default_material === 'Y' ? 'Default' : 'Custom'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Material Editor */}
          <div className="lg:col-span-2">
            {selectedRoom ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    {selectedRoom.room.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedRoom.location} - Material Configuration
                  </p>
                </div>
                <div className="p-6 space-y-6">
                  
                  {/* Use Default Material Toggle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Use Default Material
                    </label>
                    <select
                      value={selectedRoom.room.use_default_material}
                      onChange={(e) => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, 'use_default_material', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="Y">Yes - Use Default Material</option>
                      <option value="N">No - Custom Material</option>
                    </select>
                  </div>

                  {/* Material Overrides - Show only if not using default material */}
                  {selectedRoom.room.use_default_material === 'N' && (
                    <div>
                      <h4 className="text-base font-medium text-gray-900 mb-4">Custom Materials</h4>
                      <div className="space-y-4 p-4 bg-blue-50 rounded-md border border-blue-200">
                        {Object.entries(defaultScope.material).map(([key, defaultValue]) => {
                          const currentValue = selectedRoom.room.material_override[key] || '';
                          const materialToCheck = currentValue || defaultValue;
                          const showUnderlayment = needsUnderlayment(materialToCheck);
                          const currentUnderlayment = selectedRoom.room.material_underlayment_override?.[key] || '';
                          const defaultUnderlayment = defaultScope.material_underlayment?.[key] || '';
                          
                          return (
                            <div key={key} className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                                  {key.replace('_', ' ')}
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={currentValue}
                                    onChange={(e) => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, `material_override.${key}`, e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white"
                                    placeholder={`Default: ${defaultValue}`}
                                  />
                                  {currentValue && (
                                    <button
                                      onClick={() => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, `material_override.${key}`, '')}
                                      className="text-sm text-red-600 hover:text-red-800 px-3 py-2"
                                    >
                                      Reset
                                    </button>
                                  )}
                                </div>
                                {!currentValue && (
                                  <p className="text-xs text-gray-500 mt-1">Using default: {defaultValue}</p>
                                )}
                              </div>
                              
                              {/* Underlayment field - shown conditionally */}
                              {showUnderlayment && (
                                <div className="pl-4 border-l-2 border-blue-300">
                                  <label className="block text-sm font-medium text-blue-700 mb-1">
                                    {key.replace('_', ' ')} Underlayment
                                  </label>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={currentUnderlayment}
                                      onChange={(e) => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, `material_underlayment_override.${key}`, e.target.value)}
                                      className="flex-1 px-3 py-2 border border-blue-300 rounded-md bg-blue-50"
                                      placeholder={defaultUnderlayment ? `Default: ${defaultUnderlayment}` : "e.g., 6mm foam pad"}
                                    />
                                    {currentUnderlayment && (
                                      <button
                                        onClick={() => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, `material_underlayment_override.${key}`, '')}
                                        className="text-sm text-red-600 hover:text-red-800 px-3 py-2"
                                      >
                                        Reset
                                      </button>
                                    )}
                                  </div>
                                  {!currentUnderlayment && defaultUnderlayment && (
                                    <p className="text-xs text-blue-600 mt-1">Using default: {defaultUnderlayment}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <p className="text-gray-500">Select a room to configure materials</p>
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
            ← Back to Opening Verification
          </button>
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-md"
          >
            Continue to Demo Scope →
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaterialScope;