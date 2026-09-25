from fastapi import Request, status
from fastapi.responses import JSONResponse
from app.core.logging import logger

class LogiMindException(Exception):
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST, error_code: str = "BAD_REQUEST"):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code

async def logimind_exception_handler(request: Request, exc: LogiMindException):
    logger.warning(f"Business Exception: {exc.error_code} - {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error_code": exc.error_code, "message": exc.message}
    )

async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "error_code": "INTERNAL_SERVER_ERROR", "message": str(exc)}
    )
