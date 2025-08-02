import React, { useState, useRef, useEffect } from 'react';

const AreaSelector = ({ image, onAreasChange, onClose, initialAreas = [] }) => {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [areas, setAreas] = useState(initialAreas);
  const [currentArea, setCurrentArea] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [scale, setScale] = useState({ x: 1, y: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragAreaIndex, setDragAreaIndex] = useState(-1);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [forceRedraw, setForceRedraw] = useState(0);
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [dragPointIndex, setDragPointIndex] = useState(-1);
  const [selectedAreaIndex, setSelectedAreaIndex] = useState(-1);

  // Update areas when initialAreas prop changes
  useEffect(() => {
    console.log('AreaSelector: initialAreas changed:', initialAreas.length, 'areas');
    if (initialAreas.length > 0) {
      setAreas(initialAreas);
      // Delay to ensure state is updated and image is loaded
      setTimeout(() => {
        setForceRedraw(prev => prev + 1);
      }, 100);
    }
  }, [initialAreas]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape' && isDrawing) {
        handleCancelCurrent();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAreaIndex !== -1) {
        handleRemoveArea(selectedAreaIndex);
        setSelectedAreaIndex(-1);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [isDrawing, selectedAreaIndex]);

  useEffect(() => {
    if (imageRef.current && canvasRef.current) {
      const img = imageRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Wait for image to load
      const handleImageLoad = () => {
        // Set canvas size to match image display size for better interaction
        const rect = img.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        // Calculate scale for coordinate conversion
        const newScale = {
          x: img.naturalWidth / rect.width,
          y: img.naturalHeight / rect.height
        };
        console.log('AreaSelector: Image loaded, setting scale:', newScale, 'areas to draw:', areas.length);
        setScale(newScale);

        // Redraw with new scale
        redrawCanvas(ctx, canvas, newScale);
      };

      if (img.complete) {
        handleImageLoad();
      } else {
        img.addEventListener('load', handleImageLoad);
        return () => img.removeEventListener('load', handleImageLoad);
      }
    }
  }, []);

  // Separate effect for redrawing when areas or scale change
  useEffect(() => {
    console.log('AreaSelector: redraw effect triggered, areas count:', areas.length, 'scale:', scale.x, scale.y);
    if (imageRef.current && canvasRef.current && scale.x && scale.y) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      redrawCanvas(ctx, canvas, scale);
    }
  }, [areas, currentArea, scale, forceRedraw]);

  const redrawCanvas = (ctx, canvas, currentScale) => {
    console.log('AreaSelector: redrawCanvas called with', areas.length, 'areas');
    
    // Clear and redraw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set high quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw all areas
    areas.forEach((area, index) => {
      drawArea(ctx, area, index, currentScale);
    });

    // Draw current area being drawn
    if (currentArea && currentArea.points.length > 0) {
      drawArea(ctx, currentArea, 'current', currentScale);
    }
  };

  const drawArea = (ctx, area, index, currentScale = scale) => {
    if (!area || area.points.length === 0) return;

    ctx.save();
    
    // Scale points to canvas coordinates
    const scaledPoints = area.points.map(point => [
      point[0] / currentScale.x,
      point[1] / currentScale.y
    ]);
    
    // Set style based on whether it's current, selected, or completed
    if (index === 'current') {
      ctx.strokeStyle = '#FF0000'; // Bright red for current drawing
      ctx.lineWidth = 4;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.setLineDash([8, 4]); // Longer dashes for better visibility
    } else {
      const colors = ['#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];
      const color = colors[index % colors.length];
      const isSelected = index === selectedAreaIndex;
      
      ctx.strokeStyle = isSelected ? '#FF6B6B' : color;
      ctx.lineWidth = isSelected ? 5 : 3; // Thicker line for selected area
      ctx.fillStyle = isSelected ? 'rgba(255, 107, 107, 0.4)' : color + '66';
      ctx.setLineDash(isSelected ? [10, 5] : []); // Dashed line for selected area
    }

    // Draw polygon
    if (scaledPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(scaledPoints[0][0], scaledPoints[0][1]);
      scaledPoints.slice(1).forEach(point => {
        ctx.lineTo(point[0], point[1]);
      });
      
      if (index !== 'current' || area.isComplete) {
        ctx.closePath();
        ctx.fill();
      }
      
      ctx.stroke();
    }

    // Draw points with white border for better visibility
    scaledPoints.forEach((point, pointIndex) => {
      // Check if this point is being dragged
      const isPointBeingDragged = isDraggingPoint && 
                                  dragAreaIndex === index && 
                                  dragPointIndex === pointIndex;
      
      const pointRadius = isPointBeingDragged ? 9 : 7;
      const centerRadius = isPointBeingDragged ? 7 : 5;
      
      // White border
      ctx.beginPath();
      ctx.arc(point[0], point[1], pointRadius, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = isPointBeingDragged ? '#FF6B6B' : '#000000';
      ctx.lineWidth = isPointBeingDragged ? 3 : 2;
      ctx.stroke();
      
      // Colored center
      ctx.beginPath();
      ctx.arc(point[0], point[1], centerRadius, 0, 2 * Math.PI);
      ctx.fillStyle = index === 'current' ? '#FF0000' : 
                     isPointBeingDragged ? '#FF6B6B' : ctx.strokeStyle;
      ctx.fill();
      
      // Draw closing indicator on first point if drawing
      if (index === 'current' && pointIndex === 0 && scaledPoints.length > 2) {
        ctx.beginPath();
        ctx.arc(point[0], point[1], 12, 0, 2 * Math.PI);
        ctx.strokeStyle = '#00FF00'; // Green for close indicator
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });

    // Draw label with background for better readability
    if (index !== 'current' && scaledPoints.length > 0) {
      const labelText = `영역 ${index + 1}`;
      const x = scaledPoints[0][0] + 10;
      const y = scaledPoints[0][1] - 10;
      
      ctx.font = 'bold 16px Arial';
      const textMetrics = ctx.measureText(labelText);
      
      // Background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(x - 4, y - 18, textMetrics.width + 8, 22);
      
      // Border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 4, y - 18, textMetrics.width + 8, 22);
      
      // Text
      ctx.fillStyle = '#000000';
      ctx.fillText(labelText, x, y);
    }

    ctx.restore();
  };

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Get canvas coordinates (display coordinates)
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    // Convert to image coordinates for storage
    const imageX = canvasX * scale.x;
    const imageY = canvasY * scale.y;
    return [Math.round(imageX), Math.round(imageY)];
  };

  // Check if a point is inside a polygon
  const isPointInPolygon = (point, polygon) => {
    const [x, y] = point;
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  };

  // Find which area contains the clicked point
  const findAreaAtPoint = (point) => {
    // Check areas in reverse order (last drawn on top)
    for (let i = areas.length - 1; i >= 0; i--) {
      if (isPointInPolygon(point, areas[i].points)) {
        return i;
      }
    }
    return -1;
  };

  // Find if clicking on a specific point of an area
  const findPointAtPosition = (clickPoint) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickDisplayX = clickPoint[0] / scale.x;
    const clickDisplayY = clickPoint[1] / scale.y;
    
    // Check all areas for point hits (reverse order for last drawn on top)
    for (let areaIndex = areas.length - 1; areaIndex >= 0; areaIndex--) {
      const area = areas[areaIndex];
      for (let pointIndex = 0; pointIndex < area.points.length; pointIndex++) {
        const point = area.points[pointIndex];
        const pointDisplayX = point[0] / scale.x;
        const pointDisplayY = point[1] / scale.y;
        
        const distance = Math.sqrt(
          Math.pow(clickDisplayX - pointDisplayX, 2) + 
          Math.pow(clickDisplayY - pointDisplayY, 2)
        );
        
        // If click is within 12 pixels of a point (increased for easier selection)
        if (distance < 12) {
          return { areaIndex, pointIndex };
        }
      }
    }
    return null;
  };

  const handleCanvasMouseDown = (e) => {
    const coords = getCanvasCoordinates(e);

    if (isDragging || isDraggingPoint) return;

    if (!isDrawing) {
      // First check if clicking on a specific point (higher priority than area dragging)
      const pointHit = findPointAtPosition(coords);
      if (pointHit) {
        // Select the area and start dragging the specific point
        setSelectedAreaIndex(pointHit.areaIndex);
        setIsDraggingPoint(true);
        setDragAreaIndex(pointHit.areaIndex);
        setDragPointIndex(pointHit.pointIndex);
        return;
      }

      // Check if clicking on an existing area
      const areaIndex = findAreaAtPoint(coords);
      if (areaIndex !== -1) {
        // Select the area
        setSelectedAreaIndex(areaIndex);
        
        // Start dragging the whole area
        setIsDragging(true);
        setDragAreaIndex(areaIndex);
        
        // Calculate offset from area center
        const area = areas[areaIndex];
        const centerX = area.points.reduce((sum, p) => sum + p[0], 0) / area.points.length;
        const centerY = area.points.reduce((sum, p) => sum + p[1], 0) / area.points.length;
        setDragOffset({
          x: coords[0] - centerX,
          y: coords[1] - centerY
        });
        return;
      }
      
      // If clicking on empty space, deselect current area
      setSelectedAreaIndex(-1);
      
      // Start new area
      setIsDrawing(true);
      setCurrentArea({
        points: [coords],
        isComplete: false
      });
    } else {
      // Check if clicking near first point to close polygon
      if (currentArea.points.length > 2) {
        const firstPoint = currentArea.points[0];
        // Calculate distance in display coordinates for consistent detection
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const firstPointDisplayX = firstPoint[0] / scale.x;
        const firstPointDisplayY = firstPoint[1] / scale.y;
        
        const distance = Math.sqrt(
          Math.pow(clickX - firstPointDisplayX, 2) + 
          Math.pow(clickY - firstPointDisplayY, 2)
        );
        
        if (distance < 20) { // Increased threshold for easier closing
          // Close polygon
          const newArea = {
            ...currentArea,
            isComplete: true
          };
          setAreas([...areas, newArea]);
          setCurrentArea(null);
          setIsDrawing(false);
          return;
        }
      }

      // Add point to current area
      setCurrentArea({
        ...currentArea,
        points: [...currentArea.points, coords]
      });
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDragging && !isDraggingPoint) return;

    const coords = getCanvasCoordinates(e);

    if (isDraggingPoint) {
      // Drag individual point
      const newAreas = [...areas];
      const area = newAreas[dragAreaIndex];
      const newPoints = [...area.points];
      newPoints[dragPointIndex] = coords;
      
      newAreas[dragAreaIndex] = {
        ...area,
        points: newPoints
      };
      
      setAreas(newAreas);
    } else if (isDragging) {
      // Drag whole area
      const targetCenterX = coords[0] - dragOffset.x;
      const targetCenterY = coords[1] - dragOffset.y;

      // Calculate current center
      const area = areas[dragAreaIndex];
      const currentCenterX = area.points.reduce((sum, p) => sum + p[0], 0) / area.points.length;
      const currentCenterY = area.points.reduce((sum, p) => sum + p[1], 0) / area.points.length;

      // Calculate movement delta
      const deltaX = targetCenterX - currentCenterX;
      const deltaY = targetCenterY - currentCenterY;

      // Move all points of the area
      const newAreas = [...areas];
      newAreas[dragAreaIndex] = {
        ...area,
        points: area.points.map(point => [
          point[0] + deltaX,
          point[1] + deltaY
        ])
      };

      setAreas(newAreas);
    }
  };

  const handleCanvasMouseUp = (e) => {
    if (isDragging) {
      setIsDragging(false);
      setDragAreaIndex(-1);
      setDragOffset({ x: 0, y: 0 });
    }
    
    if (isDraggingPoint) {
      setIsDraggingPoint(false);
      setDragAreaIndex(-1);
      setDragPointIndex(-1);
    }
  };

  const handleRemoveArea = (index) => {
    const newAreas = areas.filter((_, i) => i !== index);
    setAreas(newAreas);
    
    // Update selected area index if needed
    if (selectedAreaIndex === index) {
      setSelectedAreaIndex(-1);
    } else if (selectedAreaIndex > index) {
      setSelectedAreaIndex(selectedAreaIndex - 1);
    }
  };

  const handleCancelCurrent = () => {
    setCurrentArea(null);
    setIsDrawing(false);
  };

  const handleSaveAreas = () => {
    if (onAreasChange) {
      onAreasChange(areas);
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">영역 선택</h2>
              <p className="text-sm text-gray-600 mt-1">
                분석할 영역을 선택해주세요. 여러 영역을 선택할 수 있습니다.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Image area */}
          <div className="flex-1 p-6 overflow-auto">
            <div className="relative inline-block">
              <img
                ref={imageRef}
                src={image}
                alt="Material analysis"
                className="max-w-full h-auto"
              />
              <canvas
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                className={`absolute inset-0 ${
                  isDragging ? 'cursor-move' : 
                  isDraggingPoint ? 'cursor-move' : 
                  isDrawing ? 'cursor-crosshair' : 'cursor-crosshair'
                }`}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80 bg-gray-50 p-6 border-l border-gray-200 overflow-y-auto">
            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-3">사용 방법</h4>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li>• <strong>클릭</strong>하여 다각형의 꼭짓점을 추가</li>
                  <li>• <strong>첫 번째 점(녹색 원)</strong>을 다시 클릭하여 영역 완성</li>
                  <li>• <strong>영역 클릭</strong>으로 선택 (빨간색 점선으로 표시)</li>
                  <li>• <strong>점을 드래그</strong>하여 개별 점 위치 조정</li>
                  <li>• <strong>영역 내부를 드래그</strong>하여 전체 영역 이동</li>
                  <li>• <strong>Delete 키</strong>로 선택된 영역 삭제</li>
                  <li>• <strong>ESC 키</strong>로 현재 그리기 취소</li>
                </ul>
                
                {isDrawing && (
                  <div className="mt-3 p-2 bg-red-50 rounded border border-red-200">
                    <p className="text-xs text-red-700">
                      <strong>그리기 중:</strong> 빨간색 점선으로 표시됩니다. 첫 번째 점의 녹색 원을 클릭하여 완성하세요.
                    </p>
                  </div>
                )}
                
                {isDraggingPoint && (
                  <div className="mt-3 p-2 bg-orange-50 rounded border border-orange-200">
                    <p className="text-xs text-orange-700">
                      <strong>점 이동 중:</strong> 마우스를 움직여 점의 위치를 조정하세요.
                    </p>
                  </div>
                )}
                
                {isDragging && (
                  <div className="mt-3 p-2 bg-purple-50 rounded border border-purple-200">
                    <p className="text-xs text-purple-700">
                      <strong>영역 이동 중:</strong> 마우스를 움직여 전체 영역을 이동하세요.
                    </p>
                  </div>
                )}
                
                {selectedAreaIndex !== -1 && !isDragging && !isDraggingPoint && !isDrawing && (
                  <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
                    <p className="text-xs text-green-700">
                      <strong>영역 {selectedAreaIndex + 1} 선택됨:</strong> Delete 키를 눌러 삭제할 수 있습니다.
                    </p>
                  </div>
                )}
              </div>

              {/* Current drawing status */}
              {isDrawing && currentArea && (
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <h4 className="font-medium text-purple-900 mb-2">현재 그리기</h4>
                  <p className="text-sm text-purple-800 mb-2">
                    {currentArea.points.length}개의 점이 선택됨
                  </p>
                  <button
                    onClick={handleCancelCurrent}
                    className="text-sm text-purple-600 hover:text-purple-800"
                  >
                    취소
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {areas.length}개 영역 생성됨
            {selectedAreaIndex !== -1 && (
              <span className="text-blue-600 ml-2">
                (영역 {selectedAreaIndex + 1} 선택됨)
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
            >
              취소
            </button>
            <button
              onClick={handleSaveAreas}
              disabled={areas.length === 0}
              className="px-6 py-2 bg-blue-600 text-black rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              영역 선택 완료
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AreaSelector;