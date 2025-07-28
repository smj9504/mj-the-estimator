import React, { useState } from 'react';

const DemoScope = ({ data, onNext, onPrevious }) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState(data || null);
  const [error, setError] = useState(null);

  const exampleText = `1st floor:
- Kitchen: entire ceiling drywall, entire wall drywall, entire laminate floor, wall insulation(17' x height + 6' 10" x height)
- Living Room: half of the ceiling drywall

2nd floor:
- furnace room: entire ceiling drywall, entire wall drywall
- Bathroom: entire ceiling drywall, entire wall drywall(except standard size bathtub surrounding tile wall), wall insulation (4' 11'' x height)
- Hallway: half of the ceiling drywall, half of the wall drywall, entire floor(floor: carpet)
- Bedroom: 20% of the floor(floor: carpet)

3rd floor:
- Bedroom: half of the floor(floor: carpet)
- Bathroom: entire floor except bathtub, half of the wall drywall, vanity, door(floor: tile, wall: drywall)
- closet: entire floor, half of the wall (floor: carpet, wall, drywall)`;

  const handleProcess = async () => {
    if (!inputText.trim()) {
      setError('Please enter demo scope information');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/pre-estimate/demo-scope', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input_text: inputText }),
      });

      if (!response.ok) {
        throw new Error('Failed to process demo scope');
      }

      const result = await response.json();
      setParsedData(result.data);
    } catch (err) {
      setError(err.message);
      // Mock data for testing
      const mockData = {
        demolition_scope: [
          {
            elevation: "1st floor",
            rooms: [
              {
                name: "Kitchen",
                demo_locations: [
                  "entire ceiling drywall",
                  "entire wall drywall", 
                  "entire laminate floor",
                  "wall insulation(17' x height + 6' 10\" x height)"
                ]
              },
              {
                name: "Living Room",
                demo_locations: [
                  "half of the ceiling drywall"
                ]
              }
            ]
          },
          {
            elevation: "2nd floor",
            rooms: [
              {
                name: "furnace room",
                demo_locations: [
                  "entire ceiling drywall",
                  "entire wall drywall"
                ]
              },
              {
                name: "Bathroom",
                demo_locations: [
                  "entire ceiling drywall",
                  "entire wall drywall(except standard size bathtub surrounding tile wall)",
                  "wall insulation (4' 11'' x height)"
                ]
              },
              {
                name: "Hallway",
                demo_locations: [
                  "half of the ceiling drywall",
                  "half of the wall drywall",
                  "entire floor(floor: carpet)"
                ]
              },
              {
                name: "Bedroom",
                demo_locations: [
                  "20% of the floor(floor: carpet)"
                ]
              }
            ]
          },
          {
            elevation: "3rd floor",
            rooms: [
              {
                name: "Bedroom",
                demo_locations: [
                  "half of the floor(floor: carpet)"
                ]
              },
              {
                name: "Bathroom",
                demo_locations: [
                  "entire floor except bathtub",
                  "half of the wall drywall",
                  "vanity",
                  "door(floor: tile, wall: drywall)"
                ]
              },
              {
                name: "closet",
                demo_locations: [
                  "entire floor",
                  "half of the wall (floor: carpet, wall, drywall)"
                ]
              }
            ]
          }
        ]
      };
      setParsedData(mockData);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseExample = () => {
    setInputText(exampleText);
  };

  const handleNext = () => {
    if (parsedData && onNext) {
      onNext(parsedData);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-gray-700">
            Demo'd Scope Description
          </label>
          <button
            onClick={handleUseExample}
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            Use Example
          </button>
        </div>
        
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Describe the demolished areas by floor and room..."
          rows={12}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <button
          onClick={handleProcess}
          disabled={!inputText.trim() || isProcessing}
          className={`px-4 py-2 rounded-md font-medium ${
            !inputText.trim() || isProcessing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isProcessing ? 'Processing...' : 'Process Demo Scope'}
        </button>
      </div>

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
            Parsed Demo'd Scope
          </h3>
          
          {/* JSON Preview */}
          <div className="bg-gray-50 p-4 rounded-md">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {JSON.stringify(parsedData, null, 2)}
            </pre>
          </div>

          {/* Structured View */}
          <div className="space-y-6">
            {parsedData.demolition_scope?.map((floor, floorIndex) => (
              <div key={floorIndex} className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-gray-900 mb-3 capitalize">
                  {floor.elevation}
                </h4>
                
                <div className="space-y-3">
                  {floor.rooms.map((room, roomIndex) => (
                    <div key={roomIndex} className="bg-gray-50 p-3 rounded-md">
                      <h5 className="font-medium text-gray-800 mb-2">
                        {room.name}
                      </h5>
                      <ul className="list-disc list-inside space-y-1">
                        {room.demo_locations.map((location, locationIndex) => (
                          <li key={locationIndex} className="text-sm text-gray-600">
                            {location}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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

export default DemoScope;