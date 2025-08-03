# API Specifications: Enhanced Demo Scope with RAG Integration

## Overview

This document defines the API endpoints and data models for the enhanced Demo Scope functionality with RAG integration and before/after photo comparison.

## Base Configuration

**Base URL**: `http://localhost:8001/api`
**Authentication**: Session-based (sessionId parameter)
**Content-Type**: `application/json` for JSON data, `multipart/form-data` for file uploads

## 1. RAG Service Endpoints

### 1.1 Query RAG Knowledge Base

**Endpoint**: `POST /rag/query`

**Description**: Search the RAG knowledge base for relevant historical cases

**Request Body**:
```json
{
  "query": "bathroom demolition tile removal",
  "index_name": "demo-scope",
  "top_k": 5,
  "similarity_threshold": 0.7,
  "filters": {
    "room_type": "bathroom",
    "material_type": "tile",
    "project_type": "residential"
  }
}
```

**Response**:
```json
{
  "success": true,
  "results": [
    {
      "id": "doc_123",
      "content": "Similar bathroom demolition case...",
      "metadata": {
        "room_type": "bathroom",
        "area_sqft": 45.5,
        "materials": ["ceramic tile", "drywall"],
        "project_date": "2024-01-15"
      },
      "similarity_score": 0.89
    }
  ],
  "query_time_ms": 45
}
```

### 1.2 Update RAG Knowledge Base

**Endpoint**: `POST /rag/update`

**Description**: Add new document to the RAG knowledge base

**Request Body**:
```json
{
  "document_type": "demo-scope",
  "content": "Detailed demolition case description...",
  "metadata": {
    "session_id": "session_123",
    "room_type": "kitchen",
    "materials": ["granite", "tile"],
    "total_area": 120.5,
    "confidence_score": 0.95
  }
}
```

**Response**:
```json
{
  "success": true,
  "document_id": "doc_456",
  "embedding_created": true,
  "indexed_at": "2024-01-20T10:30:00Z"
}
```

## 2. Before/After Comparison Endpoints

### 2.1 Compare Before/After Images

**Endpoint**: `POST /demo-analysis/compare-before-after`

**Description**: Analyze before and after images to identify demolished areas

**Request**: `multipart/form-data`
- `before_images`: File[] - Array of before images
- `after_images`: File[] - Array of after images  
- `room_context`: JSON string with room information
- `session_id`: String
- `enable_rag`: Boolean (default: true)

**Request Body** (JSON part):
```json
{
  "room_context": {
    "room_id": "room_123",
    "room_type": "bathroom",
    "room_name": "Master Bathroom",
    "dimensions": {
      "length": 10.5,
      "width": 8.0,
      "height": 9.0
    },
    "known_materials": ["ceramic tile", "drywall", "vinyl flooring"]
  },
  "session_id": "session_123",
  "enable_rag": true,
  "analysis_options": {
    "confidence_threshold": 0.7,
    "include_estimates": true,
    "uncertainty_handling": "mark_as_estimated"
  }
}
```

**Response**:
```json
{
  "success": true,
  "analysis_id": "analysis_789",
  "before_features": {
    "materials_detected": ["ceramic tile", "granite countertop"],
    "surfaces_identified": ["floor", "wall", "countertop"],
    "structural_elements": ["cabinet", "window"],
    "condition_assessment": "good"
  },
  "after_features": {
    "materials_detected": ["drywall", "subfloor"],
    "surfaces_identified": ["wall", "floor"],
    "structural_elements": ["window"],
    "demolition_evidence": ["removed_tiles", "exposed_subfloor"]
  },
  "demolished_areas": [
    {
      "type": "floor",
      "material": "ceramic tile",
      "area_sqft": 84.0,
      "confidence": 0.92,
      "description": "Complete tile floor removal",
      "estimated": false
    },
    {
      "type": "countertop", 
      "material": "granite",
      "area_sqft": 24.5,
      "confidence": 0.78,
      "description": "Granite countertop removal",
      "estimated": true
    }
  ],
  "rag_context": [
    {
      "similar_case": "Similar bathroom renovation...",
      "relevance_score": 0.89,
      "applied_insights": ["tile_removal_method", "area_calculation"]
    }
  ],
  "total_demolished_sqft": 108.5,
  "confidence_score": 0.85,
  "processing_time_ms": 2340
}
```

### 2.2 Extract Image Features

**Endpoint**: `POST /demo-analysis/extract-features`

**Description**: Extract detailed features from uploaded images for comparison

**Request**: `multipart/form-data`
- `images`: File[] - Images to analyze
- `analysis_type`: String - "before" or "after"
- `context`: JSON string with room context

**Response**:
```json
{
  "success": true,
  "features": {
    "materials": [
      {
        "type": "ceramic tile",
        "confidence": 0.94,
        "coverage_area": 85.2,
        "condition": "intact"
      }
    ],
    "surfaces": [
      {
        "type": "floor",
        "area_sqft": 84.0,
        "material": "ceramic tile",
        "condition": "good"
      }
    ],
    "architectural_elements": [
      {
        "type": "window",
        "count": 1,
        "condition": "present"
      }
    ],
    "color_analysis": {
      "dominant_colors": ["#f5f5dc", "#8b4513"],
      "material_indicators": ["tile_grout", "wood_cabinet"]
    }
  },
  "processing_time_ms": 1200
}
```

## 3. Enhanced Demo Analysis Endpoints

### 3.1 Analyze with RAG Enhancement

**Endpoint**: `POST /demo-analysis/analyze-enhanced`

**Description**: Perform standard demo analysis with RAG context enhancement

**Request**: `multipart/form-data`
- `images`: File[] - Room images to analyze
- `room_data`: JSON string with room information
- `session_id`: String
- `rag_enabled`: Boolean

**Response**:
```json
{
  "success": true,
  "analysis_id": "analysis_456",
  "demolished_areas": [
    {
      "type": "floor",
      "material": "tile",
      "area_sqft": 45.5,
      "confidence": 0.88,
      "rag_enhanced": true
    }
  ],
  "rag_insights": {
    "similar_cases_found": 3,
    "applied_corrections": ["material_identification", "area_estimation"],
    "confidence_boost": 0.15
  },
  "ai_raw_response": "Based on similar cases...",
  "model_version": "gpt-4o-vision",
  "created_at": "2024-01-20T10:30:00Z"
}
```

## 4. Workflow Management Endpoints

### 4.1 Execute Demo Analysis Workflow

**Endpoint**: `POST /workflow/demo-analysis`

**Description**: Execute complete demo analysis workflow with orchestrated steps

**Request Body**:
```json
{
  "workflow_type": "comparison", // "single", "comparison", "batch"
  "session_id": "session_123",
  "room_data": {
    "room_id": "room_456",
    "room_type": "kitchen",
    "measurements": {
      "floor_area_sqft": 150.0,
      "wall_area_sqft": 320.0,
      "ceiling_area_sqft": 150.0
    }
  },
  "images": {
    "before": ["before_1.jpg", "before_2.jpg"],
    "after": ["after_1.jpg", "after_2.jpg"]
  },
  "options": {
    "rag_enabled": true,
    "confidence_threshold": 0.7,
    "include_estimates": true
  }
}
```

**Response**:
```json
{
  "success": true,
  "workflow_id": "workflow_789",
  "status": "completed",
  "steps_executed": [
    "image_preprocessing",
    "feature_extraction", 
    "rag_context_retrieval",
    "comparison_analysis",
    "result_validation"
  ],
  "results": {
    "demolished_areas": [...],
    "confidence_scores": {...},
    "rag_context": [...]
  },
  "execution_time_ms": 3450
}
```

## 5. Feedback and Learning Endpoints

### 5.1 Submit User Feedback

**Endpoint**: `POST /demo-analysis/feedback`

**Description**: Submit user feedback for RAG learning and model improvement

**Request Body**:
```json
{
  "analysis_id": "analysis_123",
  "feedback_type": "correction", // "positive", "negative", "correction"
  "feedback_data": {
    "accuracy_rating": 4, // 1-5 scale
    "areas_feedback": [
      {
        "area_id": "area_1",
        "ai_detected": {
          "type": "floor",
          "area_sqft": 45.5,
          "material": "tile"
        },
        "user_correction": {
          "type": "floor",
          "area_sqft": 48.0,
          "material": "ceramic tile"
        },
        "correction_reason": "AI underestimated area slightly"
      }
    ],
    "overall_comments": "Good detection but area measurement needs improvement"
  },
  "user_id": "user_456"
}
```

**Response**:
```json
{
  "success": true,
  "feedback_id": "feedback_789",
  "rag_updated": true,
  "learning_applied": [
    "area_calculation_refinement",
    "material_classification_improvement"
  ],
  "thank_you_message": "Thank you for your feedback! This helps improve our AI accuracy."
}
```

## 6. Data Models

### 6.1 Room Context Model

```typescript
interface RoomContext {
  room_id: string;
  room_type: 'kitchen' | 'bathroom' | 'bedroom' | 'living_room' | 'other';
  room_name: string;
  dimensions: {
    length: number;
    width: number; 
    height: number;
  };
  measurements?: {
    floor_area_sqft: number;
    wall_area_sqft: number;
    ceiling_area_sqft: number;
    perimeter_lf: number;
  };
  known_materials?: string[];
  architectural_features?: string[];
}
```

### 6.2 Analysis Result Model

```typescript
interface AnalysisResult {
  analysis_id: string;
  session_id: string;
  room_id: string;
  analysis_type: 'single' | 'comparison' | 'enhanced';
  demolished_areas: DemolishedArea[];
  confidence_score: number;
  rag_enhanced: boolean;
  rag_context?: RAGContext[];
  processing_metadata: {
    model_version: string;
    processing_time_ms: number;
    created_at: string;
  };
}

interface DemolishedArea {
  id: string;
  type: string;
  material: string;
  area_sqft: number;
  confidence: number;
  description: string;
  estimated: boolean;
  detection_method: 'ai_vision' | 'comparison' | 'rag_enhanced';
}
```

### 6.3 RAG Context Model

```typescript
interface RAGContext {
  document_id: string;
  content: string;
  metadata: {
    room_type?: string;
    material_type?: string;
    area_sqft?: number;
    project_date?: string;
    [key: string]: any;
  };
  similarity_score: number;
  applied_insights: string[];
}
```

## 7. Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Before images are required for comparison analysis",
    "details": {
      "field": "before_images",
      "expected": "array of files",
      "received": "empty"
    }
  },
  "timestamp": "2024-01-20T10:30:00Z"
}
```

### Error Codes

- `INVALID_INPUT`: Invalid request parameters or data
- `INSUFFICIENT_IMAGES`: Not enough images for analysis
- `AI_SERVICE_ERROR`: AI model processing failed
- `RAG_SERVICE_ERROR`: RAG knowledge base query failed
- `PROCESSING_TIMEOUT`: Analysis took too long to complete
- `INSUFFICIENT_CONFIDENCE`: Analysis confidence below threshold
- `STORAGE_ERROR`: Failed to save analysis results

## 8. Rate Limiting

- **Standard Endpoints**: 60 requests per minute per session
- **Analysis Endpoints**: 10 requests per minute per session
- **RAG Query Endpoints**: 30 requests per minute per session
- **File Upload Endpoints**: 5 requests per minute per session

## 9. File Upload Specifications

### Supported Image Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)

### File Size Limits
- **Single Image**: 10MB maximum
- **Total Upload**: 50MB maximum per request
- **Image Dimensions**: 4096x4096 pixels maximum

### Quality Requirements
- **Minimum Resolution**: 800x600 pixels
- **Recommended Resolution**: 1920x1080 pixels or higher
- **Image Quality**: JPEG quality 85+ recommended

---

This API specification provides a comprehensive foundation for implementing the enhanced Demo Scope functionality with RAG integration and before/after comparison capabilities.