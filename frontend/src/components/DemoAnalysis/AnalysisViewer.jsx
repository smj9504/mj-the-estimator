import React, { useState, useEffect, useRef } from 'react';

const AnalysisViewer = ({
  images,
  analysisResults,
  showConfidence = true
}) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedArea, setSelectedArea] = useState(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  // Draw analysis results on canvas
  useEffect(() => {
    console.log('🎨 AnalysisViewer canvas redraw triggered');
    console.log('📊 analysisResults:', analysisResults);
    console.log('🖼️ selectedImage:', selectedImage);
    console.log('🎯 selectedArea:', selectedArea);
    
    if (!canvasRef.current || !imageRef.current || !analysisResults) {
      console.log('❌ Canvas redraw skipped - missing refs or data');
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    // Set canvas size to match image
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    console.log('✅ Canvas cleared and ready for drawing');

    // Draw demolished areas
    analysisResults.demolished_areas.forEach((area, index) => {
      if (area.boundaries.image_ref !== `img_${selectedImage + 1}`) return;

      console.log(`🖍️ Drawing area ${area.id}:`, {
        type: area.type,
        coordinates: area.boundaries.coordinates,
        userModified: area.user_modified,
        isSelected: selectedArea?.id === area.id
      });

      // Set style based on confidence and selection
      const isSelected = selectedArea?.id === area.id;
      ctx.strokeStyle = isSelected ? '#7C3AED' : getConfidenceColor(area.confidence);
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.fillStyle = isSelected ? 'rgba(124, 58, 237, 0.2)' : `${getConfidenceColor(area.confidence)}33`;

      // Draw polygon
      ctx.beginPath();
      const coords = area.boundaries.coordinates;
      console.log(`📍 Using coordinates for area ${area.id}:`, coords);
      ctx.moveTo(coords[0][0], coords[0][1]);
      coords.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw label
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(
        `${area.type} - ${area.ai_estimated_area.toFixed(1)} sq ft`,
        coords[0][0] + 5,
        coords[0][1] - 5
      );
    });

    // Draw reference objects
    if (analysisResults.reference_objects) {
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      analysisResults.reference_objects.forEach(obj => {
        if (obj.boundaries.image_ref !== `img_${selectedImage + 1}`) return;

        const coords = obj.boundaries.coordinates;
        ctx.strokeRect(
          coords[0][0],
          coords[0][1],
          coords[1][0] - coords[0][0],
          coords[1][1] - coords[0][1]
        );

        // Label
        ctx.fillStyle = '#065F46';
        ctx.font = '12px Arial';
        ctx.fillText(obj.type, coords[0][0] + 2, coords[0][1] - 2);
      });

      ctx.setLineDash([]);
    }
  }, [selectedImage, analysisResults, selectedArea]);

  // Get color based on confidence
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return '#10B981'; // green
    if (confidence >= 0.6) return '#F59E0B'; // yellow
    return '#EF4444'; // red
  };

  // Handle canvas click for area selection only
  const handleCanvasClick = (e) => {
    if (!canvasRef.current || !analysisResults) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;

    // Check if click is inside any area - only for selection
    for (const area of analysisResults.demolished_areas) {
      if (area.boundaries.image_ref !== `img_${selectedImage + 1}`) continue;

      if (isPointInPolygon(canvasX, canvasY, area.boundaries.coordinates)) {
        setSelectedArea(area);
        break;
      }
    }
  };

  // Check if point is inside polygon
  const isPointInPolygon = (x, y, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      
      const intersect = ((yi > y) !== (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };


  if (!analysisResults) return null;

  return (
    <div className="analysis-viewer">
      {/* Image selector */}
      {images.length > 1 && (
        <div className="mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {images.map((img, index) => (
              <button
                key={index}
                onClick={() => setSelectedImage(index)}
                className={`flex-shrink-0 w-20 h-20 rounded overflow-hidden border-2 transition-colors ${
                  selectedImage === index ? 'border-purple-500' : 'border-gray-300'
                }`}
              >
                <img
                  src={URL.createObjectURL(img.processed)}
                  alt={`Image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image with overlay */}
        <div className="lg:col-span-2">
          <div className="relative bg-gray-100 rounded-lg overflow-hidden">
            <img
              ref={imageRef}
              src={URL.createObjectURL(images[selectedImage].processed)}
              alt="Analysis"
              className="w-full h-auto"
            />
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="absolute inset-0 w-full h-full cursor-pointer"
            />
          </div>

          {/* Legend */}
          {showConfidence && (
            <div className="mt-4 flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>높은 신뢰도 (≥80%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span>중간 신뢰도 (60-80%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span>낮은 신뢰도 (&lt;60%)</span>
              </div>
            </div>
          )}
        </div>

        {/* Area list */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="font-medium text-gray-900 mb-4">감지된 영역</h4>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {analysisResults.demolished_areas.map((area) => (
                <div
                  key={area.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedArea?.id === area.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setSelectedArea(area);
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-medium text-gray-900 capitalize">{area.type}</h5>
                    {showConfidence && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        area.confidence >= 0.8 ? 'bg-green-100 text-green-800' :
                        area.confidence >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {(area.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-1">{area.description}</p>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                      {area.ai_estimated_area.toFixed(1)} sq ft
                    </span>
                    {area.material && (
                      <span className="text-xs text-gray-500">{area.material}</span>
                    )}
                  </div>
                  
                  {area.reference_objects && (
                    <div className="mt-2 text-xs text-gray-500">
                      참조: {area.reference_objects.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">총 면적:</span>
                <span className="text-lg font-semibold text-gray-900">
                  {analysisResults.demolished_areas.reduce((sum, area) => sum + area.ai_estimated_area, 0).toFixed(1)} sq ft
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AnalysisViewer;