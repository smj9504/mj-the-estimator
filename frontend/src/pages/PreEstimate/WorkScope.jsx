import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const WorkScope = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session');
  
  const [measurementData, setMeasurementData] = useState(null);
  const [materialScopeData, setMaterialScopeData] = useState(null);
  const [demoScopeData, setDemoScopeData] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDefaultScopeExpanded, setIsDefaultScopeExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);

  // Default work scope state
  const [defaultWorkScope, setDefaultWorkScope] = useState({
    scope_of_work: {
      Flooring: "Remove & Replace",
      Wall: "Patch",
      Ceiling: "Patch",
      Baseboard: "Remove & replace",
      "Quarter Round": "Remove & replace",
      "Paint Scope": "Wall, Ceiling, Baseboard"
    }
  });

  // Locations and rooms state
  const [locations, setLocations] = useState([]);

  // Load all required data from session storage
  useEffect(() => {
    if (sessionId) {
      // Load measurement data
      const storedMeasurementData = sessionStorage.getItem(`measurementData_${sessionId}`);
      // Load material scope data
      const storedMaterialData = sessionStorage.getItem(`materialScope_${sessionId}`);
      // Load demo scope data
      const storedDemoData = sessionStorage.getItem(`demoScope_${sessionId}`);
      
      if (storedMeasurementData) {
        try {
          const parsedMeasurementData = JSON.parse(storedMeasurementData);
          setMeasurementData(parsedMeasurementData);
          
          let materialData = null;
          if (storedMaterialData) {
            materialData = JSON.parse(storedMaterialData);
            setMaterialScopeData(materialData);
          }
          
          let demoData = null;
          if (storedDemoData) {
            demoData = JSON.parse(storedDemoData);
            setDemoScopeData(demoData);
          }
          
          // Load existing work scope data or initialize
          const existingWorkScope = sessionStorage.getItem(`workScope_${sessionId}`);
          if (existingWorkScope) {
            const parsedWorkScope = JSON.parse(existingWorkScope);
            setDefaultWorkScope(parsedWorkScope.default_scope || defaultWorkScope);
            const existingLocations = parsedWorkScope.locations || [];
            setLocations(existingLocations);
            
            // Auto-select first room if available
            if (existingLocations.length > 0 && existingLocations[0].rooms.length > 0) {
              setSelectedRoom({
                location: existingLocations[0].location,
                locationIndex: 0,
                room: existingLocations[0].rooms[0],
                roomIndex: 0
              });
            }
          } else {
            // Initialize locations based on measurement data
            const initialLocations = parsedMeasurementData.map(location => ({
              location: location.location,
              rooms: location.rooms?.map(room => ({
                name: room.name,
                use_default_workscope: "Y",
                work_scope: {
                  work_scope_override: {},
                  protection: [""],
                  detach_reset: [""],
                  cleaning: [""],
                  note: ""
                }
              })) || []
            }));
            setLocations(initialLocations);
            
            // Auto-select first room if available
            if (initialLocations.length > 0 && initialLocations[0].rooms.length > 0) {
              setSelectedRoom({
                location: initialLocations[0].location,
                locationIndex: 0,
                room: initialLocations[0].rooms[0],
                roomIndex: 0
              });
            }
          }
          
          // Auto-select first room will be handled by useEffect
        } catch (error) {
          console.error('Error parsing stored data:', error);
        }
      }
    }
    setLoading(false);
  }, [sessionId]);

  // Update locations when they change
  useEffect(() => {
    if (locations.length > 0 && !selectedRoom && locations[0].rooms.length > 0) {
      setSelectedRoom({
        location: locations[0].location,
        locationIndex: 0,
        room: locations[0].rooms[0],
        roomIndex: 0
      });
    }
  }, [locations, selectedRoom]);

  const handleDefaultScopeChange = (category, key, value) => {
    setDefaultWorkScope(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
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

  const addArrayItem = (locationIndex, roomIndex, arrayField) => {
    const newLocations = [...locations];
    newLocations[locationIndex].rooms[roomIndex].work_scope[arrayField].push("");
    setLocations(newLocations);
  };

  const updateArrayItem = (locationIndex, roomIndex, arrayField, itemIndex, value) => {
    const newLocations = [...locations];
    newLocations[locationIndex].rooms[roomIndex].work_scope[arrayField][itemIndex] = value;
    setLocations(newLocations);
    
    // Update selected room if it's the same room being updated
    if (selectedRoom && selectedRoom.locationIndex === locationIndex && selectedRoom.roomIndex === roomIndex) {
      setSelectedRoom({
        ...selectedRoom,
        room: newLocations[locationIndex].rooms[roomIndex]
      });
    }
  };

  const removeArrayItem = (locationIndex, roomIndex, arrayField, itemIndex) => {
    const newLocations = [...locations];
    newLocations[locationIndex].rooms[roomIndex].work_scope[arrayField].splice(itemIndex, 1);
    setLocations(newLocations);
    
    // Update selected room if it's the same room being updated
    if (selectedRoom && selectedRoom.locationIndex === locationIndex && selectedRoom.roomIndex === roomIndex) {
      setSelectedRoom({
        ...selectedRoom,
        room: newLocations[locationIndex].rooms[roomIndex]
      });
    }
  };

  const saveData = () => {
    const workScopeData = {
      default_scope: defaultWorkScope,
      locations: locations,
      material_scope: materialScopeData,
      demo_scope: demoScopeData
    };
    
    sessionStorage.setItem(`workScope_${sessionId}`, JSON.stringify(workScopeData));
  };

  const handleFormSubmit = async () => {
    const formattedData = {
      default_scope: defaultWorkScope,
      locations: locations,
      material_scope: materialScopeData,
      demo_scope: demoScopeData
    };
    
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/pre-estimate/work-scope', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          session_id: sessionId,
          input_data: JSON.stringify(formattedData) 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process work scope');
      }

      const result = await response.json();
      setParsedData(result.data);
      saveData();
    } catch (err) {
      setError(err.message);
      // Fallback to local data on error
      setParsedData(formattedData);
      saveData();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNext = () => {
    if (parsedData) {
      // Mark work scope as completed
      const completionStatus = JSON.parse(sessionStorage.getItem(`completionStatus_${sessionId}`) || '{}');
      completionStatus.workScope = true;
      sessionStorage.setItem(`completionStatus_${sessionId}`, JSON.stringify(completionStatus));
      
      // Navigate back to dashboard
      navigate(`/dashboard/${sessionId}`);
    }
  };

  const handleBack = () => {
    navigate(`/pre-estimate/demo-scope?session=${sessionId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading work scope...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Work Scope Configuration</h1>
              <p className="text-gray-600 mt-1">
                Configure work scope for each room
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
        {/* Default Work Scope Configuration */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div 
            className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
            onClick={() => setIsDefaultScopeExpanded(!isDefaultScopeExpanded)}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Default Work Scope Configuration</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {isDefaultScopeExpanded 
                    ? "Set default work scope that will be applied to all rooms (unless overridden)"
                    : "Click to expand and configure default work scope"
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
                {/* Default Scope of Work */}
                <div>
                  <h4 className="text-base font-medium text-gray-900 mb-4">Default Scope of Work</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(defaultWorkScope.scope_of_work).map(([key, value]) => (
                      <div key={key}>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-sm font-medium text-gray-700">
                            {key.replace('_', ' ')}
                          </label>
                          <button
                            onClick={() => {
                              const newScopeOfWork = { ...defaultWorkScope.scope_of_work };
                              delete newScopeOfWork[key];
                              setDefaultWorkScope(prev => ({ ...prev, scope_of_work: newScopeOfWork }));
                            }}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => handleDefaultScopeChange('scope_of_work', key, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={`Default ${key.replace('_', ' ').toLowerCase()}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add New Scope Item */}
                <div className="pt-6 border-t border-gray-200">
                  <h5 className="text-sm font-medium text-gray-700 mb-3">Add New Scope Item</h5>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Scope item name (e.g., Painting, Electrical)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                          const newKey = e.target.value.trim();
                          handleDefaultScopeChange('scope_of_work', newKey, '');
                          e.target.value = '';
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input = e.target.previousElementSibling;
                        if (input.value.trim()) {
                          const newKey = input.value.trim();
                          handleDefaultScopeChange('scope_of_work', newKey, '');
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

        {/* Room-specific Work Scope Configuration */}
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
                            {room.use_default_workscope === 'Y' ? 'Default' : 'Custom'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Work Scope Editor */}
          <div className="lg:col-span-2">
            {selectedRoom ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    {selectedRoom.room.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedRoom.location} - Work Scope Configuration
                  </p>
                </div>
                <div className="p-6 space-y-6">
                  
                  {/* Use Default Work Scope Toggle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Use Default Work Scope
                    </label>
                    <select
                      value={selectedRoom.room?.use_default_workscope || 'Y'}
                      onChange={(e) => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, 'use_default_workscope', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="Y">Yes - Use Default Work Scope</option>
                      <option value="N">No - Custom Work Scope</option>
                    </select>
                  </div>

                  {/* Work Scope Overrides - Show only if not using default work scope */}
                  {selectedRoom.room?.use_default_workscope === 'N' && selectedRoom.room?.work_scope && (
                    <div>
                      <h4 className="text-base font-medium text-gray-900 mb-4">Custom Work Scope</h4>
                      <div className="space-y-4 p-4 bg-green-50 rounded-md border border-green-200">
                        {Object.entries(defaultWorkScope.scope_of_work).map(([key, defaultValue]) => {
                          const currentValue = selectedRoom.room.work_scope.work_scope_override?.[key] || '';
                          return (
                            <div key={key}>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {key.replace('_', ' ')}
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={currentValue}
                                  onChange={(e) => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, `work_scope.work_scope_override.${key}`, e.target.value)}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white"
                                  placeholder={`Default: ${defaultValue}`}
                                />
                                {currentValue && (
                                  <button
                                    onClick={() => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, `work_scope.work_scope_override.${key}`, '')}
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
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Additional Work Items - Always shown */}
                  {selectedRoom.room?.work_scope && ['protection', 'detach_reset', 'cleaning'].map((arrayField) => (
                    <div key={arrayField}>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700 capitalize">
                          {arrayField.replace('_', ' ')}
                        </label>
                        <button
                          onClick={() => addArrayItem(selectedRoom.locationIndex, selectedRoom.roomIndex, arrayField)}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                        >
                          Add
                        </button>
                      </div>
                      {selectedRoom.room.work_scope[arrayField]?.map((item, itemIndex) => (
                        <div key={`${arrayField}-${itemIndex}-${Date.now()}`} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => updateArrayItem(selectedRoom.locationIndex, selectedRoom.roomIndex, arrayField, itemIndex, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                            placeholder={`${arrayField.replace('_', ' ')} item`}
                          />
                          <button
                            onClick={() => removeArrayItem(selectedRoom.locationIndex, selectedRoom.roomIndex, arrayField, itemIndex)}
                            className="text-sm text-red-600 hover:text-red-800 px-3 py-2"
                          >
                            Remove
                          </button>
                        </div>
                      )) || []}
                    </div>
                  ))}

                  {/* Note */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Note
                    </label>
                    <textarea
                      value={selectedRoom.room?.work_scope?.note || ''}
                      onChange={(e) => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, 'work_scope.note', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Additional notes..."
                    />
                  </div>
                  
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <p className="text-gray-500">Select a room to configure work scope</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-between">
          <button
            onClick={handleBack}
            className="px-6 py-2 border-2 border-gray-400 text-gray-700 bg-white rounded-lg font-medium hover:bg-gray-100 shadow-sm"
          >
            ← Back to Demo Scope
          </button>
          <button
            onClick={handleFormSubmit}
            disabled={isProcessing}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-md disabled:bg-gray-400"
          >
            {isProcessing ? 'Processing...' : 'Generate Work Scope'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Parsed Data Display */}
        {parsedData && (
          <div className="mt-8 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              Work Scope Configuration Complete
            </h3>
            
            <div className="bg-gray-50 p-4 rounded-md">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
                {JSON.stringify(parsedData, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-md"
              >
                Complete Work Scope
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkScope;