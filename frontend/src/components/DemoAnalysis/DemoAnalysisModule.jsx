import React, { useState, useCallback } from 'react';
import ImageUploader from './ImageUploader';
import AnalysisViewer from './AnalysisViewer';
import FeedbackCollector from './FeedbackCollector';
import { useImageAnalysis } from './hooks/useImageAnalysis';
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
    debugMode: false
  }
}) => {
  const [uploadedImages, setUploadedImages] = useState([]);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentStep, setCurrentStep] = useState('upload'); // upload, analyzing, review, feedback

  const { analyzeImages, saveAnalysisResults } = useImageAnalysis();

  // Handle image upload
  const handleImagesUploaded = useCallback((images) => {
    setUploadedImages(images);
    if (images.length > 0) {
      setCurrentStep('ready');
    }
  }, []);

  // Start AI analysis
  const handleStartAnalysis = async () => {
    if (uploadedImages.length === 0) return;

    setIsAnalyzing(true);
    setCurrentStep('analyzing');

    try {
      const analysisData = {
        images: uploadedImages,
        roomId,
        roomType: roomData?.type || 'unknown',
        projectId,
        sessionId
      };

      console.log('📤 Sending analysis data to backend:', analysisData);

      const results = await analyzeImages(analysisData);
      
      console.log('📥 Received results from backend:', results);
      
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
      area_sqft: area.ai_estimated_area
    }));

    return {
      ...analysisResults,
      analysis_id: analysisResults.analysis_id,
      project_id: projectId,
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

  // Handle feedback submission
  const handleFeedbackSubmit = async (feedback) => {
    if (onFeedbackSubmit) {
      await onFeedbackSubmit({
        analysis_id: analysisResults.analysis_id,
        feedback
      });
    }
    setShowFeedback(false);
    // Reset module
    handleReset();
  };

  // Reset module
  const handleReset = () => {
    setUploadedImages([]);
    setAnalysisResults(null);
    setCurrentStep('upload');
    setShowFeedback(false);
  };

  return (
    <div className="demo-analysis-module">
      {/* Progress indicator */}
      <div className="analysis-progress mb-6">
        <div className="flex items-center justify-between">
          <div className={`step ${['upload', 'ready'].includes(currentStep) ? 'active' : 'completed'}`}>
            <div className="step-number">1</div>
            <div className="step-label">이미지 업로드</div>
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
        {/* Image upload section */}
        {['upload', 'ready'].includes(currentStep) && (
          <div className="upload-section">
            <ImageUploader
              onImagesUploaded={handleImagesUploaded}
              maxImages={10}
              acceptedFormats={['image/jpeg', 'image/png', 'image/webp']}
              maxSizePerImage={10 * 1024 * 1024} // 10MB
            />
            
            {uploadedImages.length > 0 && !isAnalyzing && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleStartAnalysis}
                  className="px-6 py-3 bg-purple-600 text-gray-900 rounded-lg hover:bg-purple-700 font-medium flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI 분석 시작
                </button>
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">AI가 이미지를 분석하고 있습니다</h3>
            <p className="text-gray-600">잠시만 기다려주세요...</p>
          </div>
        )}

        {/* Analysis results review */}
        {currentStep === 'review' && analysisResults && (
          <div className="review-section">
            <AnalysisViewer
              images={uploadedImages}
              analysisResults={analysisResults}
              showConfidence={config.showConfidence}
            />

            {/* Apply button */}
            {config.showApplyButton && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h5 className="font-medium text-blue-900">분석 완료</h5>
                    <p className="text-sm text-blue-700 mt-1">
                      {analysisResults.demolished_areas.length}개 영역이 감지되었습니다
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
                      className="px-6 py-2 bg-green-600 text-gray-900 rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>

      {/* Debug info */}
      {config.debugMode && mode === 'testing' && (
        <div className="mt-8 p-4 bg-gray-100 rounded text-sm font-mono">
          <h4 className="font-bold mb-2">Debug Info:</h4>
          <pre>{JSON.stringify({
            currentStep,
            imagesCount: uploadedImages.length,
            hasResults: !!analysisResults
          }, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default DemoAnalysisModule;