import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MaterialAnalysisModal from '../../components/MaterialAnalysisModal';
import { useAutoSave, autoSaveAPI } from '../../utils/autoSave';
import AutoSaveIndicator from '../../components/AutoSaveIndicator';

const MaterialScope = React.memo(() => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session');
  
  const [measurementData, setMeasurementData] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isDefaultScopeExpanded, setIsDefaultScopeExpanded] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isRoomAnalysisModalOpen, setIsRoomAnalysisModalOpen] = useState(false);
  const [roomAnalysisTarget, setRoomAnalysisTarget] = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');

  // Default scope state - Updated to support multiple materials per surface type
  const [defaultScope, setDefaultScope] = useState({
    material: {
      Floor: ["Laminate Wood"],
      wall: ["drywall"],
      ceiling: ["drywall"],
      Baseboard: ["wood"],
      "Quarter Round": ["wood"]
    },
    material_underlayment: {
      Floor: ["6mm foam pad"]
    }
  });

  // Locations and rooms state
  const [locations, setLocations] = useState([]);

  // Helper function for array handling - memoized (moved up to fix initialization order)
  const ensureArray = useCallback((value) => {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === '') return [];
    return [value];
  }, []);

  // Materials that may need underlayment - memoized to prevent recreation
  const materialsWithUnderlayment = useMemo(() => ['carpet', 'laminate', 'vinyl', 'engineered hardwood', 'luxury vinyl plank'], []);

  // Helper function to check if material needs underlayment - memoized
  const needsUnderlayment = useCallback((materialValue) => {
    if (!materialValue) return false;
    const lowerMaterial = materialValue.toLowerCase();
    return materialsWithUnderlayment.some(material => lowerMaterial.includes(material));
  }, [materialsWithUnderlayment]);

  // Helper functions for multi-material handling - memoized (moved up to fix initialization order)
  const addMaterialToArray = useCallback((materialArray, newMaterial) => {
    const array = ensureArray(materialArray);
    if (newMaterial && !array.includes(newMaterial)) {
      return [...array, newMaterial];
    }
    return array;
  }, [ensureArray]);

  const removeMaterialFromArray = useCallback((materialArray, materialToRemove) => {
    const array = ensureArray(materialArray);
    return array.filter(material => material !== materialToRemove);
  }, [ensureArray]);

  const updateMaterialInArray = useCallback((materialArray, oldMaterial, newMaterial) => {
    if (!newMaterial) return ensureArray(materialArray);
    const array = ensureArray(materialArray);
    const index = array.indexOf(oldMaterial);
    if (index !== -1) {
      const updated = [...array];
      updated[index] = newMaterial;
      return updated;
    }
    return array;
  }, [ensureArray]);

  // Function to synchronize locations with measurement data while preserving existing settings - memoized
  const synchronizeLocationsWithMeasurementData = useCallback((measurementData, existingLocations) => {
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
              material_override: {}, // Will support arrays for multiple materials
              material_underlayment_override: {} // Will support arrays for multiple underlayments
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
            material_override: {}, // Will support arrays for multiple materials
            material_underlayment_override: {} // Will support arrays for multiple underlayments
          })) || []
        };
      }
    });
    
    return syncedLocations;
  }, []);

  // Load measurement data and initialize locations
  useEffect(() => {
    const loadData = async () => {
      if (sessionId) {
        try {
          // Always load measurement data first - try sessionStorage, then API
          let parsedMeasurementData = null;
          const storedData = sessionStorage.getItem(`measurementData_${sessionId}`);
          
          if (storedData) {
            // Load from sessionStorage
            parsedMeasurementData = JSON.parse(storedData);
            console.log('Material Scope: Loaded measurement data from sessionStorage:', parsedMeasurementData);
          } else {
            // Load from API as fallback
            console.log('Material Scope: No data in sessionStorage, loading from API...');
            try {
              const response = await fetch(`http://localhost:8001/api/pre-estimate/measurement/data/${sessionId}`);
              if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
              }
              const apiData = await response.json();
              if (apiData.success && apiData.data) {
                parsedMeasurementData = apiData.data;
                // Store in sessionStorage for subsequent use
                sessionStorage.setItem(`measurementData_${sessionId}`, JSON.stringify(parsedMeasurementData));
                console.log('Material Scope: Loaded measurement data from API:', parsedMeasurementData);
              } else {
                throw new Error('Invalid API response format');
              }
            } catch (apiError) {
              console.error('Material Scope: Failed to load from API:', apiError);
              console.warn('No measurement data found in sessionStorage or API');
              return;
            }
          }
          
          if (!parsedMeasurementData) {
            console.warn('No measurement data available');
            return;
          }
          
          setMeasurementData(parsedMeasurementData);
          
          // Then try to load saved material scope from database
          const savedData = await autoSaveAPI.getMaterialScope(sessionId);
          if (savedData.scopeData && savedData.scopeData.locations && savedData.scopeData.locations.length > 0) {
            // Load from database and synchronize with current measurement data
            const migratedDefaultScope = migrateToArrayFormat(savedData.scopeData.default_scope || defaultScope);
            setDefaultScope(migratedDefaultScope);
            
            // Migrate and synchronize saved locations with current measurement data
            const migratedLocations = savedData.scopeData.locations?.map(location => ({
              ...location,
              rooms: location.rooms.map(room => ({
                ...room,
                material_override: migrateObjectToArrayFormat(room.material_override || {}),
                material_underlayment_override: migrateObjectToArrayFormat(room.material_underlayment_override || {})
              }))
            })) || [];
            
            const syncedLocations = synchronizeLocationsWithMeasurementData(
              parsedMeasurementData, 
              migratedLocations
            );
            setLocations(syncedLocations);
          } else {
            // Load existing material scope data from sessionStorage or initialize
            const existingMaterialScope = sessionStorage.getItem(`materialScope_${sessionId}`);
            if (existingMaterialScope) {
              const parsedMaterialScope = JSON.parse(existingMaterialScope);
              
              // Migrate old format to new array format
              const migratedDefaultScope = migrateToArrayFormat(parsedMaterialScope.default_scope || defaultScope);
              setDefaultScope(migratedDefaultScope);
              
              // Migrate and synchronize locations with current measurement data
              const migratedLocations = parsedMaterialScope.locations?.map(location => ({
                ...location,
                rooms: location.rooms.map(room => ({
                  ...room,
                  material_override: migrateObjectToArrayFormat(room.material_override || {}),
                  material_underlayment_override: migrateObjectToArrayFormat(room.material_underlayment_override || {})
                }))
              })) || [];
              
              const syncedLocations = synchronizeLocationsWithMeasurementData(
                parsedMeasurementData, 
                migratedLocations
              );
              setLocations(syncedLocations);
            } else {
              // Initialize locations based on measurement data
              const initialLocations = parsedMeasurementData.map(location => ({
                location: location.location,
                rooms: location.rooms?.map(room => ({
                  name: room.name,
                  use_default_material: "Y",
                  material_override: {}, // Will support arrays for multiple materials
                  material_underlayment_override: {} // Will support arrays for multiple underlayments
                })) || []
              }));
              setLocations(initialLocations);
              console.log('Material Scope: Initialized locations (first time):', initialLocations);
            }
          }
        } catch (error) {
          console.error('Error loading data:', error);
          // Fallback: try to load measurement data from API if sessionStorage fails
          try {
            let parsedMeasurementData = null;
            const storedData = sessionStorage.getItem(`measurementData_${sessionId}`);
            
            if (storedData) {
              parsedMeasurementData = JSON.parse(storedData);
            } else {
              // Try API fallback
              const response = await fetch(`http://localhost:8001/api/pre-estimate/measurement/data/${sessionId}`);
              if (response.ok) {
                const apiData = await response.json();
                if (apiData.success && apiData.data) {
                  parsedMeasurementData = apiData.data;
                  sessionStorage.setItem(`measurementData_${sessionId}`, JSON.stringify(parsedMeasurementData));
                }
              }
            }
            
            if (parsedMeasurementData) {
              setMeasurementData(parsedMeasurementData);
              
              // Initialize locations based on measurement data
              const initialLocations = parsedMeasurementData.map(location => ({
                location: location.location,
                rooms: location.rooms?.map(room => ({
                  name: room.name,
                  use_default_material: "Y",
                  material_override: {}, // Will support arrays for multiple materials
                  material_underlayment_override: {} // Will support arrays for multiple underlayments
                })) || []
              }));
              setLocations(initialLocations);
            }
          } catch (fallbackError) {
            console.error('Error in fallback data loading:', fallbackError);
          }
        }
      }
      setLoading(false);
    };
    
    loadData();
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

  // Setup auto-save with useCallback to prevent recreation
  const autoSaveCallback = useCallback(async (data) => {
    if (!sessionId) return;
    
    try {
      await autoSaveAPI.saveMaterialScope(sessionId, {
        scopeData: data.scopeData,
        roomOpenings: {},  // Add room openings data if needed
        mergedRooms: {}    // Add merged rooms data if needed
      });
      
      // Also save to sessionStorage for backward compatibility
      sessionStorage.setItem(`materialScope_${sessionId}`, JSON.stringify(data.scopeData));
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [sessionId]);

  // Stable status change callback
  const handleStatusChange = useCallback((status) => {
    setAutoSaveStatus(status);
  }, []);

  const { save: autoSave, cleanup: cleanupAutoSave } = useAutoSave(
    sessionId ? `material-scope-${sessionId}` : '',
    autoSaveCallback,
    {
      debounceTime: 2000,
      periodicSaveInterval: 30000,
      onStatusChange: handleStatusChange
    }
  );

  // Auto-save when data changes - removed autoSave from dependencies to prevent infinite loop
  // and added proper serialization check
  const lastSavedDataRef = useRef(null);
  
  useEffect(() => {
    if (sessionId && autoSave && (defaultScope || locations.length > 0)) {
      const materialScopeData = {
        scopeData: {
          default_scope: defaultScope,
          locations: locations
        }
      };
      
      // Only trigger auto-save if data has actually changed
      const currentDataString = JSON.stringify(materialScopeData);
      if (lastSavedDataRef.current !== currentDataString) {
        lastSavedDataRef.current = currentDataString;
        autoSave(materialScopeData);
      }
    }
  }, [sessionId, defaultScope, locations]); // Removed autoSave from dependencies

  // Cleanup auto-save on unmount
  useEffect(() => {
    return () => {
      cleanupAutoSave();
    };
  }, [cleanupAutoSave]);

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

  const handleDefaultScopeChange = useCallback((category, key, value, action = 'set') => {
    setDefaultScope(prev => {
      const newScope = { ...prev };
      
      if (action === 'add') {
        // Add new material to array
        const currentArray = ensureArray(prev[category]?.[key]);
        newScope[category] = {
          ...prev[category],
          [key]: addMaterialToArray(currentArray, value)
        };
      } else if (action === 'remove') {
        // Remove material from array
        const currentArray = ensureArray(prev[category]?.[key]);
        newScope[category] = {
          ...prev[category],
          [key]: removeMaterialFromArray(currentArray, value)
        };
      } else if (action === 'update') {
        // Update specific material in array (value should be {oldValue, newValue})
        const currentArray = ensureArray(prev[category]?.[key]);
        newScope[category] = {
          ...prev[category],
          [key]: updateMaterialInArray(currentArray, value.oldValue, value.newValue)
        };
      } else {
        // Default: set entire array
        const valueArray = ensureArray(value);
        newScope[category] = {
          ...prev[category],
          [key]: valueArray
        };
      }
      
      // If changing materials that might need underlayment, manage the underlayment field
      if (category === 'material') {
        const materialArray = ensureArray(newScope.material[key]);
        const anyMaterialNeedsUnderlayment = materialArray.some(mat => needsUnderlayment(mat));
        const hasUnderlayment = prev.material_underlayment && prev.material_underlayment[key];
        
        if (anyMaterialNeedsUnderlayment && !hasUnderlayment) {
          // Add default underlayment
          newScope.material_underlayment = {
            ...prev.material_underlayment,
            [key]: [key.toLowerCase().includes('floor') ? '6mm foam pad' : 'standard underlayment']
          };
        } else if (!anyMaterialNeedsUnderlayment && hasUnderlayment) {
          // Remove underlayment
          const { [key]: _removed, ...restUnderlayment } = prev.material_underlayment;
          newScope.material_underlayment = restUnderlayment;
        }
      }
      
      return newScope;
    });
  }, [ensureArray, needsUnderlayment, addMaterialToArray, removeMaterialFromArray, updateMaterialInArray]);

  // Migration helper functions to convert old single-material format to new array format - memoized
  const migrateToArrayFormat = useCallback((scope) => {
    if (!scope) return defaultScope;
    
    const migratedScope = {
      material: {},
      material_underlayment: {}
    };
    
    // Migrate materials
    if (scope.material) {
      Object.entries(scope.material).forEach(([key, value]) => {
        migratedScope.material[key] = ensureArray(value);
      });
    }
    
    // Migrate underlayments
    if (scope.material_underlayment) {
      Object.entries(scope.material_underlayment).forEach(([key, value]) => {
        migratedScope.material_underlayment[key] = ensureArray(value);
      });
    }
    
    return migratedScope;
  }, [ensureArray]);

  const migrateObjectToArrayFormat = useCallback((obj) => {
    if (!obj) return {};
    
    const migratedObj = {};
    Object.entries(obj).forEach(([key, value]) => {
      migratedObj[key] = ensureArray(value);
    });
    
    return migratedObj;
  }, [ensureArray]);


  const updateRoom = useCallback((locationIndex, roomIndex, field, value, action = 'set') => {
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
      
      const finalField = parts[parts.length - 1];
      
      // Handle array operations for material overrides
      if ((parts[0] === 'material_override' || parts[0] === 'material_underlayment_override') && action !== 'set') {
        const currentArray = ensureArray(current[finalField]);
        
        if (action === 'add') {
          current[finalField] = addMaterialToArray(currentArray, value);
        } else if (action === 'remove') {
          current[finalField] = removeMaterialFromArray(currentArray, value);
        } else if (action === 'update') {
          current[finalField] = updateMaterialInArray(currentArray, value.oldValue, value.newValue);
        }
      } else {
        // Set the final value (for non-array operations or 'set' action)
        if (action === 'set') {
          current[finalField] = value;
        }
      }
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
  }, [locations, selectedRoom, ensureArray, addMaterialToArray, removeMaterialFromArray, updateMaterialInArray]);

  const handleRoomSelect = useCallback((location, locationIndex, room, roomIndex) => {
    setSelectedRoom({
      location,
      locationIndex,
      room,
      roomIndex
    });
  }, []);

  const saveData = useCallback(() => {
    const materialScopeData = {
      default_scope: defaultScope,
      locations: locations
    };
    
    sessionStorage.setItem(`materialScope_${sessionId}`, JSON.stringify(materialScopeData));
  }, [defaultScope, locations, sessionId]);

  const handleNext = useCallback(async () => {
    try {
      saveData();
      
      // Mark material scope as completed
      const completionStatus = JSON.parse(sessionStorage.getItem(`completionStatus_${sessionId}`) || '{}');
      completionStatus.materialScope = true;
      sessionStorage.setItem(`completionStatus_${sessionId}`, JSON.stringify(completionStatus));
      
      // Also save to database
      await autoSaveAPI.saveProgress(sessionId, {
        currentStep: 'material-scope',
        stepStatuses: completionStatus
      });
      
      // Navigate to demo scope
      navigate(`/pre-estimate/demo-scope?session=${sessionId}`);
    } catch (error) {
      console.error('Error saving completion status:', error);
      // Still navigate even if saving fails
      navigate(`/pre-estimate/demo-scope?session=${sessionId}`);
    }
  }, [saveData, sessionId, navigate]);

  const handleBack = useCallback(() => {
    navigate(`/pre-estimate/opening-verification?session=${sessionId}`);
  }, [navigate, sessionId]);

  const handleAnalysisResults = useCallback((suggestions, detectedMaterials) => {
    try {
      console.log('Applying AI analysis results:', { suggestions, detectedMaterials });
      
      // Update default scope with AI suggestions
      const newDefaultScope = { ...defaultScope };
      
      suggestions.suggestions.forEach(suggestion => {
        if (suggestion.category === 'material') {
          const currentMaterials = ensureArray(newDefaultScope.material[suggestion.field_name]);
          newDefaultScope.material = {
            ...newDefaultScope.material,
            [suggestion.field_name]: addMaterialToArray(currentMaterials, suggestion.suggested_value)
          };
        } else if (suggestion.category === 'material_underlayment') {
          const currentUnderlayments = ensureArray(newDefaultScope.material_underlayment[suggestion.field_name]);
          newDefaultScope.material_underlayment = {
            ...newDefaultScope.material_underlayment,
            [suggestion.field_name]: addMaterialToArray(currentUnderlayments, suggestion.suggested_value)
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
  }, [defaultScope, ensureArray, addMaterialToArray]);

  const handleRoomAnalysisResults = useCallback((suggestions, detectedMaterials) => {
    try {
      console.log('Applying room-specific AI analysis results:', { suggestions, detectedMaterials, roomAnalysisTarget });
      
      if (!roomAnalysisTarget) {
        throw new Error('No room target specified');
      }

      const { locationIndex, roomIndex } = roomAnalysisTarget;
      const newLocations = [...locations];
      
      // Set the room to use custom materials (not default)
      newLocations[locationIndex].rooms[roomIndex].use_default_material = 'N';
      
      // Apply AI suggestions to the specific room
      suggestions.suggestions.forEach(suggestion => {
        if (suggestion.category === 'material') {
          if (!newLocations[locationIndex].rooms[roomIndex].material_override) {
            newLocations[locationIndex].rooms[roomIndex].material_override = {};
          }
          const currentMaterials = ensureArray(newLocations[locationIndex].rooms[roomIndex].material_override[suggestion.field_name]);
          newLocations[locationIndex].rooms[roomIndex].material_override[suggestion.field_name] = 
            addMaterialToArray(currentMaterials, suggestion.suggested_value);
        } else if (suggestion.category === 'material_underlayment') {
          if (!newLocations[locationIndex].rooms[roomIndex].material_underlayment_override) {
            newLocations[locationIndex].rooms[roomIndex].material_underlayment_override = {};
          }
          const currentUnderlayments = ensureArray(newLocations[locationIndex].rooms[roomIndex].material_underlayment_override[suggestion.field_name]);
          newLocations[locationIndex].rooms[roomIndex].material_underlayment_override[suggestion.field_name] = 
            addMaterialToArray(currentUnderlayments, suggestion.suggested_value);
        }
      });
      
      setLocations(newLocations);
      
      // Update selected room if it's the same room being updated
      if (selectedRoom && selectedRoom.locationIndex === locationIndex && selectedRoom.roomIndex === roomIndex) {
        setSelectedRoom({
          ...selectedRoom,
          room: newLocations[locationIndex].rooms[roomIndex]
        });
      }
      
      // Show success message with applied materials
      const appliedMaterials = suggestions.suggestions.map(s => s.suggested_value).join(', ');
      const roomName = newLocations[locationIndex].rooms[roomIndex].name;
      alert(`AI analysis applied successfully to ${roomName}!\n\nDetected materials: ${appliedMaterials}\n\nThe room has been set to use custom materials. You can review and adjust these materials as needed.`);
      
    } catch (error) {
      console.error('Error applying room analysis results:', error);
      alert('Failed to apply analysis results. Please try again.');
    }
  }, [roomAnalysisTarget, locations, ensureArray, addMaterialToArray, selectedRoom]);

  const openAnalysisModal = useCallback(() => {
    setIsAnalysisModalOpen(true);
  }, []);

  const openRoomAnalysisModal = useCallback((locationIndex, roomIndex) => {
    setRoomAnalysisTarget({ locationIndex, roomIndex });
    setIsRoomAnalysisModalOpen(true);
  }, []);

  const getRoomTypeContext = useCallback(() => {
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
  }, [selectedRoom]);

  const getRoomTypeContextForTarget = useCallback((target) => {
    if (!target || !locations[target.locationIndex]?.rooms[target.roomIndex]) return null;
    
    // Try to infer room type from room name
    const roomName = locations[target.locationIndex].rooms[target.roomIndex].name.toLowerCase();
    
    if (roomName.includes('kitchen')) return 'kitchen';
    if (roomName.includes('bathroom') || roomName.includes('bath')) return 'bathroom';
    if (roomName.includes('bedroom') || roomName.includes('bed')) return 'bedroom';
    if (roomName.includes('living')) return 'living room';
    if (roomName.includes('dining')) return 'dining room';
    if (roomName.includes('office')) return 'office';
    if (roomName.includes('laundry')) return 'laundry room';
    
    return null;
  }, [locations]);

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
            <div className="flex items-center gap-4">
              <AutoSaveIndicator status={autoSaveStatus} />
              <div className="text-sm text-gray-500">
                Session: {sessionId?.slice(-8)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
          <div 
            className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
            onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Material Scope Summary</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {isSummaryExpanded 
                        ? "Review all configured materials to ensure nothing is missing"
                        : "Click to expand and review all configured materials"
                      }
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {/* Quick status indicator when collapsed */}
                    {!isSummaryExpanded && (
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <span className="font-medium text-blue-600">
                            {Object.keys(defaultScope.material).length}
                          </span>
                          <span>surfaces</span>
                        </div>
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <span className="font-medium text-green-600">
                            {locations.reduce((total, location) => total + location.rooms.length, 0)}
                          </span>
                          <span>rooms</span>
                        </div>
                        {(() => {
                          const warnings = [];
                          Object.entries(defaultScope.material).forEach(([surface, materials]) => {
                            const materialsList = ensureArray(materials);
                            if (materialsList.length === 0) {
                              warnings.push(`${surface} not configured`);
                            }
                          });
                          locations.forEach(location => {
                            location.rooms.forEach(room => {
                              if (room.use_default_material === 'N') {
                                const hasAnyOverride = Object.keys(room.material_override || {}).length > 0 ||
                                                     Object.keys(room.material_underlayment_override || {}).length > 0;
                                if (!hasAnyOverride) {
                                  warnings.push(`${room.name} needs configuration`);
                                }
                              }
                            });
                          });
                          
                          return warnings.length === 0 ? (
                            <div className="flex items-center text-green-600">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-sm">Complete</span>
                            </div>
                          ) : (
                            <div className="flex items-center text-yellow-600">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <span className="text-sm">{warnings.length} issue{warnings.length > 1 ? 's' : ''}</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isSummaryExpanded ? 'rotate-180' : ''}`}
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
          
          {isSummaryExpanded && (
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Default Materials Summary */}
                <div>
                  <h4 className="text-base font-medium text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Default Materials
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(defaultScope.material).map(([surface, materials]) => {
                      const materialsList = ensureArray(materials);
                      const underlaymentList = ensureArray(defaultScope.material_underlayment?.[surface]);
                      
                      return (
                        <div key={surface} className="bg-gray-50 p-3 rounded-lg">
                          <div className="font-medium text-gray-900 capitalize mb-1">
                            {surface.replace('_', ' ')}
                          </div>
                          <div className="text-sm text-gray-700">
                            Materials: {materialsList.length > 0 ? materialsList.join(', ') : 'Not configured'}
                          </div>
                          {underlaymentList.length > 0 && (
                            <div className="text-sm text-blue-600">
                              Underlayment: {underlaymentList.join(', ')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Room Overrides Summary */}
                <div>
                  <h4 className="text-base font-medium text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Custom Room Materials
                  </h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {locations.flatMap(location => 
                      location.rooms
                        .filter(room => room.use_default_material === 'N')
                        .map((room) => {
                          const hasCustomMaterials = Object.keys(room.material_override || {}).length > 0;
                          const hasCustomUnderlayments = Object.keys(room.material_underlayment_override || {}).length > 0;
                          
                          if (!hasCustomMaterials && !hasCustomUnderlayments) return null;
                          
                          return (
                            <div key={`${location.location}-${room.name}`} className="bg-orange-50 p-3 rounded-lg">
                              <div className="font-medium text-gray-900 mb-2">
                                {room.name} ({location.location})
                              </div>
                              
                              {/* Custom Materials */}
                              {Object.entries(room.material_override || {}).map(([surface, materials]) => {
                                const materialsList = ensureArray(materials);
                                if (materialsList.length === 0) return null;
                                
                                return (
                                  <div key={surface} className="text-sm mb-1">
                                    <span className="font-medium capitalize">{surface.replace('_', ' ')}:</span>
                                    <span className="text-gray-700 ml-1">
                                      {materialsList.join(', ')}
                                    </span>
                                  </div>
                                );
                              })}
                              
                              {/* Custom Underlayments */}
                              {Object.entries(room.material_underlayment_override || {}).map(([surface, underlayments]) => {
                                const underlaymentsList = ensureArray(underlayments);
                                if (underlaymentsList.length === 0) return null;
                                
                                return (
                                  <div key={surface} className="text-sm text-blue-600">
                                    <span className="font-medium capitalize">{surface.replace('_', ' ')} Underlayment:</span>
                                    <span className="ml-1">
                                      {underlaymentsList.join(', ')}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })
                        .filter(Boolean)
                    )}
                    
                    {locations.every(location => 
                      location.rooms.every(room => 
                        room.use_default_material === 'Y' || 
                        (Object.keys(room.material_override || {}).length === 0 && 
                         Object.keys(room.material_underlayment_override || {}).length === 0)
                      )
                    ) && (
                      <div className="text-center py-4 text-gray-500">
                        No custom room materials configured.
                        All rooms are using default materials.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {Object.keys(defaultScope.material).length}
                    </div>
                    <div className="text-sm text-gray-600">Default Surfaces</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {locations.reduce((total, location) => 
                        total + location.rooms.filter(room => room.use_default_material === 'N').length, 0
                      )}
                    </div>
                    <div className="text-sm text-gray-600">Custom Rooms</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {locations.reduce((total, location) => total + location.rooms.length, 0)}
                    </div>
                    <div className="text-sm text-gray-600">Total Rooms</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {Object.values(defaultScope.material_underlayment || {}).reduce((total, underlayments) => 
                        total + ensureArray(underlayments).length, 0
                      )}
                    </div>
                    <div className="text-sm text-gray-600">Underlayments</div>
                  </div>
                </div>
              </div>

              {/* Warnings for missing configurations */}
              <div className="mt-6">
                {(() => {
                  const warnings = [];
                  
                  // Check for empty default materials
                  Object.entries(defaultScope.material).forEach(([surface, materials]) => {
                    const materialsList = ensureArray(materials);
                    if (materialsList.length === 0) {
                      warnings.push(`Default ${surface.replace('_', ' ')} material not configured`);
                    }
                  });
                  
                  // Check for rooms with custom material setting but no overrides
                  locations.forEach(location => {
                    location.rooms.forEach(room => {
                      if (room.use_default_material === 'N') {
                        const hasAnyOverride = Object.keys(room.material_override || {}).length > 0 ||
                                             Object.keys(room.material_underlayment_override || {}).length > 0;
                        if (!hasAnyOverride) {
                          warnings.push(`${room.name} (${location.location}) is set to custom but has no material overrides`);
                        }
                      }
                    });
                  });
                  
                  if (warnings.length === 0) {
                    return (
                      <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-green-700 font-medium">All materials configured correctly!</span>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div>
                          <div className="text-yellow-700 font-medium mb-2">Please review the following:</div>
                          <ul className="text-sm text-yellow-600 space-y-1">
                            {warnings.map((warning, index) => (
                              <li key={index}>• {warning}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

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
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white font-medium hover:from-blue-700 hover:to-purple-700 transition-colors flex items-center space-x-2 shadow-sm"
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(defaultScope.material).map(([key, valueArray]) => {
                      const materialsArray = ensureArray(valueArray);
                      const anyMaterialNeedsUnderlayment = materialsArray.some(mat => needsUnderlayment(mat));
                      
                      return (
                        <div key={key} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-center mb-3">
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
                              Remove Surface
                            </button>
                          </div>
                          
                          {/* List of materials for this surface type */}
                          <div className="space-y-2 mb-3">
                            {materialsArray.map((material, index) => (
                              <div key={index} className="flex gap-2">
                                <input
                                  type="text"
                                  value={material}
                                  onChange={(e) => handleDefaultScopeChange('material', key, 
                                    { oldValue: material, newValue: e.target.value }, 'update')}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                                  placeholder={`${key.replace('_', ' ').toLowerCase()} material`}
                                />
                                <button
                                  onClick={() => handleDefaultScopeChange('material', key, material, 'remove')}
                                  className="px-2 py-1 text-red-600 hover:text-red-800 text-sm"
                                  title="Remove this material"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                          
                          {/* Add new material button */}
                          <div className="flex gap-2 mb-3">
                            <input
                              type="text"
                              placeholder={`Add new ${key.replace('_', ' ').toLowerCase()} material`}
                              className="flex-1 px-3 py-2 border border-dashed border-gray-400 rounded-md text-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.target.value.trim()) {
                                  handleDefaultScopeChange('material', key, e.target.value.trim(), 'add');
                                  e.target.value = '';
                                }
                              }}
                            />
                            <button
                              onClick={(e) => {
                                const input = e.target.previousElementSibling;
                                if (input.value.trim()) {
                                  handleDefaultScopeChange('material', key, input.value.trim(), 'add');
                                  input.value = '';
                                }
                              }}
                              className="px-3 py-2 bg-blue-600 text-sm rounded-md hover:bg-blue-700"
                            >
                              Add
                            </button>
                          </div>
                          
                          {/* Show underlayment field if any material needs it */}
                          {anyMaterialNeedsUnderlayment && (
                            <div className="mt-3 pl-4 border-l-2 border-blue-300 bg-blue-50 p-3 rounded">
                              <label className="block text-sm font-medium text-blue-700 mb-2">
                                {key.replace('_', ' ')} Underlayment Options
                              </label>
                              
                              {/* Underlayment materials list */}
                              <div className="space-y-2 mb-2">
                                {ensureArray(defaultScope.material_underlayment?.[key]).map((underlayment, index) => (
                                  <div key={index} className="flex gap-2">
                                    <input
                                      type="text"
                                      value={underlayment}
                                      onChange={(e) => handleDefaultScopeChange('material_underlayment', key, 
                                        { oldValue: underlayment, newValue: e.target.value }, 'update')}
                                      className="flex-1 px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                                      placeholder="e.g., 6mm foam pad"
                                    />
                                    <button
                                      onClick={() => handleDefaultScopeChange('material_underlayment', key, underlayment, 'remove')}
                                      className="px-2 py-1 text-red-600 hover:text-red-800 text-sm"
                                      title="Remove this underlayment"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                              
                              {/* Add new underlayment */}
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Add underlayment option"
                                  className="flex-1 px-3 py-2 border border-dashed border-blue-400 rounded-md text-sm bg-white"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                      handleDefaultScopeChange('material_underlayment', key, e.target.value.trim(), 'add');
                                      e.target.value = '';
                                    }
                                  }}
                                />
                                <button
                                  onClick={(e) => {
                                    const input = e.target.previousElementSibling;
                                    if (input.value.trim()) {
                                      handleDefaultScopeChange('material_underlayment', key, input.value.trim(), 'add');
                                      input.value = '';
                                    }
                                  }}
                                  className="px-3 py-2 bg-blue-600 text-sm rounded-md hover:bg-blue-700"
                                >
                                  Add
                                </button>
                                <button
                                  onClick={() => handleDefaultScopeChange('material_underlayment', key, 'N/A', 'add')}
                                  className={`px-3 py-2 text-sm rounded-md border ${
                                    ensureArray(defaultScope.material_underlayment?.[key]).includes('N/A')
                                      ? 'bg-gray-500 border-gray-500' 
                                      : 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200'
                                  }`}
                                  title="Add N/A option (no underlayment needed)"
                                >
                                  N/A
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                      className="px-4 py-2 bg-blue-600 text-sm rounded-md hover:bg-blue-700"
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
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
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
                    
                    {/* Room-specific AI Analysis Button */}
                    {!(selectedRoom.room.room_classification?.is_sub_area && 
                       !selectedRoom.room.room_classification?.material_applicable &&
                       !selectedRoom.room.is_merged) && (
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => openRoomAnalysisModal(selectedRoom.locationIndex, selectedRoom.roomIndex)}
                          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-white font-medium hover:from-purple-700 hover:to-blue-700 transition-colors flex items-center space-x-2 shadow-sm"
                          title="Use AI to analyze material photos specifically for this room"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <span>AI Analysis</span>
                          </button>
                        </div>
                      )}
                  </div>
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
                      <div className="space-y-6 p-4 bg-blue-50 rounded-md border border-blue-200">
                        {Object.entries(defaultScope.material).map(([key, defaultValueArray]) => {
                          const defaultMaterials = ensureArray(defaultValueArray);
                          const currentMaterials = ensureArray(selectedRoom.room.material_override[key]);
                          const anyCurrentMaterialNeedsUnderlayment = currentMaterials.some(mat => mat !== 'N/A' && needsUnderlayment(mat));
                          const anyDefaultMaterialNeedsUnderlayment = defaultMaterials.some(mat => needsUnderlayment(mat));
                          const showUnderlayment = anyCurrentMaterialNeedsUnderlayment || (currentMaterials.length === 0 && anyDefaultMaterialNeedsUnderlayment);
                          const currentUnderlayments = ensureArray(selectedRoom.room.material_underlayment_override?.[key]);
                          const defaultUnderlayments = ensureArray(defaultScope.material_underlayment?.[key]);
                          
                          return (
                            <div key={key} className="border border-blue-200 rounded-lg p-4 bg-white">
                              <div className="flex justify-between items-center mb-3">
                                <label className="block text-sm font-medium text-gray-700 capitalize">
                                  {key.replace('_', ' ')} Materials
                                </label>
                                <button
                                  onClick={() => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, `material_override.${key}`, [])}
                                  className="text-xs text-red-600 hover:text-red-800"
                                  title="Reset to use default materials"
                                >
                                  Reset to Default
                                </button>
                              </div>
                              
                              {/* Current custom materials */}
                              {currentMaterials.length > 0 ? (
                                <div className="space-y-2 mb-3">
                                  {currentMaterials.map((material, index) => (
                                    <div key={index} className="flex gap-2">
                                      <input
                                        type="text"
                                        value={material}
                                        onChange={(e) => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, 
                                          `material_override.${key}`, { oldValue: material, newValue: e.target.value }, 'update')}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                                        placeholder={`${key.replace('_', ' ').toLowerCase()} material`}
                                      />
                                      <button
                                        onClick={() => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, 
                                          `material_override.${key}`, material, 'remove')}
                                        className="px-2 py-1 text-red-600 hover:text-red-800 text-sm"
                                        title="Remove this material"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="mb-3 p-3 bg-gray-50 rounded border-dashed border-2 border-gray-300">
                                  <p className="text-sm text-gray-600 mb-2">Using default materials:</p>
                                  <div className="text-xs text-gray-500 space-y-1">
                                    {defaultMaterials.map((material, index) => (
                                      <div key={index}>• {material}</div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Add new material */}
                              <div className="flex gap-2 mb-3">
                                <input
                                  type="text"
                                  placeholder={`Add custom ${key.replace('_', ' ').toLowerCase()} material`}
                                  className="flex-1 px-3 py-2 border border-dashed border-gray-400 rounded-md text-sm"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                      updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, 
                                        `material_override.${key}`, e.target.value.trim(), 'add');
                                      e.target.value = '';
                                    }
                                  }}
                                />
                                <button
                                  onClick={(e) => {
                                    const input = e.target.previousElementSibling;
                                    if (input.value.trim()) {
                                      updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, 
                                        `material_override.${key}`, input.value.trim(), 'add');
                                      input.value = '';
                                    }
                                  }}
                                  className="px-3 py-2 bg-blue-600 text-sm rounded-md hover:bg-blue-700"
                                >
                                  Add
                                </button>
                                <button
                                  onClick={() => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, 
                                    `material_override.${key}`, 'N/A', 'add')}
                                  className={`px-3 py-2 text-sm rounded-md border ${
                                    currentMaterials.includes('N/A')
                                      ? 'bg-gray-500 border-gray-500' 
                                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                                  }`}
                                  title="Mark as not applicable for this room"
                                >
                                  N/A
                                </button>
                              </div>
                              
                              {/* Underlayment section */}
                              {showUnderlayment && !currentMaterials.includes('N/A') && (
                                <div className="pl-4 border-l-2 border-blue-300 bg-blue-50 p-3 rounded">
                                  <label className="block text-sm font-medium text-blue-700 mb-2">
                                    {key.replace('_', ' ')} Underlayment Options
                                  </label>
                                  
                                  {/* Current custom underlayments */}
                                  {currentUnderlayments.length > 0 ? (
                                    <div className="space-y-2 mb-3">
                                      {currentUnderlayments.map((underlayment, index) => (
                                        <div key={index} className="flex gap-2">
                                          <input
                                            type="text"
                                            value={underlayment}
                                            onChange={(e) => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, 
                                              `material_underlayment_override.${key}`, { oldValue: underlayment, newValue: e.target.value }, 'update')}
                                            className="flex-1 px-3 py-2 border border-blue-300 rounded-md bg-white text-sm"
                                            placeholder="e.g., 6mm foam pad"
                                          />
                                          <button
                                            onClick={() => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, 
                                              `material_underlayment_override.${key}`, underlayment, 'remove')}
                                            className="px-2 py-1 text-red-600 hover:text-red-800 text-sm"
                                            title="Remove this underlayment"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="mb-3 p-2 bg-blue-100 rounded border-dashed border-2 border-blue-300">
                                      <p className="text-sm text-blue-700 mb-1">Using default underlayments:</p>
                                      <div className="text-xs text-blue-600 space-y-1">
                                        {defaultUnderlayments.length > 0 ? defaultUnderlayments.map((underlayment, index) => (
                                          <div key={index}>• {underlayment}</div>
                                        )) : (
                                          <div>• No default underlayment specified</div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Add new underlayment */}
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      placeholder="Add custom underlayment"
                                      className="flex-1 px-3 py-2 border border-dashed border-blue-400 rounded-md text-sm bg-white"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && e.target.value.trim()) {
                                          updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, 
                                            `material_underlayment_override.${key}`, e.target.value.trim(), 'add');
                                          e.target.value = '';
                                        }
                                      }}
                                    />
                                    <button
                                      onClick={(e) => {
                                        const input = e.target.previousElementSibling;
                                        if (input.value.trim()) {
                                          updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, 
                                            `material_underlayment_override.${key}`, input.value.trim(), 'add');
                                          input.value = '';
                                        }
                                      }}
                                      className="px-3 py-2 bg-blue-600 text-sm rounded-md hover:bg-blue-700"
                                    >
                                      Add
                                    </button>
                                    <button
                                      onClick={() => updateRoom(selectedRoom.locationIndex, selectedRoom.roomIndex, 
                                        `material_underlayment_override.${key}`, 'N/A', 'add')}
                                      className={`px-3 py-2 text-sm rounded-md border ${
                                        currentUnderlayments.includes('N/A')
                                          ? 'bg-gray-500 border-gray-500' 
                                          : 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200'
                                      }`}
                                      title="No underlayment needed for this room"
                                    >
                                      N/A
                                    </button>
                                  </div>
                                </div>
                              )}
                              
                              {/* Show N/A message if materials marked as N/A */}
                              {currentMaterials.includes('N/A') && (
                                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-sm text-orange-700">
                                  ℹ️ This surface type is marked as not applicable for this room
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
            className="px-6 py-2 bg-blue-600 rounded-lg font-medium hover:bg-blue-700 shadow-md"
          >
            Continue to Demo Scope →
          </button>
        </div>
      </div>

      {/* Material Analysis Modal - Default Scope */}
      <MaterialAnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        onApplyResults={handleAnalysisResults}
        roomType={getRoomTypeContext()}
        analysisContext={{
          focusTypes: ['floor', 'wall', 'ceiling', 'baseboard', 'quarter_round']
        }}
      />

      {/* Material Analysis Modal - Room-specific */}
      <MaterialAnalysisModal
        isOpen={isRoomAnalysisModalOpen}
        onClose={() => {
          setIsRoomAnalysisModalOpen(false);
          setRoomAnalysisTarget(null);
        }}
        onApplyResults={handleRoomAnalysisResults}
        roomType={getRoomTypeContextForTarget(roomAnalysisTarget)}
        analysisContext={{
          focusTypes: ['floor', 'wall', 'ceiling', 'baseboard', 'quarter_round']
        }}
      />
    </div>
  );
});

MaterialScope.displayName = 'MaterialScope';

export default MaterialScope;