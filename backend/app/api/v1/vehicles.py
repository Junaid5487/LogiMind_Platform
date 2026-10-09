from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.dependencies.database import get_db_session
from app.db.models import Vehicle

router = APIRouter(prefix="/vehicles", tags=["Vehicles Registry"])

@router.get("", response_model=List[Dict[str, Any]])
def get_vehicles(db: Session = Depends(get_db_session)):
    vehicles = db.query(Vehicle).all()
    veh_list = vehicles if vehicles else []
    
    defaults = {
        "V-101": {"current_lat": 19.0760, "current_lng": 72.8777, "fuel_level_pct": 88, "engine_temp_c": 85.0, "health_status": "NORMAL", "failure_risk_pct": 15},
        "V-102": {"current_lat": 19.0330, "current_lng": 73.0297, "fuel_level_pct": 75, "engine_temp_c": 88.0, "health_status": "NORMAL", "failure_risk_pct": 22},
        "V-104": {"current_lat": 18.5204, "current_lng": 73.8567, "fuel_level_pct": 92, "engine_temp_c": 98.5, "health_status": "WARNING", "failure_risk_pct": 60}
    }

    result = []
    for v in veh_list:
        v_id = v.vehicle_id
        telemetry = defaults.get(v_id, {"current_lat": 19.0760, "current_lng": 72.8777, "fuel_level_pct": 80, "engine_temp_c": 85.0, "health_status": "NORMAL", "failure_risk_pct": 20})
        name_str = f"{v.brand or ''} {v.model or ''}".strip()
        result.append({
            "id": v_id,
            "vehicle_id": v_id,
            "name": name_str or v_id,
            "registration_number": v.registration_number,
            "brand": v.brand,
            "model": v.model,
            "type": v.vehicle_type,
            "vehicle_type": v.vehicle_type,
            "capacity_kg": v.capacity_kg,
            "fuel_type": v.fuel_type,
            "status": v.status,
            "odometer_km": v.odometer_km,
            "mileage_km": v.odometer_km,
            **telemetry
        })

    if not result:
        return [
            {"id": "V-101", "vehicle_id": "V-101", "name": "Tata Prima 5530.S", "type": "HEAVY_TRUCK", "capacity_kg": 5000.0, "fuel_type": "DIESEL", "status": "AVAILABLE", "current_lat": 19.0760, "current_lng": 72.8777, "fuel_level_pct": 88, "engine_temp_c": 85.0, "mileage_km": 62000.0, "health_status": "NORMAL", "failure_risk_pct": 15},
            {"id": "V-102", "vehicle_id": "V-102", "name": "Mahindra Treo Zor EV", "type": "EV_VAN", "capacity_kg": 1800.0, "fuel_type": "ELECTRIC", "status": "IN_TRANSIT", "current_lat": 19.0330, "current_lng": 73.0297, "fuel_level_pct": 75, "engine_temp_c": 88.0, "mileage_km": 18500.0, "health_status": "NORMAL", "failure_risk_pct": 22},
            {"id": "V-104", "vehicle_id": "V-104", "name": "Ashok Leyland BADA DOST", "type": "EV_VAN", "capacity_kg": 1500.0, "fuel_type": "ELECTRIC", "status": "MAINTENANCE", "current_lat": 18.5204, "current_lng": 73.8567, "fuel_level_pct": 92, "engine_temp_c": 98.5, "mileage_km": 31000.0, "health_status": "WARNING", "failure_risk_pct": 60}
        ]

    return result

class VehicleCreateRequest(BaseModel):
    brand: str
    model: str = ""
    vehicle_type: str = "LIGHT_TRUCK"
    capacity_kg: float = 1500.0
    fuel_type: str = "DIESEL"
    status: str = "AVAILABLE"
    registration_number: Optional[str] = None
    manufacturing_year: Optional[int] = None
    odometer_km: float = 0.0


VALID_FUEL_TYPES = {"DIESEL", "PETROL", "CNG", "ELECTRIC"}
VALID_STATUSES = {"AVAILABLE", "IN_TRANSIT", "MAINTENANCE", "OUT_OF_SERVICE"}


def _next_vehicle_id(db: Session) -> str:
    existing = {v.vehicle_id for v in db.query(Vehicle.vehicle_id).all()}
    n = 101
    while f"V-{n}" in existing:
        n += 1
    return f"V-{n}"


def _serialize_new_vehicle(v: Vehicle) -> Dict[str, Any]:
    name_str = f"{v.brand or ''} {v.model or ''}".strip()
    return {
        "id": v.vehicle_id,
        "vehicle_id": v.vehicle_id,
        "name": name_str or v.vehicle_id,
        "registration_number": v.registration_number,
        "brand": v.brand,
        "model": v.model,
        "type": v.vehicle_type,
        "vehicle_type": v.vehicle_type,
        "capacity_kg": v.capacity_kg,
        "fuel_type": v.fuel_type,
        "status": v.status,
        "odometer_km": v.odometer_km,
        "mileage_km": v.odometer_km,
        "current_lat": 19.0760,
        "current_lng": 72.8777,
        "fuel_level_pct": 80,
        "engine_temp_c": 85.0,
        "health_status": "NORMAL",
        "failure_risk_pct": 20,
    }


@router.post("", response_model=Dict[str, Any])
def create_vehicle(req: VehicleCreateRequest, db: Session = Depends(get_db_session)):
    if not req.brand or not req.brand.strip():
        raise HTTPException(status_code=400, detail="brand (vehicle name) is required.")
    if req.capacity_kg is None or req.capacity_kg <= 0:
        raise HTTPException(status_code=400, detail="capacity_kg must be greater than 0.")
    if req.fuel_type not in VALID_FUEL_TYPES:
        raise HTTPException(status_code=400, detail=f"fuel_type must be one of: {', '.join(sorted(VALID_FUEL_TYPES))}.")
    if req.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of: {', '.join(sorted(VALID_STATUSES))}.")

    vehicle_id = _next_vehicle_id(db)
    reg = (req.registration_number or f"REG-{vehicle_id}").strip()
    if db.query(Vehicle).filter(Vehicle.registration_number == reg).first():
        raise HTTPException(status_code=400, detail=f"registration_number '{reg}' already exists.")

    v = Vehicle(
        vehicle_id=vehicle_id,
        registration_number=reg,
        vehicle_type=(req.vehicle_type or "LIGHT_TRUCK").strip().upper(),
        brand=req.brand.strip(),
        model=(req.model or "").strip(),
        manufacturing_year=req.manufacturing_year,
        capacity_kg=req.capacity_kg,
        fuel_type=req.fuel_type,
        status=req.status,
        odometer_km=req.odometer_km or 0.0,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return _serialize_new_vehicle(v)


@router.delete("/{vehicle_id}", response_model=Dict[str, Any])
def delete_vehicle(vehicle_id: str, db: Session = Depends(get_db_session)):
    v = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first()
    if not v:
        raise HTTPException(status_code=404, detail=f"Vehicle {vehicle_id} not found.")
    db.delete(v)
    db.commit()
    return {"deleted": True, "vehicle_id": vehicle_id}


