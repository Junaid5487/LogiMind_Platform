from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.dependencies.database import get_db_session
from app.db.models import Vehicle, MaintenanceLog
from app.services.ml.risk_analyzer import RiskAnalyzer

router = APIRouter(prefix="/vehicles", tags=["Vehicles Registry"])

# Synthesized telemetry keyed by vehicle id. The DB has no fuel/risk columns,
# so the API and the VRP solver share one source of truth: the optimizer needs
# fuel_level_pct (range guard) and failure_risk_pct (risk exclusion) to run
# the same constraints the UI shows.
VEHICLE_TELEMETRY_DEFAULTS = {
    "V-101": {"current_lat": 19.0760, "current_lng": 72.8777, "fuel_level_pct": 88, "engine_temp_c": 85.0, "coolant_pressure_bar": 2.1, "tire_wear_pct": 30, "health_status": "NORMAL", "failure_risk_pct": 15},
    "V-102": {"current_lat": 28.6139, "current_lng": 77.2090, "fuel_level_pct": 75, "engine_temp_c": 88.0, "coolant_pressure_bar": 1.9, "tire_wear_pct": 25, "health_status": "NORMAL", "failure_risk_pct": 22},
    "V-103": {"current_lat": 12.9716, "current_lng": 77.5946, "fuel_level_pct": 81, "engine_temp_c": 87.0, "coolant_pressure_bar": 2.0, "tire_wear_pct": 42, "health_status": "NORMAL", "failure_risk_pct": 25},
    "V-104": {"current_lat": 21.1458, "current_lng": 79.0882, "fuel_level_pct": 92, "engine_temp_c": 98.5, "coolant_pressure_bar": 2.7, "tire_wear_pct": 58, "health_status": "WARNING", "failure_risk_pct": 60},
    "V-105": {"current_lat": 17.3850, "current_lng": 78.4867, "fuel_level_pct": 90, "engine_temp_c": 82.0, "coolant_pressure_bar": 1.8, "tire_wear_pct": 18, "health_status": "NORMAL", "failure_risk_pct": 12},
    "V-106": {"current_lat": 22.5726, "current_lng": 88.3639, "fuel_level_pct": 85, "engine_temp_c": 86.5, "coolant_pressure_bar": 2.2, "tire_wear_pct": 35, "health_status": "NORMAL", "failure_risk_pct": 20},
}
VEHICLE_TELEMETRY_FALLBACK = {"current_lat": 19.0760, "current_lng": 72.8777, "fuel_level_pct": 80, "engine_temp_c": 85.0, "coolant_pressure_bar": 2.0, "tire_wear_pct": 30, "health_status": "NORMAL", "failure_risk_pct": 20}


def vehicle_telemetry(vehicle_id: str) -> Dict[str, Any]:
    """Telemetry dict for a vehicle id (defaults for unknown ids)."""
    return dict(VEHICLE_TELEMETRY_DEFAULTS.get(vehicle_id, VEHICLE_TELEMETRY_FALLBACK))


@router.get("", response_model=List[Dict[str, Any]])
def get_vehicles(db: Session = Depends(get_db_session)):
    vehicles = db.query(Vehicle).all()
    veh_list = vehicles if vehicles else []
    
    defaults = VEHICLE_TELEMETRY_DEFAULTS

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
            {"id": "V-102", "vehicle_id": "V-102", "name": "Mahindra Treo Zor EV", "type": "EV_VAN", "capacity_kg": 1800.0, "fuel_type": "ELECTRIC", "status": "AVAILABLE", "current_lat": 28.6139, "current_lng": 77.2090, "fuel_level_pct": 75, "engine_temp_c": 88.0, "mileage_km": 18500.0, "health_status": "NORMAL", "failure_risk_pct": 22},
            {"id": "V-103", "vehicle_id": "V-103", "name": "Eicher Pro 3019", "type": "HEAVY_TRUCK", "capacity_kg": 6000.0, "fuel_type": "DIESEL", "status": "AVAILABLE", "current_lat": 12.9716, "current_lng": 77.5946, "fuel_level_pct": 81, "engine_temp_c": 87.0, "mileage_km": 115000.0, "health_status": "NORMAL", "failure_risk_pct": 25},
            {"id": "V-104", "vehicle_id": "V-104", "name": "Ashok Leyland BADA DOST", "type": "REFRIGERATED_TRUCK", "capacity_kg": 2500.0, "fuel_type": "DIESEL", "status": "MAINTENANCE", "current_lat": 21.1458, "current_lng": 79.0882, "fuel_level_pct": 92, "engine_temp_c": 98.5, "mileage_km": 31000.0, "health_status": "WARNING", "failure_risk_pct": 60}
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


class VehicleConditionUpdateRequest(BaseModel):
    mileage_km: Optional[float] = None
    engine_temp_c: Optional[float] = None
    coolant_pressure_bar: Optional[float] = None
    tire_wear_pct: Optional[float] = None
    fuel_level_pct: Optional[float] = None
    service_status: Optional[str] = None  # e.g. "AVAILABLE", "MAINTENANCE"
    inspection_notes: Optional[str] = None


@router.post("/{vehicle_id}/condition", response_model=Dict[str, Any])
def update_vehicle_condition(
    vehicle_id: str,
    req: VehicleConditionUpdateRequest,
    db: Session = Depends(get_db_session)
):
    """
    Fleet Manager: Submit post-trip vehicle inspection telemetry.
    Re-runs ML RiskAnalyzer to calculate SHAP feature attributions and updated failure risk.
    If failure risk >= 70%, the vehicle is automatically flagged as MAINTENANCE
    and removed from future VRP dispatch tours.
    """
    v = db.query(Vehicle).filter(Vehicle.vehicle_id == vehicle_id).first()
    if not v:
        raise HTTPException(status_code=404, detail=f"Vehicle {vehicle_id} not found.")

    # Read current telemetry
    current_telem = dict(VEHICLE_TELEMETRY_DEFAULTS.get(vehicle_id, VEHICLE_TELEMETRY_FALLBACK))

    if req.mileage_km is not None and req.mileage_km > 0:
        v.odometer_km = req.mileage_km
        current_telem["mileage_km"] = req.mileage_km
    else:
        current_telem["mileage_km"] = float(v.odometer_km or 40000.0)

    if req.engine_temp_c is not None:
        current_telem["engine_temp_c"] = float(req.engine_temp_c)
    if req.coolant_pressure_bar is not None:
        current_telem["coolant_pressure_bar"] = float(req.coolant_pressure_bar)
    if req.tire_wear_pct is not None:
        current_telem["tire_wear_pct"] = float(req.tire_wear_pct)
    if req.fuel_level_pct is not None:
        current_telem["fuel_level_pct"] = max(0.0, min(100.0, float(req.fuel_level_pct)))

    # Run ML RiskAnalyzer
    analyzer = RiskAnalyzer()
    vehicle_dict = {
        "id": vehicle_id,
        "name": f"{v.brand or ''} {v.model or ''}".strip() or vehicle_id,
        "fuel_type": v.fuel_type,
        "engine_temp_c": current_telem.get("engine_temp_c", 85.0),
        "mileage_km": current_telem.get("mileage_km", float(v.odometer_km or 40000.0)),
        "coolant_pressure_bar": current_telem.get("coolant_pressure_bar", 2.0),
        "tire_wear_pct": current_telem.get("tire_wear_pct", 30),
    }
    risk_report = analyzer.analyze_vehicle_health(vehicle_dict, [])

    failure_risk_score = risk_report.get("overall_failure_risk", 0.15)
    failure_risk_pct = int(round(failure_risk_score * 100))
    health_status = risk_report.get("status", "NORMAL")

    current_telem["health_status"] = health_status
    current_telem["failure_risk_pct"] = failure_risk_pct
    VEHICLE_TELEMETRY_DEFAULTS[vehicle_id] = current_telem

    # If failure risk is critical (>= 70%) or manager requested MAINTENANCE:
    if req.service_status in VALID_STATUSES:
        v.status = req.service_status
    elif failure_risk_score >= 0.70:
        v.status = "MAINTENANCE"
    elif v.status == "MAINTENANCE" and failure_risk_score < 0.35 and (req.service_status == "AVAILABLE" or not req.service_status):
        # Cleared inspection
        v.status = "AVAILABLE"

    # Add Maintenance Log
    log_entry = MaintenanceLog(
        vehicle_id=vehicle_id,
        service_type="POST_TRIP_INSPECTION",
        component_serviced="Engine, Tires, Brakes & Battery Check",
        cost=0.0 if v.status == "AVAILABLE" else 450.0,
        service_center="Fleet Terminal Diagnostics Bay",
        status="COMPLETED" if v.status == "AVAILABLE" else "IN_PROGRESS",
        failure_risk_score=failure_risk_score,
        description=req.inspection_notes or f"Post-trip condition recorded. Status: {health_status} (Risk: {failure_risk_pct}%)",
    )
    db.add(log_entry)
    db.commit()
    db.refresh(v)

    return {
        "status": "SUCCESS",
        "vehicle_id": vehicle_id,
        "vehicle_status": v.status,
        "odometer_km": v.odometer_km,
        "telemetry": current_telem,
        "risk_analysis": risk_report,
    }


@router.get("/{vehicle_id}/inspections", response_model=List[Dict[str, Any]])
def list_vehicle_inspections(vehicle_id: str, db: Session = Depends(get_db_session)):
    """Fetch post-trip inspections and maintenance history for a vehicle."""
    logs = db.query(MaintenanceLog).filter(MaintenanceLog.vehicle_id == vehicle_id).all()
    return [
        {
            "maintenance_log_id": l.maintenance_log_id,
            "service_type": l.service_type,
            "component_serviced": l.component_serviced,
            "service_date": l.service_date,
            "cost": l.cost,
            "status": l.status,
            "failure_risk_score": l.failure_risk_score,
            "description": l.description,
        }
        for l in logs
    ]



