import React, { useState } from 'react';

const WorkScope = ({ data, onNext, onPrevious }) => {
  const [inputMode, setInputMode] = useState('form'); // 'form' or 'text'
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState(data || null);
  const [error, setError] = useState(null);

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
  const [locations, setLocations] = useState([
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
  ]);

  const handleDefaultScopeChange = (category, key, value) => {
    setDefaultScope(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  const addRoom = (locationIndex) => {
    const newLocations = [...locations];
    newLocations[locationIndex].rooms.push({
      name: "",
      material_override: {},
      work_scope: {
        use_default: "Y",
        work_scope_override: {},
        protection: [""],
        detach_reset: [""],
        cleaning: [""],
        note: ""
      }
    });
    setLocations(newLocations);
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
  };

  const removeArrayItem = (locationIndex, roomIndex, arrayField, itemIndex) => {
    const newLocations = [...locations];
    newLocations[locationIndex].rooms[roomIndex].work_scope[arrayField].splice(itemIndex, 1);
    setLocations(newLocations);
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
        body: JSON.stringify({ input_data: JSON.stringify(formattedData) }),
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

  const handleTextProcess = async () => {
    if (!inputText.trim()) {
      setError('Please enter work scope information');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/pre-estimate/work-scope', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input_data: inputText }),
      });

      if (!response.ok) {
        throw new Error('Failed to process work scope');
      }

      const result = await response.json();
      setParsedData(result.data);
    } catch (err) {
      setError(err.message);
      // Mock data for testing
      const mockData = {
        default_scope: defaultScope,
        locations: locations
      };
      setParsedData(mockData);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNext = () => {
    if (parsedData && onNext) {
      onNext(parsedData);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Mode Toggle */}
      <div className="flex space-x-4">
        <button
          onClick={() => setInputMode('form')}
          className={`px-4 py-2 rounded-md font-medium ${
            inputMode === 'form'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Form Input
        </button>
        <button
          onClick={() => setInputMode('text')}
          className={`px-4 py-2 rounded-md font-medium ${
            inputMode === 'text'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Text Input
        </button>
      </div>

      {inputMode === 'form' ? (
        <div className="space-y-8">
          {/* Default Scope Section */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Default Scope</h3>
            
            {/* Default Materials */}
            <div className="mb-6">
              <h4 className="text-md font-medium text-gray-800 mb-3">Materials</h4>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(defaultScope.material).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {key}
                    </label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleDefaultScopeChange('material', key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Default Scope of Work */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">Scope of Work</h4>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(defaultScope.scope_of_work).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {key}
                    </label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleDefaultScopeChange('scope_of_work', key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Locations and Rooms */}
          <div className="space-y-6">
            {locations.map((location, locationIndex) => (
              <div key={locationIndex} className="border border-gray-200 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <input
                    type="text"
                    value={location.location}
                    onChange={(e) => {
                      const newLocations = [...locations];
                      newLocations[locationIndex].location = e.target.value;
                      setLocations(newLocations);
                    }}
                    placeholder="Location (e.g., 1st Floor)"
                    className="text-lg font-medium border-b border-gray-300 bg-transparent focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => addRoom(locationIndex)}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                  >
                    Add Room
                  </button>
                </div>

                <div className="space-y-4">
                  {location.rooms.map((room, roomIndex) => (
                    <div key={roomIndex} className="bg-gray-50 p-4 rounded-md space-y-4">
                      <input
                        type="text"
                        value={room.name}
                        onChange={(e) => updateRoom(locationIndex, roomIndex, 'name', e.target.value)}
                        placeholder="Room name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Use Default Scope
                          </label>
                          <select
                            value={room.work_scope.use_default}
                            onChange={(e) => updateRoom(locationIndex, roomIndex, 'work_scope.use_default', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          >
                            <option value="Y">Yes</option>
                            <option value="N">No</option>
                          </select>
                        </div>
                      </div>

                      {/* Array fields */}
                      {['protection', 'detach_reset', 'cleaning'].map((arrayField) => (
                        <div key={arrayField}>
                          <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-gray-700 capitalize">
                              {arrayField.replace('_', ' ')}
                            </label>
                            <button
                              onClick={() => addArrayItem(locationIndex, roomIndex, arrayField)}
                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700"
                            >
                              Add
                            </button>
                          </div>
                          {room.work_scope[arrayField].map((item, itemIndex) => (
                            <div key={itemIndex} className="flex gap-2 mb-2">
                              <input
                                type="text"
                                value={item}
                                onChange={(e) => updateArrayItem(locationIndex, roomIndex, arrayField, itemIndex, e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                                placeholder={`${arrayField.replace('_', ' ')} item`}
                              />
                              <button
                                onClick={() => removeArrayItem(locationIndex, roomIndex, arrayField, itemIndex)}
                                className="px-2 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      ))}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Note
                        </label>
                        <textarea
                          value={room.work_scope.note}
                          onChange={(e) => updateRoom(locationIndex, roomIndex, 'work_scope.note', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          placeholder="Additional notes..."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleFormSubmit}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-md font-medium ${
              isProcessing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isProcessing ? 'Processing...' : 'Generate Work Scope'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Work Scope Description
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Describe the work scope in text format..."
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleTextProcess}
            disabled={!inputText.trim() || isProcessing}
            className={`px-4 py-2 rounded-md font-medium ${
              !inputText.trim() || isProcessing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isProcessing ? 'Processing...' : 'Process Work Scope'}
          </button>
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
          <h3 className="text-lg font-medium text-gray-900">
            Work Scope Configuration
          </h3>
          
          <div className="bg-gray-50 p-4 rounded-md">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {JSON.stringify(parsedData, null, 2)}
            </pre>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
            >
              Continue with this data
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkScope;