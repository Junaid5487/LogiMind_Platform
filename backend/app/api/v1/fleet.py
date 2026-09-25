from fastapi import APIRouter
from typing import Dict, Any
from app.services.ml.risk_analyzer import RiskAnalyzer

router = APIRouter(prefix="/fleet", tags=["Fleet Health & XAI Diagnostics"])

@router.get("/{vehicle_id}/health", response_model=Dict[str, Any])
def get_vehicle_health_telemetry(vehicle_id: str):
    analyzer = RiskAnalyzer()
    sample_vehicle = {
        "id": vehicle_id,
        "name": "Ford E-Transit" if vehicle_id == "V-104" else "Freightliner M2 106",
        "engine_temp_c": 98.5 if vehicle_id == "V-104" else 85.0,
        "mileage_km": 62000.0,
        "fuel_type": "ELECTRIC" if vehicle_id == "V-104" else "DIESEL"
    }
    return analyzer.analyze_vehicle_health(sample_vehicle, [])
