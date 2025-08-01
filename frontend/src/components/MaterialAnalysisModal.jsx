import React, { useState, useRef, useCallback } from 'react';
import { buildApiUrl } from '../config/api';

const MaterialAnalysisModal = ({ 
  isOpen, 
  onClose, 
  onApplyResults,
  roomType = null,
  analysisContext = null 
}) => {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState({});
  
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Reset modal state when closed/opened
  React.useEffect(() => {
    if (!isOpen) {
      setImageFile(null);
      setImagePreview(null);
      setAnalysisResults(null);
      setError(null);
      setSelectedMaterials({});
      setIsAnalyzing(false);
    }
  }, [isOpen]);

  // Handle paste events for clipboard images
  React.useEffect(() => {
    const handlePaste = (e) => {
      if (!isOpen) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleImageFile(file);
          }
          break;
        }
      }
    };

    if (isOpen) {
      document.addEventListener('paste', handlePaste);
    }

    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [isOpen]);

  const handleImageFile = useCallback((file) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file size must be less than 10MB');
      return;
    }

    setImageFile(file);
    setError(null);
    setAnalysisResults(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageFile(files[0]);
    }
  };

  const analyzeImage = async () => {
    if (!imageFile) {
      setError('Please select an image first');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      if (roomType) {
        formData.append('room_type', roomType);
      }

      if (analysisContext?.focusTypes?.length > 0) {
        formData.append('analysis_focus', JSON.stringify(analysisContext.focusTypes));
      }

      const response = await fetch(buildApiUrl('/api/analyze-material'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Analysis failed');
      }

      const results = await response.json();
      
      if (!results.success) {
        throw new Error(results.error_message || 'Analysis failed');
      }

      setAnalysisResults(results);
      
      // Pre-select high confidence materials
      const preSelected = {};
      results.materials.forEach((material, index) => {
        if (material.confidence_score >= 8.0) {
          preSelected[index] = true;
        }
      });
      setSelectedMaterials(preSelected);

    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze image');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMaterialSelection = (index, selected) => {
    setSelectedMaterials(prev => ({
      ...prev,
      [index]: selected
    }));
  };

  const applySelectedMaterials = async () => {
    if (!analysisResults) return;

    const selectedMaterialsList = analysisResults.materials.filter((_, index) => 
      selectedMaterials[index]
    );

    if (selectedMaterialsList.length === 0) {
      setError('Please select at least one material to apply');
      return;
    }

    try {
      // Generate material scope suggestions
      const suggestionsResponse = await fetch(buildApiUrl('/api/generate-material-suggestions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          materials: selectedMaterialsList,
          room_type: roomType
        }),
      });

      if (!suggestionsResponse.ok) {
        throw new Error('Failed to generate material suggestions');
      }

      const suggestions = await suggestionsResponse.json();
      
      // Call parent callback with suggestions
      onApplyResults(suggestions, selectedMaterialsList);
      onClose();

    } catch (err) {
      console.error('Apply materials error:', err);
      setError(err.message || 'Failed to apply materials');
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 8) return 'bg-green-100 text-green-800';
    if (confidence >= 5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getConfidenceText = (confidence) => {
    if (confidence >= 8) return 'High';
    if (confidence >= 5) return 'Medium';
    return 'Low';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">AI Material Analysis</h2>
            <p className="text-sm text-gray-600 mt-1">
              Upload or paste an image to identify building materials
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {!imageFile ? (
            /* Image Upload Section */
            <div className="space-y-6">
              {/* Drop Zone */}
              <div
                ref={dropZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragOver 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="space-y-4">
                  <div className="mx-auto w-16 h-16 text-gray-400">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  
                  <div>
                    <p className="text-lg font-medium text-gray-900">Drop your image here</p>
                    <p className="text-sm text-gray-600 mt-1">
                      or <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        choose a file
                      </button>
                    </p>
                  </div>
                  
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>Supported formats: JPEG, PNG, WebP, BMP</p>
                    <p>Maximum size: 10MB</p>
                    <p className="font-medium">Tip: You can also paste images directly with Ctrl+V</p>
                  </div>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {roomType && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Room context:</span> {roomType}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    This will help the AI provide more accurate material identification
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Analysis Section */
            <div className="space-y-6">
              {/* Image Preview */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {imageFile.name}
                  </span>
                  <button
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      setAnalysisResults(null);
                      setError(null);
                    }}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
                <div className="p-4">
                  <img
                    src={imagePreview}
                    alt="Selected material image"
                    className="max-w-full max-h-64 mx-auto rounded"
                  />
                </div>
              </div>

              {/* Analysis Button */}
              {!analysisResults && (
                <div className="text-center">
                  <button
                    onClick={analyzeImage}
                    disabled={isAnalyzing}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span>Analyze Materials</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Analysis Results */}
              {analysisResults && (
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-medium text-green-800">Analysis Complete</span>
                    </div>
                    <div className="mt-2 text-sm text-green-700 space-y-1">
                      <p>Found {analysisResults.materials.length} materials</p>
                      <p>Overall confidence: {analysisResults.overall_confidence.toFixed(1)}/10</p>
                      <p>Processing time: {analysisResults.processing_time.toFixed(1)}s</p>
                      {analysisResults.analysis_notes && (
                        <p className="text-xs mt-2">{analysisResults.analysis_notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900">Detected Materials</h3>
                    
                    {analysisResults.materials.map((material, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            id={`material-${index}`}
                            checked={selectedMaterials[index] || false}
                            onChange={(e) => handleMaterialSelection(index, e.target.checked)}
                            className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <label 
                                htmlFor={`material-${index}`}
                                className="font-medium text-gray-900 cursor-pointer"
                              >
                                {material.material_name}
                              </label>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(material.confidence_score)}`}>
                                  {getConfidenceText(material.confidence_score)} ({material.confidence_score}/10)
                                </span>
                                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium capitalize">
                                  {material.material_type.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                            
                            <p className="text-sm text-gray-600 mt-1">{material.description}</p>
                            
                            {(material.color || material.texture) && (
                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                {material.color && (
                                  <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                    Color: {material.color}
                                  </span>
                                )}
                                {material.texture && (
                                  <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">
                                    Texture: {material.texture}
                                  </span>
                                )}
                              </div>
                            )}

                            {material.underlayment_needed && material.recommended_underlayment && (
                              <div className="mt-2 text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded">
                                Requires underlayment: {material.recommended_underlayment}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-red-800">Error</span>
              </div>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {analysisResults && (
              <span>
                {Object.values(selectedMaterials).filter(Boolean).length} of {analysisResults.materials.length} materials selected
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
            >
              Cancel
            </button>
            
            {analysisResults && (
              <button
                onClick={applySelectedMaterials}
                disabled={Object.values(selectedMaterials).filter(Boolean).length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Apply Selected Materials
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaterialAnalysisModal;