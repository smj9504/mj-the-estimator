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
                  return {
                    ...room,
                    measurements: {
                      ...room.measurements,
                      openings: newOpenings.map(opening => ({
                        type: opening.type,
                        size: opening.type === 'open_wall' 
                          ? `${opening.width}' wide opening`
                          : `${opening.width}' × ${opening.height}'${opening.type === 'window' ? ' window' : ''}`
                      })),
                      ...response.updated_measurements
                    }
                  };
                }
                return room;
              })
            };
          }
          return locationData;
        });

        // Update session storage
        sessionStorage.setItem(`measurementData_${sessionId}`, JSON.stringify(updatedData));
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

  const handleContinue = () => {
    // Navigate to the next step in the workflow
    navigate(`/pre-estimate/work-scope?session=${sessionId}`);
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
                          <span className="font-medium text-gray-900">{room.name}</span>
                          <span className="text-xs text-gray-500">
                            {room.measurements?.openings?.length || 0} opening(s)
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {room.measurements?.floor_area_sqft?.toFixed(0)} sq ft
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
            {selectedRoom ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    {selectedRoom.room.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedRoom.location} • {selectedRoom.room.measurements?.floor_area_sqft?.toFixed(0)} sq ft
                  </p>
                </div>
                <div className="p-6">
                  <OpeningEditor
                    openings={selectedRoom.room.measurements?.openings?.map(opening => {
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
                    }) || []}
                    onChange={(newOpenings) => 
                      handleOpeningUpdate(selectedRoom.location, selectedRoom.room.name, newOpenings)
                    }
                    roomName={selectedRoom.room.name}
                  />

                  {/* Measurement Impact */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-3">Current Measurements</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Wall Area:</span>
                        <span className="ml-2 font-medium">
                          {selectedRoom.room.measurements?.wall_area_sqft?.toFixed(1)} sq ft
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Floor Area:</span>
                        <span className="ml-2 font-medium">
                          {selectedRoom.room.measurements?.floor_area_sqft?.toFixed(1)} sq ft
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Ceiling Area:</span>
                        <span className="ml-2 font-medium">
                          {selectedRoom.room.measurements?.ceiling_area_sqft?.toFixed(1)} sq ft
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Perimeter:</span>
                        <span className="ml-2 font-medium">
                          {selectedRoom.room.measurements?.floor_perimeter_lf?.toFixed(1)} ft
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
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
            {saving ? 'Saving...' : 'Continue to Work Scope →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpeningVerification;