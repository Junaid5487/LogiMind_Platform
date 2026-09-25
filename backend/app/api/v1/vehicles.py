from fastapi import APIRouter, Depends
from typing import List, Dict, Any
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

