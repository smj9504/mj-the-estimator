-- DATABASE MIGRATION SCHEMA: Enhanced Demo Scope with RAG Integration
-- Version: 2.0.0
-- Date: 2025-01-20
-- Description: Adds RAG knowledge base, before/after comparison, and enhanced analytics

-- =============================================================================
-- RAG KNOWLEDGE BASE TABLES
-- =============================================================================

-- Core RAG documents storage
CREATE TABLE IF NOT EXISTS rag_documents (
    id TEXT PRIMARY KEY,
    document_type TEXT NOT NULL CHECK (document_type IN ('demo-scope', 'material', 'work-scope', 'general')),
    title TEXT,
    content TEXT NOT NULL,
    content_summary TEXT,
    metadata JSON,
    source_session_id TEXT,
    source_analysis_id TEXT,
    embedding_vector BLOB, -- Store embeddings as binary for performance
    embedding_model TEXT DEFAULT 'sentence-transformers/all-MiniLM-L6-v2',
    vector_dimension INTEGER DEFAULT 384,
    quality_score REAL DEFAULT 0.8,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deprecated'))
);

-- RAG document relationships and clustering
CREATE TABLE IF NOT EXISTS rag_document_clusters (
    id TEXT PRIMARY KEY,
    cluster_name TEXT NOT NULL,
    cluster_type TEXT NOT NULL, -- 'room_type', 'material_type', 'project_size', etc.
    document_ids JSON NOT NULL, -- Array of document IDs
    centroid_vector BLOB,
    cluster_quality REAL,
    member_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RAG query performance tracking
CREATE TABLE IF NOT EXISTS rag_query_logs (
    id TEXT PRIMARY KEY,
    query_text TEXT NOT NULL,
    query_embedding BLOB,
    index_name TEXT NOT NULL,
    top_k INTEGER DEFAULT 5,
    similarity_threshold REAL DEFAULT 0.7,
    filters JSON,
    results_count INTEGER,
    top_similarity_score REAL,
    avg_similarity_score REAL,
    query_time_ms INTEGER,
    session_id TEXT,
    user_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- ENHANCED DEMO ANALYSIS TABLES
-- =============================================================================

-- Before/After comparison analysis results
CREATE TABLE IF NOT EXISTS demo_comparison_analysis (
    analysis_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    project_id TEXT,
    room_id TEXT NOT NULL,
    comparison_type TEXT DEFAULT 'before_after' CHECK (comparison_type IN ('before_after', 'progressive', 'multi_stage')),
    
    -- Image references
    before_images JSON NOT NULL, -- Array of image metadata
    after_images JSON NOT NULL,  -- Array of image metadata
    
    -- Feature extraction results
    before_features JSON, -- Extracted features from before images
    after_features JSON,  -- Extracted features from after images
    feature_differences JSON, -- Computed differences
    
    -- AI analysis results
    demolished_areas JSON NOT NULL, -- Array of detected demolished areas
    comparison_confidence REAL DEFAULT 0.8,
    total_demolished_sqft REAL DEFAULT 0.0,
    
    -- RAG integration
    rag_enabled BOOLEAN DEFAULT TRUE,
    rag_context JSON, -- Retrieved RAG context documents
    rag_insights JSON, -- Applied insights from RAG
    rag_confidence_boost REAL DEFAULT 0.0,
    
    -- AI model information
    ai_model_version TEXT,
    ai_prompt_version TEXT,
    processing_time_ms INTEGER,
    
    -- User interaction
    user_reviewed BOOLEAN DEFAULT FALSE,
    user_modifications JSON,
    applied_to_scope BOOLEAN DEFAULT FALSE,
    applied_at TIMESTAMP,
    
    -- Quality metrics
    accuracy_rating INTEGER CHECK (accuracy_rating BETWEEN 1 AND 5),
    confidence_score REAL DEFAULT 0.8,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (session_id) REFERENCES pre_estimate_sessions(session_id)
);

-- Enhanced single image analysis (extending existing functionality)
CREATE TABLE IF NOT EXISTS demo_ai_analysis_enhanced (
    analysis_id TEXT PRIMARY KEY,
    original_analysis_id TEXT, -- Reference to original demo_ai_analysis
    session_id TEXT NOT NULL,
    project_id TEXT,
    room_id TEXT NOT NULL,
    
    -- Enhanced analysis data
    analysis_type TEXT DEFAULT 'single' CHECK (analysis_type IN ('single', 'comparison', 'batch')),
    images JSON NOT NULL,
    
    -- RAG integration
    rag_enabled BOOLEAN DEFAULT TRUE,
    rag_query TEXT,
    rag_context JSON,
    rag_applied_insights JSON,
    rag_confidence_improvement REAL DEFAULT 0.0,
    
    -- Enhanced AI results
    ai_raw_response TEXT,
    ai_structured_results JSON,
    confidence_breakdown JSON, -- Per-area confidence scores
    uncertainty_markers JSON, -- Areas marked as estimated
    
    -- Feature extraction
    detected_materials JSON,
    detected_surfaces JSON,
    architectural_elements JSON,
    damage_assessment JSON,
    
    -- Quality assurance
    validation_checks JSON,
    quality_score REAL DEFAULT 0.8,
    processing_metadata JSON,
    
    -- User feedback
    user_feedback JSON,
    accuracy_confirmed BOOLEAN,
    corrections_applied JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES pre_estimate_sessions(session_id),
    FOREIGN KEY (original_analysis_id) REFERENCES demo_ai_analysis(analysis_id)
);

-- =============================================================================
-- FEEDBACK AND LEARNING TABLES
-- =============================================================================

-- User feedback for continuous learning
CREATE TABLE IF NOT EXISTS rag_feedback (
    feedback_id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL,
    analysis_type TEXT NOT NULL CHECK (analysis_type IN ('single', 'comparison', 'enhanced')),
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'correction', 'suggestion')),
    
    -- Overall feedback
    accuracy_rating INTEGER CHECK (accuracy_rating BETWEEN 1 AND 5),
    rag_helpfulness_rating INTEGER CHECK (rag_helpfulness_rating BETWEEN 1 AND 5),
    overall_satisfaction INTEGER CHECK (overall_satisfaction BETWEEN 1 AND 5),
    
    -- Specific feedback data
    area_corrections JSON, -- Corrections for specific detected areas
    material_corrections JSON, -- Material identification corrections
    measurement_corrections JSON, -- Area/measurement corrections
    
    -- RAG-specific feedback
    rag_context_relevance INTEGER CHECK (rag_context_relevance BETWEEN 1 AND 5),
    rag_context_accuracy INTEGER CHECK (rag_context_accuracy BETWEEN 1 AND 5),
    suggested_similar_cases JSON,
    
    -- Text feedback
    comments TEXT,
    improvement_suggestions TEXT,
    
    -- Learning application
    feedback_processed BOOLEAN DEFAULT FALSE,
    applied_to_model BOOLEAN DEFAULT FALSE,
    applied_to_rag BOOLEAN DEFAULT FALSE,
    processing_notes TEXT,
    
    -- User information
    user_id TEXT,
    user_expertise_level TEXT CHECK (user_expertise_level IN ('beginner', 'intermediate', 'expert', 'professional')),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Model performance tracking
CREATE TABLE IF NOT EXISTS ai_model_performance (
    id TEXT PRIMARY KEY,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    analysis_type TEXT NOT NULL,
    
    -- Performance metrics
    total_analyses INTEGER DEFAULT 0,
    successful_analyses INTEGER DEFAULT 0,
    failed_analyses INTEGER DEFAULT 0,
    avg_confidence_score REAL,
    avg_processing_time_ms INTEGER,
    avg_accuracy_rating REAL,
    
    -- RAG performance
    rag_queries_total INTEGER DEFAULT 0,
    rag_queries_successful INTEGER DEFAULT 0,
    avg_rag_relevance REAL,
    avg_confidence_improvement REAL,
    
    -- Time period
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- WORKFLOW AND PROCESSING TABLES
-- =============================================================================

-- Workflow execution tracking
CREATE TABLE IF NOT EXISTS demo_workflow_executions (
    workflow_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    workflow_type TEXT NOT NULL CHECK (workflow_type IN ('single_analysis', 'comparison_analysis', 'batch_analysis')),
    
    -- Workflow steps
    steps_planned JSON NOT NULL,
    steps_executed JSON,
    current_step TEXT,
    workflow_status TEXT DEFAULT 'pending' CHECK (workflow_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    
    -- Input data
    input_data JSON,
    configuration JSON,
    
    -- Results
    results JSON,
    error_details JSON,
    
    -- Performance
    execution_time_ms INTEGER,
    resource_usage JSON,
    
    -- Relationships
    analysis_ids JSON, -- Array of generated analysis IDs
    
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES pre_estimate_sessions(session_id)
);

-- Image processing cache
CREATE TABLE IF NOT EXISTS image_processing_cache (
    cache_id TEXT PRIMARY KEY,
    image_hash TEXT UNIQUE NOT NULL, -- SHA-256 hash of image content
    image_size INTEGER,
    image_format TEXT,
    
    -- Processing results
    features_extracted JSON,
    materials_detected JSON,
    surfaces_identified JSON,
    processing_metadata JSON,
    
    -- Cache management
    access_count INTEGER DEFAULT 1,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cache_hit_rate REAL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP -- For cache cleanup
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- RAG documents indexes
CREATE INDEX IF NOT EXISTS idx_rag_documents_type ON rag_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_rag_documents_source ON rag_documents(source_session_id, source_analysis_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_quality ON rag_documents(quality_score);
CREATE INDEX IF NOT EXISTS idx_rag_documents_usage ON rag_documents(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_rag_documents_created ON rag_documents(created_at);
CREATE INDEX IF NOT EXISTS idx_rag_documents_status ON rag_documents(status);

-- RAG query logs indexes
CREATE INDEX IF NOT EXISTS idx_rag_query_logs_session ON rag_query_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_rag_query_logs_time ON rag_query_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_rag_query_logs_performance ON rag_query_logs(query_time_ms, results_count);

-- Demo analysis indexes
CREATE INDEX IF NOT EXISTS idx_demo_comparison_session ON demo_comparison_analysis(session_id);
CREATE INDEX IF NOT EXISTS idx_demo_comparison_room ON demo_comparison_analysis(room_id);
CREATE INDEX IF NOT EXISTS idx_demo_comparison_confidence ON demo_comparison_analysis(comparison_confidence);
CREATE INDEX IF NOT EXISTS idx_demo_comparison_created ON demo_comparison_analysis(created_at);
CREATE INDEX IF NOT EXISTS idx_demo_comparison_rag ON demo_comparison_analysis(rag_enabled, rag_confidence_boost);

CREATE INDEX IF NOT EXISTS idx_demo_enhanced_session ON demo_ai_analysis_enhanced(session_id);
CREATE INDEX IF NOT EXISTS idx_demo_enhanced_original ON demo_ai_analysis_enhanced(original_analysis_id);
CREATE INDEX IF NOT EXISTS idx_demo_enhanced_type ON demo_ai_analysis_enhanced(analysis_type);
CREATE INDEX IF NOT EXISTS idx_demo_enhanced_quality ON demo_ai_analysis_enhanced(quality_score);

-- Feedback indexes
CREATE INDEX IF NOT EXISTS idx_rag_feedback_analysis ON rag_feedback(analysis_id, analysis_type);
CREATE INDEX IF NOT EXISTS idx_rag_feedback_processed ON rag_feedback(feedback_processed, applied_to_rag);
CREATE INDEX IF NOT EXISTS idx_rag_feedback_ratings ON rag_feedback(accuracy_rating, rag_helpfulness_rating);
CREATE INDEX IF NOT EXISTS idx_rag_feedback_created ON rag_feedback(created_at);

-- Workflow indexes
CREATE INDEX IF NOT EXISTS idx_workflow_session ON demo_workflow_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_workflow_status ON demo_workflow_executions(workflow_status);
CREATE INDEX IF NOT EXISTS idx_workflow_type ON demo_workflow_executions(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflow_created ON demo_workflow_executions(created_at);

-- Cache indexes
CREATE INDEX IF NOT EXISTS idx_image_cache_hash ON image_processing_cache(image_hash);
CREATE INDEX IF NOT EXISTS idx_image_cache_access ON image_processing_cache(last_accessed);
CREATE INDEX IF NOT EXISTS idx_image_cache_expires ON image_processing_cache(expires_at);

-- =============================================================================
-- VIEWS FOR ANALYTICS
-- =============================================================================

-- RAG effectiveness view
CREATE VIEW IF NOT EXISTS rag_effectiveness_stats AS
SELECT 
    document_type,
    COUNT(*) as total_documents,
    AVG(quality_score) as avg_quality_score,
    AVG(usage_count) as avg_usage_count,
    COUNT(CASE WHEN usage_count > 0 THEN 1 END) as documents_used,
    COUNT(CASE WHEN last_used_at >= datetime('now', '-30 days') THEN 1 END) as recently_used
FROM rag_documents 
WHERE status = 'active'
GROUP BY document_type;

-- Analysis performance view
CREATE VIEW IF NOT EXISTS analysis_performance_stats AS
SELECT 
    DATE(created_at) as analysis_date,
    analysis_type,
    COUNT(*) as total_analyses,
    AVG(confidence_score) as avg_confidence,
    AVG(processing_time_ms) as avg_processing_time,
    COUNT(CASE WHEN rag_enabled = TRUE THEN 1 END) as rag_enabled_count,
    AVG(CASE WHEN rag_enabled = TRUE THEN rag_confidence_boost END) as avg_rag_boost
FROM demo_ai_analysis_enhanced
GROUP BY DATE(created_at), analysis_type;

-- User feedback summary view
CREATE VIEW IF NOT EXISTS user_feedback_summary AS
SELECT 
    DATE(created_at) as feedback_date,
    analysis_type,
    COUNT(*) as total_feedback,
    AVG(accuracy_rating) as avg_accuracy_rating,
    AVG(rag_helpfulness_rating) as avg_rag_helpfulness,
    AVG(overall_satisfaction) as avg_satisfaction,
    COUNT(CASE WHEN feedback_type = 'positive' THEN 1 END) as positive_feedback,
    COUNT(CASE WHEN feedback_type = 'negative' THEN 1 END) as negative_feedback,
    COUNT(CASE WHEN feedback_type = 'correction' THEN 1 END) as corrections
FROM rag_feedback
GROUP BY DATE(created_at), analysis_type;

-- =============================================================================
-- TRIGGERS FOR MAINTENANCE
-- =============================================================================

-- Update rag_documents usage count and last_used_at
CREATE TRIGGER IF NOT EXISTS update_rag_document_usage
AFTER INSERT ON rag_query_logs
BEGIN
    UPDATE rag_documents 
    SET 
        usage_count = usage_count + 1,
        last_used_at = NEW.created_at
    WHERE id IN (
        SELECT json_extract(value, '$.document_id')
        FROM json_each(
            COALESCE(
                (SELECT results FROM rag_query_logs WHERE id = NEW.id LIMIT 1),
                '[]'
            )
        )
    );
END;

-- Update timestamps on record changes
CREATE TRIGGER IF NOT EXISTS update_rag_documents_timestamp
AFTER UPDATE ON rag_documents
BEGIN
    UPDATE rag_documents 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_demo_comparison_timestamp
AFTER UPDATE ON demo_comparison_analysis
BEGIN
    UPDATE demo_comparison_analysis 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE analysis_id = NEW.analysis_id;
END;

-- =============================================================================
-- DATA MIGRATION FROM EXISTING TABLES
-- =============================================================================

-- Migrate existing demo_ai_analysis data to enhanced table
INSERT OR IGNORE INTO demo_ai_analysis_enhanced (
    analysis_id,
    original_analysis_id,
    session_id,
    project_id,
    room_id,
    analysis_type,
    images,
    rag_enabled,
    ai_raw_response,
    ai_structured_results,
    quality_score,
    user_feedback,
    created_at,
    updated_at
)
SELECT 
    analysis_id || '_enhanced' as analysis_id,
    analysis_id as original_analysis_id,
    session_id,
    project_id,
    room_id,
    'single' as analysis_type,
    images,
    FALSE as rag_enabled, -- Existing analyses don't have RAG
    ai_raw_response,
    ai_parsed_results as ai_structured_results,
    quality_score,
    user_feedback,
    created_at,
    updated_at
FROM demo_ai_analysis
WHERE analysis_id NOT IN (
    SELECT original_analysis_id FROM demo_ai_analysis_enhanced 
    WHERE original_analysis_id IS NOT NULL
);

-- =============================================================================
-- INITIAL DATA SEEDING
-- =============================================================================

-- Insert default RAG document types and clusters
INSERT OR IGNORE INTO rag_document_clusters (id, cluster_name, cluster_type, document_ids, member_count)
VALUES 
    ('cluster_bathroom_demo', 'Bathroom Demolition', 'room_type', '[]', 0),
    ('cluster_kitchen_demo', 'Kitchen Demolition', 'room_type', '[]', 0),
    ('cluster_tile_removal', 'Tile Removal', 'material_type', '[]', 0),
    ('cluster_cabinet_removal', 'Cabinet Removal', 'material_type', '[]', 0),
    ('cluster_flooring_demo', 'Flooring Demolition', 'material_type', '[]', 0);

-- =============================================================================
-- CLEANUP AND MAINTENANCE PROCEDURES
-- =============================================================================

-- Note: These would typically be implemented as stored procedures or scheduled jobs
-- For SQLite, these are documented as maintenance tasks:

-- 1. Clean up expired image cache entries
-- DELETE FROM image_processing_cache WHERE expires_at < CURRENT_TIMESTAMP;

-- 2. Archive old RAG query logs (keep last 90 days)
-- DELETE FROM rag_query_logs WHERE created_at < datetime('now', '-90 days');

-- 3. Update RAG document quality scores based on feedback
-- UPDATE rag_documents SET quality_score = (
--     SELECT AVG(rag_helpfulness_rating) / 5.0 
--     FROM rag_feedback 
--     WHERE /* feedback relates to documents containing this doc */
-- ) WHERE /* conditions */;

-- 4. Rebuild embedding clusters monthly
-- This would be handled by the RAG service, not SQL

-- =============================================================================
-- SCHEMA VERSION TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_versions (
    version TEXT PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO schema_versions (version, description) 
VALUES ('2.0.0', 'Enhanced Demo Scope with RAG Integration and Before/After Comparison');

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify all tables were created successfully
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%rag%' OR name LIKE '%demo%enhanced%';

-- Verify indexes were created
SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%';

-- Verify views were created  
SELECT name FROM sqlite_master WHERE type='view';

-- Check schema version
SELECT * FROM schema_versions ORDER BY applied_at DESC LIMIT 1;