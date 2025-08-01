import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MaterialAnalysisModal from '../../components/MaterialAnalysisModal';

const MaterialScope = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session');
  
  const [measurementData, setMeasurementData] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDefaultScopeExpanded, setIsDefaultScopeExpanded] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);

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

  // Function to synchronize locations with measurement data while preserving existing settings
  const synchronizeLocationsWithMeasurementData = (measurementData, existingLocations) => {
    const syncedLocations = measurementData.map(locationData => {
      // Find existing location data
      const existingLocation = existingLocations.find(loc => loc.location === locationData.location);
      
      if (existingLocation) {
        // Location exists, synchronize rooms
        const syncedRooms = locationData.rooms?.map(room => {
          // Find existing room data
          const existingRoom = existingLocation.rooms.find(r => r.name === room.name);
          
          if (existingRoom) {
            // Room exists, preserve existing settings
            return existingRoom;
          } else {
            // New room, initialize with default settings
            return {
              name: room.name,
              use_default_material: "Y",
              material_override: {},
              material_underlayment_override: {}
            };
          }
        }) || [];
        
        return {
          location: locationData.location,
          rooms: syncedRooms
        };
      } else {
        // New location, initialize all rooms with default settings
        return {
          location: locationData.location,
          rooms: locationData.rooms?.map(room => ({
            name: room.name,
            use_default_material: "Y",
            material_override: {},
            material_underlayment_override: {}
          })) || []
        };
      }
    });
    
    return syncedLocations;
  };

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
            
            // Synchronize locations with current measurement data
            const syncedLocations = synchronizeLocationsWithMeasurementData(
              parsedMeasurementData, 
              parsedMaterialScope.locations || []
            );
            setLocations(syncedLocations);
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
        } catch (error) {
          console.error('Error parsing measurement data:', error);
        }
      }
    }
    setLoading(false);
  }, [sessionId]);

  // Listen for changes in measurement data from other components
  useEffect(() => {
    if (!sessionId || !measurementData) return;

    const handleStorageChange = (e) => {
      if (e.key === `measurementData_${sessionId}` && e.newValue) {
        try {
          const updatedMeasurementData = JSON.parse(e.newValue);
          
          // Only update if data actually changed
          if (JSON.stringify(updatedMeasurementData) !== JSON.stringify(measurementData)) {
            setMeasurementData(updatedMeasurementData);
            
            // Synchronize locations while preserving existing settings
            const syncedLocations = synchronizeLocationsWithMeasurementData(
              updatedMeasurementData, 
              locations
            );
            setLocations(syncedLocations);
            
            console.log('Material Scope synchronized with updated measurement data');
          }
        } catch (error) {
          console.error('Error synchronizing measurement data:', error);
        }
      }
    };

    // Listen for storage changes (works across tabs/windows)
    window.addEventListener('storage', handleStorageChange);
    
    // For same-window changes, we need a custom event listener
    const handleCustomStorageChange = (e) => {
      if (e.detail.key === `measurementData_${sessionId}`) {
        handleStorageChange({
          key: e.detail.key,
          newValue: e.detail.newValue
        });
      }
    };
    
    window.addEventListener('customStorageChange', handleCustomStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('customStorageChange', handleCustomStorageChange);
    };
  }, [sessionId, measurementData, locations]);

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

  const handleAnalysisResults = (suggestions, detectedMaterials) => {
    try {
      console.log('Applying AI analysis results:', { suggestions, detectedMaterials });
      
      // Update default scope with AI suggestions
      const newDefaultScope = { ...defaultScope };
      
      suggestions.suggestions.forEach(suggestion => {
        if (suggestion.category === 'material') {
          newDefaultScope.material = {
            ...newDefaultScope.material,
            [suggestion.field_name]: suggestion.suggested_value
          };
        } else if (suggestion.category === 'material_underlayment') {
          newDefaultScope.material_underlayment = {
            ...newDefaultScope.material_underlayment,
            [suggestion.field_name]: suggestion.suggested_value
          };
        }
      });
      
      setDefaultScope(newDefaultScope);
      
      // Show success message with applied materials
      const appliedMaterials = suggestions.suggestions.map(s => s.suggested_value).join(', ');
      alert(`AI analysis applied successfully!\n\nDetected materials: ${appliedMaterials}\n\nYou can review and adjust these materials as needed.`);
      
      // Expand default scope section to show changes
      setIsDefaultScopeExpanded(true);
      
    } catch (error) {
      console.error('Error applying analysis results:', error);
      alert('Failed to apply analysis results. Please try again.');
    }
  };

  const openAnalysisModal = () => {
    setIsAnalysisModalOpen(true);
  };

  const getRoomTypeContext = () => {
    if (!selectedRoom?.room) return null;
    
    // Try to infer room type from room name
    const roomName = selectedRoom.room.name.toLowerCase();
    
    if (roomName.includes('kitchen')) return 'kitchen';
    if (roomName.includes('bathroom') || roomName.includes('bath')) return 'bathroom';
    if (roomName.includes('bedroom') || roomName.includes('bed')) return 'bedroom';
    if (roomName.includes('living')) return 'living room';
    if (roomName.includes('dining')) return 'dining room';
    if (roomName.includes('office')) return 'office';
    if (roomName.includes('laundry')) return 'laundry room';
    
    return null;
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
              <div className="flex-1">
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
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent expanding/collapsing when clicking the button
                        openAnalysisModal();
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-colors flex items-center space-x-2 shadow-sm"
                      title="Use AI to analyze material photos and automatically identify materials"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span>AI Analysis</span>
                    </button>
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
              </div>
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
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={defaultScope.material_underlayment?.[key] || ''}
                                onChange={(e) => handleDefaultScopeChange('material_underlayment', key, e.target.value)}
                                className="flex-1 px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50"
                                placeholder="e.g., 6mm foam pad"
                              />
                              <button
                                onClick={() => handleDefaultScopeChange('material_underlayment', key, 'N/A')}
                                className={`px-3 py-2 text-sm rounded-md border ${
                                  (defaultScope.material_underlayment?.[key] || '') === 'N/A' 
                                    ? 'bg-gray-500 text-white border-gray-500' 
                                    : 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200'
                                }`}
                                title="기본값으로 underlayment가 필요하지 않음"
                              >
                                N/A
                              </button>
                            </div>
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
                          <div className="flex flex-col">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">{room.name}</span>
                              {room.is_merged && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                  Merged
                                </span>
                              )}
                            </div>
                            {room.is_merged && (
                              <div className="text-xs text-gray-600 mt-1">
                                <div>Main area + {room.sub_areas?.length || 0} sub-area(s)</div>
                                <div className="text-xs text-gray-500">
                                  Material applies to main area only
                                </div>
                              </div>
                            )}
                            {room.room_classification?.is_sub_area && !room.is_merged && (
                              <span className={`text-xs px-1 py-0.5 rounded mt-1 self-start ${
                                room.room_classification?.material_applicable 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {room.room_classification?.sub_area_type || 'Sub-area'}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {room.use_default_material === 'Y' ? 'Default' : 'Custom'}
                            {room.use_default_material === 'N' && 
                             Object.values(room.material_override || {}).some(value => value === 'N/A') && (
                              <span className="ml-1 text-orange-600">• N/A</span>
                            )}
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
                    {selectedRoom.room.room_classification?.is_sub_area && (
                      <span className={`ml-2 text-sm px-2 py-1 rounded ${
                        selectedRoom.room.room_classification?.material_applicable 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {selectedRoom.room.room_classification?.sub_area_type || 'Sub-area'}
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedRoom.location} - Material Configuration
                    {selectedRoom.room.is_merged && (
                      <span className="block text-blue-600 mt-1">
                        ℹ️ This merged room contains main area and sub-areas. Materials apply to main area only.
                      </span>
                    )}
                    {selectedRoom.room.room_classification?.is_sub_area && 
                     !selectedRoom.room.room_classification?.material_applicable && 
                     !selectedRoom.room.is_merged && (
                      <span className="block text-orange-600 mt-1">
                        ⚠️ This sub-area typically doesn't require material configuration
                      </span>
                    )}
                  </p>
                </div>
                <div className="p-6 space-y-6">
                  
                  {/* Show merged room details */}
                  {(selectedRoom.room.is_merged || selectedRoom.room.room_classification?.is_merged_room) && (
                    <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-4">
                      <h4 className="text-sm font-medium text-blue-900 mb-3">Room Composition</h4>
                      <div className="space-y-2 text-sm">
                        {/* New structure with room_classification.composition */}
                        {selectedRoom.room.room_classification?.composition && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-blue-800">Main Area ({selectedRoom.room.room_classification.composition.main_area.type}):</span>
                              <span className="font-medium">{selectedRoom.room.room_classification.composition.main_area.name} ({selectedRoom.room.room_classification.composition.main_area.area_sqft?.toFixed(1)} sq ft)</span>
                            </div>
                            {selectedRoom.room.room_classification.composition.sub_areas?.map((subArea, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="text-blue-700">Sub-area ({subArea.type}):</span>
                                <span className="font-medium">{subArea.name} ({subArea.area_sqft?.toFixed(1)} sq ft) {!subArea.material_applicable && <span className="text-orange-600">- No materials</span>}</span>
                              </div>
                            ))}
                          </>
                        )}
                        
                        {/* Legacy structure support */}
                        {!selectedRoom.room.room_classification?.composition && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-blue-800">Main Area:</span>
                              <span className="font-medium">{selectedRoom.room.name} ({selectedRoom.room.main_area?.measurements?.floor_area_sqft?.toFixed(1)} sq ft)</span>
                            </div>
                            {selectedRoom.room.sub_areas?.map((subArea, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="text-blue-700">Sub-area ({subArea.type}):</span>
                                <span className="font-medium">{subArea.measurements?.floor_area_sqft?.toFixed(1)} sq ft {!subArea.material_applicable && <span className="text-orange-600">- No materials</span>}</span>
                              </div>
                            ))}
                          </>
                        )}
                        
                        <div className="pt-2 border-t border-blue-200 flex justify-between font-medium">
                          <span className="text-blue-900">Total Area:</span>
                          <span>{selectedRoom.room.total_measurements?.floor_area_sqft?.toFixed(1) || 'Calculating...'} sq ft</span>
                        </div>
                        
                        {/* Material application note */}
                        <div className="pt-2 border-t border-blue-200 text-xs text-blue-700">
                          💡 Materials are applied to main area only. Sub-areas may have different material requirements.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Material Configuration - Hide for non-applicable sub-areas */}
                  {selectedRoom.room.room_classification?.is_sub_area && 
                   !selectedRoom.room.room_classification?.material_applicable &&
                   !selectedRoom.room.is_merged ? (
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">Material Configuration Not Required</h4>
                      <p className="text-gray-600 mb-4">
                        This {selectedRoom.room.room_classification?.sub_area_type} area typically doesn't require material configuration.
                      </p>
                      <button
                        onClick={() => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, 'use_default_material', 'N')}
                        className="text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        Override and configure materials anyway
                      </button>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}

                  {/* Material Overrides - Show only if not using default material */}
                  {selectedRoom.room.use_default_material === 'N' && (
                    <div>
                      <h4 className="text-base font-medium text-gray-900 mb-4">Custom Materials</h4>
                      <div className="space-y-4 p-4 bg-blue-50 rounded-md border border-blue-200">
                        {Object.entries(defaultScope.material).map(([key, defaultValue]) => {
                          const currentValue = selectedRoom.room.material_override[key] || '';
                          const materialToCheck = currentValue || defaultValue;
                          const showUnderlayment = currentValue !== 'N/A' && needsUnderlayment(materialToCheck);
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
                                  <button
                                    onClick={() => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, `material_override.${key}`, 'N/A')}
                                    className={`px-3 py-2 text-sm rounded-md border ${
                                      currentValue === 'N/A' 
                                        ? 'bg-gray-500 text-white border-gray-500' 
                                        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                                    }`}
                                    title="이 방에 해당 요소가 없음"
                                  >
                                    N/A
                                  </button>
                                  {currentValue && currentValue !== 'N/A' && (
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
                                {currentValue === 'N/A' && (
                                  <p className="text-xs text-orange-600 mt-1">이 방에는 해당 요소가 없습니다</p>
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
                                    <button
                                      onClick={() => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, `material_underlayment_override.${key}`, 'N/A')}
                                      className={`px-3 py-2 text-sm rounded-md border ${
                                        currentUnderlayment === 'N/A' 
                                          ? 'bg-gray-500 text-white border-gray-500' 
                                          : 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200'
                                      }`}
                                      title="이 방에 underlayment가 필요하지 않음"
                                    >
                                      N/A
                                    </button>
                                    {currentUnderlayment && currentUnderlayment !== 'N/A' && (
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
                                  {currentUnderlayment === 'N/A' && (
                                    <p className="text-xs text-orange-600 mt-1">이 방에는 underlayment가 필요하지 않습니다</p>
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

      {/* Material Analysis Modal */}
      <MaterialAnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        onApplyResults={handleAnalysisResults}
        roomType={getRoomTypeContext()}
        analysisContext={{
          focusTypes: ['floor', 'wall', 'ceiling', 'baseboard', 'quarter_round']
        }}
      />
    </div>
  );
};

export default MaterialScope;