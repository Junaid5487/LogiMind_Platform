from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.db.models import Driver, Vehicle, Route, Trip, Shipment

router = APIRouter(prefix="/driver", tags=["Driver Dispatch & Delivery Execution"])

class UpdateStopStatusRequest(BaseModel):
    status: str  # "DELIVERED", "DELAYED", "IN_TRANSIT"
    exception_note: Optional[str] = None
    delay_minutes: Optional[int] = None

# Mock driver shifts for demonstration and role switching
DRIVER_SHIFTS = {
    "DRV-01": {
        "driver_id": "DRV-01",
        "driver_name": "Rahul Sharma",
        "license_number": "MH-04-2022-0094821",
        "vehicle_id": "V-101",
        "vehicle_name": "Tata Prima 5530.S",
        "vehicle_type": "HEAVY_TRUCK",
        "fuel_type": "DIESEL",
        "fuel_level_pct": 88,
        "engine_temp_c": 85.0,
        "odometer_km": 62000.0,
        "health_status": "NORMAL",
        "trip_status": "IN_PROGRESS",
        "assigned_route": {
            "route_id": "RT-V101-OPT",
            "origin_name": "Mumbai Central Logistics Hub",
            "origin_address": "Bhiwandi Logistics Park, NH 160, Mumbai",
            "total_distance_km": 82.5,
            "estimated_fuel_liters": 23.1,
            "carbon_emissions_kg": 61.9,
            "stops": [
                {
                    "sequence": 1,
                    "order_id": "ORD-101",
                    "customer_name": "Apex BioMed South Mumbai",
                    "address": "Colaba Industrial Estate, South Mumbai",
                    "dest_lat": 18.9220,
                    "dest_lng": 72.8347,
                    "eta": "+0h 25m",
                    "weight_kg": 250.0,
                    "priority": "CRITICAL_COLD_CHAIN",
                    "status": "DELIVERED",
                    "delivered_at": "09:45 AM",
                    "delay_minutes": 12,
                    "delay_reason": "Heavy traffic at Sion Flyover during peak hours"
                },
                {
                    "sequence": 2,
                    "order_id": "ORD-102",
                    "customer_name": "PharmaDist Thane West",
                    "address": "Ghoshal Logistics Hub, Thane",
                    "dest_lat": 19.2183,
                    "dest_lng": 72.9781,
                    "eta": "+0h 55m",
                    "weight_kg": 180.0,
                    "priority": "HIGH",
                    "status": "IN_TRANSIT",
                    "delivered_at": None,
                    "delay_minutes": 0,
                    "delay_reason": None
                }
            ]
        }
    },
    "DRV-02": {
        "driver_id": "DRV-02",
        "driver_name": "Amit Varma",
        "license_number": "MH-12-2023-0182743",
        "vehicle_id": "V-102",
        "vehicle_name": "Mahindra Treo Zor EV",
        "vehicle_type": "EV_VAN",
        "fuel_type": "ELECTRIC",
        "fuel_level_pct": 75,
        "engine_temp_c": 62.0,
        "odometer_km": 18500.0,
        "health_status": "NORMAL",
        "trip_status": "IN_PROGRESS",
        "assigned_route": {
            "route_id": "RT-V102-OPT",
            "origin_name": "Navi Mumbai Cargo Distribution Center",
            "origin_address": "JNPT Port Expressway, Navi Mumbai",
            "total_distance_km": 60.0,
            "estimated_fuel_liters": 9.0,
            "carbon_emissions_kg": 0.0,
            "stops": [
                {
                    "sequence": 1,
                    "order_id": "ORD-103",
                    "customer_name": "Reliance Retail Navi Mumbai",
                    "address": "Vashi Sector 17, Navi Mumbai",
                    "dest_lat": 19.0330,
                    "dest_lng": 73.0297,
                    "eta": "+0h 40m",
                    "weight_kg": 320.0,
                    "priority": "HIGH",
                    "status": "PENDING",
                    "delivered_at": None,
                    "delay_minutes": 0,
                    "delay_reason": None
                },
                {
                    "sequence": 2,
                    "order_id": "ORD-105",
                    "customer_name": "Nashik Regional Cargo Depot",
                    "address": "MIDC Satpur, Nashik",
                    "dest_lat": 20.0059,
                    "dest_lng": 73.7898,
                    "eta": "+1h 45m",
                    "weight_kg": 450.0,
                    "priority": "NORMAL",
                    "status": "PENDING",
                    "delivered_at": None,
                    "delay_minutes": 0,
                    "delay_reason": None
                }
            ]
        }
    }
}

@router.get("/me/route", response_model=Dict[str, Any])
def get_driver_active_route(driver_id: str = "DRV-01"):
    shift = DRIVER_SHIFTS.get(driver_id, DRIVER_SHIFTS["DRV-01"])
    return shift

@router.post("/stops/{order_id}/status", response_model=Dict[str, Any])
def update_delivery_stop_status(order_id: str, req: UpdateStopStatusRequest, driver_id: str = "DRV-01"):
    shift = DRIVER_SHIFTS.get(driver_id, DRIVER_SHIFTS["DRV-01"])
    route = shift.get("assigned_route", {})
    stops = route.get("stops", [])

    found = False
    for stop in stops:
        if stop["order_id"] == order_id:
            stop["status"] = req.status
            if req.status == "DELIVERED":
                from datetime import datetime
                stop["delivered_at"] = datetime.now().strftime("%I:%M %p")
            if req.status == "DELAYED":
                stop["delay_minutes"] = req.delay_minutes or 15
                stop["delay_reason"] = req.exception_note or "Unspecified delay"
            if req.exception_note:
                stop["exception_note"] = req.exception_note
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found in driver shift")

    return {
        "status": "SUCCESS",
        "order_id": order_id,
        "new_status": req.status,
        "driver_id": driver_id,
        "updated_stops": stops
    }
