from typing import Any, Dict, List
from fastapi import APIRouter, Query, HTTPException
from app.db.session import SessionLocal
from app.services.activity_simulator import (
    get_recent_activity,
    get_activity_count,
    get_simulator_status,
    perform_random_mutation,
    record_activity,
)

router = APIRouter(prefix="/activity", tags=["Activity Simulator"])


@router.get("/recent")
def recent_activity(limit: int = Query(50, ge=1, le=500)):
    items = get_recent_activity(limit)
    return {"items": items, "count": len(items), "total": get_activity_count()}


@router.get("/status")
def activity_status():
    return get_simulator_status()
@router.post("/run")
def run_activity_now():
    db = SessionLocal()
    try:
        desc = perform_random_mutation(db)
        if desc:
            db.commit()
            record_activity(desc, changed=True)
            return {"status": "CHANGED", "description": desc}
        db.rollback()
        record_activity("No eligible mutation this cycle", changed=False)
        return {"status": "NO_CHANGE", "description": "No eligible mutation this cycle"}
    except Exception as exc:
        db.rollback()
        record_activity(f"Cycle failed: {exc}", changed=False, error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        db.close()