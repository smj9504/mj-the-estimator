import React, { useState, useRef, useEffect } from 'react';

const AreaEditor = ({ area, image, onSave, onClose }) => {
  const [editedArea, setEditedArea] = useState({
    ...area,
    area_sqft: area.user_area || area.ai_estimated_area
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState(() => {
    // Validate initial points and filter out invalid ones
    const initialPoints = area.boundaries.coordinates || [];
    const validPoints = initialPoints.filter(([x, y]) => !isNaN(x) && !isNaN(y));
    console.log('🔧 Initial points validation:', {
      original: initialPoints,
      valid: validPoints,
      filtered: initialPoints.length - validPoints.length
    });
    return validPoints;
  });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragPointIndex, setDragPointIndex] = useState(-1);
  const [isDraggingPolygon, setIsDraggingPolygon] = useState(false);
  const [polygonDragStart, setPolygonDragStart] = useState(null);
  const [selectedPointIndices, setSelectedPointIndices] = useState(new Set()); // 다중 선택 지원
  const [hoveredPointIndex, setHoveredPointIndex] = useState(-1);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imageRef = useRef(null); // 이미지 캐싱을 위한 ref

  useEffect(() => {
    drawCanvas();
  }, [points, selectedPointIndices, hoveredPointIndex]);

  // Keyboard event listener for point deletion
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' && selectedPointIndices.size > 0) {
        e.preventDefault();
        // 선택된 점들을 인덱스 역순으로 삭제 (인덱스 변화 방지)
        const sortedIndices = Array.from(selectedPointIndices).sort((a, b) => b - a);
        console.log('🗑️ Deleting selected points:', sortedIndices);
        
        let newPoints = [...points];
        sortedIndices.forEach(index => {
          if (newPoints.length > 3) { // 최소 3개 점 유지
            newPoints = newPoints.filter((_, i) => i !== index);
          }
        });
        
        if (newPoints.length !== points.length) {
          setPoints(newPoints);
          setSelectedPointIndices(new Set()); // 모든 선택 해제
        } else {
          alert('최소 3개의 점이 필요합니다.');
        }
      }
      
      // Escape 키로 모든 선택 해제
      if (e.key === 'Escape') {
        setSelectedPointIndices(new Set());
        setIsDrawing(false);
        console.log('🔄 All selections cleared');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedPointIndices, points]);

  // 이미지 초기 로드 및 drawCanvas 호출
  useEffect(() => {
    if (image && image.processed) {
      console.log('🔄 Loading image for AreaEditor');
      const img = new Image();
      img.onload = () => {
        console.log('✅ Image loaded successfully:', img.width, 'x', img.height);
        imageRef.current = img;
        setImageDimensions({ width: img.width, height: img.height });
        setImageLoaded(true);
        // 이미지 로드 완료 후 즉시 캔버스 그리기
        setTimeout(() => drawCanvas(), 10);
      };
      img.onerror = (error) => {
        console.error('❌ Failed to load image:', error);
        setImageLoaded(false);
      };
      
      try {
        img.src = URL.createObjectURL(image.processed);
        console.log('📎 Image URL created:', img.src);
      } catch (error) {
        console.error('❌ Failed to create object URL:', error);
      }
    }
  }, [image]);

  // 캔버스 다시 그리기 (이미지가 로드된 후에만)
  useEffect(() => {
    if (imageLoaded && imageRef.current) {
      console.log('🔄 Redrawing canvas due to state change');
      drawCanvas();
    }
  }, [points, selectedPointIndices, hoveredPointIndex, imageLoaded]);

  // 컴포넌트 마운트 후 캔버스 크기 설정 및 그리기
  useEffect(() => {
    const timer = setTimeout(() => {
      if (imageLoaded && imageRef.current) {
        console.log('⏰ Timer-triggered canvas draw');
        drawCanvas();
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [imageLoaded]);

  const drawCanvas = () => {
    console.log('🎨 drawCanvas called');
    console.log('📊 Canvas state:', {
      hasCanvas: !!canvasRef.current,
      hasContainer: !!containerRef.current,
      hasImageRef: !!imageRef.current,
      imageLoaded: imageLoaded,
      pointsCount: points.length
    });

    if (!canvasRef.current || !containerRef.current || !imageRef.current || !imageLoaded) {
      console.log('❌ drawCanvas early return - missing requirements');
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const container = containerRef.current;
    const img = imageRef.current; // 캐시된 이미지 사용
    
    // Set canvas size
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    console.log('📐 Canvas setup:', {
      canvasSize: { width: canvas.width, height: canvas.height },
      imageSize: { width: img.width, height: img.height }
    });

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
      
    // Calculate scale to fit image in container
    const scale = Math.min(
      canvas.width / img.width,
      canvas.height / img.height
    );
    
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;

    console.log('📏 Drawing calculations:', {
      scale,
      scaledSize: { width: scaledWidth, height: scaledHeight },
      offset: { x: offsetX, y: offsetY }
    });

    // Draw image (이미지는 이미 로드되어 있으므로 즉시 그려짐)
    try {
      ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
      console.log('✅ Image drawn successfully');
    } catch (error) {
      console.error('❌ Failed to draw image:', error);
    }

    // Draw polygon if points exist and are valid
    if (points && points.length > 0) {
      ctx.strokeStyle = '#7C3AED';
      ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(124, 58, 237, 0.2)';

      ctx.beginPath();
      
      // Scale points to canvas - check for valid coordinates
      const scaledPoints = points.map(([x, y]) => {
        const scaledX = offsetX + x * scale;
        const scaledY = offsetY + y * scale;
        return [scaledX, scaledY];
      }).filter(([x, y]) => !isNaN(x) && !isNaN(y)); // Filter out NaN points

      if (scaledPoints.length > 0) {
        ctx.moveTo(scaledPoints[0][0], scaledPoints[0][1]);
        scaledPoints.forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw points with enhanced styling
        scaledPoints.forEach(([x, y], index) => {
          const isSelected = selectedPointIndices.has(index);
          const isHovered = hoveredPointIndex === index;
          const pointRadius = isSelected ? 8 : isHovered ? 7 : 6;
          
          ctx.beginPath();
          ctx.arc(x, y, pointRadius, 0, 2 * Math.PI);
          
          // Point fill color
          if (isSelected) {
            ctx.fillStyle = '#DC2626'; // Red for selected
          } else if (isHovered) {
            ctx.fillStyle = '#F59E0B'; // Yellow for hovered
          } else {
            ctx.fillStyle = '#7C3AED'; // Purple for normal
          }
          ctx.fill();
          
          // Point border
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.stroke();

          // Point number
          ctx.fillStyle = '#ffffff';
          ctx.font = isSelected ? 'bold 11px Arial' : 'bold 10px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((index + 1).toString(), x, y);
        });
      }
    }
  };

  // Utility function to get mouse coordinates and convert to image coordinates
  const getImageCoordinates = (e) => {
    if (!canvasRef.current || !imageLoaded) return null;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!imageDimensions.width || !imageDimensions.height) return null;

    const canvas = canvasRef.current;
    const scale = Math.min(
      canvas.width / imageDimensions.width,
      canvas.height / imageDimensions.height
    );
    
    const scaledWidth = imageDimensions.width * scale;
    const scaledHeight = imageDimensions.height * scale;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;
    
    const imageX = (x - offsetX) / scale;
    const imageY = (y - offsetY) / scale;

    if (isNaN(imageX) || isNaN(imageY)) return null;
    if (imageX < 0 || imageX > imageDimensions.width || imageY < 0 || imageY > imageDimensions.height) return null;

    return { imageX, imageY, canvasX: x, canvasY: y, scale, offsetX, offsetY };
  };

  // Check if click is near a point
  const getPointAtPosition = (canvasX, canvasY) => {
    if (!imageLoaded) return -1;

    const canvas = canvasRef.current;
    const scale = Math.min(
      canvas.width / imageDimensions.width,
      canvas.height / imageDimensions.height
    );
    const offsetX = (canvas.width - (imageDimensions.width * scale)) / 2;
    const offsetY = (canvas.height - (imageDimensions.height * scale)) / 2;

    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i];
      const scaledX = offsetX + x * scale;
      const scaledY = offsetY + y * scale;
      
      const distance = Math.sqrt(Math.pow(canvasX - scaledX, 2) + Math.pow(canvasY - scaledY, 2));
      if (distance <= 10) { // 10px tolerance
        return i;
      }
    }
    return -1;
  };

  // Check if click is inside polygon
  const isClickInsidePolygon = (canvasX, canvasY) => {
    if (!imageLoaded || points.length < 3) return false;

    const canvas = canvasRef.current;
    const scale = Math.min(
      canvas.width / imageDimensions.width,
      canvas.height / imageDimensions.height
    );
    const offsetX = (canvas.width - (imageDimensions.width * scale)) / 2;
    const offsetY = (canvas.height - (imageDimensions.height * scale)) / 2;

    // Convert image coordinates to canvas coordinates
    const scaledPoints = points.map(([x, y]) => [
      offsetX + x * scale,
      offsetY + y * scale
    ]);

    // Point in polygon algorithm
    let inside = false;
    for (let i = 0, j = scaledPoints.length - 1; i < scaledPoints.length; j = i++) {
      const xi = scaledPoints[i][0], yi = scaledPoints[i][1];
      const xj = scaledPoints[j][0], yj = scaledPoints[j][1];
      
      const intersect = ((yi > canvasY) !== (yj > canvasY))
          && (canvasX < (xj - xi) * (canvasY - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Mouse down handler
  const handleMouseDown = (e) => {
    if (!canvasRef.current || !imageLoaded) return;
    e.preventDefault(); // 기본 동작 방지

    const coords = getImageCoordinates(e);
    if (!coords) return;

    const pointIndex = getPointAtPosition(coords.canvasX, coords.canvasY);
    const insidePolygon = isClickInsidePolygon(coords.canvasX, coords.canvasY);
    
    if (pointIndex >= 0) {
      // Clicking on existing point
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd + Click: 다중 선택 토글
        const newSelected = new Set(selectedPointIndices);
        if (newSelected.has(pointIndex)) {
          newSelected.delete(pointIndex);
          console.log('🔲 Deselected point:', pointIndex);
        } else {
          newSelected.add(pointIndex);
          console.log('🔲 Selected point:', pointIndex);
        }
        setSelectedPointIndices(newSelected);
      } else {
        // 일반 클릭: 드래그 시작 또는 단일 선택
        if (!selectedPointIndices.has(pointIndex)) {
          // 선택되지 않은 점 클릭 시 단일 선택
          setSelectedPointIndices(new Set([pointIndex]));
          console.log('🎯 Selected single point:', pointIndex);
        }
        setIsDragging(true);
        setDragPointIndex(pointIndex);
        console.log('🎯 Started dragging point:', pointIndex);
      }
    } else if (insidePolygon && !isDrawing) {
      // Clicking inside polygon - start polygon drag
      setIsDraggingPolygon(true);
      setPolygonDragStart({ x: coords.imageX, y: coords.imageY });
      console.log('🏠 Started dragging polygon from:', coords.imageX, coords.imageY);
    } else if (isDrawing) {
      // Drawing mode - add new point
      console.log('✅ Adding new point:', [coords.imageX, coords.imageY]);
      setPoints(prevPoints => [...prevPoints, [coords.imageX, coords.imageY]]);
    } else {
      // 빈 공간 클릭 - 모든 선택 해제
      setSelectedPointIndices(new Set());
      console.log('🔄 Cleared all selections (empty space click)');
    }
  };

  // Mouse move handler
  const handleMouseMove = (e) => {
    if (!canvasRef.current || !imageLoaded) return;

    const coords = getImageCoordinates(e);
    if (!coords) return;

    if (isDragging && dragPointIndex >= 0) {
      // Dragging a point
      const newPoints = [...points];
      newPoints[dragPointIndex] = [coords.imageX, coords.imageY];
      setPoints(newPoints);
      console.log('🔄 Dragging point', dragPointIndex, 'to:', [coords.imageX, coords.imageY]);
    } else if (isDraggingPolygon && polygonDragStart) {
      // Dragging the entire polygon
      const deltaX = coords.imageX - polygonDragStart.x;
      const deltaY = coords.imageY - polygonDragStart.y;
      
      const newPoints = points.map(([x, y]) => [x + deltaX, y + deltaY]);
      
      // Check if the new polygon is within image bounds
      const isWithinBounds = newPoints.every(([x, y]) => 
        x >= 0 && x <= imageDimensions.width && y >= 0 && y <= imageDimensions.height
      );
      
      if (isWithinBounds) {
        setPoints(newPoints);
        setPolygonDragStart({ x: coords.imageX, y: coords.imageY });
        console.log('🏠 Moving polygon by delta:', deltaX, deltaY);
      }
    } else {
      // Check for hover
      const pointIndex = getPointAtPosition(coords.canvasX, coords.canvasY);
      setHoveredPointIndex(pointIndex);
    }
  };

  // Mouse up handler
  const handleMouseUp = (e) => {
    if (isDragging) {
      console.log('🏁 Finished dragging point:', dragPointIndex);
      setIsDragging(false);
      setDragPointIndex(-1);
    }
    
    if (isDraggingPolygon) {
      console.log('🏁 Finished dragging polygon');
      setIsDraggingPolygon(false);
      setPolygonDragStart(null);
    }
  };

  const removePoint = (index) => {
    if (points.length <= 3) {
      alert('최소 3개의 점이 필요합니다.');
      return;
    }
    console.log('🗑️ Removing point:', index);
    setPoints(points.filter((_, i) => i !== index));
    
    // Update selected point indices
    const newSelected = new Set();
    selectedPointIndices.forEach(selectedIndex => {
      if (selectedIndex < index) {
        newSelected.add(selectedIndex); // 이전 인덱스는 그대로
      } else if (selectedIndex > index) {
        newSelected.add(selectedIndex - 1); // 이후 인덱스는 1 감소
      }
      // selectedIndex === index인 경우는 제거됨
    });
    setSelectedPointIndices(newSelected);
  };

  const handleSave = () => {
    console.log('💾 AreaEditor handleSave called');
    console.log('📊 Original area:', area);
    console.log('✏️ Edited area:', editedArea);
    console.log('📍 Modified points:', points);
    
    const updatedArea = {
      ...editedArea,
      boundaries: {
        ...area.boundaries,
        coordinates: points
      },
      user_modified: true
    };
    
    console.log('🔄 Updated area to save:', updatedArea);
    console.log('🎯 Calling onSave with updated area');
    
    onSave(updatedArea);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">영역 수정</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Canvas */}
            <div className="lg:col-span-2">
              <div 
                ref={containerRef}
                className="relative bg-gray-100 rounded-lg overflow-hidden"
                style={{ height: '500px' }}
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className={`w-full h-full ${
                    isDragging || isDraggingPolygon ? 'cursor-grabbing' : 
                    hoveredPointIndex >= 0 ? 'cursor-grab' : 
                    isDrawing ? 'cursor-crosshair' : 'cursor-move'
                  }`}
                />
              </div>

              <div className="mt-4 flex justify-between items-center">
                <button
                  onClick={() => setIsDrawing(!isDrawing)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    isDrawing
                      ? 'bg-blue-600 text-gray-900'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {isDrawing ? '점 추가 모드' : '점 추가 모드 시작'}
                </button>
                
                <button
                  onClick={() => {
                    setPoints(area.boundaries.coordinates);
                    setSelectedPointIndices(new Set());
                    setIsDrawing(false);
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  원래대로 복원
                </button>
              </div>
            </div>

            {/* Controls */}
            <div className="lg:col-span-1 space-y-4">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-3">사용 방법:</h4>
                <ul className="text-xs text-blue-700 space-y-2">
                  <li>• 점을 클릭하여 선택 (빨간색으로 표시)</li>
                  <li>• Ctrl/Cmd + 클릭으로 다중 선택</li>
                  <li>• 점을 드래그하여 이동</li>
                  <li>• <strong>영역 내부를 드래그하여 전체 영역 이동</strong></li>
                  <li>• 선택된 점에서 Del 키로 삭제</li>
                  <li>• Esc 키로 모든 선택 해제</li>
                  <li>• 빈 공간 클릭으로 선택 해제</li>
                  <li>• "점 추가 모드"에서 빈 공간 클릭으로 점 추가</li>
                  {selectedPointIndices.size > 0 && (
                    <li className="font-medium text-blue-800 mt-2 pt-2 border-t border-blue-200">
                      • 현재 {selectedPointIndices.size}개 점 선택됨: {Array.from(selectedPointIndices).map(i => i + 1).join(', ')} - Del 키로 삭제 가능
                    </li>
                  )}
                </ul>
              </div>

              {/* Area info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  표면 유형
                </label>
                <input
                  type="text"
                  value={editedArea.type}
                  onChange={(e) => setEditedArea({ ...editedArea, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명
                </label>
                <textarea
                  value={editedArea.description}
                  onChange={(e) => setEditedArea({ ...editedArea, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  면적 (sq ft)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={editedArea.area_sqft}
                  onChange={(e) => setEditedArea({ ...editedArea, area_sqft: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <p className="mt-1 text-xs text-gray-500">
                  AI 추정: {area.ai_estimated_area.toFixed(1)} sq ft
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 text-gray-900 rounded-lg hover:bg-green-700"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default AreaEditor;