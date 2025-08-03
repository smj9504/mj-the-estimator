# Frontend Component Specifications: Enhanced Demo Scope UI

## Overview

This document defines the frontend component architecture and specifications for the enhanced Demo Scope functionality with RAG integration and before/after photo comparison.

## Component Architecture

```
DemoScope.jsx (Enhanced)
├── DemoAnalysisModule.jsx (Enhanced)
│   ├── BeforeAfterComparison.jsx (New)
│   │   ├── ImageUploader.jsx (Existing)
│   │   ├── ComparisonViewer.jsx (New)
│   │   └── FeatureVisualization.jsx (New)
│   ├── AnalysisViewer.jsx (Enhanced)
│   ├── RagContextPreview.jsx (New)
│   └── FeedbackCollector.jsx (Enhanced)
├── AutoSaveIndicator.jsx (Existing)
└── MaterialAnalysisModal.jsx (Existing)
```

## 1. Enhanced DemoAnalysisModule Component

### Props Interface
```typescript
interface DemoAnalysisModuleProps {
  roomId: string;
  roomData: RoomData;
  projectId: string;
  sessionId: string;
  onAnalysisComplete: (results: AnalysisResult) => void;
  onApplyToForm: (data: FormData) => void;
  onFeedbackSubmit: (feedback: FeedbackData) => void;
  mode?: 'single' | 'comparison' | 'batch';
  ragEnabled?: boolean;
  config?: {
    enableFeedback: boolean;
    showConfidence: boolean;
    showApplyButton: boolean;
    debugMode: boolean;
    maxImages: number;
  };
}
```

### State Management
```typescript
interface DemoAnalysisState {
  currentStep: 'upload' | 'analyzing' | 'review' | 'feedback';
  analysisMode: 'single' | 'comparison';
  uploadedImages: UploadedImage[];
  beforeImages: UploadedImage[];
  afterImages: UploadedImage[];
  analysisResults: AnalysisResult | null;
  ragContext: RAGContext[] | null;
  isAnalyzing: boolean;
  showFeedback: boolean;
  showRagPreview: boolean;
  debugMode: boolean;
  confidenceThreshold: number;
}
```

### Enhanced UI Features
```jsx
const DemoAnalysisModule = (props) => {
  return (
    <div className="demo-analysis-module">
      {/* Mode Selection */}
      <div className="analysis-mode-selector">
        <button 
          className={`mode-btn ${analysisMode === 'single' ? 'active' : ''}`}
          onClick={() => setAnalysisMode('single')}
        >
          Single Image Analysis
        </button>
        <button 
          className={`mode-btn ${analysisMode === 'comparison' ? 'active' : ''}`}
          onClick={() => setAnalysisMode('comparison')}
        >
          Before/After Comparison
        </button>
      </div>

      {/* RAG Settings Panel */}
      {props.ragEnabled && (
        <div className="rag-settings">
          <label>
            <input 
              type="checkbox" 
              checked={ragEnabled}
              onChange={setRagEnabled}
            />
            Use historical case analysis (RAG)
          </label>
          {props.config?.debugMode && (
            <button onClick={() => setShowRagPreview(!showRagPreview)}>
              {showRagPreview ? 'Hide' : 'Show'} RAG Context
            </button>
          )}
        </div>
      )}

      {/* Content based on mode */}
      {analysisMode === 'comparison' ? (
        <BeforeAfterComparison {...comparisonProps} />
      ) : (
        <SingleImageAnalysis {...singleProps} />
      )}

      {/* RAG Context Preview */}
      {showRagPreview && ragContext && (
        <RagContextPreview context={ragContext} debugMode={debugMode} />
      )}
    </div>
  );
};
```

## 2. BeforeAfterComparison Component (New)

### Component Specification
```typescript
interface BeforeAfterComparisonProps {
  onAnalysisComplete: (results: ComparisonResult) => void;
  onRagContextUpdate: (context: RAGContext[]) => void;
  sessionId: string;
  roomData: RoomData;
  maxImages: number;
  ragEnabled: boolean;
  debugMode: boolean;
}

interface BeforeAfterComparisonState {
  beforeImages: UploadedImage[];
  afterImages: UploadedImage[];
  beforeFeatures: ImageFeatures | null;
  afterFeatures: ImageFeatures | null;
  comparisonResults: ComparisonResult | null;
  isProcessing: boolean;
  currentStep: 'upload' | 'processing' | 'features' | 'comparison' | 'results';
  ragPreview: RAGContext[] | null;
}
```

### UI Layout
```jsx
const BeforeAfterComparison = (props) => {
  return (
    <div className="before-after-comparison">
      {/* Upload Sections */}
      <div className="upload-grid">
        <div className="before-section">
          <div className="section-header">
            <h4>Before Photos</h4>
            <span className="image-count">{beforeImages.length}/{maxImages}</span>
          </div>
          <ImageUploader
            images={beforeImages}
            onImagesUploaded={setBeforeImages}
            maxImages={maxImages}
            dropzoneText="Drop before demolition photos here"
            className="before-uploader"
          />
          <div className="upload-tips">
            <p>📸 Tip: Include multiple angles and close-ups of materials</p>
          </div>
        </div>

        <div className="after-section">
          <div className="section-header">
            <h4>After Photos</h4>
            <span className="image-count">{afterImages.length}/{maxImages}</span>
          </div>
          <ImageUploader
            images={afterImages}
            onImagesUploaded={setAfterImages}
            maxImages={maxImages}
            dropzoneText="Drop after demolition photos here"
            className="after-uploader"
          />
          <div className="upload-tips">
            <p>🔍 Tip: Show demolished areas clearly for accurate detection</p>
          </div>
        </div>
      </div>

      {/* Analysis Controls */}
      <div className="analysis-controls">
        <div className="settings-row">
          <label>
            Confidence Threshold:
            <input 
              type="range" 
              min="0.5" 
              max="1.0" 
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(e.target.value)}
            />
            <span>{(confidenceThreshold * 100).toFixed(0)}%</span>
          </label>
        </div>
        
        <button
          className="analyze-btn primary"
          onClick={handleStartComparison}
          disabled={beforeImages.length === 0 || afterImages.length === 0 || isProcessing}
        >
          {isProcessing ? (
            <>
              <Spinner size="sm" />
              Analyzing Comparison...
            </>
          ) : (
            <>
              <CompareIcon />
              Start Before/After Analysis
            </>
          )}
        </button>
      </div>

      {/* Processing Steps */}
      {isProcessing && (
        <ProcessingSteps currentStep={currentStep} />
      )}

      {/* Results Display */}
      {comparisonResults && (
        <ComparisonResults 
          results={comparisonResults}
          beforeImages={beforeImages}
          afterImages={afterImages}
          onApplyToForm={props.onAnalysisComplete}
        />
      )}
    </div>
  );
};
```

## 3. ComparisonViewer Component (New)

### Purpose
Display side-by-side comparison of before/after images with detected areas highlighted.

```jsx
const ComparisonViewer = ({
  beforeImages,
  afterImages,
  comparisonResults,
  selectedArea = null,
  onAreaSelect,
  showOverlays = true
}) => {
  return (
    <div className="comparison-viewer">
      <div className="viewer-grid">
        <div className="before-viewer">
          <h5>Before</h5>
          <ImageCarousel
            images={beforeImages}
            overlays={showOverlays ? beforeOverlays : []}
            onOverlayClick={onAreaSelect}
            className="before-carousel"
          />
        </div>

        <div className="comparison-separator">
          <div className="separator-line" />
          <CompareIcon className="separator-icon" />
        </div>

        <div className="after-viewer">
          <h5>After</h5>
          <ImageCarousel
            images={afterImages}
            overlays={showOverlays ? afterOverlays : []}
            onOverlayClick={onAreaSelect}
            className="after-carousel"
          />
        </div>
      </div>

      {/* Detected Areas List */}
      <div className="detected-areas">
        <h6>Detected Changes</h6>
        <div className="areas-list">
          {comparisonResults?.demolished_areas.map((area, idx) => (
            <AreaCard
              key={idx}
              area={area}
              isSelected={selectedArea?.id === area.id}
              onClick={() => onAreaSelect(area)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
```

## 4. RagContextPreview Component (New)

### Purpose
Display RAG context results for debugging and transparency.

```jsx
const RagContextPreview = ({ context, debugMode, onApplyContext }) => {
  const [expandedCard, setExpandedCard] = useState(null);

  return (
    <div className="rag-context-preview">
      <div className="context-header">
        <h5>
          <DatabaseIcon />
          Similar Cases Found ({context.length})
        </h5>
        {debugMode && (
          <button className="toggle-debug">
            <BugIcon />
            Debug Mode
          </button>
        )}
      </div>

      <div className="context-cards">
        {context.map((doc, idx) => (
          <div 
            key={doc.id}
            className={`context-card ${expandedCard === idx ? 'expanded' : ''}`}
          >
            <div className="card-header" onClick={() => setExpandedCard(expandedCard === idx ? null : idx)}>
              <div className="similarity-score">
                <span className="score-bar" style={{width: `${doc.similarity_score * 100}%`}} />
                <span className="score-text">{(doc.similarity_score * 100).toFixed(1)}%</span>
              </div>
              <div className="case-summary">
                {doc.metadata.room_type} - {doc.metadata.area_sqft} sq ft
              </div>
              <ChevronIcon className={`expand-icon ${expandedCard === idx ? 'rotated' : ''}`} />
            </div>

            {expandedCard === idx && (
              <div className="card-content">
                <div className="case-details">
                  <p>{doc.content.substring(0, 200)}...</p>
                  {debugMode && (
                    <div className="debug-info">
                      <h6>Metadata:</h6>
                      <pre>{JSON.stringify(doc.metadata, null, 2)}</pre>
                    </div>
                  )}
                </div>
                
                <div className="applied-insights">
                  <h6>Applied Insights:</h6>
                  <div className="insights-tags">
                    {doc.applied_insights?.map((insight, i) => (
                      <span key={i} className="insight-tag">{insight}</span>
                    ))}
                  </div>
                </div>

                <button 
                  className="apply-context-btn"
                  onClick={() => onApplyContext?.(doc)}
                >
                  Apply This Context
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="context-summary">
        <div className="summary-stats">
          <div className="stat">
            <span className="label">Avg Confidence:</span>
            <span className="value">
              {(context.reduce((sum, doc) => sum + doc.similarity_score, 0) / context.length * 100).toFixed(1)}%
            </span>
          </div>
          <div className="stat">
            <span className="label">Total Insights:</span>
            <span className="value">
              {context.reduce((sum, doc) => sum + (doc.applied_insights?.length || 0), 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

## 5. FeatureVisualization Component (New)

### Purpose
Visualize extracted features from before/after images.

```jsx
const FeatureVisualization = ({ 
  beforeFeatures, 
  afterFeatures, 
  onFeatureToggle,
  visibleFeatures = ['materials', 'surfaces', 'changes']
}) => {
  return (
    <div className="feature-visualization">
      <div className="feature-controls">
        <h6>Feature Layers</h6>
        <div className="layer-toggles">
          {['materials', 'surfaces', 'changes', 'annotations'].map(layer => (
            <label key={layer}>
              <input
                type="checkbox"
                checked={visibleFeatures.includes(layer)}
                onChange={() => onFeatureToggle(layer)}
              />
              <span className="layer-name">{layer}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="features-comparison">
        <div className="before-features">
          <h6>Before Features</h6>
          <FeatureList features={beforeFeatures} type="before" />
        </div>

        <div className="feature-changes">
          <h6>Detected Changes</h6>
          <ChangesList 
            beforeFeatures={beforeFeatures}
            afterFeatures={afterFeatures}
          />
        </div>

        <div className="after-features">
          <h6>After Features</h6>
          <FeatureList features={afterFeatures} type="after" />
        </div>
      </div>
    </div>
  );
};
```

## 6. Enhanced AnalysisViewer Component

### Enhancements to Existing Component
```jsx
const AnalysisViewer = ({ 
  images, 
  analysisResults, 
  showConfidence,
  ragContext = null,
  comparisonMode = false 
}) => {
  return (
    <div className="analysis-viewer enhanced">
      {/* Existing image gallery and results */}
      <ImageGallery images={images} overlays={analysisOverlays} />
      
      {/* Enhanced results panel */}
      <div className="results-panel">
        <div className="results-header">
          <h5>Analysis Results</h5>
          {ragContext && (
            <div className="rag-indicator">
              <DatabaseIcon />
              <span>RAG Enhanced</span>
              <span className="enhancement-count">+{ragContext.length} cases</span>
            </div>
          )}
        </div>

        <div className="detected-areas">
          {analysisResults.demolished_areas.map((area, idx) => (
            <div key={idx} className="area-card enhanced">
              <div className="area-header">
                <div className="area-type">{area.type}</div>
                <div className="confidence-badge">
                  <span className={`confidence ${getConfidenceClass(area.confidence)}`}>
                    {(area.confidence * 100).toFixed(0)}%
                  </span>
                  {area.estimated && <span className="estimated-tag">Estimated</span>}
                </div>
              </div>
              
              <div className="area-details">
                <div className="detail-row">
                  <span className="label">Material:</span>
                  <span className="value">{area.material}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Area:</span>
                  <span className="value">{area.area_sqft} sq ft</span>
                </div>
                <div className="detail-row">
                  <span className="label">Method:</span>
                  <span className="value">{area.detection_method}</span>
                </div>
              </div>

              {area.rag_insights && (
                <div className="rag-insights">
                  <h6>AI Insights:</h6>
                  <ul>
                    {area.rag_insights.map((insight, i) => (
                      <li key={i}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Summary section */}
        <div className="analysis-summary">
          <div className="summary-row">
            <span className="label">Total Demolished Area:</span>
            <span className="value highlight">
              {analysisResults.total_demolished_sqft} sq ft
            </span>
          </div>
          <div className="summary-row">
            <span className="label">Overall Confidence:</span>
            <span className="value">
              {(analysisResults.confidence_score * 100).toFixed(0)}%
            </span>
          </div>
          {ragContext && (
            <div className="summary-row">
              <span className="label">Historical Cases Used:</span>
              <span className="value">{ragContext.length}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

## 7. ProcessingSteps Component (New)

### Purpose
Show progress during AI analysis with detailed steps.

```jsx
const ProcessingSteps = ({ currentStep, steps = defaultSteps }) => {
  const defaultSteps = [
    { key: 'preprocessing', label: 'Image Preprocessing', duration: '~10s' },
    { key: 'feature_extraction', label: 'Feature Extraction', duration: '~15s' },
    { key: 'rag_search', label: 'Searching Similar Cases', duration: '~5s' },
    { key: 'comparison', label: 'AI Comparison Analysis', duration: '~20s' },
    { key: 'validation', label: 'Result Validation', duration: '~5s' }
  ];

  return (
    <div className="processing-steps">
      <div className="steps-container">
        {steps.map((step, idx) => {
          const isActive = step.key === currentStep;
          const isCompleted = steps.findIndex(s => s.key === currentStep) > idx;
          
          return (
            <div 
              key={step.key}
              className={`step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            >
              <div className="step-indicator">
                {isCompleted ? (
                  <CheckIcon />
                ) : isActive ? (
                  <Spinner size="sm" />
                ) : (
                  <span className="step-number">{idx + 1}</span>
                )}
              </div>
              
              <div className="step-content">
                <div className="step-label">{step.label}</div>
                <div className="step-duration">{step.duration}</div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="overall-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{
              width: `${((steps.findIndex(s => s.key === currentStep) + 1) / steps.length) * 100}%`
            }}
          />
        </div>
        <div className="progress-text">
          Step {steps.findIndex(s => s.key === currentStep) + 1} of {steps.length}
        </div>
      </div>
    </div>
  );
};
```

## 8. Enhanced FeedbackCollector Component

### Enhancements for RAG Learning
```jsx
const FeedbackCollector = ({ 
  analysisId, 
  analysisResults,
  ragContext,
  onSubmit, 
  onSkip 
}) => {
  const [feedbackData, setFeedbackData] = useState({
    accuracy_rating: 5,
    areas_feedback: [],
    rag_helpfulness: 5,
    overall_comments: '',
    suggested_improvements: []
  });

  return (
    <div className="feedback-collector enhanced">
      <div className="feedback-header">
        <h5>Help Improve AI Accuracy</h5>
        <p>Your feedback helps our AI learn from real projects</p>
      </div>

      {/* Overall accuracy rating */}
      <div className="rating-section">
        <label>Overall Analysis Accuracy:</label>
        <StarRating 
          value={feedbackData.accuracy_rating}
          onChange={(rating) => setFeedbackData(prev => ({...prev, accuracy_rating: rating}))}
        />
      </div>

      {/* RAG helpfulness rating */}
      {ragContext && (
        <div className="rating-section">
          <label>How helpful were the similar cases?</label>
          <StarRating 
            value={feedbackData.rag_helpfulness}
            onChange={(rating) => setFeedbackData(prev => ({...prev, rag_helpfulness: rating}))}
          />
        </div>
      )}

      {/* Area-specific feedback */}
      <div className="areas-feedback">
        <h6>Area-Specific Feedback:</h6>
        {analysisResults.demolished_areas.map((area, idx) => (
          <AreaFeedbackCard
            key={idx}
            area={area}
            onFeedback={(feedback) => updateAreaFeedback(idx, feedback)}
          />
        ))}
      </div>

      {/* Comments and suggestions */}
      <div className="comments-section">
        <label>Additional Comments:</label>
        <textarea
          value={feedbackData.overall_comments}
          onChange={(e) => setFeedbackData(prev => ({...prev, overall_comments: e.target.value}))}
          placeholder="Any specific observations or suggestions for improvement?"
          rows={3}
        />
      </div>

      <div className="feedback-actions">
        <button onClick={onSkip} className="skip-btn">
          Skip Feedback
        </button>
        <button onClick={() => onSubmit(feedbackData)} className="submit-btn primary">
          Submit Feedback
        </button>
      </div>
    </div>
  );
};
```

## 9. Styling Guidelines

### CSS Variables
```css
:root {
  /* RAG-specific colors */
  --rag-primary: #6366f1;
  --rag-secondary: #818cf8;
  --rag-accent: #c7d2fe;
  
  /* Comparison colors */
  --before-color: #ef4444;
  --after-color: #10b981;
  --change-color: #f59e0b;
  
  /* Confidence levels */
  --confidence-high: #10b981;
  --confidence-medium: #f59e0b; 
  --confidence-low: #ef4444;
  
  /* Processing states */
  --processing: #6366f1;
  --completed: #10b981;
  --error: #ef4444;
}
```

### Component Classes
```css
.demo-analysis-module {
  .analysis-mode-selector { /* Mode toggle buttons */ }
  .rag-settings { /* RAG configuration panel */ }
  .before-after-comparison { /* Main comparison layout */ }
  .rag-context-preview { /* RAG results display */ }
}

.before-after-comparison {
  .upload-grid { /* Side-by-side upload areas */ }
  .analysis-controls { /* Settings and trigger button */ }
  .processing-steps { /* Progress indicator */ }
}

.comparison-viewer {
  .viewer-grid { /* Before/after image grid */ }
  .comparison-separator { /* Visual separator */ }
  .detected-areas { /* Results list */ }
}

.rag-context-preview {
  .context-cards { /* Individual case cards */ }
  .similarity-score { /* Confidence indicators */ }
  .applied-insights { /* Insight tags */ }
}
```

## 10. Accessibility Features

### ARIA Labels and Roles
```jsx
// Screen reader support
<button 
  aria-label={`Analyze ${beforeImages.length} before images and ${afterImages.length} after images`}
  aria-describedby="analysis-description"
>

// Progress indication
<div 
  role="progressbar" 
  aria-valuenow={currentStepIndex} 
  aria-valuemax={totalSteps}
  aria-label="Analysis progress"
>

// RAG context
<div 
  role="region" 
  aria-label="Similar historical cases"
  aria-expanded={showRagPreview}
>
```

### Keyboard Navigation
- Tab navigation through all interactive elements
- Enter/Space for button activation
- Arrow keys for image carousel navigation
- Escape to close modals/previews

### Visual Accessibility
- High contrast mode support
- Focus indicators for all interactive elements
- Color-blind friendly confidence indicators
- Text alternatives for all visual elements

---

This comprehensive component specification provides a solid foundation for implementing the enhanced Demo Scope UI with RAG integration and before/after comparison capabilities.