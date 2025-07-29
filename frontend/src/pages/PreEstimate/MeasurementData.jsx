import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { uploadMeasurementFile, createSession } from '../../utils/api';
import logger from '../../utils/logger';

const MeasurementData = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [uploadType, setUploadType] = useState('image'); // 'image' or 'csv'
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);
  const [sessionId, setSessionId] = useState(searchParams.get('session'));
  const [showJsonData, setShowJsonData] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [pendingFileProcess, setPendingFileProcess] = useState(false);
  const [projectName, setProjectName] = useState('');

  // Remove automatic session creation on page load

  // Auto-process file when session becomes available
  useEffect(() => {
    if (sessionId && pendingFileProcess && file) {
      setPendingFileProcess(false);
      processFile();
    }
  }, [sessionId, pendingFileProcess, file]);

  const createNewSession = async () => {
    try {
      setSessionLoading(true);
      setError(null);
      const response = await createSession(projectName || null);
      const newSessionId = response.data.session_id;
      setSessionId(newSessionId);
      // Update URL with new session ID
      navigate(`/pre-estimate/measurement-data?session=${newSessionId}`, { replace: true });
      logger.info('Session created successfully:', newSessionId, { projectName });
    } catch (error) {
      logger.error('Failed to create session:', error);
      setError('Failed to create session. Please try again.');
    } finally {
      setSessionLoading(false);
    }
  };

  const handleFileUpload = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      logger.userAction('File selected', 'file-upload', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
        uploadType
      });
    }
  };

  const handleProcess = async () => {
    if (!file) {
      setError('Please select a file to upload');
      logger.warn('Process attempted without file selection');
      return;
    }

    // Create new session first, then process file
    if (!sessionId) {
      await createNewSession();
      // Set flag to process file after session is created
      setPendingFileProcess(true);
      return;
    }

    await processFileWithSession(sessionId);
  };

  const processFileWithSession = async (currentSessionId) => {
    if (!currentSessionId || !file) return;

    setIsProcessing(true);
    setError(null);
    logger.info('Starting file processing', { fileName: file.name, uploadType, sessionId: currentSessionId });

    try {
      const result = await uploadMeasurementFile(file, uploadType, currentSessionId);
      
      setParsedData(result.data.data);
      
      // Store measurement data in session storage for other components
      sessionStorage.setItem(`measurementData_${sessionId}`, JSON.stringify(result.data.data));
      
      logger.info('File processed successfully', { 
        fileName: file.name,
        measurementCount: result.data.data?.length || 0,
        sessionId
      });
    } catch (err) {
      setError(err.message);
      logger.error('File processing failed', {
        fileName: file.name,
        uploadType,
        sessionId,
        error: err.message
      });
      
      // Mock data for testing
      const mockData = [
        {
          location: "1st Floor",
          rooms: [
            {
              name: "Kitchen",
              measurements: {
                height: 8.0,
                wall_area_sqft: 280.0,
                ceiling_area_sqft: 120.0,
                floor_area_sqft: 120.0,
                walls_and_ceiling_area_sqft: 400.0,
                flooring_area_sy: 13.33,
                ceiling_perimeter_lf: 44.0,
                floor_perimeter_lf: 44.0,
                openings: [
                  { type: "door", size: "3' X 6'8\"" }
                ]
              }
            },
            {
              name: "Living Room",
              measurements: {
                height: 9.0,
                wall_area_sqft: 450.0,
                ceiling_area_sqft: 300.0,
                floor_area_sqft: 300.0,
                walls_and_ceiling_area_sqft: 750.0,
                flooring_area_sy: 33.33,
                ceiling_perimeter_lf: 70.0,
                floor_perimeter_lf: 70.0,
                openings: [
                  { type: "open_wall", size: "8' wide opening" },
                  { type: "window", size: "6' X 4' window" }
                ]
              }
            }
          ]
        }
      ];
      setParsedData(mockData);
      sessionStorage.setItem(`measurementData_${sessionId}`, JSON.stringify(mockData));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNext = () => {
    if (parsedData && sessionId) {
      // Navigate to opening verification step
      navigate(`/pre-estimate/opening-verification?session=${sessionId}`);
    }
  };

  const handleBack = () => {
    // 세션이 있으면 프로젝트 생성 페이지로, 없으면 pre-estimate로
    if (sessionId) {
      navigate('/create-project');
    } else {
      navigate('/pre-estimate');
    }
  };

  const acceptedFileTypes = uploadType === 'image' 
    ? '.jpg,.jpeg,.png,.gif'
    : '.csv';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Measurement Data</h1>
              <p className="text-gray-600 mt-1">
                Upload and process your measurement files
              </p>
            </div>
            <div className="text-sm">
              {sessionLoading ? (
                <span className="text-blue-600">🔄 Initializing session...</span>
              ) : sessionId ? (
                <span className="text-gray-500">Session: {sessionId.slice(-8)}</span>
              ) : (
                <span className="text-red-500">❌ No session</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
      
      {/* Project Creation Section */}
      {!sessionId && !sessionLoading && (
        <div className="border-2 border-blue-300 rounded-lg p-6 bg-blue-50">
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-medium text-blue-900 mb-2 text-center">
              Start New Project
            </h3>
            <p className="text-blue-700 mb-4 text-center">
              Create a new estimation project to begin uploading and processing measurement data.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-2">
                  Project Name (Optional)
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., Main Street Renovation"
                  className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <button
                onClick={createNewSession}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 shadow-md transition-colors"
              >
                🚀 Create New Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Section */}
      {(sessionId || sessionLoading) && (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <div className="text-center">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Type
            </label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="image">Image (JPG, PNG)</option>
              <option value="csv">CSV File</option>
            </select>
          </div>

          <div className="mb-4">
            <input
              type="file"
              accept={acceptedFileTypes}
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {file && (
            <div className="mb-4 p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            </div>
          )}

          <button
            onClick={handleProcess}
            disabled={!file || isProcessing || sessionLoading || !sessionId || pendingFileProcess}
            style={{
              backgroundColor: (!file || isProcessing || sessionLoading || !sessionId || pendingFileProcess) ? '#9CA3AF' : '#2563EB',
              color: (!file || isProcessing || sessionLoading || !sessionId || pendingFileProcess) ? '#374151' : '#FFFFFF',
              cursor: (!file || isProcessing || sessionLoading || !sessionId || pendingFileProcess) ? 'not-allowed' : 'pointer'
            }}
            className="px-4 py-2 rounded-md font-medium shadow-md hover:opacity-90"
          >
            {sessionLoading ? 'Initializing Session...' : 
             pendingFileProcess ? 'Waiting for Session...' :
             isProcessing ? 'Processing...' : 
             !sessionId ? 'Session Required' : 
             'Process File'}
          </button>
        </div>
      </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Parsed Data Display */}
      {parsedData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Parsed Measurement Data
            </h3>
            <button
              onClick={() => setShowJsonData(!showJsonData)}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
            >
              {showJsonData ? 'Hide JSON' : 'Show JSON'}
            </button>
          </div>
          
          {showJsonData && (
            <div className="bg-gray-50 border border-gray-200 rounded-md">
              <div className="p-3 border-b border-gray-200 bg-gray-100">
                <span className="text-xs font-medium text-gray-600">Raw JSON Data</span>
              </div>
              <div className="p-4 max-h-80 overflow-auto">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap text-left font-mono">
{JSON.stringify(parsedData, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Room Summary View */}
          <div className="space-y-4">
            {parsedData.map((location, locationIndex) => (
              <div key={locationIndex} className="border border-gray-200 rounded-md overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                  <h4 className="font-medium text-gray-900">{location.location}</h4>
                </div>
                <div className="bg-white">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Room
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Floor Area
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Wall Area
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Height
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Openings
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {location.rooms?.map((room, roomIndex) => (
                        <tr key={roomIndex}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {room.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {room.measurements.floor_area_sqft?.toFixed(1)} sq ft
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {room.measurements.wall_area_sqft?.toFixed(1)} sq ft
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {room.measurements.height}' 
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="space-y-1">
                              {room.measurements.openings?.map((opening, openingIndex) => (
                                <div key={openingIndex} className="flex items-center space-x-2">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    opening.type === 'door' ? 'bg-blue-100 text-blue-800' :
                                    opening.type === 'window' ? 'bg-green-100 text-green-800' :
                                    'bg-orange-100 text-orange-800'
                                  }`}>
                                    {opening.type}
                                  </span>
                                  <span className="text-xs text-gray-600">{opening.size}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={handleBack}
              className="px-6 py-2 border-2 border-gray-400 text-gray-700 bg-white rounded-md font-medium hover:bg-gray-100 shadow-sm"
            >
              ← Back
            </button>
            <button
              onClick={handleNext}
              style={{
                backgroundColor: '#2563EB',
                color: '#FFFFFF'
              }}
              className="px-6 py-2 rounded-md font-medium shadow-md hover:opacity-90"
            >
              Review Openings →
            </button>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default MeasurementData;