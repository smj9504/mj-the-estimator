from fastapi import Request, Response
from fastapi.routing import APIRoute
from typing import Callable
import time
import uuid
from utils.logger import logger

class LoggingRoute(APIRoute):
    """Custom APIRoute that logs all requests and responses"""
    
    def get_route_handler(self) -> Callable:
        original_route_handler = super().get_route_handler()
        
        async def custom_route_handler(request: Request) -> Response:
            # Generate request ID
            request_id = str(uuid.uuid4())
            
            # Extract session ID from request if available
            session_id = None
            if hasattr(request, 'json'):
                try:
                    body = await request.json()
                    session_id = body.get('session_id')
                    # Reset body for downstream processing
                    request._body = await request.body()
                except:
                    pass
            
            # Start timer
            start_time = time.time()
            
            # Log request
            logger.info(
                f"Request started: {request.method} {request.url.path}",
                method=request.method,
                api_endpoint=request.url.path,
                request_id=request_id,
                session_id=session_id,
                client_host=request.client.host if request.client else None
            )
            
            try:
                # Call original handler
                response = await original_route_handler(request)
                
                # Calculate duration
                duration = time.time() - start_time
                
                # Log response
                logger.api_request(
                    method=request.method,
                    endpoint=request.url.path,
                    status_code=response.status_code,
                    duration=duration,
                    session_id=session_id,
                    request_id=request_id
                )
                
                # Add request ID to response headers
                response.headers["X-Request-ID"] = request_id
                
                return response
                
            except Exception as e:
                # Calculate duration
                duration = time.time() - start_time
                
                # Log error
                logger.error(
                    f"Request failed: {request.method} {request.url.path}",
                    method=request.method,
                    api_endpoint=request.url.path,
                    duration=duration,
                    request_id=request_id,
                    session_id=session_id,
                    exc_info=True
                )
                
                raise
        
        return custom_route_handler

async def log_request_body(request: Request, call_next):
    """Middleware to log request bodies for debugging"""
    # Only log bodies for specific endpoints or in debug mode
    if request.url.path.startswith("/api/") and request.method in ["POST", "PUT", "PATCH"]:
        try:
            body = await request.body()
            if body:
                logger.debug(
                    "Request body",
                    api_endpoint=request.url.path,
                    method=request.method,
                    body_size=len(body),
                    body_preview=body[:200].decode('utf-8', errors='ignore') if len(body) < 1000 else "Body too large to log"
                )
            # Reset body for downstream processing
            request._body = body
        except Exception as e:
            logger.error(f"Failed to log request body: {e}")
    
    response = await call_next(request)
    return response