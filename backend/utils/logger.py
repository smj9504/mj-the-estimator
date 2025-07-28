import logging
import logging.handlers
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
import traceback

class CustomFormatter(logging.Formatter):
    """Custom formatter that outputs JSON formatted logs"""
    
    def format(self, record):
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "message": record.getMessage(),
        }
        
        # Add extra fields if available
        if hasattr(record, 'api_endpoint'):
            log_data['api_endpoint'] = record.api_endpoint
        if hasattr(record, 'method'):
            log_data['method'] = record.method
        if hasattr(record, 'status_code'):
            log_data['status_code'] = record.status_code
        if hasattr(record, 'user_id'):
            log_data['user_id'] = record.user_id
        if hasattr(record, 'session_id'):
            log_data['session_id'] = record.session_id
        if hasattr(record, 'duration'):
            log_data['duration'] = record.duration
            
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = {
                'type': record.exc_info[0].__name__,
                'message': str(record.exc_info[1]),
                'traceback': traceback.format_exception(*record.exc_info)
            }
            
        return json.dumps(log_data)

class Logger:
    """Centralized logging interface"""
    
    def __init__(self, name: str = "mj-estimator", log_dir: str = "logs", 
                 console_level: str = "INFO", file_level: str = "DEBUG"):
        self.name = name
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)
        
        # Create logger
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)
        
        # Remove existing handlers
        self.logger.handlers = []
        
        # Console handler with custom format
        console_handler = logging.StreamHandler()
        console_handler.setLevel(getattr(logging, console_level))
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - [%(module)s:%(funcName)s:%(lineno)d] - %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        self.logger.addHandler(console_handler)
        
        # File handler with JSON format
        file_handler = logging.handlers.RotatingFileHandler(
            self.log_dir / f"{name}.log",
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(getattr(logging, file_level))
        file_handler.setFormatter(CustomFormatter())
        self.logger.addHandler(file_handler)
        
        # Error file handler
        error_handler = logging.handlers.RotatingFileHandler(
            self.log_dir / f"{name}-error.log",
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(CustomFormatter())
        self.logger.addHandler(error_handler)
    
    def debug(self, message: str, **kwargs):
        """Log debug message with optional extra fields"""
        self.logger.debug(message, extra=kwargs)
    
    def info(self, message: str, **kwargs):
        """Log info message with optional extra fields"""
        self.logger.info(message, extra=kwargs)
    
    def warning(self, message: str, **kwargs):
        """Log warning message with optional extra fields"""
        self.logger.warning(message, extra=kwargs)
    
    def error(self, message: str, exc_info: bool = True, **kwargs):
        """Log error message with optional extra fields"""
        self.logger.error(message, exc_info=exc_info, extra=kwargs)
    
    def critical(self, message: str, exc_info: bool = True, **kwargs):
        """Log critical message with optional extra fields"""
        self.logger.critical(message, exc_info=exc_info, extra=kwargs)
    
    def api_request(self, method: str, endpoint: str, status_code: int = None, 
                   duration: float = None, session_id: str = None, **kwargs):
        """Log API request with structured data"""
        message = f"{method} {endpoint}"
        if status_code:
            message += f" - {status_code}"
        if duration:
            message += f" - {duration:.3f}s"
            
        extra = {
            'method': method,
            'api_endpoint': endpoint,
            'status_code': status_code,
            'duration': duration,
            'session_id': session_id,
            **kwargs
        }
        
        if status_code and status_code >= 400:
            self.error(message, exc_info=False, **extra)
        else:
            self.info(message, **extra)
    
    def service_call(self, service: str, operation: str, success: bool = True, 
                    duration: float = None, **kwargs):
        """Log service operation"""
        status = "SUCCESS" if success else "FAILED"
        message = f"{service}.{operation} - {status}"
        if duration:
            message += f" - {duration:.3f}s"
            
        extra = {
            'service': service,
            'operation': operation,
            'success': success,
            'duration': duration,
            **kwargs
        }
        
        if success:
            self.info(message, **extra)
        else:
            self.error(message, exc_info=False, **extra)

# Global logger instance
logger = Logger()