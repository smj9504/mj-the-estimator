import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import OpeningEditor from '../../components/OpeningEditor';
import { updateRoomOpenings } from '../../utils/api';
import logger from '../../utils/logger';

const OpeningVerification = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session');

  const [measurementData, setMeasurementData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadMeasurementData();
    }
  }, [sessionId]);

  const loadMeasurementData = async () => {
    try {
      // Get the measurement data from session storage or API
      const storedData = sessionStorage.getItem(`measurementData_${sessionId}`);
      if (storedData) {
        const data = JSON.parse(storedData);
        setMeasurementData(data);
        setLoading(false);
      } else {
        // Fallback: fetch from API if not in session storage
        // This would need to be implemented based on your API structure
        setLoading(false);
      }
    } catch (error) {
      logger.error('Error loading measurement data:', error);
      setLoading(false);
    }
  };

  const handleOpeningUpdate = async (location, roomName, newOpenings) => {
    if (!sessionId) return;

    try {
      setSaving(true);
      setHasChanges(true);

      // Update via API
      const response = await updateRoomOpenings({
        session_id: sessionId,
        location: location,
        room_name: roomName,
        openings: newOpenings
      });

      // Update local state
      setMeasurementData(prevData => {
        const updatedData = prevData.map(locationData => {
          if (locationData.location === location) {
            return {
              ...locationData,
              rooms: locationData.rooms.map(room => {
                if (room.name === roomName) {
                  const updatedRoom = { ...room };
                  
                  if (room.is_merged) {
                    // For merged rooms, update total_measurements
                    updatedRoom.total_measurements = {
                      ...room.total_measurements,
                      openings: newOpenings.map(opening => ({
                        type: opening.type,
                        size: opening.type === 'open_wall' 
                          ? `${opening.width}' wide opening`
                          : `${opening.width}' × ${opening.height}'${opening.type === 'window' ? ' window' : ''}`
                      })),
                      ...response.updated_measurements
                    };
                  } else {
                    // For regular rooms, update measurements
                    updatedRoom.measurements = {
                      ...room.measurements,
                      openings: newOpenings.map(opening => ({
                        type: opening.type,
                        size: opening.type === 'open_wall' 
                          ? `${opening.width}' wide opening`
                          : `${opening.width}' × ${opening.height}'${opening.type === 'window' ? ' window' : ''}`
                      })),
                      ...response.updated_measurements
                    };
                  }
                  
                  // Also update selectedRoom if it's the same room
                  if (selectedRoom?.room.name === roomName && selectedRoom?.location === location) {
                    setSelectedRoom(prev => ({
                      ...prev,
                      room: updatedRoom
                    }));
                  }
                  
                  return updatedRoom;
                }
                return room;
              })
            };
          }
          return locationData;
        });

        // Update session storage
        sessionStorage.setItem(`measurementData_${sessionId}`, JSON.stringify(updatedData));
        
        // Dispatch custom event for same-window components to detect the change
        window.dispatchEvent(new CustomEvent('customStorageChange', {
          detail: {
            key: `measurementData_${sessionId}`,
            newValue: JSON.stringify(updatedData)
          }
        }));
        
        return updatedData;
      });

      logger.info(`Updated openings for ${roomName}`, { location, roomName, openings: newOpenings });

    } catch (error) {
      logger.error('Error updating room openings:', {
        error: error.message,
        location,
        roomName,
        newOpenings,
        sessionId,
        stack: error.stack
      });
      
      let errorMessage = 'Failed to update room openings. Please try again.';
      if (error.status === 404) {
        errorMessage = `Room "${roomName}" not found in "${location}".`;
      } else if (error.data && error.data.detail) {
        errorMessage = error.data.detail;
      }
      
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const calculateTotalRooms = () => {
    if (!measurementData) return 0;
    return measurementData.reduce((total, location) => total + location.rooms.length, 0);
  };

  // Get current room data from measurementData (for real-time updates)
  const getCurrentRoomData = () => {
    if (!selectedRoom || !measurementData) return null;
    
    const location = measurementData.find(loc => loc.location === selectedRoom.location);
    if (!location) return null;
    
    const room = location.rooms.find(r => r.name === selectedRoom.room.name);
    return room || selectedRoom.room;
  };

  const handleContinue = () => {
    // Mark this step as completed
    const completionStatus = JSON.parse(sessionStorage.getItem(`completionStatus_${sessionId}`) || '{}');
    completionStatus.openingVerification = true;
    sessionStorage.setItem(`completionStatus_${sessionId}`, JSON.stringify(completionStatus));
    
    // Navigate to the next step in the workflow
    navigate(`/pre-estimate/material-scope?session=${sessionId}`);
  };


  const handleBack = () => {
    navigate(`/pre-estimate/measurement-data?session=${sessionId}`);
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
              <h1 className="text-2xl font-bold text-gray-900">Opening Verification</h1>
              <p className="text-gray-600 mt-1">
                Review and adjust doors, windows, and openings for each room
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
              Total Rooms: {calculateTotalRooms()}
            </div>
            {hasChanges && (
              <div className="flex items-center text-sm text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                Changes saved automatically
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
                {measurementData.map((location, locationIndex) => (
                  <div key={locationIndex}>
                    <div className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700 border-b border-gray-100">
                      {location.location}
                    </div>
                    {location.rooms.map((room, roomIndex) => (
                      <button
                        key={roomIndex}
                        onClick={() => setSelectedRoom({ location: location.location, room })}
                        className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                          selectedRoom?.room.name === room.name && selectedRoom?.location === location.location
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
                                Main area + {room.sub_areas?.length || 0} sub-area(s)
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {(() => {
                              if (room.is_merged) {
                                // For merged rooms, count total openings from all areas
                                const mainOpenings = room.total_measurements?.openings?.length || 0;
                                return `${mainOpenings} opening(s)`;
                              } else {
                                // For regular rooms
                                return `${room.measurements?.openings?.length || 0} opening(s)`;
                              }
                            })()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {(() => {
                            if (room.is_merged) {
                              // For merged rooms, show total area
                              return `${room.total_measurements?.floor_area_sqft?.toFixed(0) || 0} sq ft (total)`;
                            } else {
                              // For regular rooms
                              return `${room.measurements?.floor_area_sqft?.toFixed(0) || 0} sq ft`;
                            }
                          })()}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Opening Editor */}
          <div className="lg:col-span-2">
            {selectedRoom ? (() => {
              const currentRoom = getCurrentRoomData();
              return currentRoom ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">
                      {currentRoom.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedRoom.location} • {(() => {
                        if (currentRoom.is_merged) {
                          return `${currentRoom.total_measurements?.floor_area_sqft?.toFixed(0) || 0} sq ft (total)`;
                        } else {
                          return `${currentRoom.measurements?.floor_area_sqft?.toFixed(0) || 0} sq ft`;
                        }
                      })()}
                      {currentRoom.is_merged && (
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Merged Room
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="p-6">
                    <OpeningEditor
                      openings={(() => {
                        // Get openings from appropriate location based on room type
                        const openings = currentRoom.is_merged 
                          ? currentRoom.total_measurements?.openings 
                          : currentRoom.measurements?.openings;
                        
                        return (openings || []).map(opening => {
                          // Parse existing opening format back to editable format
                          const match = opening.size.match(/(\d+(?:\.\d+)?)'?\s*[×x]\s*(\d+(?:\.\d+)?)'?/);
                          if (match) {
                            return {
                              type: opening.type,
                              width: parseFloat(match[1]),
                              height: parseFloat(match[2])
                            };
                          } else if (opening.type === 'open_wall') {
                            const widthMatch = opening.size.match(/(\d+(?:\.\d+)?)'?\s*wide/);
                            return {
                              type: opening.type,
                              width: widthMatch ? parseFloat(widthMatch[1]) : 6.0,
                              height: 8.0
                            };
                          }
                          return {
                            type: opening.type || 'door',
                            width: 3.0,
                            height: 6.8
                          };
                        });
                      })()}
                      onChange={(newOpenings) => 
                        handleOpeningUpdate(selectedRoom.location, currentRoom.name, newOpenings)
                      }
                      roomName={currentRoom.name}
                    />

                    {/* Show merged room composition */}
                    {currentRoom.is_merged && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h4 className="font-medium text-gray-900 mb-3">Room Composition</h4>
                        <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-4">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-blue-800">Main Area:</span>
                              <span className="font-medium">{currentRoom.main_area?.measurements?.floor_area_sqft?.toFixed(1)} sq ft</span>
                            </div>
                            {currentRoom.sub_areas?.map((subArea, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="text-blue-700">Sub-area ({subArea.type}):</span>
                                <span className="font-medium">{subArea.measurements?.floor_area_sqft?.toFixed(1)} sq ft {!subArea.material_applicable && <span className="text-orange-600">- No materials</span>}</span>
                              </div>
                            ))}
                            <div className="pt-2 border-t border-blue-200 flex justify-between font-medium">
                              <span className="text-blue-900">Total Area:</span>
                              <span>{currentRoom.total_measurements?.floor_area_sqft?.toFixed(1)} sq ft</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Measurement Impact */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-3">Current Measurements</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Wall Area:</span>
                          <span className="ml-2 font-medium">
                            {(() => {
                              const measurements = currentRoom.is_merged 
                                ? currentRoom.total_measurements 
                                : currentRoom.measurements;
                              return `${measurements?.wall_area_sqft?.toFixed(1) || 0} sq ft`;
                            })()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Floor Area:</span>
                          <span className="ml-2 font-medium">
                            {(() => {
                              const measurements = currentRoom.is_merged 
                                ? currentRoom.total_measurements 
                                : currentRoom.measurements;
                              return `${measurements?.floor_area_sqft?.toFixed(1) || 0} sq ft`;
                            })()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Ceiling Area:</span>
                          <span className="ml-2 font-medium">
                            {(() => {
                              const measurements = currentRoom.is_merged 
                                ? currentRoom.total_measurements 
                                : currentRoom.measurements;
                              return `${measurements?.ceiling_area_sqft?.toFixed(1) || 0} sq ft`;
                            })()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Perimeter:</span>
                          <span className="ml-2 font-medium">
                            {(() => {
                              const measurements = currentRoom.is_merged 
                                ? currentRoom.total_measurements 
                                : currentRoom.measurements;
                              return `${measurements?.floor_perimeter_lf?.toFixed(1) || 0} ft`;
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null;
            })() : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex items-center justify-center h-96">
                <div className="text-center text-gray-500">
                  <p className="text-lg mb-2">Select a room to edit openings</p>
                  <p className="text-sm">Choose a room from the list on the left to review and modify its doors, windows, and openings.</p>
                </div>
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
            ← Back to Measurement Data
          </button>
          <button
            onClick={handleContinue}
            disabled={saving}
            style={{
              backgroundColor: saving ? '#9CA3AF' : '#2563EB',
              color: '#FFFFFF',
              opacity: saving ? 0.5 : 1
            }}
            className="px-6 py-2 rounded-lg font-medium shadow-md hover:opacity-90"
          >
            {saving ? 'Saving...' : 'Continue to Material Scope →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpeningVerification;