import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { uploadMeasurementFile, createSession, getSession } from '../../utils/api';
import logger from '../../utils/logger';
import styles from './MeasurementData.module.css';

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
  const [sessionData, setSessionData] = useState(null);
  const [copyStatus, setCopyStatus] = useState('idle'); // 'idle', 'success', 'error'
  const [editMode, setEditMode] = useState(false);
  const [editableData, setEditableData] = useState(null);

  // Remove automatic session creation on page load

  // Fetch session data when sessionId is available
  useEffect(() => {
    if (sessionId && !sessionData) {
      fetchSessionData(sessionId);
    }
  }, [sessionId, sessionData]);

  // Load existing parsed data from session storage on page load
  useEffect(() => {
    if (sessionId) {
      const storedData = sessionStorage.getItem(`measurementData_${sessionId}`);
      if (storedData) {
        try {
          const parsedStoredData = JSON.parse(storedData);
          setParsedData(parsedStoredData);
          setEditableData(JSON.parse(JSON.stringify(parsedStoredData))); // Deep copy
          logger.info('Loaded existing measurement data from session storage', {
            dataLength: parsedStoredData.length,
            sessionId
          });
        } catch (error) {
          logger.error('Error loading stored measurement data', error);
        }
      }
    }
  }, [sessionId]);

  // Auto-process file when session becomes available
  useEffect(() => {
    if (sessionId && pendingFileProcess && file) {
      setPendingFileProcess(false);
      processFile();
    }
  }, [sessionId, pendingFileProcess, file]);

  const fetchSessionData = async (currentSessionId) => {
    try {
      const response = await getSession(currentSessionId);
      setSessionData(response.data);
      logger.info('Session data fetched successfully', response.data);
    } catch (error) {
      logger.error('Failed to fetch session data', error);
    }
  };

  const createNewSession = async () => {
    try {
      setSessionLoading(true);
      setError(null);
      const response = await createSession(projectName || null);
      const newSessionId = response.data.session_id;
      setSessionId(newSessionId);
      setSessionData(response.data); // Set session data immediately
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
      setEditableData(JSON.parse(JSON.stringify(result.data.data))); // Deep copy
      
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
      setEditableData(JSON.parse(JSON.stringify(mockData))); // Deep copy
      sessionStorage.setItem(`measurementData_${sessionId}`, JSON.stringify(mockData));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNext = () => {
    if (parsedData && sessionId) {
      // Mark measurement data as completed
      const completionStatus = JSON.parse(sessionStorage.getItem(`completionStatus_${sessionId}`) || '{}');
      completionStatus.measurementData = true;
      sessionStorage.setItem(`completionStatus_${sessionId}`, JSON.stringify(completionStatus));
      
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

  const handleCopyJsonToClipboard = async () => {
    if (!parsedData) return;
    
    try {
      setCopyStatus('idle');
      
      // Create JSON string
      const jsonData = JSON.stringify(parsedData, null, 2);
      
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(jsonData);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = jsonData;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      
      setCopyStatus('success');
      logger.userAction('Copied JSON data to clipboard', 'json-clipboard-copy', {
        sessionId,
        dataLength: parsedData.length
      });
      
      // Reset status after 2 seconds
      setTimeout(() => setCopyStatus('idle'), 2000);
      
    } catch (error) {
      logger.error('Failed to copy JSON to clipboard', error);
      setCopyStatus('error');
      
      // Reset status after 3 seconds
      setTimeout(() => setCopyStatus('idle'), 3000);
    }
  };

  // Utility functions for room management
  const detectDuplicateRooms = (data) => {
    const duplicates = [];
    data.forEach((location, locationIndex) => {
      const roomNames = {};
      location.rooms?.forEach((room, roomIndex) => {
        const name = room.name?.trim() || '';
        if (!name || name === '') {
          duplicates.push({
            locationIndex,
            roomIndex,
            issue: 'empty_name',
            suggestion: `Room ${roomIndex + 1}`
          });
        } else if (roomNames[name]) {
          duplicates.push({
            locationIndex,
            roomIndex,
            issue: 'duplicate_name',
            name: name,
            suggestion: `${name} ${Object.keys(roomNames).filter(n => n.startsWith(name)).length + 1}`
          });
        }
        roomNames[name] = (roomNames[name] || 0) + 1;
      });
    });
    return duplicates;
  };

  const updateRoomName = (locationIndex, roomIndex, newName) => {
    const newData = JSON.parse(JSON.stringify(editableData));
    if (newData[locationIndex] && newData[locationIndex].rooms[roomIndex]) {
      newData[locationIndex].rooms[roomIndex].name = newName;
    }
    setEditableData(newData);
  };

  const mergeRooms = (locationIndex, roomIndex1, roomIndex2) => {
    const newData = JSON.parse(JSON.stringify(editableData));
    const location = newData[locationIndex];
    
    if (location && location.rooms[roomIndex1] && location.rooms[roomIndex2]) {
      const room1 = location.rooms[roomIndex1];
      const room2 = location.rooms[roomIndex2];
      
      // Merge measurements by adding numeric values
      const mergedMeasurements = {
        wall_area_sqft: (room1.measurements.wall_area_sqft || 0) + (room2.measurements.wall_area_sqft || 0),
        ceiling_area_sqft: (room1.measurements.ceiling_area_sqft || 0) + (room2.measurements.ceiling_area_sqft || 0),
        floor_area_sqft: (room1.measurements.floor_area_sqft || 0) + (room2.measurements.floor_area_sqft || 0),
        walls_and_ceiling_area_sqft: (room1.measurements.walls_and_ceiling_area_sqft || 0) + (room2.measurements.walls_and_ceiling_area_sqft || 0),
        floor_perimeter_lf: (room1.measurements.floor_perimeter_lf || 0) + (room2.measurements.floor_perimeter_lf || 0),
        ceiling_perimeter_lf: (room1.measurements.ceiling_perimeter_lf || 0) + (room2.measurements.ceiling_perimeter_lf || 0),
        flooring_area_sy: ((room1.measurements.floor_area_sqft || 0) + (room2.measurements.floor_area_sqft || 0)) / 9.0,
        height: Math.max(room1.measurements.height || 0, room2.measurements.height || 0), // Use the higher height
        openings: mergeOpenings(
          room1.measurements.openings || [], 
          room2.measurements.openings || [], 
          room1.name, 
          room2.name
        )
      };
      
      // Update the first room with merged data
      location.rooms[roomIndex1].measurements = mergedMeasurements;
      
      // Remove the second room
      location.rooms.splice(roomIndex2, 1);
    }
    
    setEditableData(newData);
  };

  const mergeOpenings = (openings1, openings2, room1Name, room2Name) => {
    const allOpenings = [...openings1, ...openings2];
    const filteredOpenings = [];
    
    // Create array of all room name variations that should be considered as "internal" after merge
    const internalRoomNames = [
      room1Name, room2Name,
      room1Name?.toUpperCase(), room2Name?.toUpperCase(),
      room1Name?.toLowerCase(), room2Name?.toLowerCase(),
      // Handle numbered variations (e.g., "Stairs" should match "STAIRS", "STAIRS2", "STAIRS3")
      ...generateRoomNameVariations(room1Name),
      ...generateRoomNameVariations(room2Name)
    ].filter(Boolean); // Remove null/undefined values
    
    logger.info(`Merging openings. Internal room names to filter: ${JSON.stringify(internalRoomNames)}`);
    
    for (const opening of allOpenings) {
      // Skip internal connections between rooms being merged
      const isInternalConnection = internalRoomNames.some(internalName => 
        opening.opens_to && isRoomNameMatch(opening.opens_to, internalName)
      );
      
      if (isInternalConnection) {
        logger.info(`Removing internal connection: ${opening.type} ${opening.size} opens to ${opening.opens_to}`);
        continue;
      }
      
      // Check for duplicates based on type, size, and opens_to
      const isDuplicate = filteredOpenings.some(existing => 
        existing.type === opening.type &&
        existing.size === opening.size &&
        existing.opens_to === opening.opens_to
      );
      
      if (!isDuplicate) {
        filteredOpenings.push(opening);
        logger.info(`Keeping opening: ${opening.type} ${opening.size} opens to ${opening.opens_to}`);
      } else {
        logger.info(`Removing duplicate opening: ${opening.type} ${opening.size} opens to ${opening.opens_to}`);
      }
    }
    
    logger.info(`Final merged openings count: ${filteredOpenings.length}`);
    return filteredOpenings;
  };

  const generateRoomNameVariations = (roomName) => {
    if (!roomName) return [];
    
    const variations = [];
    const baseName = roomName.replace(/\d+$/, '').trim(); // Remove trailing numbers
    
    // Add base name variations
    variations.push(baseName, baseName.toUpperCase(), baseName.toLowerCase());
    
    // Add numbered variations (1-10 should cover most cases)
    for (let i = 1; i <= 10; i++) {
      variations.push(`${baseName}${i}`);
      variations.push(`${baseName.toUpperCase()}${i}`);
      variations.push(`${baseName.toLowerCase()}${i}`);
    }
    
    return variations;
  };

  const isRoomNameMatch = (opensTo, internalName) => {
    if (!opensTo || !internalName) return false;
    
    // Exact match
    if (opensTo === internalName) return true;
    
    // Case insensitive match
    if (opensTo.toLowerCase() === internalName.toLowerCase()) return true;
    
    // Check if opensTo starts with internalName (for cases like "STAIRS2" matching "STAIRS")
    const opensToBase = opensTo.replace(/\d+$/, '').trim();
    const internalBase = internalName.replace(/\d+$/, '').trim();
    
    return opensToBase.toLowerCase() === internalBase.toLowerCase();
  };

  const saveChanges = () => {
    setParsedData(JSON.parse(JSON.stringify(editableData)));
    sessionStorage.setItem(`measurementData_${sessionId}`, JSON.stringify(editableData));
    setEditMode(false);
    logger.info('Room changes saved', { sessionId, totalRooms: editableData?.reduce((total, loc) => total + (loc.rooms?.length || 0), 0) });
  };

  const cancelChanges = () => {
    setEditableData(JSON.parse(JSON.stringify(parsedData)));
    setEditMode(false);
  };

  const acceptedFileTypes = uploadType === 'image' 
    ? '.jpg,.jpeg,.png,.gif,.pdf'
    : '.csv';

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className="flex justify-between items-start mb-4">
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
          <div className={styles.headerFlex}>
            <div>
              <h1 className={styles.title}>Measurement Data</h1>
              <p className={styles.subtitle}>
                Upload and process your measurement files
              </p>
            </div>
            <div className="text-sm">
              {sessionLoading ? (
                <span className="text-blue-600">🔄 Initializing session...</span>
              ) : sessionId && sessionData ? (
                <span className="text-gray-500">
                  {sessionData.project_name ? 
                    `Project: ${sessionData.project_name}` : 
                    `Session: ${sessionId.slice(-8)}`
                  }
                </span>
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
      <div className={styles.mainContent}>
        <div className={styles.contentSpace}>
      
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
                className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonLarge}`}
                style={{ width: '100%' }}
              >
                🚀 Create New Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Data Notice */}
      {parsedData && !isProcessing && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900 mb-1">
                Measurement Data Already Processed
              </h4>
              <p className="text-sm text-blue-700 mb-3">
                This session already has processed measurement data with{' '}
                {parsedData.length} location(s) and{' '}
                {parsedData.reduce((total, loc) => total + (loc.rooms?.length || 0), 0)} room(s).
                You can upload a new file to replace the existing data or continue with the current data.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleNext}
                  className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonMedium}`}
                >
                  Continue with Current Data →
                </button>
                <button
                  onClick={() => {
                    setParsedData(null);
                    sessionStorage.removeItem(`measurementData_${sessionId}`);
                    setFile(null);
                  }}
                  className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonMedium}`}
                >
                  Upload New File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Section - Show always if no parsed data, or if user clicked "Upload New File" */}
      {(sessionId || sessionLoading) && (!parsedData || file) && (
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
              <option value="image">Image/PDF (JPG, PNG, PDF)</option>
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
            className={`${styles.button} ${styles.buttonMedium} ${
              (!file || isProcessing || sessionLoading || !sessionId || pendingFileProcess) 
                ? '' 
                : styles.buttonPrimary
            }`}
            style={(!file || isProcessing || sessionLoading || !sessionId || pendingFileProcess) 
              ? { backgroundColor: '#9ca3af', color: '#6b7280', cursor: 'not-allowed' }
              : {}
            }
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
          <div className={styles.parsedDataHeader}>
            <h3 className={styles.parsedDataTitle}>
              Parsed Measurement Data
            </h3>
            <div className={styles.parsedDataActions}>
              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonSmall}`}
                >
                  ✏️ Edit Rooms
                </button>
              )}
              {editMode && (
                <>
                  <button
                    onClick={saveChanges}
                    className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonSmall}`}
                  >
                    💾 Save Changes
                  </button>
                  <button
                    onClick={cancelChanges}
                    className={`${styles.button} ${styles.buttonSecondary} ${styles.buttonSmall}`}
                  >
                    ❌ Cancel
                  </button>
                </>
              )}
              <button
                onClick={() => setShowJsonData(!showJsonData)}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
              >
                {showJsonData ? 'Hide JSON' : 'Show JSON'}
              </button>
            </div>
          </div>
          
          {showJsonData && (
            <div className="bg-gray-50 border border-gray-200 rounded-md">
              <div className="p-3 border-b border-gray-200 bg-gray-100 flex justify-between items-center">
                <span className="text-xs font-medium text-gray-600">Raw JSON Data</span>
                <button
                  onClick={handleCopyJsonToClipboard}
                  className={`${styles.copyButton} ${
                    copyStatus === 'success' ? styles.copyButtonSuccess :
                    copyStatus === 'error' ? styles.copyButtonError : ''
                  }`}
                  disabled={copyStatus !== 'idle'}
                >
                  {copyStatus === 'idle' && (
                    <>
                      📋 Copy JSON
                    </>
                  )}
                  {copyStatus === 'success' && (
                    <>
                      ✅ Copied!
                    </>
                  )}
                  {copyStatus === 'error' && (
                    <>
                      ❌ Failed
                    </>
                  )}
                </button>
              </div>
              <div className="p-4 max-h-80 overflow-auto">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap text-left font-mono">
{JSON.stringify(parsedData, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Duplicate Rooms Warning */}
          {(() => {
            const duplicates = detectDuplicateRooms(editableData || parsedData);
            return duplicates.length > 0 && (
              <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">⚠️</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-yellow-900 mb-2">
                      Room Name Issues Detected
                    </h4>
                    <p className="text-sm text-yellow-700 mb-3">
                      Found {duplicates.length} room(s) with empty names or duplicate names. Click "Edit Rooms" to fix these issues.
                    </p>
                    <div className="space-y-1">
                      {duplicates.slice(0, 3).map((duplicate, index) => (
                        <div key={index} className="text-xs text-yellow-600">
                          • {duplicate.issue === 'empty_name' ? 'Empty room name' : `Duplicate name: "${duplicate.name}"`} 
                          in {(editableData || parsedData)[duplicate.locationIndex]?.location || 'Unknown Location'}
                        </div>
                      ))}
                      {duplicates.length > 3 && (
                        <div className="text-xs text-yellow-600">
                          • ...and {duplicates.length - 3} more issues
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Room Summary View */}
          <div className="space-y-4">
            {(editMode ? editableData : parsedData)?.map((location, locationIndex) => (
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
                        {editMode && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {location.rooms?.map((room, roomIndex) => {
                        const isEmpty = !room.name || room.name.trim() === '';
                        const duplicates = location.rooms.filter((r, i) => i !== roomIndex && r.name === room.name && room.name.trim() !== '');
                        const hasDuplicate = duplicates.length > 0;
                        
                        return (
                          <tr key={roomIndex} className={editMode && (isEmpty || hasDuplicate) ? 'bg-yellow-50' : ''}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {editMode ? (
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    value={room.name || ''}
                                    onChange={(e) => updateRoomName(locationIndex, roomIndex, e.target.value)}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter room name"
                                  />
                                  {isEmpty && (
                                    <div className="text-xs text-red-600">⚠️ Empty name</div>
                                  )}
                                  {hasDuplicate && (
                                    <div className="text-xs text-orange-600">⚠️ Duplicate name</div>
                                  )}
                                </div>
                              ) : (
                                <span className={isEmpty ? 'text-gray-400 italic' : ''}>
                                  {room.name || 'Unnamed Room'}
                                </span>
                              )}
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
                                    <span className="text-xs text-gray-600">
                                      {opening.size}
                                      {opening.opens_to && (
                                        <span className="text-gray-500 ml-1">→ {opening.opens_to}</span>
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            {editMode && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div className="flex flex-col space-y-1">
                                  {hasDuplicate && (
                                    <button
                                      onClick={() => {
                                        const duplicateIndex = location.rooms.findIndex((r, i) => i > roomIndex && r.name === room.name);
                                        if (duplicateIndex !== -1) {
                                          mergeRooms(locationIndex, roomIndex, duplicateIndex);
                                        }
                                      }}
                                      className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded hover:bg-orange-200"
                                      title="Merge with duplicate room"
                                    >
                                      🔄 Merge
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.navigationButtons}>
            <button
              onClick={handleBack}
              className={`${styles.button} ${styles.backButton} ${styles.buttonLarge}`}
            >
              ← Back
            </button>
            <button
              onClick={handleNext}
              className={`${styles.button} ${styles.nextButton} ${styles.buttonLarge}`}
              disabled={!parsedData}
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