import React, { useState } from 'react';

const MeasurementData = ({ data, onNext, onPrevious }) => {
  const [file, setFile] = useState(null);
  const [uploadType, setUploadType] = useState('image'); // 'image' or 'csv'
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState(data || null);
  const [error, setError] = useState(null);

  const handleFileUpload = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleProcess = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('file_type', uploadType);

      const response = await fetch('/api/pre-estimate/measurement', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process file');
      }

      const result = await response.json();
      setParsedData(result.data);
    } catch (err) {
      setError(err.message);
      // Mock data for testing
      const mockData = {
        measurements: [
          {
            elevation: "1st Floor",
            room: "Kitchen",
            dimensions: {
              length: 10,
              width: 12,
              height: 8
            }
          },
          {
            elevation: "1st Floor", 
            room: "Living Room",
            dimensions: {
              length: 15,
              width: 20,
              height: 9
            }
          }
        ]
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

  const acceptedFileTypes = uploadType === 'image' 
    ? '.jpg,.jpeg,.png,.gif'
    : '.csv';

  return (
    <div className="space-y-6">
      {/* File Upload Section */}
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
            disabled={!file || isProcessing}
            className={`px-4 py-2 rounded-md font-medium ${
              !file || isProcessing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isProcessing ? 'Processing...' : 'Process File'}
          </button>
        </div>
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
            Parsed Measurement Data
          </h3>
          
          <div className="bg-gray-50 p-4 rounded-md">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap">
              {JSON.stringify(parsedData, null, 2)}
            </pre>
          </div>

          {/* Editable Table View */}
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Elevation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Room
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Length
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Width
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Height
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {parsedData.measurements?.map((measurement, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {measurement.elevation}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {measurement.room}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {measurement.dimensions.length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {measurement.dimensions.width}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {measurement.dimensions.height}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

export default MeasurementData;