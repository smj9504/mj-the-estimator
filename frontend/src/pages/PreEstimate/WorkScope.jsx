import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import styles from './WorkScope.module.css';

const WorkScope = ({ data, onNext, onPrevious }) => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  
  const [inputMode, setInputMode] = useState('form'); // 'form' or 'text'
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState(data || null);
  const [error, setError] = useState(null);
  const [measurementData, setMeasurementData] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  // Default scope state
  const [defaultScope, setDefaultScope] = useState({
    material: {
      Floor: "Laminate Wood",
      wall: "drywall",
      ceiling: "drywall",
      Baseboard: "wood",
      "Quarter Round": "wood"
    },
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

  // Load measurement data from session storage and initialize locations
  useEffect(() => {
    if (sessionId) {
      // Try to get measurement data from session storage
      const storedData = sessionStorage.getItem(`measurementData_${sessionId}`);
      if (storedData) {
        try {
          const parsedMeasurementData = JSON.parse(storedData);
          setMeasurementData(parsedMeasurementData);
          
          // Initialize locations based on measurement data
          const initialLocations = parsedMeasurementData.map(location => ({
            location: location.location,
            rooms: location.rooms?.map(room => ({
              name: room.name,
              material_override: {},
              work_scope: {
                use_default: "Y",
                work_scope_override: {},
                protection: [""],
                detach_reset: [""],
                cleaning: [""],
                note: ""
              }
            })) || []
          }));
          
          setLocations(initialLocations);
          
          // Auto-select first room
          if (initialLocations.length > 0 && initialLocations[0].rooms.length > 0) {
            setSelectedRoom({
              location: initialLocations[0].location,
              locationIndex: 0,
              room: initialLocations[0].rooms[0],
              roomIndex: 0
            });
          }
        } catch (error) {
          console.error('Error parsing measurement data:', error);
          setError('Failed to load measurement data');
        }
      } else {
        // Fallback to default structure if no measurement data
        const fallbackLocations = [
          {
            location: "1st Floor",
            rooms: [
              {
                name: "Kitchen",
                material_override: {},
                work_scope: {
                  use_default: "Y",
                  work_scope_override: {},
                  protection: [""],
                  detach_reset: [""],
                  cleaning: [""],
                  note: ""
                }
              }
            ]
          }
        ];
        setLocations(fallbackLocations);
        
        // Auto-select first room for fallback
        setSelectedRoom({
          location: fallbackLocations[0].location,
          locationIndex: 0,
          room: fallbackLocations[0].rooms[0],
          roomIndex: 0
        });
      }
    }
    setLoading(false);
  }, [sessionId]);

  const handleDefaultScopeChange = (category, key, value) => {
    setDefaultScope(prev => ({
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
      const [parent, child] = field.split('.');
      newLocations[locationIndex].rooms[roomIndex][parent][child] = value;
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

  const handleFormSubmit = async () => {
    const formattedData = {
      default_scope: defaultScope,
      locations: locations
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
    } catch (err) {
      setError(err.message);
      // Fallback to local data on error
      setParsedData(formattedData);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNext = () => {
    if (parsedData && onNext) {
      onNext(parsedData);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading measurement data...</p>
        </div>
      </div>
    );
  }

  if (!locations.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No rooms found for work scope configuration.</p>
          <button
            onClick={() => window.history.back()}
            className={styles.primaryButton}
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Work Scope Configuration</h1>
              <p className="text-gray-600 mt-1">
                Configure materials and work scope for each room
              </p>
            </div>
            <div className="text-sm text-gray-500">
              Session: {sessionId?.slice(-8)}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Summary */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Total Rooms: {locations.reduce((total, loc) => total + loc.rooms.length, 0)}
            </div>
            {measurementData && (
              <div className="text-sm text-green-600">
                ✓ Measurement data loaded
              </div>
            )}
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
                          <span className="text-xs text-gray-500">
                            {room.work_scope?.use_default === 'Y' ? 'Default' : 'Custom'}
                          </span>
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
                    {selectedRoom.location}
                  </p>
                </div>
                <div className="p-6 space-y-6">
                  {/* Use Default Toggle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Use Default Scope
                    </label>
                    <select
                      value={selectedRoom.room.work_scope.use_default}
                      onChange={(e) => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, 'work_scope.use_default', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="Y">Yes</option>
                      <option value="N">No</option>
                    </select>
                  </div>

                  {/* Array fields */}
                  {['protection', 'detach_reset', 'cleaning'].map((arrayField) => (
                    <div key={arrayField}>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700 capitalize">
                          {arrayField.replace('_', ' ')}
                        </label>
                        <button
                          onClick={() => addArrayItem(selectedRoom.locationIndex, selectedRoom.roomIndex, arrayField)}
                          className={`${styles.smallButton} ${styles.addButton}`}
                        >
                          Add
                        </button>
                      </div>
                      {selectedRoom.room.work_scope[arrayField].map((item, itemIndex) => (
                        <div key={itemIndex} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => updateArrayItem(selectedRoom.locationIndex, selectedRoom.roomIndex, arrayField, itemIndex, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                            placeholder={`${arrayField.replace('_', ' ')} item`}
                          />
                          <button
                            onClick={() => removeArrayItem(selectedRoom.locationIndex, selectedRoom.roomIndex, arrayField, itemIndex)}
                            className={`${styles.smallButton} ${styles.removeButton}`}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Note */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Note
                    </label>
                    <textarea
                      value={selectedRoom.room.work_scope.note}
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
            onClick={() => window.history.back()}
            className="px-6 py-2 border-2 border-gray-400 text-gray-700 bg-white rounded-md font-medium hover:bg-gray-100 shadow-sm"
          >
            ← Back
          </button>
          <button
            onClick={handleFormSubmit}
            disabled={isProcessing}
            className={styles.primaryButton}
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
                className={styles.primaryButton}
              >
                Continue to Next Step
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkScope;