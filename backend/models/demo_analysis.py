# This file appears to be unused - the project uses raw SQLite queries instead of SQLAlchemy ORM
# The actual demo_ai_analysis table is created in models/database.py using raw SQL
# If you need to use SQLAlchemy in the future, uncomment the code below and:
# 1. Add SQLAlchemy Base class definition to models/database.py
# 2. Configure SQLAlchemy engine and session management
# 3. Update all database operations to use ORM instead of raw SQL

# from sqlalchemy import Column, String, DateTime, Boolean, Float, Text, JSON
# from sqlalchemy.sql import func
# from .database import Base
#
# class DemoAIAnalysis(Base):
#     __tablename__ = "demo_ai_analysis"
#     
#     analysis_id = Column(String(100), primary_key=True, index=True)
#     project_id = Column(String(100), index=True, nullable=False)
#     session_id = Column(String(100), index=True, nullable=False)
#     room_id = Column(String(100), nullable=False)
#     
#     # Analysis metadata
#     analysis_timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
#     model_version = Column(String(50), nullable=False)
#     prompt_version = Column(String(50), nullable=False)
#     
#     # Image data
#     images = Column(JSON, nullable=False)  # Metadata about images
#     
#     # AI results
#     ai_raw_response = Column(Text, nullable=False)  # Raw AI response
#     ai_parsed_results = Column(JSON, nullable=False)  # Parsed structured results
#     
#     # User modifications
#     user_modifications = Column(JSON, nullable=True)  # User edits to AI results
#     user_feedback = Column(JSON, nullable=True)  # User feedback on accuracy
#     
#     # Quality metrics
#     quality_score = Column(Float, default=0.8, index=True)  # 0.0 to 1.0
#     is_verified = Column(Boolean, default=False, index=True)  # User verified results
#     is_applied = Column(Boolean, default=False)  # Applied to demo scope
#     
#     # Timestamps
#     created_at = Column(DateTime(timezone=True), server_default=func.now())
#     updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())