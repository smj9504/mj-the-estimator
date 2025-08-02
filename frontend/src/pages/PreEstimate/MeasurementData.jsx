import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { uploadMeasurementFile, createSession, getSession } from '../../utils/api';
import { buildApiUrl, API_CONFIG } from '../../config/api';
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
  const [editingOpening, setEditingOpening] = useState(null); // { locationIndex, roomIndex, openingIndex } or null
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'success', 'error'
  
  // Progress tracking states
  const [processingProgress, setProcessingProgress] = useState({
    stage: 'idle',
    message: '',
    progress: 0,
    timestamp: null
  });
  const [showProgress, setShowProgress] = useState(false);

  // Remove automatic session creation on page load

  // Fetch session data when sessionId is available
  useEffect(() => {
    if (sessionId && !sessionData) {
      fetchSessionData(sessionId);
    }
  }, [sessionId, sessionData]);

  // Load existing parsed data from session storage or API on page load
  useEffect(() => {
    const loadExistingData = async () => {
      if (sessionId) {
        let parsedStoredData = null;
        const storedData = sessionStorage.getItem(`measurementData_${sessionId}`);
        
        if (storedData) {
          // Load from sessionStorage
          try {
            parsedStoredData = JSON.parse(storedData);
            logger.info('Measurement Data: Loaded existing data from sessionStorage', {
              dataLength: parsedStoredData.length,
              sessionId
            });
          } catch (error) {
            logger.error('Error parsing stored measurement data', error);
          }
        } else {
          // Fallback: load from API
          logger.info('Measurement Data: No data in sessionStorage, trying API...');
          try {
            const response = await fetch(`http://localhost:8001/api/pre-estimate/measurement/data/${sessionId}`);
            if (response.ok) {
              const apiData = await response.json();
              if (apiData.success && apiData.data) {
                parsedStoredData = apiData.data;
                // Store in sessionStorage for subsequent use
                sessionStorage.setItem(`measurementData_${sessionId}`, JSON.stringify(parsedStoredData));
                logger.info('Measurement Data: Loaded existing data from API', {
                  dataLength: parsedStoredData.length,
                  sessionId
                });
              }
            }
          } catch (apiError) {
            logger.info('Measurement Data: No existing data found in API (this is normal for new sessions)');
          }
        }
        
        if (parsedStoredData) {
          setParsedData(parsedStoredData);
          setEditableData(JSON.parse(JSON.stringify(parsedStoredData))); // Deep copy
        }
      }
    };
    
    loadExistingData();
  }, [sessionId]);

  // Auto-process file when session becomes available
  useEffect(() => {
    if (sessionId && pendingFileProcess && file) {
      setPendingFileProcess(false);
      processFile();
    }
  }, [sessionId, pendingFileProcess, file]);

  // Helper functions for enhanced progress display
  const getStageMessage = (stage, message) => {
    if (message) return message;
    
    const stageMessages = {
      'initializing': 'Setting up processing pipeline...',
      'parsing': 'Analyzing measurement data format...',
      'calculating': 'Computing room measurements...',
      'finalizing': 'Organizing room data structures...',
      'completed': 'All measurements processed successfully!',
      'error': 'Processing encountered an error',
      'fallback': 'Using alternative processing method...'
    };
    
    return stageMessages[stage] || 'Processing your measurement file...';
  };

  const getStageDescription = (stage) => {
    const descriptions = {
      'initializing': 'Preparing to analyze your measurement data',
      'parsing': 'Detecting room data format and extracting information',
      'calculating': 'Computing area, perimeter, and opening measurements',
      'finalizing': 'Structuring data for room-by-room analysis',
      'completed': 'Ready to proceed to opening verification',
      'error': 'Check file format and try again',
      'fallback': 'Attempting backup processing method'
    };
    
    return descriptions[stage] || 'Please wait while we process your file';
  };

  const getStageDisplayName = (stage) => {
    const displayNames = {
      'initializing': 'Initializing',
      'parsing': 'Parsing Data',
      'calculating': 'Calculating',
      'finalizing': 'Finalizing',
      'completed': 'Complete',
      'error': 'Error',
      'fallback': 'Retry Mode'
    };
    
    return displayNames[stage] || stage;
  };

  const getStageIndex = (stage) => {
    const stages = ['initializing', 'parsing', 'calculating', 'finalizing'];
    return stages.indexOf(stage);
  };

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

  // Progress tracking functions
  const fetchProgress = async (sessionId) => {
    try {
      const response = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.PRE_ESTIMATE.MEASUREMENT_PROGRESS}/${sessionId}`));
      if (response.ok) {
        const progressData = await response.json();
        setProcessingProgress(progressData);
        return progressData;
      }
    } catch (error) {
      logger.error('Error fetching progress', error);
    }
    return null;
  };

  const startProgressPolling = (sessionId) => {
    setShowProgress(true);
    setProcessingProgress({
      stage: 'initializing',
      message: 'Starting measurement data processing...',
      progress: 5,
      timestamp: Date.now()
    });

    const pollInterval = setInterval(async () => {
      const progressData = await fetchProgress(sessionId);
      
      if (progressData) {
        setProcessingProgress(progressData);
        
        if (progressData.stage === 'completed') {
          clearInterval(pollInterval);
          setTimeout(() => {
            setShowProgress(false);
          }, 3000); // Show completion for 3 seconds
        } else if (progressData.stage === 'error') {
          clearInterval(pollInterval);
          // Don't auto-hide on error, let user see the error message
        }
      }
    }, 500); // Poll every 500ms for smoother updates

    // Cleanup after 60 seconds to prevent infinite polling
    setTimeout(() => {
      clearInterval(pollInterval);
      if (showProgress) {
        setShowProgress(false);
      }
    }, 60000);

    return pollInterval;
  };

  const clearProgress = async (sessionId) => {
    try {
      await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.PRE_ESTIMATE.MEASUREMENT_PROGRESS}/${sessionId}`), {
        method: 'DELETE'
      });
    } catch (error) {
      logger.error('Error clearing progress', error);
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

    // Start progress polling
    const pollInterval = startProgressPolling(currentSessionId);

    try {
      const result = await uploadMeasurementFile(file, uploadType, currentSessionId);
      
      setParsedData(result.data.data);
      setEditableData(JSON.parse(JSON.stringify(result.data.data))); // Deep copy
      
      // Store measurement data in session storage for other components
      sessionStorage.setItem(`measurementData_${sessionId}`, JSON.stringify(result.data.data));
      
      // Dispatch custom event for same-window components to detect the change
      window.dispatchEvent(new CustomEvent('customStorageChange', {
        detail: {
          key: `measurementData_${sessionId}`,
          newValue: JSON.stringify(result.data.data)
        }
      }));
      
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
      
      // Dispatch custom event for same-window components to detect the change
      window.dispatchEvent(new CustomEvent('customStorageChange', {
        detail: {
          key: `measurementData_${sessionId}`,
          newValue: JSON.stringify(mockData)
        }
      }));
    } finally {
      setIsProcessing(false);
      
      // Clean up progress polling and clear progress data
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      
      // Clear progress data from backend after a short delay
      setTimeout(async () => {
        await clearProgress(currentSessionId);
        setShowProgress(false);
      }, 3000);
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

  const updateRoomClassification = (locationIndex, roomIndex, field, value) => {
    const newData = JSON.parse(JSON.stringify(editableData));
    if (newData[locationIndex] && newData[locationIndex].rooms[roomIndex]) {
      if (!newData[locationIndex].rooms[roomIndex].room_classification) {
        newData[locationIndex].rooms[roomIndex].room_classification = {};
      }
      newData[locationIndex].rooms[roomIndex].room_classification[field] = value;
      
      // Auto-update related fields based on sub_area_type
      if (field === 'sub_area_type') {
        const nonMaterialTypes = ['bathtub', 'cabinet', 'fixture'];
        newData[locationIndex].rooms[roomIndex].room_classification.is_sub_area = value !== null;
        newData[locationIndex].rooms[roomIndex].room_classification.material_applicable = 
          value === null || !nonMaterialTypes.includes(value);
      }
      
      // Mark as user confirmed
      newData[locationIndex].rooms[roomIndex].room_classification.user_confirmed = true;
    }
    setEditableData(newData);
  };

  const mergeRoomsAsSubArea = (locationIndex, parentRoomIndex, subAreaRoomIndex) => {
    console.log('🔄 Starting room merge:', { locationIndex, parentRoomIndex, subAreaRoomIndex });
    const newData = JSON.parse(JSON.stringify(editableData));
    const location = newData[locationIndex];
    
    if (location && location.rooms[parentRoomIndex] && location.rooms[subAreaRoomIndex]) {
      const parentRoom = location.rooms[parentRoomIndex];
      const subAreaRoom = location.rooms[subAreaRoomIndex];
      console.log('📋 Merging rooms:', { parentRoom: parentRoom.name, subAreaRoom: subAreaRoom.name });
      
      // Convert to merged room structure - optimized with only essential fields
      const mergedRoom = {
        name: parentRoom.name.replace(/ #\d+$/, ''), // Remove numbering
        is_merged: true,
        main_area: {
          measurements: { ...parentRoom.measurements }
        },
        sub_areas: [
          {
            type: subAreaRoom.room_classification?.sub_area_type || 'sub_area',
            measurements: { 
              ...subAreaRoom.measurements,
              // Filter openings based on sub-area type validity
              openings: filterOpeningsForSubArea(
                subAreaRoom.measurements.openings || [], 
                subAreaRoom.room_classification?.sub_area_type
              )
            },
            material_applicable: subAreaRoom.room_classification?.material_applicable !== false
          }
        ],
        total_measurements: {
          height: Math.max(parentRoom.measurements.height || 0, subAreaRoom.measurements.height || 0),
          wall_area_sqft: (parentRoom.measurements.wall_area_sqft || 0) + (subAreaRoom.measurements.wall_area_sqft || 0),
          ceiling_area_sqft: (parentRoom.measurements.ceiling_area_sqft || 0) + (subAreaRoom.measurements.ceiling_area_sqft || 0),
          floor_area_sqft: (parentRoom.measurements.floor_area_sqft || 0) + (subAreaRoom.measurements.floor_area_sqft || 0),
          walls_and_ceiling_area_sqft: (parentRoom.measurements.walls_and_ceiling_area_sqft || 0) + (subAreaRoom.measurements.walls_and_ceiling_area_sqft || 0),
          flooring_area_sy: (parentRoom.measurements.flooring_area_sy || 0) + (subAreaRoom.measurements.flooring_area_sy || 0),
          ceiling_perimeter_lf: Math.max(parentRoom.measurements.ceiling_perimeter_lf || 0, subAreaRoom.measurements.ceiling_perimeter_lf || 0),
          floor_perimeter_lf: Math.max(parentRoom.measurements.floor_perimeter_lf || 0, subAreaRoom.measurements.floor_perimeter_lf || 0),
          openings: mergeOpenings(
            parentRoom.measurements.openings || [], 
            subAreaRoom.measurements.openings || [], 
            parentRoom.name, 
            subAreaRoom.name
          )
        }
      };

      // Remove the room that comes later first to avoid index shifting issues
      if (subAreaRoomIndex > parentRoomIndex) {
        // Sub-area comes after parent: remove sub-area first, then replace parent
        location.rooms.splice(subAreaRoomIndex, 1);
        location.rooms[parentRoomIndex] = mergedRoom;
      } else {
        // Sub-area comes before parent: replace parent first, then remove sub-area
        location.rooms[parentRoomIndex] = mergedRoom;
        location.rooms.splice(subAreaRoomIndex, 1);
      }
    }
    
    console.log('✅ Room merge completed, updating editableData');
    setEditableData(newData);
    console.log('📊 New editableData set:', newData);
  };

  const unmergeRoom = (locationIndex, roomIndex) => {
    const newData = JSON.parse(JSON.stringify(editableData));
    const location = newData[locationIndex];
    const mergedRoom = location.rooms[roomIndex];
    
    if (mergedRoom && mergedRoom.is_merged) {
      // Create separate rooms from merged data
      const rooms = [];
      
      // Main area room
      rooms.push({
        name: `${mergedRoom.name} #1`,
        measurements: { ...mergedRoom.main_area.measurements }
      });
      
      // Sub-area rooms
      mergedRoom.sub_areas.forEach((subArea, index) => {
        rooms.push({
          name: `${mergedRoom.name} #${index + 2}`,
          measurements: { ...subArea.measurements },
          room_classification: {
            ...subArea.original_room_classification,
            sub_area_type: subArea.type,
            is_sub_area: true,
            material_applicable: subArea.material_applicable,
            user_confirmed: true
          }
        });
      });
      
      // Replace merged room with separate rooms
      location.rooms.splice(roomIndex, 1, ...rooms);
    }
    
    setEditableData(newData);
  };

  const mergeRooms = (locationIndex, roomIndex1, roomIndex2) => {
    const newData = JSON.parse(JSON.stringify(editableData));
    const location = newData[locationIndex];
    
    if (location && location.rooms[roomIndex1] && location.rooms[roomIndex2]) {
      const room1 = location.rooms[roomIndex1];
      const room2 = location.rooms[roomIndex2];
      
      // Check if one is a sub-area
      const room1IsSubArea = room1.room_classification?.is_sub_area;
      const room2IsSubArea = room2.room_classification?.is_sub_area;
      
      if (room1IsSubArea && !room2IsSubArea) {
        mergeRoomsAsSubArea(locationIndex, roomIndex2, roomIndex1);
      } else if (room2IsSubArea && !room1IsSubArea) {
        mergeRoomsAsSubArea(locationIndex, roomIndex1, roomIndex2); 
      } else {
        // Legacy merge for same-name rooms
        console.log('Performing legacy merge for:', room1.name, 'and', room2.name);
        
        const mergedMeasurements = {
          wall_area_sqft: (room1.measurements.wall_area_sqft || 0) + (room2.measurements.wall_area_sqft || 0),
          ceiling_area_sqft: (room1.measurements.ceiling_area_sqft || 0) + (room2.measurements.ceiling_area_sqft || 0),
          floor_area_sqft: (room1.measurements.floor_area_sqft || 0) + (room2.measurements.floor_area_sqft || 0),
          walls_and_ceiling_area_sqft: (room1.measurements.walls_and_ceiling_area_sqft || 0) + (room2.measurements.walls_and_ceiling_area_sqft || 0),
          floor_perimeter_lf: (room1.measurements.floor_perimeter_lf || 0) + (room2.measurements.floor_perimeter_lf || 0),
          ceiling_perimeter_lf: (room1.measurements.ceiling_perimeter_lf || 0) + (room2.measurements.ceiling_perimeter_lf || 0),
          flooring_area_sy: ((room1.measurements.floor_area_sqft || 0) + (room2.measurements.floor_area_sqft || 0)) / 9.0,
          height: Math.max(room1.measurements.height || 0, room2.measurements.height || 0),
          openings: mergeOpenings(
            room1.measurements.openings || [], 
            room2.measurements.openings || [], 
            room1.name, 
            room2.name
          )
        };
        
        // Update first room and remove second room
        room1.measurements = mergedMeasurements;
        room1.name = room1.name.replace(/ #\d+$/, ''); // Remove numbering
        
        // Remove the second room (adjust index based on position)
        if (roomIndex2 > roomIndex1) {
          location.rooms.splice(roomIndex2, 1);
        } else {
          location.rooms.splice(roomIndex2, 1);
          // No need to adjust roomIndex1 since we already updated room1
        }
      }
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

  // Define valid opening types for each sub-area type
  const getValidOpeningsForSubArea = (subAreaType) => {
    const openingRules = {
      // Areas that can have doors/windows (accessible spaces)
      'closet': ['door'], // Closets have doors but typically no windows
      'pantry': ['door'], // Pantries have doors but typically no windows
      'alcove': ['window'], // Alcoves might have windows but no separate doors
      'walk_in_shower': [], // Walk-in showers are open, no doors/windows in the shower area itself
      'walk-in shower': [], // Same as above
      
      // Areas that typically don't have openings (fixtures/built-ins)
      'bathtub': [], // Bathtubs don't have doors or windows
      'shower_booth': [], // Shower booths are enclosed but don't have separate doors/windows
      'shower booth': [], // Same as above
      'cabinet': [], // Cabinets don't have doors/windows to outside
      'fixture': [], // Other fixtures don't have openings
      
      // Custom types - default to allowing doors and windows
      'default': ['door', 'window', 'open_wall']
    };
    
    return openingRules[subAreaType?.toLowerCase()] || openingRules['default'];
  };

  // Filter openings based on sub-area type validity
  const filterOpeningsForSubArea = (openings, subAreaType) => {
    if (!openings || !Array.isArray(openings) || !subAreaType) {
      return openings || [];
    }
    
    const validOpeningTypes = getValidOpeningsForSubArea(subAreaType);
    
    // If no openings are valid for this sub-area type, return empty array
    if (validOpeningTypes.length === 0) {
      return [];
    }
    
    // Filter openings to only include valid types
    const filteredOpenings = openings.filter(opening => {
      return validOpeningTypes.includes(opening.type);
    });
    
    return filteredOpenings;
  };

  // Validate and clean openings when sub-area type changes
  const validateSubAreaOpenings = (room, subAreaType) => {
    if (!room.measurements?.openings || !subAreaType) {
      return room;
    }
    
    const validOpenings = filterOpeningsForSubArea(room.measurements.openings, subAreaType);
    const removedCount = room.measurements.openings.length - validOpenings.length;
    
    if (removedCount > 0) {
      const removedOpenings = room.measurements.openings.filter(opening => 
        !validOpenings.some(valid => valid.type === opening.type && valid.size === opening.size)
      );
      
      // Ask user if they want to keep the invalid openings
      const keepInvalidOpenings = confirm(
        `Sub-area type "${subAreaType}" configured.\n\n${removedCount} opening(s) are typically not valid for this sub-area type:\n${removedOpenings.map(o => `• ${o.type} (${o.size})`).join('\n')}\n\nDo you want to keep these openings anyway?\n\nClick OK to KEEP all openings\nClick Cancel to REMOVE invalid openings`
      );
      
      if (keepInvalidOpenings) {
        // User wants to keep all openings - return original room
        setTimeout(() => {
          alert(`All openings kept for "${subAreaType}" sub-area.\n\nNote: Some openings may be marked as unusual for this sub-area type but will be preserved.`);
        }, 100);
        return room;
      } else {
        // User wants to remove invalid openings
        const updatedRoom = { ...room };
        updatedRoom.measurements = { ...room.measurements };
        updatedRoom.measurements.openings = validOpenings;
        
        setTimeout(() => {
          alert(`${removedCount} opening(s) removed for "${subAreaType}" sub-area.\n\nRemaining openings: ${validOpenings.length}\n\nYou can add them back manually if needed using Edit mode.`);
        }, 100);
        
        return updatedRoom;
      }
    }
    
    return room;
  };

  // Opening editing functions - support both merged and regular rooms
  const getOpeningsArray = (room) => {
    // For merged rooms, use main_area.measurements.openings
    if (room.is_merged && room.main_area?.measurements?.openings) {
      return room.main_area.measurements.openings;
    }
    // For regular rooms, use measurements.openings
    return room.measurements?.openings || [];
  };

  const updateOpening = (locationIndex, roomIndex, openingIndex, field, value) => {
    const newData = JSON.parse(JSON.stringify(editableData));
    const room = newData[locationIndex]?.rooms[roomIndex];
    
    if (room) {
      // Determine which openings array to use
      let openingsArray;
      if (room.is_merged && room.main_area?.measurements) {
        if (!room.main_area.measurements.openings) {
          room.main_area.measurements.openings = [];
        }
        openingsArray = room.main_area.measurements.openings;
      } else {
        if (!room.measurements) room.measurements = {};
        if (!room.measurements.openings) {
          room.measurements.openings = [];
        }
        openingsArray = room.measurements.openings;
      }
      
      const opening = openingsArray[openingIndex];
      if (opening) {
        opening[field] = value;
        setEditableData(newData);
      }
    }
  };

  const addOpening = (locationIndex, roomIndex) => {
    const newData = JSON.parse(JSON.stringify(editableData));
    const room = newData[locationIndex]?.rooms[roomIndex];
    
    if (room) {
      const newOpening = {
        type: 'door',
        size: '3\' X 6\'8"',
        opens_to: ''
      };
      
      // Determine which openings array to use
      if (room.is_merged && room.main_area?.measurements) {
        if (!room.main_area.measurements.openings) {
          room.main_area.measurements.openings = [];
        }
        room.main_area.measurements.openings.push(newOpening);
      } else {
        if (!room.measurements) room.measurements = {};
        if (!room.measurements.openings) {
          room.measurements.openings = [];
        }
        room.measurements.openings.push(newOpening);
      }
      
      setEditableData(newData);
    }
  };

  const removeOpening = (locationIndex, roomIndex, openingIndex) => {
    const newData = JSON.parse(JSON.stringify(editableData));
    const room = newData[locationIndex]?.rooms[roomIndex];
    
    if (room) {
      // Determine which openings array to use
      let openingsArray;
      if (room.is_merged && room.main_area?.measurements?.openings) {
        openingsArray = room.main_area.measurements.openings;
      } else if (room.measurements?.openings) {
        openingsArray = room.measurements.openings;
      }
      
      if (openingsArray && openingsArray[openingIndex]) {
        openingsArray.splice(openingIndex, 1);
        setEditableData(newData);
        setEditingOpening(null); // Close editor if we're editing this opening
      }
    }
  };

  const saveChanges = async () => {
    console.log('💾 Starting save changes process');
    console.log('📊 Current editableData:', editableData);
    setSaveStatus('saving');
    
    try {
      // Update local state first
      setParsedData(JSON.parse(JSON.stringify(editableData)));
      sessionStorage.setItem(`measurementData_${sessionId}`, JSON.stringify(editableData));
      console.log('✅ Updated sessionStorage and parsedData');
      
      // Dispatch custom event for same-window components to detect the change
      window.dispatchEvent(new CustomEvent('customStorageChange', {
        detail: {
          key: `measurementData_${sessionId}`,
          newValue: JSON.stringify(editableData)
        }
      }));
      
      // Save to database via API (manual save)
      const requestBody = {
        measurementData: editableData
      };
      
      console.log('📤 Sending to API:', requestBody);
      console.log('📊 Request body size:', JSON.stringify(requestBody).length, 'characters');
      
      const response = await fetch(`http://localhost:8001/api/pre-estimate/measurement/save/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('🎉 API save response:', result);
      logger.info('Room changes saved to database', { 
        sessionId, 
        totalRooms: editableData?.reduce((total, loc) => total + (loc.rooms?.length || 0), 0),
        success: result.success 
      });
      
      setSaveStatus('success');
      setEditMode(false);
      console.log('✅ Save completed successfully');
      
      // Clear success status after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
      
    } catch (error) {
      logger.error('Error saving room changes to database:', error);
      console.error('Failed to save changes to database:', error);
      
      setSaveStatus('error');
      setEditMode(false);
      
      // Show user-friendly error message
      alert('변경사항이 일부만 저장되었습니다. 데이터베이스 저장에 실패했지만 현재 세션에서는 변경사항이 유지됩니다.');
      
      // Clear error status after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    }
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

      {/* Enhanced Progress Modal */}
      {showProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4 relative overflow-hidden">
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 opacity-60"></div>
            
            <div className="relative z-10">
              <div className="text-center">
                {/* Enhanced animated icon */}
                <div className="mb-6 relative">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4 shadow-lg">
                    {processingProgress.stage === 'completed' ? (
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : processingProgress.stage === 'error' ? (
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg className="w-10 h-10 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </div>
                  
                  {/* Pulsing rings animation */}
                  {processingProgress.stage !== 'completed' && processingProgress.stage !== 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-24 h-24 border-2 border-blue-300 rounded-full animate-ping opacity-75"></div>
                      <div className="w-28 h-28 border-2 border-purple-300 rounded-full animate-ping opacity-50 absolute" style={{ animationDelay: '0.5s' }}></div>
                    </div>
                  )}
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {processingProgress.stage === 'completed' ? 'Processing Complete!' :
                   processingProgress.stage === 'error' ? 'Processing Failed' :
                   'Processing Measurement Data'}
                </h3>
                
                {/* Enhanced progress message with stage-specific content */}
                <div className="mb-6">
                  <p className="text-sm text-gray-700 mb-2 font-medium">
                    {getStageMessage(processingProgress.stage, processingProgress.message)}
                  </p>
                  
                  {/* Detailed stage description */}
                  <p className="text-xs text-gray-500">
                    {getStageDescription(processingProgress.stage)}
                  </p>
                </div>
                
                {/* Enhanced Progress Bar */}
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-2 shadow-inner">
                    <div 
                      className={`h-3 rounded-full transition-all duration-500 ease-out relative ${
                        processingProgress.stage === 'completed' ? 'bg-gradient-to-r from-green-500 to-green-600' :
                        processingProgress.stage === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600' :
                        'bg-gradient-to-r from-blue-500 to-purple-600'
                      }`}
                      style={{ width: `${processingProgress.progress}%` }}
                    >
                      {/* Animated shine effect */}
                      {processingProgress.progress > 0 && processingProgress.stage !== 'completed' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse rounded-full"></div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize font-medium text-gray-700">
                      {getStageDisplayName(processingProgress.stage)}
                    </span>
                    <span className="font-bold text-gray-900">{processingProgress.progress}%</span>
                  </div>
                </div>
                
                {/* Status-specific content */}
                {processingProgress.stage === 'error' && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-red-800">Processing Failed</p>
                        <p className="text-xs text-red-600 mt-1">
                          Please try again or contact support if the issue persists.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {processingProgress.stage === 'completed' && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-medium text-green-800">
                        Measurement data processed successfully!
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Processing stages indicator */}
                {processingProgress.stage !== 'completed' && processingProgress.stage !== 'error' && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      {['initializing', 'parsing', 'calculating', 'finalizing'].map((stage, index) => (
                        <div key={stage} className="flex flex-col items-center space-y-1">
                          <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                            getStageIndex(processingProgress.stage) > index ? 'bg-blue-500 scale-110' :
                            getStageIndex(processingProgress.stage) === index ? 'bg-blue-500 animate-pulse scale-110' :
                            'bg-gray-300'
                          }`}></div>
                          <span className={`capitalize transition-colors duration-300 ${
                            getStageIndex(processingProgress.stage) >= index ? 'text-blue-600 font-medium' : 'text-gray-400'
                          }`}>{getStageDisplayName(stage)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* File info */}
                {file && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Processing: {file.name}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
                    disabled={saveStatus === 'saving'}
                    className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonSmall}`}
                    style={{
                      opacity: saveStatus === 'saving' ? 0.6 : 1,
                      cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {saveStatus === 'saving' && '⏳ Saving...'}
                    {saveStatus === 'success' && '✅ Saved!'}
                    {saveStatus === 'error' && '❌ Error'}
                    {saveStatus === 'idle' && '💾 Save Changes'}
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
              <div key={locationIndex} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                  <h4 className="font-medium text-gray-900">{location.location}</h4>
                </div>
                {/* Table container with improved layout */}
                <div className="bg-white overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200 table-fixed">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: editMode ? '18%' : '22%'}}>
                          Room
                        </th>
                        {editMode && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '16%'}}>
                            Type
                          </th>
                        )}
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: editMode ? '12%' : '15%'}}>
                          Floor Area
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: editMode ? '12%' : '15%'}}>
                          Wall Area
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: editMode ? '8%' : '10%'}}>
                          Height
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: editMode ? '22%' : '38%'}}>
                          Openings
                        </th>
                        {editMode && (
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '12%'}}>
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
                            <td className="px-6 py-3 text-sm font-medium text-gray-900">
                              {editMode ? (
                                <div className="space-y-1">
                                  {(room.is_merged || room.room_classification?.is_merged_room) ? (
                                    <div className="space-y-2">
                                      <div className="flex items-center space-x-2">
                                        <span className="font-medium text-green-800">{room.name}</span>
                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                          Merged Room
                                        </span>
                                      </div>
                                      
                                      {/* New structure with detailed area information */}
                                      {room.room_classification?.composition ? (
                                        <div className="text-xs text-gray-700 space-y-1 bg-gray-50 p-2 rounded border">
                                          <div className="font-medium text-blue-800">
                                            Room Composition:
                                          </div>
                                          <div className="flex justify-between">
                                            <span>• Main ({room.room_classification.composition.main_area.type}):</span>
                                            <span className="font-medium">{room.room_classification.composition.main_area.area_sqft?.toFixed(1)} sq ft</span>
                                          </div>
                                          {room.room_classification.composition.sub_areas?.map((subArea, idx) => (
                                            <div key={idx} className="flex justify-between">
                                              <span className="text-purple-700">• Sub-area ({subArea.type}):</span>
                                              <span className="font-medium">
                                                {subArea.area_sqft?.toFixed(1)} sq ft
                                                {subArea.material_applicable === false && (
                                                  <span className="text-orange-600 ml-1">(No flooring)</span>
                                                )}
                                                {subArea.material_applicable === true && (
                                                  <span className="text-green-600 ml-1">(Same flooring)</span>
                                                )}
                                              </span>
                                            </div>
                                          ))}
                                          <div className="pt-1 mt-1 border-t border-gray-300 flex justify-between font-medium text-green-800">
                                            <span>Total Area:</span>
                                            <span>{room.total_measurements?.floor_area_sqft?.toFixed(1)} sq ft</span>
                                          </div>
                                        </div>
                                      ) : (
                                        /* Legacy structure support */
                                        <div className="text-xs text-gray-600 space-y-1">
                                          <div>• Main: {room.main_area?.name}</div>
                                          {room.sub_areas?.map((subArea, idx) => (
                                            <div key={idx}>• {subArea.type}: {subArea.name}</div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <>
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
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  {(room.is_merged || room.room_classification?.is_merged_room) ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center space-x-2">
                                        <span className="font-medium">{room.name}</span>
                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                          Merged
                                        </span>
                                      </div>
                                      {/* Show composition details using new simplified structure */}
                                      <div className="text-xs text-gray-600">
                                        <div>Contains: Main + {room.sub_areas?.length || 0} sub-area(s)</div>
                                        <div className="mt-1 space-y-0.5">
                                          {room.sub_areas?.map((subArea, idx) => (
                                            <div key={idx} className="text-purple-600">
                                              • {subArea.type} ({subArea.measurements?.floor_area_sqft?.toFixed(1)} sq ft)
                                              {subArea.material_applicable === false && (
                                                <span className="text-orange-600 ml-1">(No flooring)</span>
                                              )}
                                              {subArea.material_applicable === true && (
                                                <span className="text-green-600 ml-1">(Same flooring)</span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className={isEmpty ? 'text-gray-400 italic' : ''}>
                                      {room.name || 'Unnamed Room'}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            {editMode && (
                              <td className="px-4 py-3 text-sm text-gray-900">
                                <div className="space-y-2">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Sub-area Type</label>
                                    <div className="space-y-2">
                                      <input
                                        type="text"
                                        list={`subarea-types-${locationIndex}-${roomIndex}`}
                                        value={room.room_classification?.sub_area_type || ''}
                                        placeholder="Select or type sub-area type"
                                        onChange={(e) => {
                                          const subAreaType = e.target.value.trim() || null;
                                          
                                          // Define material applicability for each sub-area type
                                          const materialApplicabilityMap = {
                                            // Types that need flooring materials (same as parent)
                                            'closet': { applicable: true, reason: 'Walking space requires flooring' },
                                            'pantry': { applicable: true, reason: 'Walking space requires flooring' },
                                            'alcove': { applicable: true, reason: 'Living space requires flooring' },
                                            'walk_in_shower': { applicable: true, reason: 'Requires specialized shower flooring' },
                                            'walk-in shower': { applicable: true, reason: 'Requires specialized shower flooring' },
                                            // Types that don't need flooring materials (separate treatment)
                                            'bathtub': { applicable: false, reason: 'Has built-in tub surface, no additional flooring' },
                                            'shower_booth': { applicable: false, reason: 'Has built-in shower pan, separate from room flooring' },
                                            'shower booth': { applicable: false, reason: 'Has built-in shower pan, separate from room flooring' },
                                            'cabinet': { applicable: false, reason: 'Interior cabinet surfaces, not floor area' },
                                            'fixture': { applicable: false, reason: 'Fixed equipment area, no flooring needed' }
                                          };
                                          
                                          // Update all classification fields at once to avoid race conditions
                                          const newData = JSON.parse(JSON.stringify(editableData));
                                          if (newData[locationIndex] && newData[locationIndex].rooms[roomIndex]) {
                                            if (!newData[locationIndex].rooms[roomIndex].room_classification) {
                                              newData[locationIndex].rooms[roomIndex].room_classification = {};
                                            }
                                            
                                            const roomClassification = newData[locationIndex].rooms[roomIndex].room_classification;
                                            
                                            // Update sub-area type
                                            roomClassification.sub_area_type = subAreaType;
                                            
                                            // Update material applicability based on sub-area type
                                            if (subAreaType && materialApplicabilityMap[subAreaType.toLowerCase()]) {
                                              const config = materialApplicabilityMap[subAreaType.toLowerCase()];
                                              roomClassification.is_sub_area = true;
                                              roomClassification.material_applicable = config.applicable;
                                              roomClassification.user_confirmed = true;
                                              
                                              // Show user-friendly message about material applicability
                                              const materialStatus = config.applicable ? 
                                                'will use the same flooring materials as the parent room' : 
                                                'will NOT use flooring materials (handled separately)';
                                              
                                              alert(`${subAreaType.charAt(0).toUpperCase() + subAreaType.slice(1)} selected.\n\nThis area ${materialStatus}.\n\nReason: ${config.reason}`);
                                            } else if (subAreaType === null) {
                                              // Reset to regular room
                                              roomClassification.is_sub_area = false;
                                              roomClassification.material_applicable = true;
                                              roomClassification.user_confirmed = true;
                                            } else if (subAreaType) {
                                              // Custom sub-area type - ask user about material applicability
                                              roomClassification.is_sub_area = true;
                                              roomClassification.user_confirmed = true;
                                              
                                              const userChoice = confirm(`Custom sub-area type "${subAreaType}" selected.\n\nDoes this area need flooring materials (same as parent room)?\n\nClick OK if YES (needs flooring)\nClick Cancel if NO (no flooring needed)`);
                                              roomClassification.material_applicable = userChoice;
                                              
                                              const materialStatus = userChoice ? 
                                                'will use the same flooring materials as the parent room' : 
                                                'will NOT use flooring materials (handled separately)';
                                              
                                              alert(`Custom sub-area "${subAreaType}" configured.\n\nThis area ${materialStatus}.`);
                                            }
                                            
                                            // Validate and filter openings for the sub-area
                                            if (subAreaType) {
                                              const room = newData[locationIndex].rooms[roomIndex];
                                              const validatedRoom = validateSubAreaOpenings(room, subAreaType);
                                              newData[locationIndex].rooms[roomIndex] = validatedRoom;
                                            }
                                            
                                            // Apply the changes
                                            setEditableData(newData);
                                          }
                                          
                                          // Auto-suggest room name when sub-area type is selected
                                          if (subAreaType) {
                                            const currentName = room.name || '';
                                            const baseName = currentName.replace(/ #\d+$/, '');
                                            
                                            // Find a potential parent room
                                            const parentRoom = location.rooms.find((r, i) => {
                                              const rBaseName = r.name.replace(/ #\d+$/, '');
                                              return i !== roomIndex && 
                                                     rBaseName !== baseName && 
                                                     !r.room_classification?.is_sub_area &&
                                                     (rBaseName.toLowerCase().includes(subAreaType) || 
                                                      (subAreaType === 'bathtub' && rBaseName.toLowerCase().includes('bathroom')));
                                            });
                                            
                                            if (parentRoom && !currentName.startsWith(parentRoom.name.replace(/ #\d+$/, ''))) {
                                              const suggestedName = `${parentRoom.name.replace(/ #\d+$/, '')} #2`;
                                              if (confirm(`Suggested room name: "${suggestedName}". Update room name?`)) {
                                                updateRoomName(locationIndex, roomIndex, suggestedName);
                                              }
                                            }
                                          }
                                        }}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                      <datalist id={`subarea-types-${locationIndex}-${roomIndex}`}>
                                        <option value="">Regular Room</option>
                                        <option value="closet">Closet (📁 with flooring)</option>
                                        <option value="pantry">Pantry (📁 with flooring)</option>
                                        <option value="alcove">Alcove (📁 with flooring)</option>
                                        <option value="walk-in shower">Walk-in Shower (📁 with flooring)</option>
                                        <option value="bathtub">Bathtub (🚫 no flooring)</option>
                                        <option value="shower booth">Shower Booth (🚫 no flooring)</option>
                                        <option value="cabinet">Cabinet (🚫 no flooring)</option>
                                        <option value="fixture">Other Fixture (🚫 no flooring)</option>
                                      </datalist>
                                      
                                    </div>
                                  </div>
                                  {room.room_classification?.is_sub_area && (
                                    <div className="flex items-center space-x-1">
                                      <span className={`text-xs px-2 py-1 rounded-full ${
                                        room.room_classification?.material_applicable 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-orange-100 text-orange-800'
                                      }`}>
                                        {room.room_classification?.material_applicable ? 'Material ✓' : 'No Material'}
                                      </span>
                                      {room.room_classification?.detection_confidence && (
                                        <span className="text-xs text-gray-500">
                                          ({room.room_classification.detection_confidence} confidence)
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            )}
                            <td className="px-6 py-3 text-sm text-gray-900 text-center">
                              {(room.is_merged || room.room_classification?.is_merged_room) ? (
                                <div className="space-y-1">
                                  <div className="font-medium text-green-800">
                                    {(room.main_area?.measurements?.floor_area_sqft || room.measurements?.floor_area_sqft)?.toFixed(1)} sq ft
                                    <div className="text-xs text-gray-600">(Material calc)</div>
                                  </div>
                                  {room.sub_areas && (
                                    <div className="text-xs text-gray-600 space-y-0.5">
                                      <div className="text-blue-700">
                                        Main: {room.main_area?.measurements?.floor_area_sqft?.toFixed(1)} sq ft
                                      </div>
                                      {room.sub_areas?.map((subArea, idx) => (
                                        <div key={idx} className="text-purple-600">
                                          {subArea.type}: {subArea.measurements?.floor_area_sqft?.toFixed(1)} sq ft
                                        </div>
                                      ))}
                                      <div className="border-t border-gray-300 pt-0.5 font-medium text-green-700">
                                        Total: {room.total_measurements?.floor_area_sqft?.toFixed(1)} sq ft
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span>{(room.main_area?.measurements?.floor_area_sqft || room.measurements?.floor_area_sqft)?.toFixed(1)} sq ft</span>
                              )}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-900 text-center">
                              {(room.is_merged || room.room_classification?.is_merged_room) ? (
                                <div className="space-y-1">
                                  <div className="font-medium text-green-800">
                                    {(room.main_area?.measurements?.wall_area_sqft || room.measurements?.wall_area_sqft)?.toFixed(1)} sq ft
                                    <div className="text-xs text-gray-600">(Material calc)</div>
                                  </div>
                                  {room.total_measurements && (
                                    <div className="text-xs text-green-700 font-medium">
                                      Total: {room.total_measurements.wall_area_sqft?.toFixed(1)} sq ft
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span>{(room.main_area?.measurements?.wall_area_sqft || room.measurements?.wall_area_sqft)?.toFixed(1)} sq ft</span>
                              )}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-900 text-center">
                              {(room.main_area?.measurements?.height || room.measurements?.height)}' 
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-900">
                              <div className="space-y-1">
                                {(room.main_area?.measurements?.openings || room.measurements?.openings)?.map((opening, openingIndex) => {
                                  // Check if this opening is valid for the sub-area type
                                  const isSubArea = room.room_classification?.is_sub_area;
                                  const subAreaType = room.room_classification?.sub_area_type;
                                  const validOpeningTypes = isSubArea && subAreaType ? getValidOpeningsForSubArea(subAreaType) : null;
                                  const isValidOpening = !validOpeningTypes || validOpeningTypes.includes(opening.type);
                                  const isEditing = editingOpening?.locationIndex === locationIndex && 
                                                   editingOpening?.roomIndex === roomIndex && 
                                                   editingOpening?.openingIndex === openingIndex;
                                  
                                  return (
                                    <div key={openingIndex} className="flex items-center space-x-2 group">
                                      {isEditing ? (
                                        // Edit mode for this opening
                                        <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 rounded border text-xs">
                                          <select
                                            value={opening.type}
                                            onChange={(e) => updateOpening(locationIndex, roomIndex, openingIndex, 'type', e.target.value)}
                                            className="text-xs border border-gray-300 rounded px-1 py-1 min-w-16"
                                          >
                                            <option value="door">Door</option>
                                            <option value="window">Window</option>
                                            <option value="open_wall">Open Wall</option>
                                          </select>
                                          <input
                                            type="text"
                                            value={opening.size}
                                            onChange={(e) => updateOpening(locationIndex, roomIndex, openingIndex, 'size', e.target.value)}
                                            className="text-xs border border-gray-300 rounded px-1 py-1 w-16 min-w-16"
                                            placeholder="Size"
                                          />
                                          <input
                                            type="text"
                                            value={opening.opens_to || ''}
                                            onChange={(e) => updateOpening(locationIndex, roomIndex, openingIndex, 'opens_to', e.target.value)}
                                            className="text-xs border border-gray-300 rounded px-1 py-1 w-14 min-w-14"
                                            placeholder="To"
                                          />
                                          <button
                                            onClick={() => setEditingOpening(null)}
                                            className="text-xs text-green-600 hover:text-green-800 px-1"
                                            title="Save changes"
                                          >
                                            ✓
                                          </button>
                                          <button
                                            onClick={() => removeOpening(locationIndex, roomIndex, openingIndex)}
                                            className="text-xs text-red-600 hover:text-red-800 px-1"
                                            title="Delete opening"
                                          >
                                            🗑️
                                          </button>
                                        </div>
                                      ) : (
                                        // Display mode
                                        <>
                                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            !isValidOpening ? 'bg-red-100 text-red-800 line-through' :
                                            opening.type === 'door' ? 'bg-blue-100 text-blue-800' :
                                            opening.type === 'window' ? 'bg-green-100 text-green-800' :
                                            'bg-orange-100 text-orange-800'
                                          }`}>
                                            {opening.type}
                                            {!isValidOpening && (
                                              <span className="ml-1" title={`Invalid for ${subAreaType} sub-area`}>⚠️</span>
                                            )}
                                          </span>
                                          <span className="text-xs text-gray-600">
                                            {opening.size}
                                            {opening.opens_to && (
                                              <span className="text-gray-500 ml-1">→ {opening.opens_to}</span>
                                            )}
                                            {!isValidOpening && (
                                              <span className="text-red-600 ml-1 text-xs">(Invalid for {subAreaType})</span>
                                            )}
                                          </span>
                                          {editMode && (
                                            <button
                                              onClick={() => setEditingOpening({locationIndex, roomIndex, openingIndex})}
                                              className="text-xs text-blue-600 hover:text-blue-800 opacity-0 group-hover:opacity-100 transition-opacity"
                                              title="Edit opening"
                                            >
                                              ✏️
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                                {editMode && (
                                  <button
                                    onClick={() => addOpening(locationIndex, roomIndex)}
                                    className="text-xs text-green-600 hover:text-green-800 mt-1 flex items-center space-x-1"
                                    title="Add new opening"
                                  >
                                    <span>+ Add Opening</span>
                                  </button>
                                )}
                              </div>
                            </td>
                            {editMode && (
                              <td className="px-6 py-3 text-sm text-gray-900 text-center">
                                <div className="flex flex-col space-y-1 items-center">
                                  {room.is_merged ? (
                                    <button
                                      onClick={() => unmergeRoom(locationIndex, roomIndex)}
                                      className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200"
                                      title="Split merged room back to separate rooms"
                                    >
                                      ↗️ Unmerge
                                    </button>
                                  ) : (
                                    <>
                                      {hasDuplicate && (
                                        <button
                                          onClick={() => {
                                            console.log('Looking for duplicate of:', room.name);
                                            console.log('Available rooms:', location.rooms.map((r, i) => `${i}: ${r.name}`));
                                            
                                            const duplicateIndex = location.rooms.findIndex((r, i) => {
                                              const isDuplicate = i > roomIndex && r.name === room.name && room.name.trim() !== '';
                                              console.log(`Room ${i} (${r.name}): matches name=${r.name === room.name}, after current=${i > roomIndex}, not empty=${room.name.trim() !== ''}, is duplicate=${isDuplicate}`);
                                              return isDuplicate;
                                            });
                                            
                                            console.log('Found duplicate index:', duplicateIndex);
                                            if (duplicateIndex !== -1) {
                                              console.log(`Merging room ${roomIndex} (${room.name}) with room ${duplicateIndex} (${location.rooms[duplicateIndex].name})`);
                                              mergeRooms(locationIndex, roomIndex, duplicateIndex);
                                            } else {
                                              alert('No duplicate room found');
                                            }
                                          }}
                                          className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded hover:bg-orange-200"
                                          title="Merge with duplicate room"
                                        >
                                          🔄 Merge Duplicates
                                        </button>
                                      )}
                                      {room.room_classification?.is_sub_area && !hasDuplicate && (
                                        <button
                                          onClick={() => {
                                            // Find parent room (same base name, non-sub-area)
                                            const baseName = room.name.replace(/ #\d+$/, '');
                                            const subAreaType = room.room_classification?.sub_area_type;
                                            const subAreaArea = room.measurements?.floor_area_sqft?.toFixed(1);
                                            
                                            console.log(`Merging sub-area "${room.name}" (${subAreaType}, ${subAreaArea} sq ft) as sub-area of parent room with base name: ${baseName}`);
                                            
                                            const parentIndex = location.rooms.findIndex((r, i) => {
                                              const rBaseName = r.name.replace(/ #\d+$/, '');
                                              return i !== roomIndex && 
                                                rBaseName === baseName && 
                                                !r.room_classification?.is_sub_area;
                                            });
                                          
                                            if (parentIndex !== -1) {
                                              const parentRoom = location.rooms[parentIndex];
                                              console.log(`Found parent room: ${parentRoom.name} (${parentRoom.measurements?.floor_area_sqft?.toFixed(1)} sq ft)`);
                                              console.log(`Sub-area details: ${subAreaType} area with ${subAreaArea} sq ft`);
                                              
                                              // Use the proper merge function that creates new structure
                                              mergeRoomsAsSubArea(locationIndex, parentIndex, roomIndex);
                                              
                                              // Show success message
                                              setTimeout(() => {
                                                const materialNote = ['bathtub', 'cabinet', 'fixture'].includes(subAreaType) ? 
                                                  '\nNote: Materials apply to main area only (sub-area has no physical flooring)' : 
                                                  '\nNote: Materials apply to main area only';
                                                alert(`Successfully merged "${room.name}" as ${subAreaType} sub-area of "${baseName}"!${materialNote}`);
                                              }, 100);
                                            } else {
                                              alert(`No parent room found for "${room.name}".\n\nPlease ensure there's a main room with base name "${baseName}".\n\nAvailable rooms: ${location.rooms.map(r => r.name).join(', ')}`);
                                            }
                                          }}
                                          className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200"
                                          title={`Merge "${room.name}" as ${room.room_classification?.sub_area_type || 'sub-area'} of parent room`}
                                        >
                                          Merge as Sub-area
                                        </button>
                                      )}
                                    </>
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