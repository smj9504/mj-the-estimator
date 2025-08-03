import { useState, useCallback } from 'react';

export const useImageAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const analyzeImages = useCallback(async ({ images, roomId, roomType, projectId, sessionId, roomMaterials }) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // Prepare images for upload
      const formData = new FormData();
      
      images.forEach((img, index) => {
        formData.append(`images`, img.processed, `image_${index + 1}.jpg`);
      });

      formData.append('room_id', roomId);
      formData.append('room_type', roomType);
      formData.append('project_id', projectId);
      formData.append('session_id', sessionId);
      
      // Add room materials if provided
      if (roomMaterials) {
        formData.append('room_materials', JSON.stringify(roomMaterials));
      }

      // Call AI analysis API
      const response = await fetch('http://localhost:8001/api/demo-analysis/analyze', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      // Transform the response to match our expected format
      const analysisResults = {
        analysis_id: result.analysis_id,
        demolished_areas: result.demolished_areas.map((area, index) => ({
          id: `area_${index + 1}`,
          type: area.surface_type,
          material: area.material || area.material_removed,
          description: area.description,
          ai_estimated_area: area.estimated_area_sqft,
          confidence: area.confidence || 0.85,
          demolition_completeness: area.demolition_completeness,
          completion_percentage: area.completion_percentage,
          total_possible_area_sqft: area.total_possible_area_sqft,
          partial_description: area.partial_description
        })),
        reference_objects: result.reference_objects || [],
        model_version: result.model_version || 'v1.0',
        prompt_version: result.prompt_version || 'demo_v1'
      };

      return analysisResults;
    } catch (error) {
      console.error('Image analysis error:', error);
      setError(error.message);
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const saveAnalysisResults = useCallback(async (finalData) => {
    try {
      const response = await fetch('http://localhost:8001/api/demo-analysis/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          analysis_id: finalData.analysis_id,
          project_id: finalData.project_id,
          modifications: finalData.user_modifications,
          final_results: finalData.final_data,
          quality_score: calculateQualityScore(finalData),
          is_verified: finalData.is_verified
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save analysis results');
      }

      return await response.json();
    } catch (error) {
      console.error('Save error:', error);
      throw error;
    }
  }, []);

  const calculateQualityScore = (data) => {
    let score = 0.8; // Base score

    // Adjust based on modifications
    const modificationCount = Object.keys(data.user_modifications || {}).length;
    const areaCount = data.final_data.areas.length;
    
    if (areaCount > 0) {
      const modificationRatio = modificationCount / areaCount;
      score *= (1 - modificationRatio * 0.3); // Reduce score based on modifications
    }

    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  };

  return {
    analyzeImages,
    saveAnalysisResults,
    isAnalyzing,
    error
  };
};