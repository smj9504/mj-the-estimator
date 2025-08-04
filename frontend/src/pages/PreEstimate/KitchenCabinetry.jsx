import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { autoSaveManager, autoSaveAPI } from '../../utils/autoSave';
import AutoSaveIndicator from '../../components/AutoSaveIndicator';

const KitchenCabinetry = React.memo(() => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session');
  
  const [loading, setLoading] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  
  // Image upload state
  const [uploadedImages, setUploadedImages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef(null);
  
  // Analysis results state
  const [analysisResults, setAnalysisResults] = useState(null);
  
  // Kitchen cabinetry data state
  const [kitchenData, setKitchenData] = useState({
    layout: {
      kitchenType: '',
      dimensions: '',
      hasIsland: false,
      islandDimensions: '',
      configuration: ''
    },
    baseCabinets: {
      cabinet12: 0,
      cabinet15: 0,
      cabinet18: 0,
      cabinet21: 0,
      cabinet24: 0,
      cabinet30: 0,
      cabinet36: 0,
      customSizes: []
    },
    wallCabinets: {
      cabinet12: 0,
      cabinet15: 0,
      cabinet18: 0,
      cabinet24: 0,
      cabinet30: 0,
      cabinet36: 0,
      customSizes: []
    },
    specialtyCabinets: {
      sinkBase: { count: 0, width: '' },
      cornerBase: 0,
      cornerWall: 0,
      tallPantry: { count: 0, width: '' },
      islandCabinets: [],
      other: ''
    },
    linearMeasurements: {
      totalBaseLF: 0,
      totalWallLF: 0,
      islandLF: 0
    },
    specifications: {
      doorStyle: '',
      materialType: '',
      construction: '',
      overlayType: '',
      finish: '',
      qualityTier: ''
    },
    hardware: {
      style: '',
      type: '',
      finish: '',
      size: '',
      hinges: ''
    },
    countertops: {
      material: '',
      edgeProfile: '',
      estimatedSF: 0,
      color: ''
    },
    backsplash: {
      material: '',
      pattern: '',
      installationPattern: '',
      estimatedSF: 0
    },
    appliances: [],
    specialFeatures: '',
    workingConditions: {
      floorType: '',
      ceilingHeight: '',
      access: ''
    },
    notes: ''
  });

  // Setup auto-save
  useEffect(() => {
    if (sessionId) {
      autoSaveManager.register(
        `kitchenCabinetry_${sessionId}`,
        async (data) => {
          await autoSaveAPI.saveKitchenCabinetry(sessionId, data);
        },
        {
          debounceTime: 3000,
          onStatusChange: setAutoSaveStatus
        }
      );

      return () => {
        autoSaveManager.unregister(`kitchenCabinetry_${sessionId}`);
      };
    }
  }, [sessionId]);

  // Auto-save when kitchenData changes
  useEffect(() => {
    if (sessionId && Object.keys(kitchenData).length > 0) {
      autoSaveManager.save(`kitchenCabinetry_${sessionId}`, { 
        kitchenData, 
        uploadedImages: uploadedImages.map(img => ({ 
          id: img.id, 
          name: img.name, 
          size: img.size,
          url: img.url // Only save the URL, not the file object
        })),
        analysisResults 
      });
    }
  }, [kitchenData, uploadedImages, analysisResults, sessionId]);

  // Load existing data
  useEffect(() => {
    const initializeData = async () => {
      if (sessionId) {
        await loadExistingData();
      }
      setLoading(false);
    };
    
    initializeData();
  }, [sessionId]);

  const loadExistingData = useCallback(async () => {
    try {
      const savedData = await autoSaveAPI.getKitchenCabinetry(sessionId);
      if (savedData.success && savedData.data) {
        if (savedData.data.kitchenData) {
          setKitchenData(savedData.data.kitchenData);
        }
        if (savedData.data.uploadedImages) {
          setUploadedImages(savedData.data.uploadedImages);
        }
        if (savedData.data.analysisResults) {
          setAnalysisResults(savedData.data.analysisResults);
        }
      }
    } catch (error) {
      console.error('Failed to load existing kitchen cabinetry data:', error);
    }
  }, [sessionId]);

  // Image upload handlers
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    handleFileUpload(files);
  }, []);

  const handleFileSelect = useCallback((e) => {
    const files = Array.from(e.target.files);
    handleFileUpload(files);
  }, []);

  const handleFileUpload = useCallback((files) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newImage = {
          id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          file: file,
          name: file.name,
          size: file.size,
          url: e.target.result,
          uploadedAt: new Date().toISOString()
        };

        setUploadedImages(prev => [...prev, newImage]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeImage = useCallback((imageId) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
  }, []);

  // AI Analysis handler
  const handleAIAnalysis = useCallback(async () => {
    if (uploadedImages.length === 0) {
      alert('Please upload at least one image before running AI analysis.');
      return;
    }

    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      
      // Add images to form data
      uploadedImages.forEach((image, index) => {
        if (image.file) {
          formData.append(`images`, image.file);
        }
      });

      // Add session ID
      formData.append('sessionId', sessionId);

      const response = await fetch('http://localhost:8001/api/kitchen-cabinetry/analyze', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setAnalysisResults(result.analysis);
        alert('AI analysis completed successfully! The results are displayed below.');
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('AI Analysis error:', error);
      alert('Failed to analyze images. Please try again or contact support.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [uploadedImages, sessionId]);

  // Form update handlers
  const updateKitchenData = useCallback((section, field, value) => {
    setKitchenData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  }, []);

  const updateNestedData = useCallback((section, subsection, field, value) => {
    setKitchenData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subsection]: {
          ...prev[section][subsection],
          [field]: value
        }
      }
    }));
  }, []);

  // Navigation handlers
  const handleBack = useCallback(() => {
    navigate(`/pre-estimate/work-scope?session=${sessionId}`);
  }, [navigate, sessionId]);

  const handleComplete = useCallback(async () => {
    // Force save current data
    if (sessionId) {
      try {
        await autoSaveManager.forceSave(`kitchenCabinetry_${sessionId}`, { 
          kitchenData, 
          uploadedImages: uploadedImages.map(img => ({ 
            id: img.id, 
            name: img.name, 
            size: img.size,
            url: img.url
          })),
          analysisResults 
        });
      } catch (error) {
        console.error('Failed to save kitchen cabinetry data:', error);
      }
    }

    // Mark kitchen cabinetry as completed
    const completionStatus = JSON.parse(sessionStorage.getItem(`completionStatus_${sessionId}`) || '{}');
    completionStatus.kitchenCabinetry = true;
    sessionStorage.setItem(`completionStatus_${sessionId}`, JSON.stringify(completionStatus));

    // Navigate to dashboard
    navigate(`/dashboard/${sessionId}`);
  }, [kitchenData, uploadedImages, analysisResults, sessionId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading kitchen cabinetry...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Kitchen Cabinetry</h1>
              <p className="text-gray-600 mt-1">
                Analyze and document kitchen cabinet specifications and features
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Session: {sessionId?.slice(-8)}
              </div>
              <AutoSaveIndicator status={autoSaveStatus} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          
          {/* Image Upload Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Kitchen Photos</h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload multiple photos of the kitchen to analyze cabinet specifications, layout, and features.
            </p>
            
            {/* Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-lg text-gray-600 mb-2">
                {isDragging ? 'Drop images here' : 'Drag and drop kitchen images here'}
              </p>
              <p className="text-sm text-gray-500 mb-4">or</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 text-gray-800 rounded-md hover:bg-blue-700 hover:text-gray-100 transition-colors"
              >
                Browse Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Uploaded Images Gallery */}
            {uploadedImages.length > 0 && (
              <div className="mt-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">
                  Uploaded Images ({uploadedImages.length})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {uploadedImages.map((image) => (
                    <div key={image.id} className="relative group">
                      <img
                        src={image.url}
                        alt={image.name}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        onClick={() => removeImage(image.id)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                      <div className="mt-1 text-xs text-gray-500 truncate">
                        {image.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Analysis Button */}
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleAIAnalysis}
                disabled={uploadedImages.length === 0 || isAnalyzing}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center space-x-2"
              >
                {isAnalyzing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing Images...
                  </>
                ) : (
                  <>
                    🤖 AI Analysis
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Analysis Results */}
          {analysisResults && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">AI Analysis Results</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                  {typeof analysisResults === 'string' ? analysisResults : JSON.stringify(analysisResults, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Manual Data Entry Forms */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Kitchen Cabinet Specifications</h3>
            
            {/* Layout Information */}
            <div className="mb-8">
              <h4 className="text-md font-medium text-gray-900 mb-4">Layout & Configuration</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kitchen Type</label>
                  <select
                    value={kitchenData?.layout?.kitchenType || ''}
                    onChange={(e) => updateKitchenData('layout', 'kitchenType', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select kitchen type</option>
                    <option value="L-shaped">L-shaped</option>
                    <option value="U-shaped">U-shaped</option>
                    <option value="Galley">Galley</option>
                    <option value="Island">Island</option>
                    <option value="Peninsula">Peninsula</option>
                    <option value="One-wall">One-wall</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Overall Dimensions</label>
                  <input
                    type="text"
                    value={kitchenData?.layout?.dimensions || ''}
                    onChange={(e) => updateKitchenData('layout', 'dimensions', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="e.g., 12' x 14'"
                  />
                </div>
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="hasIsland"
                    checked={kitchenData?.layout?.hasIsland || false}
                    onChange={(e) => updateKitchenData('layout', 'hasIsland', e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="hasIsland" className="text-sm font-medium text-gray-700">Has Island/Peninsula</label>
                </div>
                {kitchenData.layout.hasIsland && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Island/Peninsula Dimensions</label>
                    <input
                      type="text"
                      value={kitchenData.layout.islandDimensions}
                      onChange={(e) => updateKitchenData('layout', 'islandDimensions', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="e.g., 6' x 3'"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Base Cabinets */}
            <div className="mb-8">
              <h4 className="text-md font-medium text-gray-900 mb-4">Base Cabinets</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(kitchenData.baseCabinets).filter(([key]) => key !== 'customSizes').map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {key.replace('cabinet', '')}″ Base
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={value}
                      onChange={(e) => updateKitchenData('baseCabinets', key, parseInt(e.target.value) || 0)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Wall Cabinets */}
            <div className="mb-8">
              <h4 className="text-md font-medium text-gray-900 mb-4">Wall Cabinets</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(kitchenData.wallCabinets).filter(([key]) => key !== 'customSizes').map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {key.replace('cabinet', '')}″ Wall
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={value}
                      onChange={(e) => updateKitchenData('wallCabinets', key, parseInt(e.target.value) || 0)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Linear Measurements */}
            <div className="mb-8">
              <h4 className="text-md font-medium text-gray-900 mb-4">Linear Measurements</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Base Cabinet LF</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={kitchenData.linearMeasurements.totalBaseLF}
                    onChange={(e) => updateKitchenData('linearMeasurements', 'totalBaseLF', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Wall Cabinet LF</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={kitchenData.linearMeasurements.totalWallLF}
                    onChange={(e) => updateKitchenData('linearMeasurements', 'totalWallLF', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Island/Peninsula LF</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={kitchenData.linearMeasurements.islandLF}
                    onChange={(e) => updateKitchenData('linearMeasurements', 'islandLF', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            {/* Cabinet Specifications */}
            <div className="mb-8">
              <h4 className="text-md font-medium text-gray-900 mb-4">Cabinet Specifications</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Door Style</label>
                  <input
                    type="text"
                    value={kitchenData.specifications.doorStyle}
                    onChange={(e) => updateKitchenData('specifications', 'doorStyle', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Shaker, Raised Panel"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Material Type</label>
                  <input
                    type="text"
                    value={kitchenData.specifications.materialType}
                    onChange={(e) => updateKitchenData('specifications', 'materialType', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Solid Wood, MDF"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Finish</label>
                  <input
                    type="text"
                    value={kitchenData.specifications.finish}
                    onChange={(e) => updateKitchenData('specifications', 'finish', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Painted White, Natural Stain"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quality Tier</label>
                  <select
                    value={kitchenData.specifications.qualityTier}
                    onChange={(e) => updateKitchenData('specifications', 'qualityTier', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select quality tier</option>
                    <option value="Builder-Grade">Builder-Grade</option>
                    <option value="Mid-Range">Mid-Range</option>
                    <option value="Architectural-Grade">Architectural-Grade</option>
                    <option value="Custom Millwork">Custom Millwork</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Additional Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
              <textarea
                value={kitchenData.notes}
                onChange={(e) => updateKitchenData('', 'notes', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
                rows="4"
                placeholder="Any additional observations, special requirements, or notes about the kitchen cabinetry..."
              />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <button
            onClick={handleBack}
            className="px-6 py-2 border-2 border-gray-400 text-gray-700 bg-white rounded-lg font-medium hover:bg-gray-100 shadow-sm"
          >
            ← Back to Work Scope
          </button>
          <button
            onClick={handleComplete}
            className="px-6 py-2 bg-green-600 text-green-50 rounded-lg font-medium hover:bg-green-700 hover:text-green-100 shadow-md"
          >
            Complete Kitchen Cabinetry →
          </button>
        </div>
      </div>
    </div>
  );
});

KitchenCabinetry.displayName = 'KitchenCabinetry';

export default KitchenCabinetry;