import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from app.core.logging import logger

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        correlation_id = str(uuid.uuid4())
        request.state.correlation_id = correlation_id
        start_time = time.time()
        
        response = await call_next(request)
        
        process_time_ms = round((time.time() - start_time) * 1000, 2)
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Process-Time-MS"] = str(process_time_ms)
        
        logger.info(f"[{correlation_id}] {request.method} {request.url.path} - Status: {response.status_code} ({process_time_ms}ms)")
        return response
