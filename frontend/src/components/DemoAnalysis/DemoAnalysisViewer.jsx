import React, { useState } from 'react';

const DemoAnalysisViewer = ({
  images,
  analysisResults,
  showConfidence = true
}) => {
  const [selectedImage, setSelectedImage] = useState(0);

  if (!analysisResults || !analysisResults.demolished_areas) {
    return (
      <div className="analysis-viewer p-4 text-center text-gray-500">
        분석 결과가 없습니다.
      </div>
    );
  }

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
        {/* Image display (no overlay needed for demo scope) */}
        <div className="lg:col-span-2">
          <div className="relative bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={URL.createObjectURL(images[selectedImage].processed)}
              alt="Analysis"
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* Area list */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium text-gray-900">감지된 철거 영역</h4>
              {analysisResults.workflow_used === 'multi_stage_enhanced' && (
                <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">
                  4단계 분석
                </span>
              )}
            </div>
            
            {analysisResults.demolished_areas?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                감지된 철거 영역이 없습니다.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {analysisResults.demolished_areas?.map((area, index) => (
                <div
                  key={area.id || `area_${index}`}
                  className="p-3 rounded-lg border border-gray-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="font-medium text-gray-900 capitalize">{area.type || area.surface_type}</h5>
                    {showConfidence && area.confidence && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        area.confidence >= 0.8 ? 'bg-green-100 text-green-800' :
                        area.confidence >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {(Number(area.confidence || 0) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-1">{area.description}</p>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                      {(Number(area.ai_estimated_area || area.estimated_area_sqft || 0)).toFixed(1)} sq ft
                    </span>
                    {area.material && (
                      <span className="text-xs text-gray-500">{area.material}</span>
                    )}
                  </div>
                  
                  {area.demolition_completeness && (
                    <div className="mt-2 text-xs text-gray-500">
                      철거 완료도: {area.demolition_completeness === 'total' ? '전체' : '부분'} 
                      {area.completion_percentage && ` (${area.completion_percentage}%)`}
                    </div>
                  )}
                </div>
                ))}
              </div>
            )}

            {/* Multi-stage analysis metadata */}
            {analysisResults.classification_summary && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h5 className="text-xs font-medium text-blue-900 mb-2">분석 요약</h5>
                <div className="text-xs text-blue-700 space-y-1">
                  {analysisResults.classification_summary.dominant_state && (
                    <div>상태: {analysisResults.classification_summary.dominant_state === 'primarily_after' ? '주로 철거 후' : '혼합 상태'}</div>
                  )}
                  {analysisResults.synthesis_summary?.detected_toilets > 0 && (
                    <div>토일렛 감지: {analysisResults.synthesis_summary.detected_toilets}개</div>
                  )}
                  {analysisResults.synthesis_summary?.detected_fixtures > 0 && (
                    <div>조명기구 감지: {analysisResults.synthesis_summary.detected_fixtures}개</div>
                  )}
                  {analysisResults.synthesis_summary?.insulation_removal_detected && (
                    <div>단열재 제거 감지됨</div>
                  )}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">총 철거 면적:</span>
                <span className="text-lg font-semibold text-gray-900">
                  {analysisResults.demolished_areas?.reduce((sum, area) => sum + Number(area.ai_estimated_area || area.estimated_area_sqft || 0), 0).toFixed(1) || '0'} sq ft
                </span>
              </div>
              
              {/* Analysis confidence */}
              {analysisResults.confidence_score && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm font-medium text-gray-700">분석 신뢰도:</span>
                  <span className={`text-sm font-medium ${
                    analysisResults.confidence_score >= 0.8 ? 'text-green-600' :
                    analysisResults.confidence_score >= 0.6 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {(Number(analysisResults.confidence_score || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default DemoAnalysisViewer;