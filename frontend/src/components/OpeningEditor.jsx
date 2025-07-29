import React, { useState } from 'react';

const OpeningEditor = ({ openings = [], onChange, roomName = "" }) => {
  const [editingOpenings, setEditingOpenings] = useState(openings);

  const openingTypes = [
    { value: 'door', label: 'Door', color: 'bg-blue-100 text-blue-800' },
    { value: 'window', label: 'Window', color: 'bg-green-100 text-green-800' },
    { value: 'open_wall', label: 'Open Wall', color: 'bg-orange-100 text-orange-800' }
  ];

  const getDefaultSize = (type) => {
    const defaults = {
      door: { width: 3.0, height: 6.8 },
      window: { width: 4.0, height: 3.0 },
      open_wall: { width: 6.0, height: 8.0 }
    };
    return defaults[type] || defaults.door;
  };

  const addOpening = () => {
    const newOpening = {
      type: 'door',
      ...getDefaultSize('door')
    };
    const updated = [...editingOpenings, newOpening];
    setEditingOpenings(updated);
    onChange(updated);
  };

  const updateOpening = (index, field, value) => {
    const updated = editingOpenings.map((opening, i) => {
      if (i === index) {
        const newOpening = { ...opening, [field]: value };
        
        // If type changed, update default dimensions
        if (field === 'type') {
          const defaultSize = getDefaultSize(value);
          newOpening.width = defaultSize.width;
          newOpening.height = defaultSize.height;
        }
        
        return newOpening;
      }
      return opening;
    });
    
    setEditingOpenings(updated);
    onChange(updated);
  };

  const removeOpening = (index) => {
    const updated = editingOpenings.filter((_, i) => i !== index);
    setEditingOpenings(updated);
    onChange(updated);
  };

  const getTypeColor = (type) => {
    const typeConfig = openingTypes.find(t => t.value === type);
    return typeConfig?.color || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium text-gray-900">
          Openings for {roomName}
        </h4>
        <button
          onClick={addOpening}
          style={{
            backgroundColor: '#2563EB',
            color: '#FFFFFF'
          }}
          className="px-3 py-1 text-sm rounded font-medium shadow-sm hover:opacity-90"
        >
          + Add Opening
        </button>
      </div>

      {editingOpenings.length === 0 ? (
        <div className="text-gray-500 text-sm py-4 text-center border-2 border-dashed border-gray-200 rounded">
          No openings defined. Click "Add Opening" to add doors, windows, or open walls.
        </div>
      ) : (
        <div className="space-y-3">
          {editingOpenings.map((opening, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(opening.type)}`}>
                  {openingTypes.find(t => t.value === opening.type)?.label || opening.type}
                </span>
                <button
                  onClick={() => removeOpening(index)}
                  className="px-2 py-1 text-red-600 hover:text-red-800 text-sm font-medium hover:bg-red-50 rounded"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={opening.type}
                    onChange={(e) => updateOpening(index, 'type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {openingTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Width */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Width (ft)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={opening.width}
                    onChange={(e) => updateOpening(index, 'width', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Height */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Height (ft)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={opening.height}
                    onChange={(e) => updateOpening(index, 'height', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Size Display */}
              <div className="mt-2 text-sm text-gray-600">
                {opening.type === 'open_wall' 
                  ? `${opening.width}' wide opening`
                  : `${opening.width}' × ${opening.height}'${opening.type === 'window' ? ' window' : ''}`
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      {editingOpenings.length > 0 && (
        <div className="pt-3 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const doorOpening = { type: 'door', ...getDefaultSize('door') };
                const updated = [...editingOpenings, doorOpening];
                setEditingOpenings(updated);
                onChange(updated);
              }}
              className="px-3 py-1 bg-blue-200 text-blue-800 text-xs rounded font-medium hover:bg-blue-300 shadow-sm"
            >
              + Standard Door
            </button>
            <button
              onClick={() => {
                const windowOpening = { type: 'window', ...getDefaultSize('window') };
                const updated = [...editingOpenings, windowOpening];
                setEditingOpenings(updated);
                onChange(updated);
              }}
              className="px-3 py-1 bg-green-200 text-green-800 text-xs rounded font-medium hover:bg-green-300 shadow-sm"
            >
              + Window
            </button>
            <button
              onClick={() => {
                const openWallOpening = { type: 'open_wall', ...getDefaultSize('open_wall') };
                const updated = [...editingOpenings, openWallOpening];
                setEditingOpenings(updated);
                onChange(updated);
              }}
              className="px-3 py-1 bg-orange-200 text-orange-800 text-xs rounded font-medium hover:bg-orange-300 shadow-sm"
            >
              + Open Wall
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpeningEditor;