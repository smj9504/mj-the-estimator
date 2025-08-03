import React, { useState, useCallback } from 'react';
import ImageUploader from './ImageUploader';
import DemoAnalysisViewer from './DemoAnalysisViewer';
import FeedbackCollector from './FeedbackCollector';
import ErrorBoundary from '../ErrorBoundary';
import { useImageAnalysis } from './hooks/useImageAnalysis';
import { useBeforeAfterAnalysis } from './hooks/useBeforeAfterAnalysis';
import './DemoAnalysisModule.css';

const DemoAnalysisModule = ({
  roomId,
  roomData,
  projectId,
  sessionId,
  onAnalysisComplete,
  onApplyToForm,
  onFeedbackSubmit,
  mode = 'production',
  config = {
    enableFeedback: true,
    showConfidence: true,
    showApplyButton: true,
    debugMode: false,
    enableRAG: true,
    enableBeforeAfter: true
  }
}) => {
  const [uploadedImages, setUploadedImages] = useState([]);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentStep, setCurrentStep] = useState('upload'); // upload, analyzing, review, feedback
  const [analysisMode, setAnalysisMode] = useState(null); // 'demo-calculation', 'before-after'
  const [showModeSelector, setShowModeSelector] = useState(true); // Always show mode selector initially

  const { analyzeImages, saveAnalysisResults } = useImageAnalysis();
  const { analyzeEnhanced, analyzeMultiStage, submitFeedback } = useBeforeAfterAnalysis();

  // Handle image upload
  const handleImagesUploaded = useCallback((images) => {
    setUploadedImages(images);
    if (images.length > 0) {
      setCurrentStep('ready');
    }
  }, []);

  // Start AI analysis with RAG enhancement
  const handleStartAnalysis = async () => {
    if (uploadedImages.length === 0) return;

    setIsAnalyzing(true);
    setCurrentStep('analyzing');

    try {
      let results;

      if (config.enableRAG) { // RAG dependencies now available
        // Prepare room data
        const roomDataForAnalysis = {
          room_id: roomId,
          room_type: roomData?.type || 'unknown',
          dimensions: roomData?.measurements || {},
          known_materials: roomData?.materials || [],
          material_scope: roomData?.materialScope || {},
          project_id: projectId
        };

        const analysisOptions = {
          enableRag: true,
          confidenceThreshold: 0.7
        };

        console.log('📤 Sending analysis with mode:', analysisMode);

        if (analysisMode === 'demo-calculation') {
          // Use multi-stage analysis for accurate demo area calculation
          results = await analyzeMultiStage(uploadedImages, roomDataForAnalysis, sessionId, analysisOptions);
        } else if (analysisMode === 'before-after') {
          // Use multi-stage analysis with before-after comparison focus
          results = await analyzeMultiStage(uploadedImages, roomDataForAnalysis, sessionId, {
            ...analysisOptions,
            analysisType: 'before_after_comparison'
          });
        }
      } else {
        // Use regular analysis
        const analysisData = {
          images: uploadedImages,
          roomId,
          roomType: roomData?.type || 'unknown',
          projectId,
          sessionId,
          roomMaterials: roomData?.materialScope
        };

        console.log('📤 Sending regular analysis data:', analysisData);
        results = await analyzeImages(analysisData);
      }
      
      console.log('📥 Received analysis results:', results);
      
      setAnalysisResults(results);
      setCurrentStep('review');
      
      if (onAnalysisComplete) {
        onAnalysisComplete(results);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('AI 분석 중 오류가 발생했습니다. 다시 시도해주세요.');
      setCurrentStep('ready');
    } finally {
      setIsAnalyzing(false);
    }
  };



  // Prepare final data
  const prepareFinalData = () => {
    if (!analysisResults) return null;

    const areas = analysisResults.demolished_areas.map(area => ({
      ...area,
      area_sqft: area.ai_estimated_area || area.estimated_area_sqft,
      demolition_completeness: area.demolition_completeness || 'total',
      completion_percentage: area.completion_percentage || 100,
      total_possible_area_sqft: area.total_possible_area_sqft || area.estimated_area_sqft,
      partial_description: area.partial_description || area.description
    }));

    return {
      ...analysisResults,
      analysis_id: analysisResults.analysis_id,
      project_id: projectId,
      workflow_used: analysisResults.workflow_used || 'single',
      analysis_metadata: {
        classification_summary: analysisResults.classification_summary,
        synthesis_summary: analysisResults.synthesis_summary,
        validation_results: analysisResults.validation_results,
        estimation_data: analysisResults.estimation_data
      },
      final_data: {
        areas: areas,
        total_demolished_sqft: areas.reduce((sum, area) => sum + area.area_sqft, 0)
      },
      is_verified: true
    };
  };

  // Apply to Demo Scope form
  const handleApplyToForm = async () => {
    const finalData = prepareFinalData();
    if (!finalData) return;

    // Save to backend
    try {
      await saveAnalysisResults(finalData);
    } catch (error) {
      console.error('Failed to save analysis results:', error);
    }

    // Apply to form
    if (onApplyToForm) {
      onApplyToForm(finalData);
    }

    // Show feedback form if enabled
    if (config.enableFeedback) {
      setShowFeedback(true);
      setCurrentStep('feedback');
    }
  };

  // Handle feedback submission with RAG integration
  const handleFeedbackSubmit = async (feedback) => {
    try {
      if (config.enableRAG && analysisResults?.analysis_id) {
        // Submit to RAG system for learning
        await submitFeedback(analysisResults.analysis_id, {
          type: 'correction',
          accuracy_rating: feedback.accuracy_rating || 3,
          area_corrections: feedback.area_corrections || [],
          material_corrections: feedback.material_corrections || [],
          comments: feedback.comments || '',
          analysis_type: 'single'
        });
      }

      if (onFeedbackSubmit) {
        await onFeedbackSubmit({
          analysis_id: analysisResults.analysis_id,
          feedback
        });
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
    
    setShowFeedback(false);
    // Reset module
    handleReset();
  };


  // Handle mode switch
  const handleModeSwitch = (newMode) => {
    setAnalysisMode(newMode);
    setShowModeSelector(false);
    setUploadedImages([]);
    setAnalysisResults(null);
    setCurrentStep('upload');
    setShowFeedback(false);
  };

  // Reset module
  const handleReset = () => {
    setUploadedImages([]);
    setAnalysisResults(null);
    setCurrentStep('upload');
    setShowFeedback(false);
    setAnalysisMode(null);
    setShowModeSelector(true);
  };

  return (
    <div className="demo-analysis-module">
      {/* Analysis mode selector */}
      <div className="mode-selector mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">분석 방식 선택</h3>
            {config.enableRAG && (
              <div className="flex items-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI 향상 기능 활성화
                </span>
              </div>
            )}
          </div>
          
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Demo 면적 계산 모드 */}
          <button
            onClick={() => handleModeSwitch('demo-calculation')}
            className={`p-4 rounded-lg border-2 text-left transition-colors ${
              analysisMode === 'demo-calculation'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center mb-2">
              <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h4 className="font-medium text-gray-900">Demo 면적 계산</h4>
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                일반
              </span>
            </div>
            <p className="text-sm text-gray-600">현재 상태의 사진을 분석하여 철거 영역과 면적을 자동 계산합니다</p>
          </button>

          {/* 전후 비교 분석 모드 */}
          <button
            onClick={() => handleModeSwitch('before-after')}
            className={`p-4 rounded-lg border-2 text-left transition-colors ${
              analysisMode === 'before-after'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center mb-2">
              <svg className="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <h4 className="font-medium text-gray-900">전후 사진 비교</h4>
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                정밀
              </span>
            </div>
            <p className="text-sm text-gray-600">철거 전후 사진을 한번에 업로드하면 AI가 자동으로 구분하여 정밀 비교 분석합니다</p>
          </button>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="analysis-progress mb-6">
        <div className="flex items-center justify-between">
          <div className={`step ${['upload', 'ready'].includes(currentStep) ? 'active' : 'completed'}`}>
            <div className="step-number">1</div>
            <div className="step-label">
              {analysisMode === 'before-after' ? '사진 업로드' : '이미지 업로드'}
            </div>
          </div>
          <div className={`step ${currentStep === 'analyzing' ? 'active' : currentStep === 'upload' || currentStep === 'ready' ? '' : 'completed'}`}>
            <div className="step-number">2</div>
            <div className="step-label">AI 분석</div>
          </div>
          <div className={`step ${currentStep === 'review' ? 'active' : ['upload', 'ready', 'analyzing'].includes(currentStep) ? '' : 'completed'}`}>
            <div className="step-number">3</div>
            <div className="step-label">검토 및 수정</div>
          </div>
          {config.enableFeedback && (
            <div className={`step ${currentStep === 'feedback' ? 'active' : ''}`}>
              <div className="step-number">4</div>
              <div className="step-label">피드백</div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="analysis-content">
        {/* Show upload interface only when mode is selected */}
        {!showModeSelector && (analysisMode === 'demo-calculation' || analysisMode === 'before-after') && (
          <>
            {/* Image upload section */}
            {['upload', 'ready'].includes(currentStep) && (
              <div className="upload-section">
                <div className="mb-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    이미지 업로드
                    {config.enableRAG && (
                      <span className="ml-2 text-sm text-indigo-600 font-normal">
                        (AI 과거 사례 학습 기반 분석)
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-gray-600">
                    철거할 영역이 포함된 사진을 업로드하세요. 여러 각도에서 촬영한 사진을 올리면 더 정확한 분석이 가능합니다.
                  </p>
                </div>

                <ImageUploader
                  onImagesUploaded={handleImagesUploaded}
                  maxImages={10}
                  acceptedFormats={['image/jpeg', 'image/png', 'image/webp']}
                  maxSizePerImage={10 * 1024 * 1024} // 10MB
                />
                
                {uploadedImages.length > 0 && !isAnalyzing && (
                  <div className="mt-6">
                    
                    <div className="flex justify-center">
                      <button
                        onClick={handleStartAnalysis}
                        className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex items-center"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        {config.enableRAG ? 'AI 향상 분석 시작' : 'AI 분석 시작'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Analyzing state */}
            {currentStep === 'analyzing' && (
              <div className="analyzing-section text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
                  <svg className="animate-spin h-12 w-12 text-purple-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {analysisMode === 'demo-calculation' 
                    ? 'AI가 Demo 면적을 계산하고 있습니다'
                    : analysisMode === 'before-after'
                      ? 'AI가 전후 사진을 비교 분석하고 있습니다'
                      : 'AI가 이미지를 분석하고 있습니다'
                  }
                </h3>
                <p className="text-gray-600">
                  {analysisMode === 'demo-calculation' 
                    ? '철거 영역을 정밀 분석하여 면적을 계산하고 있습니다...'
                    : analysisMode === 'before-after'
                      ? '철거 전후 변화량을 정확히 측정하고 있습니다...'
                      : '잠시만 기다려주세요...'
                  }
                </p>
                
                {/* Progress indicators for demo calculation */}
                {analysisMode === 'demo-calculation' && (
                  <div className="mt-6 max-w-md mx-auto">
                    <div className="flex justify-between text-xs text-gray-500 mb-2">
                      <span>사진 분류</span>
                      <span>요소 인벤토리</span>
                      <span>법의학적 분석</span>
                      <span>종합 판정</span>
                    </div>
                    <div className="flex gap-1">
                      {[1,2,3,4].map(step => (
                        <div key={step} className="flex-1 h-2 bg-gray-200 rounded">
                          <div className="h-full bg-green-500 rounded animate-pulse"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Analysis results review */}
            {currentStep === 'review' && analysisResults && (
              <div className="review-section">
                <ErrorBoundary
                  title="분석 결과 표시 오류"
                  message="분석 결과를 표시하는 중 오류가 발생했습니다. 분석을 다시 실행해보세요."
                  showDetails={config.debugMode}
                  onError={(error, errorInfo) => {
                    console.error('AnalysisViewer Error:', error, errorInfo);
                  }}
                  onRetry={() => {
                    // Reset to upload step to retry analysis
                    setCurrentStep('upload');
                    setAnalysisResults(null);
                  }}
                >
                  <DemoAnalysisViewer
                    images={uploadedImages}
                    analysisResults={analysisResults}
                    showConfidence={config.showConfidence}
                  />
                </ErrorBoundary>

                {/* Apply button */}
                {config.showApplyButton && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <h5 className="font-medium text-blue-900">분석 완료</h5>
                        <p className="text-sm text-blue-700 mt-1">
                          {analysisResults.demolished_areas?.length || 0}개 영역이 감지되었습니다
                          {config.enableRAG && analysisResults.rag_enhanced && (
                            <span className="ml-2 text-indigo-600">• AI 향상 적용됨</span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleReset}
                          disabled={isAnalyzing}
                          className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          처음부터 다시
                        </button>
                        <button
                          onClick={handleApplyToForm}
                          disabled={isAnalyzing}
                          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Demo Scope에 적용
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Feedback form */}
            {showFeedback && currentStep === 'feedback' && (
              <FeedbackCollector
                analysisId={analysisResults?.analysis_id}
                onSubmit={handleFeedbackSubmit}
                onSkip={handleReset}
              />
            )}
          </>
        )}
      </div>

      {/* Debug info */}
      {config.debugMode && mode === 'testing' && (
        <div className="mt-8 p-4 bg-gray-100 rounded text-sm font-mono">
          <h4 className="font-bold mb-2">Debug Info:</h4>
          <pre>{JSON.stringify({
            currentStep,
            analysisMode,
            imagesCount: uploadedImages.length,
            hasResults: !!analysisResults,
            ragEnabled: config.enableRAG,
            beforeAfterEnabled: config.enableBeforeAfter
          }, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default DemoAnalysisModule;