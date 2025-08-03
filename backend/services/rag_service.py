import os
import json
import time
import uuid
from typing import Dict, List, Any, Optional, Tuple, Union
from datetime import datetime
import asyncio
from concurrent.futures import ThreadPoolExecutor

try:
    import pinecone
    from sentence_transformers import SentenceTransformer
    import faiss
    import numpy as np
    from sklearn.metrics.pairwise import cosine_similarity
    DEPENDENCIES_AVAILABLE = True
    # Type alias for numpy array when available
    NumpyArray = np.ndarray
except ImportError as e:
    print(f"RAG dependencies not available: {e}")
    DEPENDENCIES_AVAILABLE = False
    # Fallback type when numpy is not available
    NumpyArray = Any
    np = None

from utils.logger import logger
from models.database import execute_query, execute_insert, execute_update

class RAGService:
    """
    Retrieval-Augmented Generation service for enhancing AI analysis with historical context.
    Supports both Pinecone (production) and FAISS (development) vector stores.
    """
    
    def __init__(self):
        self.embedding_model = None
        self.pinecone_index = None
        self.faiss_index = None
        self.vector_dimension = 384
        self.use_pinecone = False
        self.use_faiss = False
        self.executor = ThreadPoolExecutor(max_workers=3)
        
        # Document type to index mapping
        self.indices = {
            'demo-scope': 'demo-scope-index',
            'material': 'material-index', 
            'work-scope': 'work-scope-index',
            'general': 'general-index'
        }
        
        if DEPENDENCIES_AVAILABLE:
            self._initialize_services()
        else:
            logger.warning("RAG service running in mock mode - dependencies not available")
    
    def _initialize_services(self):
        """Initialize embedding model and vector store services"""
        try:
            # Initialize embedding model
            self.embedding_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
            logger.info("Sentence transformer model loaded successfully")
            
            # Try to initialize Pinecone (production)
            pinecone_api_key = os.getenv('PINECONE_API_KEY')
            if pinecone_api_key:
                self._initialize_pinecone()
            else:
                logger.info("Pinecone API key not found, using FAISS for development")
                self._initialize_faiss()
                
        except Exception as e:
            logger.error(f"Failed to initialize RAG services: {e}")
    
    def _initialize_pinecone(self):
        """Initialize Pinecone vector database"""
        try:
            pinecone_api_key = os.getenv('PINECONE_API_KEY')
            pinecone_env = os.getenv('PINECONE_ENVIRONMENT', 'us-west1-gcp')
            
            pinecone.init(api_key=pinecone_api_key, environment=pinecone_env)
            
            # Check if index exists, create if not
            index_name = os.getenv('PINECONE_INDEX_NAME', 'mj-estimator-rag')
            if index_name not in pinecone.list_indexes():
                pinecone.create_index(
                    name=index_name,
                    dimension=self.vector_dimension,
                    metric='cosine'
                )
                logger.info(f"Created Pinecone index: {index_name}")
            
            self.pinecone_index = pinecone.Index(index_name)
            self.use_pinecone = True
            logger.info("Pinecone initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Pinecone: {e}")
            self._initialize_faiss()
    
    def _initialize_faiss(self):
        """Initialize FAISS vector index for development"""
        try:
            # Create FAISS index for cosine similarity
            self.faiss_index = faiss.IndexFlatIP(self.vector_dimension)
            self.faiss_documents = []  # Store document metadata
            self.use_faiss = True
            logger.info("FAISS initialized successfully")
            
            # Load existing documents from database
            asyncio.create_task(self._load_existing_documents())
            
        except Exception as e:
            logger.error(f"Failed to initialize FAISS: {e}")
    
    async def _load_existing_documents(self):
        """Load existing documents from database into FAISS index"""
        try:
            documents = execute_query(
                "SELECT id, content, metadata, embedding_vector FROM rag_documents WHERE status = 'active'"
            )
            
            vectors = []
            for doc in documents:
                if doc['embedding_vector']:
                    # Convert BLOB back to numpy array
                    vector = np.frombuffer(doc['embedding_vector'], dtype=np.float32)
                    vectors.append(vector)
                    self.faiss_documents.append({
                        'id': doc['id'],
                        'content': doc['content'],
                        'metadata': json.loads(doc['metadata']) if doc['metadata'] else {}
                    })
            
            if vectors:
                vectors_array = np.array(vectors)
                # Normalize for cosine similarity
                faiss.normalize_L2(vectors_array)
                self.faiss_index.add(vectors_array)
                logger.info(f"Loaded {len(vectors)} documents into FAISS index")
            
        except Exception as e:
            logger.error(f"Failed to load existing documents: {e}")
    
    async def create_embedding(self, text: str) -> NumpyArray:
        """Create embedding for given text"""
        if not self.embedding_model:
            raise ValueError("Embedding model not initialized")
        
        try:
            # Run embedding generation in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            embedding = await loop.run_in_executor(
                self.executor, 
                self.embedding_model.encode, 
                text
            )
            return embedding.astype(np.float32)
        except Exception as e:
            logger.error(f"Failed to create embedding: {e}")
            raise
    
    async def add_document(
        self, 
        document_type: str, 
        content: str,
        metadata: Dict[str, Any] = None,
        doc_id: str = None
    ) -> str:
        """Add document to RAG knowledge base"""
        try:
            if doc_id is None:
                doc_id = str(uuid.uuid4())
            
            if metadata is None:
                metadata = {}
            
            # Create embedding
            embedding = await self.create_embedding(content)
            
            # Store in vector database
            if self.use_pinecone:
                await self._add_to_pinecone(doc_id, embedding, metadata)
            elif self.use_faiss:
                await self._add_to_faiss(doc_id, embedding, content, metadata)
            
            # Store in SQL database
            execute_insert(
                """INSERT INTO rag_documents 
                   (id, document_type, content, metadata, embedding_vector, created_at) 
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    doc_id,
                    document_type,
                    content,
                    json.dumps(metadata),
                    embedding.tobytes(),
                    datetime.utcnow().isoformat()
                )
            )
            
            logger.info(f"Added document {doc_id} to RAG knowledge base")
            return doc_id
            
        except Exception as e:
            logger.error(f"Failed to add document: {e}")
            raise
    
    async def _add_to_pinecone(self, doc_id: str, embedding: NumpyArray, metadata: Dict):
        """Add document to Pinecone index"""
        try:
            self.pinecone_index.upsert([(doc_id, embedding.tolist(), metadata)])
        except Exception as e:
            logger.error(f"Failed to add to Pinecone: {e}")
            raise
    
    async def _add_to_faiss(self, doc_id: str, embedding: NumpyArray, content: str, metadata: Dict):
        """Add document to FAISS index"""
        try:
            # Normalize for cosine similarity
            normalized_embedding = embedding.copy()
            faiss.normalize_L2(normalized_embedding.reshape(1, -1))
            
            self.faiss_index.add(normalized_embedding.reshape(1, -1))
            self.faiss_documents.append({
                'id': doc_id,
                'content': content,
                'metadata': metadata
            })
        except Exception as e:
            logger.error(f"Failed to add to FAISS: {e}")
            raise
    
    async def search_similar_documents(
        self,
        query: str,
        document_type: str = None,
        top_k: int = 5,
        similarity_threshold: float = 0.7,
        filters: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """Search for similar documents in the knowledge base"""
        try:
            start_time = time.time()
            
            # Create query embedding
            query_embedding = await self.create_embedding(query)
            
            # Search in vector database
            if self.use_pinecone:
                results = await self._search_pinecone(
                    query_embedding, top_k, similarity_threshold, filters
                )
            elif self.use_faiss:
                results = await self._search_faiss(
                    query_embedding, top_k, similarity_threshold, document_type, filters
                )
            else:
                results = []
            
            # Log query performance
            query_time = int((time.time() - start_time) * 1000)
            await self._log_query(query, document_type, top_k, len(results), query_time)
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to search documents: {e}")
            return []
    
    async def _search_pinecone(
        self, 
        query_embedding: NumpyArray, 
        top_k: int, 
        threshold: float,
        filters: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """Search Pinecone index"""
        try:
            search_results = self.pinecone_index.query(
                vector=query_embedding.tolist(),
                top_k=top_k,
                include_metadata=True,
                filter=filters
            )
            
            results = []
            for match in search_results['matches']:
                if match['score'] >= threshold:
                    results.append({
                        'id': match['id'],
                        'similarity_score': match['score'],
                        'metadata': match.get('metadata', {}),
                        'content': match['metadata'].get('content', '')
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Pinecone search failed: {e}")
            return []
    
    async def _search_faiss(
        self, 
        query_embedding: NumpyArray, 
        top_k: int, 
        threshold: float,
        document_type: str = None,
        filters: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """Search FAISS index"""
        try:
            if len(self.faiss_documents) == 0:
                return []
            
            # Normalize query for cosine similarity
            normalized_query = query_embedding.copy()
            faiss.normalize_L2(normalized_query.reshape(1, -1))
            
            # Search FAISS index
            scores, indices = self.faiss_index.search(normalized_query.reshape(1, -1), top_k)
            
            results = []
            for i, (score, idx) in enumerate(zip(scores[0], indices[0])):
                if idx != -1 and score >= threshold:
                    doc = self.faiss_documents[idx]
                    
                    # Apply filters if specified
                    if document_type and doc['metadata'].get('document_type') != document_type:
                        continue
                    
                    if filters:
                        skip = False
                        for key, value in filters.items():
                            if doc['metadata'].get(key) != value:
                                skip = True
                                break
                        if skip:
                            continue
                    
                    results.append({
                        'id': doc['id'],
                        'content': doc['content'],
                        'metadata': doc['metadata'],
                        'similarity_score': float(score)
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"FAISS search failed: {e}")
            return []
    
    async def _log_query(self, query: str, doc_type: str, top_k: int, results_count: int, query_time: int):
        """Log query performance for analytics"""
        try:
            execute_insert(
                """INSERT INTO rag_query_logs 
                   (id, query_text, index_name, top_k, results_count, query_time_ms, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    str(uuid.uuid4()),
                    query,
                    doc_type or 'general',
                    top_k,
                    results_count,
                    query_time,
                    datetime.utcnow().isoformat()
                )
            )
        except Exception as e:
            logger.error(f"Failed to log query: {e}")
    
    async def get_rag_context(
        self, 
        query: str, 
        document_type: str = 'demo-scope',
        top_k: int = 5,
        similarity_threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        Get RAG context for enhancing AI prompts
        Returns relevant historical cases and insights
        """
        try:
            # Search for similar documents
            similar_docs = await self.search_similar_documents(
                query=query,
                document_type=document_type,
                top_k=top_k,
                similarity_threshold=similarity_threshold
            )
            
            # Format for AI prompt enhancement
            rag_context = []
            for doc in similar_docs:
                context_item = {
                    'document_id': doc['id'],
                    'content': doc['content'][:500],  # Truncate for prompt efficiency
                    'metadata': doc['metadata'],
                    'similarity_score': doc['similarity_score'],
                    'applied_insights': self._extract_insights(doc)
                }
                rag_context.append(context_item)
            
            return rag_context
            
        except Exception as e:
            logger.error(f"Failed to get RAG context: {e}")
            return []
    
    def _extract_insights(self, document: Dict[str, Any]) -> List[str]:
        """Extract actionable insights from similar documents"""
        insights = []
        metadata = document.get('metadata', {})
        
        # Material-based insights
        if 'materials' in metadata:
            insights.append(f"material_identification: {metadata['materials']}")
        
        # Area calculation insights
        if 'area_sqft' in metadata:
            insights.append(f"area_estimation: {metadata['area_sqft']} sq ft")
        
        # Room type insights
        if 'room_type' in metadata:
            insights.append(f"room_context: {metadata['room_type']}")
        
        # Confidence insights
        if 'confidence_score' in metadata:
            insights.append(f"confidence_reference: {metadata['confidence_score']}")
        
        return insights
    
    async def create_enhanced_prompt(
        self, 
        base_prompt: str, 
        rag_context: List[Dict[str, Any]],
        include_uncertainty_guidance: bool = True
    ) -> str:
        """Create enhanced prompt with RAG context"""
        try:
            if not rag_context:
                return base_prompt
            
            # Build context section
            context_section = "Similar Historical Cases:\n"
            for i, context in enumerate(rag_context[:3], 1):  # Limit to top 3 for prompt efficiency
                context_section += f"{i}. {context['content']}\n"
                context_section += f"   Confidence: {context['similarity_score']:.2f}\n"
                if context['applied_insights']:
                    context_section += f"   Insights: {', '.join(context['applied_insights'])}\n"
                context_section += "\n"
            
            # Add uncertainty guidance
            uncertainty_guidance = ""
            if include_uncertainty_guidance:
                uncertainty_guidance = """
Guidelines:
- Use historical cases to improve accuracy
- Mark uncertain measurements as 'estimated' (추정)
- Provide confidence scores for each detected area
- Reference similar cases when applicable
"""
            
            # Combine into enhanced prompt
            enhanced_prompt = f"""
{context_section}

{uncertainty_guidance}

{base_prompt}
"""
            
            return enhanced_prompt.strip()
            
        except Exception as e:
            logger.error(f"Failed to create enhanced prompt: {e}")
            return base_prompt
    
    async def update_document_usage(self, document_id: str):
        """Update document usage statistics"""
        try:
            execute_update(
                """UPDATE rag_documents 
                   SET usage_count = usage_count + 1, last_used_at = ? 
                   WHERE id = ?""",
                (datetime.utcnow().isoformat(), document_id)
            )
        except Exception as e:
            logger.error(f"Failed to update document usage: {e}")
    
    async def add_feedback(
        self,
        analysis_id: str,
        feedback_data: Dict[str, Any],
        create_new_documents: bool = True
    ):
        """Process user feedback to improve RAG knowledge base"""
        try:
            # Store feedback
            feedback_id = str(uuid.uuid4())
            execute_insert(
                """INSERT INTO rag_feedback 
                   (feedback_id, analysis_id, analysis_type, feedback_type, 
                    accuracy_rating, area_corrections, comments, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    feedback_id,
                    analysis_id,
                    feedback_data.get('analysis_type', 'demo'),
                    feedback_data.get('feedback_type', 'correction'),
                    feedback_data.get('accuracy_rating', 3),
                    json.dumps(feedback_data.get('area_corrections', [])),
                    feedback_data.get('comments', ''),
                    datetime.utcnow().isoformat()
                )
            )
            
            # Create new documents from corrections if enabled
            if create_new_documents and feedback_data.get('area_corrections'):
                await self._create_documents_from_feedback(feedback_data)
            
            logger.info(f"Processed feedback for analysis {analysis_id}")
            
        except Exception as e:
            logger.error(f"Failed to process feedback: {e}")
    
    async def _create_documents_from_feedback(self, feedback_data: Dict[str, Any]):
        """Create new RAG documents from user corrections"""
        try:
            corrections = feedback_data.get('area_corrections', [])
            
            for correction in corrections:
                if correction.get('user_correction'):
                    # Create document content from correction
                    content = f"Corrected analysis: {correction['correction_reason']}\n"
                    content += f"AI detected: {correction.get('ai_detected', {})}\n"
                    content += f"Actual: {correction['user_correction']}"
                    
                    # Create metadata
                    metadata = {
                        'document_type': 'demo-scope',
                        'feedback_based': True,
                        'accuracy_improvement': True,
                        **correction.get('user_correction', {})
                    }
                    
                    # Add to knowledge base
                    await self.add_document(
                        document_type='demo-scope',
                        content=content,
                        metadata=metadata
                    )
            
        except Exception as e:
            logger.error(f"Failed to create documents from feedback: {e}")

# Global RAG service instance
rag_service = RAGService()