from fastapi import APIRouter, Depends
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.dependencies.database import get_db_session
from app.db.models import Driver

router = APIRouter(prefix="/drivers", tags=["Drivers Registry"])

@router.get("", response_model=List[Dict[str, Any]])
def get_drivers(db: Session = Depends(get_db_session)):
    drivers = db.query(Driver).all()
    return [
        {
            "driver_id": d.driver_id,
            "license_number": d.license_number,
            "experience_years": d.experience_years,
            "availability_status": d.availability_status,
            "rating_score": d.rating_score
        }
        for d in drivers
    ]
