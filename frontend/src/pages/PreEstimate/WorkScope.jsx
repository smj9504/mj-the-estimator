import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { autoSaveManager } from '../../utils/autoSave';

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
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const [showKitchenDialog, setShowKitchenDialog] = useState(false);
  const [kitchenCabinetryEnabled, setKitchenCabinetryEnabled] = useState(false);

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

  // Hidden items state (per room)
  const [hiddenItems, setHiddenItems] = useState({});

  // Custom work scope categories
  const [customCategories, setCustomCategories] = useState([]);

  // Locations and rooms state
  const [locations, setLocations] = useState([]);

  // Setup auto-save
  useEffect(() => {
    if (sessionId) {
      autoSaveManager.register(
        `workScope_${sessionId}`,
        async (data) => {
          // Save to sessionStorage (could be replaced with API call later)
          sessionStorage.setItem(`workScope_${sessionId}`, JSON.stringify(data));
          console.log('Work scope auto-saved');
        },
        {
          debounceTime: 2000,
          periodicSaveInterval: 30000,
          onStatusChange: setAutoSaveStatus
        }
      );
    }

    return () => {
      if (sessionId) {
        autoSaveManager.unregister(`workScope_${sessionId}`);
      }
    };
  }, [sessionId]);

  // Trigger auto-save when data changes
  useEffect(() => {
    if (!loading && locations.length > 0 && sessionId) {
      const workScopeData = {
        default_scope: defaultWorkScope,
        locations: locations,
        material_scope: materialScopeData,
        demo_scope: demoScopeData,
        customCategories: customCategories,
        hiddenItems: hiddenItems
      };
      
      autoSaveManager.save(`workScope_${sessionId}`, workScopeData);
    }
  }, [sessionId, defaultWorkScope, locations, materialScopeData, demoScopeData, customCategories, hiddenItems, loading]);

  // Load all required data from session storage
  useEffect(() => {
    if (sessionId) {
      // Check kitchen cabinetry status
      const kitchenEnabled = sessionStorage.getItem(`kitchenCabinetryEnabled_${sessionId}`);
      setKitchenCabinetryEnabled(kitchenEnabled === 'true');
      
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
            
            // Load custom categories if they exist
            if (parsedWorkScope.customCategories) {
              setCustomCategories(parsedWorkScope.customCategories);
            }
            
            // Load hidden items state if it exists
            if (parsedWorkScope.hiddenItems) {
              setHiddenItems(parsedWorkScope.hiddenItems);
            }
            
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
                  installation: [""],
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
    if (!newLocations[locationIndex].rooms[roomIndex].work_scope[arrayField]) {
      newLocations[locationIndex].rooms[roomIndex].work_scope[arrayField] = [];
    }
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
      demo_scope: demoScopeData,
      customCategories: customCategories,
      hiddenItems: hiddenItems
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
      
      // If kitchen cabinetry is enabled, go directly to kitchen cabinetry page
      if (kitchenCabinetryEnabled) {
        navigate(`/pre-estimate/kitchen-cabinetry?session=${sessionId}`);
      } else {
        // Show Kitchen Cabinetry dialog
        setShowKitchenDialog(true);
      }
    }
  };

  const handleKitchenDialogResponse = async (includeKitchen) => {
    setShowKitchenDialog(false);
    
    if (includeKitchen) {
      // Save kitchen cabinetry enabled status
      sessionStorage.setItem(`kitchenCabinetryEnabled_${sessionId}`, 'true');
      
      // Update in database
      try {
        const response = await fetch(`http://localhost:8001/api/pre-estimate/sessions/${sessionId}/kitchen-cabinetry-status?enabled=true`, {
          method: 'PUT'
        });
        if (!response.ok) {
          console.error('Failed to update kitchen cabinetry status in database');
        }
      } catch (error) {
        console.error('Error updating kitchen cabinetry status:', error);
      }
      
      // Navigate to Kitchen Cabinetry page
      navigate(`/pre-estimate/kitchen-cabinetry?session=${sessionId}`);
    } else {
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
            <div className="flex items-center space-x-4">
              {autoSaveStatus === 'saving' && (
                <div className="text-sm text-gray-600 flex items-center">
                  <svg className="animate-spin h-4 w-4 mr-1 text-gray-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  저장 중...
                </div>
              )}
              {autoSaveStatus === 'saved' && (
                <div className="text-sm text-green-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  자동 저장됨
                </div>
              )}
              {autoSaveStatus === 'error' && (
                <div className="text-sm text-red-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  저장 실패
                </div>
              )}
              <div className="text-sm text-gray-500">
                Session: {sessionId?.slice(-8)}
              </div>
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
                      className="px-4 py-2 bg-blue-600 text-gray-900 text-sm rounded-md hover:bg-blue-700"
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

                  {/* Additional Work Items - With hide/show functionality */}
                  {selectedRoom.room?.work_scope && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-base font-medium text-gray-900">Additional Work Items</h4>
                        <button
                          onClick={() => {
                            const roomKey = `${selectedRoom.locationIndex}-${selectedRoom.roomIndex}`;
                            const allHidden = hiddenItems[roomKey] && Object.keys(hiddenItems[roomKey]).length === 4;
                            if (allHidden) {
                              setHiddenItems(prev => ({ ...prev, [roomKey]: {} }));
                            } else {
                              setHiddenItems(prev => ({
                                ...prev,
                                [roomKey]: {
                                  protection: true,
                                  detach_reset: true,
                                  cleaning: true,
                                  installation: true
                                }
                              }));
                            }
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          {hiddenItems[`${selectedRoom.locationIndex}-${selectedRoom.roomIndex}`] && 
                           Object.keys(hiddenItems[`${selectedRoom.locationIndex}-${selectedRoom.roomIndex}`]).length === 4 
                            ? 'Show All' : 'Hide All'}
                        </button>
                      </div>
                      
                      {['protection', 'detach_reset', 'cleaning', 'installation'].map((arrayField) => {
                        const roomKey = `${selectedRoom.locationIndex}-${selectedRoom.roomIndex}`;
                        const isHidden = hiddenItems[roomKey]?.[arrayField];
                        
                        return (
                          <div key={arrayField} className={`${isHidden ? 'opacity-50' : ''}`}>
                            <div className="flex justify-between items-center mb-2">
                              <label className="block text-sm font-medium text-gray-700 capitalize">
                                {arrayField.replace('_', ' ')}
                              </label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setHiddenItems(prev => ({
                                      ...prev,
                                      [roomKey]: {
                                        ...prev[roomKey],
                                        [arrayField]: !isHidden
                                      }
                                    }));
                                  }}
                                  className="text-sm text-gray-600 hover:text-gray-800"
                                >
                                  {isHidden ? 'Show' : 'Hide'}
                                </button>
                                {!isHidden && (
                                  <button
                                    onClick={() => addArrayItem(selectedRoom.locationIndex, selectedRoom.roomIndex, arrayField)}
                                    className="px-3 py-1 bg-green-600 text-gray-900 text-sm rounded-md hover:bg-green-700"
                                  >
                                    Add
                                  </button>
                                )}
                              </div>
                            </div>
                            {!isHidden && (selectedRoom.room.work_scope[arrayField]?.map((item, itemIndex) => (
                              <div key={`${arrayField}-${itemIndex}`} className="flex gap-2 mb-2">
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
                            )) || [])}
                          </div>
                        );
                      })}
                      
                      {/* Custom Categories */}
                      {customCategories.map((category) => {
                        const roomKey = `${selectedRoom.locationIndex}-${selectedRoom.roomIndex}`;
                        const isHidden = hiddenItems[roomKey]?.[category];
                        
                        return (
                          <div key={category} className={`${isHidden ? 'opacity-50' : ''}`}>
                            <div className="flex justify-between items-center mb-2">
                              <label className="block text-sm font-medium text-gray-700 capitalize">
                                {category.replace('_', ' ')}
                              </label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setHiddenItems(prev => ({
                                      ...prev,
                                      [roomKey]: {
                                        ...prev[roomKey],
                                        [category]: !isHidden
                                      }
                                    }));
                                  }}
                                  className="text-sm text-gray-600 hover:text-gray-800"
                                >
                                  {isHidden ? 'Show' : 'Hide'}
                                </button>
                                <button
                                  onClick={() => {
                                    setCustomCategories(prev => prev.filter(cat => cat !== category));
                                    // Remove from all rooms
                                    const newLocations = [...locations];
                                    newLocations.forEach(location => {
                                      location.rooms.forEach(room => {
                                        if (room.work_scope && room.work_scope[category]) {
                                          delete room.work_scope[category];
                                        }
                                      });
                                    });
                                    setLocations(newLocations);
                                  }}
                                  className="text-sm text-red-600 hover:text-red-800"
                                >
                                  Delete Category
                                </button>
                                {!isHidden && (
                                  <button
                                    onClick={() => addArrayItem(selectedRoom.locationIndex, selectedRoom.roomIndex, category)}
                                    className="px-3 py-1 bg-green-600 text-gray-900 text-sm rounded-md hover:bg-green-700"
                                  >
                                    Add
                                  </button>
                                )}
                              </div>
                            </div>
                            {!isHidden && (selectedRoom.room.work_scope[category]?.map((item, itemIndex) => (
                              <div key={`${category}-${itemIndex}`} className="flex gap-2 mb-2">
                                <input
                                  type="text"
                                  value={item}
                                  onChange={(e) => updateArrayItem(selectedRoom.locationIndex, selectedRoom.roomIndex, category, itemIndex, e.target.value)}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                                  placeholder={`${category.replace('_', ' ')} item`}
                                />
                                <button
                                  onClick={() => removeArrayItem(selectedRoom.locationIndex, selectedRoom.roomIndex, category, itemIndex)}
                                  className="text-sm text-red-600 hover:text-red-800 px-3 py-2"
                                >
                                  Remove
                                </button>
                              </div>
                            )) || [])}
                          </div>
                        );
                      })}
                      
                      {/* Add Custom Category */}
                      <div className="pt-4 border-t border-gray-200">
                        <h5 className="text-sm font-medium text-gray-700 mb-3">Add Custom Category</h5>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Category name (e.g., electrical, plumbing)"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.target.value.trim()) {
                                const newCategory = e.target.value.trim().toLowerCase().replace(/ /g, '_');
                                if (!customCategories.includes(newCategory) && 
                                    !['protection', 'detach_reset', 'cleaning', 'installation'].includes(newCategory)) {
                                  setCustomCategories(prev => [...prev, newCategory]);
                                  // Initialize the category for all rooms
                                  const newLocations = [...locations];
                                  newLocations.forEach(location => {
                                    location.rooms.forEach(room => {
                                      if (room.work_scope && !room.work_scope[newCategory]) {
                                        room.work_scope[newCategory] = [""];
                                      }
                                    });
                                  });
                                  setLocations(newLocations);
                                  e.target.value = '';
                                }
                              }
                            }}
                          />
                          <button
                            onClick={(e) => {
                              const input = e.target.previousElementSibling;
                              if (input.value.trim()) {
                                const newCategory = input.value.trim().toLowerCase().replace(/ /g, '_');
                                if (!customCategories.includes(newCategory) && 
                                    !['protection', 'detach_reset', 'cleaning', 'installation'].includes(newCategory)) {
                                  setCustomCategories(prev => [...prev, newCategory]);
                                  // Initialize the category for all rooms
                                  const newLocations = [...locations];
                                  newLocations.forEach(location => {
                                    location.rooms.forEach(room => {
                                      if (room.work_scope && !room.work_scope[newCategory]) {
                                        room.work_scope[newCategory] = [""];
                                      }
                                    });
                                  });
                                  setLocations(newLocations);
                                  input.value = '';
                                }
                              }
                            }}
                            className="px-4 py-2 bg-blue-600 text-gray-900 text-sm rounded-md hover:bg-blue-700"
                          >
                            Add Category
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

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
{kitchenCabinetryEnabled ? 'Continue to Kitchen Cabinetry' : 'Complete Work Scope'}
              </button>
            </div>
          </div>
        )}

        {/* Kitchen Cabinetry Dialog */}
        {showKitchenDialog && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="bg-blue-100 rounded-full p-3">
                    <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                  Kitchen Cabinetry Scope
                </h3>
                
                <p className="text-gray-600 text-center mb-6">
                  이 프로젝트에 Kitchen Cabinetry 작업이 포함되어 있습니까?
                </p>
                
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    Kitchen Cabinetry를 포함하면:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-blue-700">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>여러 장의 주방 사진을 업로드할 수 있습니다</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>AI가 캐비닛 종류와 사양을 자동으로 분석합니다</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>나중에 언제든지 롤백할 수 있습니다</span>
                    </li>
                  </ul>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleKitchenDialogResponse(false)}
                    className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    아니요, 건너뛰기
                  </button>
                  <button
                    onClick={() => handleKitchenDialogResponse(true)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    네, 포함하기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkScope;