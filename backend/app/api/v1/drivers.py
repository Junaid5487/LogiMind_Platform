from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

router = APIRouter(prefix="/drivers", tags=["Drivers Registry"])

# In-memory driver registry (mock data pattern, consistent with DRIVER_SHIFTS)
DRIVERS: List[Dict[str, Any]] = [
    {
        "driver_id": "DRV-01",
        "driver_name": "Rahul Sharma",
        "license_number": "MH-04-2022-0094821",
        "phone": "+91-98200-11223",
        "experience_years": 8,
        "availability_status": "ON_TRIP",
        "rating_score": 4.8,
        "vehicle_id": "V-101",
        "vehicle_name": "Tata Prima 5530.S",
        "vehicle_type": "HEAVY_TRUCK",
        "route_id": "RT-V101-OPT",
    },
    {
        "driver_id": "DRV-02",
        "driver_name": "Amit Varma",
        "license_number": "MH-12-2023-0182743",
        "phone": "+91-98765-44556",
        "experience_years": 4,
        "availability_status": "ON_TRIP",
        "rating_score": 4.6,
        "vehicle_id": "V-102",
        "vehicle_name": "Mahindra Treo Zor EV",
        "vehicle_type": "EV_VAN",
        "route_id": "RT-V102-OPT",
    },
]

class CreateDriverRequest(BaseModel):
    driver_name: str
    license_number: str
    vehicle_id: str
    vehicle_name: str
    vehicle_type: str = "EV_VAN"
    phone: Optional[str] = None
    experience_years: int = 0

@router.get("", response_model=List[Dict[str, Any]])
def get_drivers():
    return DRIVERS

@router.post("", response_model=Dict[str, Any], status_code=201)
def create_driver(req: CreateDriverRequest):
    if not req.driver_name.strip():
        raise HTTPException(status_code=400, detail="Driver name is required")
    if not req.license_number.strip():
        raise HTTPException(status_code=400, detail="License number is required")
    if any(d["license_number"] == req.license_number for d in DRIVERS):
        raise HTTPException(status_code=400, detail=f"License {req.license_number} already registered")

    next_num = 1
    existing_ids = {d["driver_id"] for d in DRIVERS}
    while f"DRV-{next_num:02d}" in existing_ids:
        next_num += 1

    new_driver = {
        "driver_id": f"DRV-{next_num:02d}",
        "driver_name": req.driver_name.strip(),
        "license_number": req.license_number.strip(),
        "phone": req.phone or "",
        "experience_years": req.experience_years,
        "availability_status": "AVAILABLE",
        "rating_score": 5.0,
        "vehicle_id": req.vehicle_id,
        "vehicle_name": req.vehicle_name,
        "vehicle_type": req.vehicle_type,
        "route_id": None,
    }
    DRIVERS.append(new_driver)
    return {"status": "CREATED", "driver": new_driver}

@router.delete("/{driver_id}", response_model=Dict[str, Any])
def delete_driver(driver_id: str):
    for idx, d in enumerate(DRIVERS):
        if d["driver_id"] == driver_id:
            removed = DRIVERS.pop(idx)
            return {"status": "REMOVED", "driver": removed}
    raise HTTPException(status_code=404, detail=f"Driver {driver_id} not found")

