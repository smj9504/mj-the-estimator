import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Server Configuration
    port: int = 8000
    host: str = "127.0.0.1"
    
    # Environment
    environment: str = "development"
    
    # Ollama Configuration
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3"
    
    # OpenAI Configuration
    openai_api_key: Optional[str] = None
    
    # Anthropic Configuration
    anthropic_api_key: Optional[str] = None
    
    # Google Cloud Configuration
    google_application_credentials: Optional[str] = None
    
    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'

# Global settings instance
settings = Settings()

# Convenience function to get backend URL
def get_backend_url() -> str:
    return f"http://{settings.host}:{settings.port}"