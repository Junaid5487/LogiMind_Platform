from fastapi import APIRouter
from app.db.session import check_db_health

router = APIRouter(tags=["Health & System Diagnostics"])

@router.get("/health")
def health_check():
    db_ok = check_db_health()
    return {
        "status": "HEALTHY" if db_ok else "DEGRADED",
        "system": "LogiMind Enterprise AI Operating System",
        "database": "CONNECTED" if db_ok else "DISCONNECTED"
    }
