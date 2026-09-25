from fastapi import APIRouter, Depends
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.dependencies.database import get_db_session
from app.db.models import Vehicle
from app.services.ml.risk_analyzer import RiskAnalyzer

router = APIRouter(prefix="/fleet", tags=["Fleet Health & XAI Diagnostics"])

FLEET_PROFILES = {
    "V-101": {
        "name": "Tata Prima 5530.S",
        "engine_temp_c": 88.5,
        "mileage_km": 94000.0,
        "fuel_type": "DIESEL",
        "coolant_pressure_bar": 2.1,
        "tire_wear_pct": 68
    },
    "V-102": {
        "name": "Mahindra Treo Zor EV",
        "engine_temp_c": 62.0,
        "mileage_km": 24000.0,
        "fuel_type": "ELECTRIC",
        "coolant_pressure_bar": 1.4,
        "tire_wear_pct": 22
    },
    "V-103": {
        "name": "Eicher Pro 3019",
        "engine_temp_c": 92.4,
        "mileage_km": 115000.0,
        "fuel_type": "DIESEL",
        "coolant_pressure_bar": 2.8,
        "tire_wear_pct": 82
    },
    "V-104": {
        "name": "Ashok Leyland BADA DOST",
        "engine_temp_c": 98.5,
        "mileage_km": 86000.0,
        "fuel_type": "DIESEL",
        "coolant_pressure_bar": 3.4,
        "tire_wear_pct": 74
    },
    "V-105": {
        "name": "Tata Ace Gold EV",
        "engine_temp_c": 65.0,
        "mileage_km": 18000.0,
        "fuel_type": "ELECTRIC",
        "coolant_pressure_bar": 1.2,
        "tire_wear_pct": 18
    }
}

@router.get("/{vehicle_id}/health", response_model=Dict[str, Any])
def get_vehicle_health_telemetry(vehicle_id: str, db: Session = Depends(get_db_session)):
    analyzer = RiskAnalyzer()
    db_veh = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first()
    
    veh_name = f"{db_veh.brand} {db_veh.model}" if (db_veh and db_veh.brand) else vehicle_id
    
    profile = FLEET_PROFILES.get(vehicle_id, {
        "name": veh_name,
        "engine_temp_c": 85.0,
        "mileage_km": db_veh.odometer_km if db_veh else 45000.0,
        "fuel_type": db_veh.fuel_type if db_veh else "DIESEL",
        "coolant_pressure_bar": 2.0,
        "tire_wear_pct": 35
    })
    
    sample_vehicle = {
        "id": vehicle_id,
        "name": profile.get("name", veh_name),
        "engine_temp_c": profile.get("engine_temp_c", 85.0),
        "mileage_km": profile.get("mileage_km", 45000.0),
        "fuel_type": profile.get("fuel_type", "DIESEL"),
        "coolant_pressure_bar": profile.get("coolant_pressure_bar", 2.0),
        "tire_wear_pct": profile.get("tire_wear_pct", 35)
    }
    return analyzer.analyze_vehicle_health(sample_vehicle, [])
