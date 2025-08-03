import { useState, useCallback } from 'react';
import { API_CONFIG, buildApiUrl } from '../../../config/api';

const API_BASE_URL = API_CONFIG.BASE_URL;

export const useBeforeAfterAnalysis = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);


  // Main analysis function
  const analyzeBeforeAfter = useCallback(async (analysisData) => {
    setIsLoading(true);
    setError(null);

    try {
      const {
        beforeImages,
        afterImages,
        roomId,
        roomType,
        roomMeasurements,
        projectId,
        sessionId,
        analysisType = 'before_after_comparison',
        enableRag = true,
        confidenceThreshold = 0.7
      } = analysisData;

      // Validate input
      if (!beforeImages || beforeImages.length === 0) {
        throw new Error('Before images are required');
      }
      if (!afterImages || afterImages.length === 0) {
        throw new Error('After images are required');
      }
      if (!sessionId) {
        throw new Error('Session ID is required');
      }


      // Prepare room context
      const roomContext = {
        room_id: roomId,
        room_type: roomType || 'unknown',
        dimensions: roomMeasurements || {},
        known_materials: [],
        project_id: projectId
      };

      // Prepare form data
      const formData = new FormData();
      
      // Add before images - use original File objects if available
      beforeImages.forEach((imageFile, index) => {
        if (imageFile instanceof File) {
          formData.append('before_images', imageFile, imageFile.name);
        } else if (imageFile.file instanceof File) {
          formData.append('before_images', imageFile.file, imageFile.file.name);
        } else {
          console.error('Invalid before image format:', imageFile);
        }
      });

      // Add after images - use original File objects if available
      afterImages.forEach((imageFile, index) => {
        if (imageFile instanceof File) {
          formData.append('after_images', imageFile, imageFile.name);
        } else if (imageFile.file instanceof File) {
          formData.append('after_images', imageFile.file, imageFile.file.name);
        } else {
          console.error('Invalid after image format:', imageFile);
        }
      });

      // Add metadata
      formData.append('room_context', JSON.stringify(roomContext));
      formData.append('session_id', sessionId);
      formData.append('enable_rag', enableRag);
      formData.append('confidence_threshold', confidenceThreshold);

      console.log('🚀 Sending before/after comparison request:', {
        beforeImagesCount: beforeImages.length,
        afterImagesCount: afterImages.length,
        roomContext,
        sessionId,
        enableRag,
        confidenceThreshold
      });

      // Send request to RAG-enhanced comparison endpoint
      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.RAG_DEMO_ANALYSIS.COMPARE_BEFORE_AFTER), {
        method: 'POST',
        body: formData,
        headers: {
          // Don't set Content-Type - let browser set it with boundary for FormData
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      console.log('✅ Before/after comparison successful:', result);

      // Return enhanced result with additional metadata
      return {
        ...result,
        analysis_timestamp: new Date().toISOString(),
        analysis_type: analysisType,
        input_data: {
          before_images_count: beforeImages.length,
          after_images_count: afterImages.length,
          room_context: roomContext
        }
      };

    } catch (err) {
      console.error('❌ Before/after analysis error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Multi-stage analysis using the new 4-stage workflow
  const analyzeMultiStage = useCallback(async (images, roomData, sessionId, options = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const {
        enableRag = true,
        confidenceThreshold = 0.7,
        analysisType = 'demo_calculation'
      } = options;

      // Prepare form data - use original File objects directly
      const formData = new FormData();

      images.forEach((imageFile, index) => {
        if (imageFile instanceof File) {
          formData.append('images', imageFile, imageFile.name);
        } else if (imageFile.file instanceof File) {
          formData.append('images', imageFile.file, imageFile.file.name);
        } else if (imageFile.processed instanceof File) {
          formData.append('images', imageFile.processed, imageFile.processed.name);
        } else {
          console.error('Invalid image format for multi-stage analysis:', imageFile);
        }
      });

      formData.append('room_context', JSON.stringify(roomData));
      formData.append('session_id', sessionId);
      formData.append('enable_rag', enableRag);
      formData.append('confidence_threshold', confidenceThreshold);
      formData.append('analysis_type', analysisType);

      console.log('🚀 Sending multi-stage analysis request:', {
        imagesCount: images.length,
        roomData,
        sessionId,
        enableRag,
        confidenceThreshold,
        analysisType
      });

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.RAG_DEMO_ANALYSIS.ANALYZE_MULTI_STAGE), {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Multi-stage analysis failed');
      }

      console.log('✅ Multi-stage analysis successful:', result);

      return {
        ...result,
        analysis_timestamp: new Date().toISOString(),
        analysis_type: 'multi_stage',
        input_data: {
          images_count: images.length,
          room_context: roomData
        }
      };

    } catch (err) {
      console.error('❌ Multi-stage analysis error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Enhanced single image analysis with RAG
  const analyzeEnhanced = useCallback(async (images, roomData, sessionId, options = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const {
        enableRag = true,
        analysisType = 'single'
      } = options;

      // Prepare form data - use original File objects directly
      const formData = new FormData();

      images.forEach((imageFile, index) => {
        if (imageFile instanceof File) {
          formData.append('images', imageFile, imageFile.name);
        } else if (imageFile.file instanceof File) {
          formData.append('images', imageFile.file, imageFile.file.name);
        } else if (imageFile.processed instanceof File) {
          formData.append('images', imageFile.processed, imageFile.processed.name);
        } else {
          console.error('Invalid image format for enhanced analysis:', imageFile);
        }
      });

      formData.append('room_data', JSON.stringify(roomData));
      formData.append('session_id', sessionId);
      formData.append('rag_enabled', enableRag);
      formData.append('analysis_type', analysisType);

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.RAG_DEMO_ANALYSIS.ANALYZE_ENHANCED), {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Enhanced analysis failed');
      }

      return result;

    } catch (err) {
      console.error('❌ Enhanced analysis error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Feature extraction
  const extractFeatures = useCallback(async (images, analysisType, context) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();

      images.forEach((imageFile, index) => {
        if (imageFile instanceof File) {
          formData.append('images', imageFile, imageFile.name);
        } else if (imageFile.file instanceof File) {
          formData.append('images', imageFile.file, imageFile.file.name);
        } else if (imageFile.processed instanceof File) {
          formData.append('images', imageFile.processed, imageFile.processed.name);
        } else {
          console.error('Invalid image format for feature extraction:', imageFile);
        }
      });

      formData.append('analysis_type', analysisType);
      formData.append('context', JSON.stringify(context));

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.RAG_DEMO_ANALYSIS.EXTRACT_FEATURES), {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Feature extraction failed');
      }

      return result.features;

    } catch (err) {
      console.error('❌ Feature extraction error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Query RAG knowledge base
  const queryRAG = useCallback(async (query, documentType = 'demo-scope', options = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const {
        topK = 5,
        similarityThreshold = 0.7,
        filters = {}
      } = options;

      const formData = new FormData();
      formData.append('query', query);
      formData.append('document_type', documentType);
      formData.append('top_k', topK);
      formData.append('similarity_threshold', similarityThreshold);
      formData.append('filters', JSON.stringify(filters));

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.RAG_DEMO_ANALYSIS.RAG_QUERY), {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'RAG query failed');
      }

      return result.results;

    } catch (err) {
      console.error('❌ RAG query error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Submit feedback
  const submitFeedback = useCallback(async (analysisId, feedbackData) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('analysis_id', analysisId);
      formData.append('feedback_type', feedbackData.type || 'correction');
      formData.append('feedback_data', JSON.stringify(feedbackData));

      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.RAG_DEMO_ANALYSIS.FEEDBACK), {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Feedback submission failed');
      }

      return result;

    } catch (err) {
      console.error('❌ Feedback submission error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save comparison results to backend
  const saveComparisonResults = useCallback(async (comparisonData) => {
    try {
      // This would typically save to the demo_comparison_analysis table
      // For now, we'll use a simpler approach or the existing demo save endpoint
      
      console.log('💾 Saving comparison results:', comparisonData);
      
      // Implementation would depend on existing save patterns in the app
      // This is a placeholder that matches the existing pattern
      
      return { success: true, saved_id: comparisonData.analysis_id };
    } catch (err) {
      console.error('❌ Save comparison results error:', err);
      throw err;
    }
  }, []);

  return {
    analyzeBeforeAfter,
    analyzeEnhanced,
    analyzeMultiStage,
    extractFeatures,
    queryRAG,
    submitFeedback,
    saveComparisonResults,
    isLoading,
    error,
    clearError: () => setError(null)
  };
};