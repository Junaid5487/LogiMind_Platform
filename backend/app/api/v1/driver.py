from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
import random

from app.db.models import Driver, Vehicle, Route, Trip, Shipment
from app.dependencies.database import get_db_session
from app.services.optimization.vrp_solver import (
    VRPOptimizer, obstacle_aware_leg, haversine_distance_km,
)
from app.services.optimization.obstacles import (
    load_obstacles, create_obstacle, validate_obstacle_input,
)

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
            "origin_lat": 19.0760,
            "origin_lng": 72.8777,
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
            "origin_lat": 19.0330,
            "origin_lng": 73.0297,
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
def authenticate_driver(driver_name: str) -> Optional[Dict[str, Any]]:
    """Simple driver authentication - username = password = driver_name."""
    for driver_id, shift in DRIVER_SHIFTS.items():
        if shift["driver_name"] == driver_name:
            return shift
    return None


@router.post("/login", response_model=Dict[str, Any])
def driver_login(driver_name: str = Body(...)):
    """Simple driver login - username and password are both the driver name."""
    shift = authenticate_driver(driver_name)
    if not shift:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid driver credentials",
        )
    # Return driver shift data as authenticated session
    return {
        "access_token": driver_name,
        "token_type": "bearer",
        "driver_id": shift["driver_id"],
        "driver_name": shift["driver_name"],
        "vehicle_id": shift.get("vehicle_id"),
        "vehicle_name": shift.get("vehicle_name"),
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


class ObstacleReportRequest(BaseModel):
    """Blockage reported by the driver on their upcoming path segment."""

    obstacle_type: str = Field(..., examples=["ROAD_CLOSED"])
    description: Optional[str] = Field(None, examples=["Overturned truck blocking both lanes"])
    radius_km: float = 2.0
    # Defaults to the mid-point of the driver's current leg when omitted.
    latitude: Optional[float] = None
    longitude: Optional[float] = None


def _chain_distance_km(start: Dict[str, float], stops: List[Dict[str, Any]],
                       obstacles: Optional[List[Dict[str, Any]]]) -> float:
    """Obstacle-aware remaining distance: start → stops in the given order."""
    total = 0.0
    cur_lat, cur_lng = start["lat"], start["lng"]
    for stop in stops:
        dist, _, _ = obstacle_aware_leg(cur_lat, cur_lng, stop["dest_lat"], stop["dest_lng"], obstacles)
        total += dist
        cur_lat, cur_lng = stop["dest_lat"], stop["dest_lng"]
    return total


@router.get("/demo-coordinates", response_model=Dict[str, Any])
def demo_coordinates(driver_id: str = "DRV-01"):
    """Random demo blockage point that lands ON the driver's current path.

    Picks a random leg of the driver's remaining route and a random point
    along that leg (biased to the middle so the circle reliably clips the
    straight path). Every call returns a different point, so clicking the
    demo button repeatedly produces visibly different detours.
    """
    shift = DRIVER_SHIFTS.get(driver_id) or DRIVER_SHIFTS.get("DRV-01")
    if not shift:
        raise HTTPException(status_code=404, detail=f"Driver {driver_id} not found.")
    route = shift.get("assigned_route") or {}
    stops = route.get("stops") or []

    delivered = [s for s in stops if s.get("status") == "DELIVERED"]
    pending = [s for s in stops if s.get("status") != "DELIVERED"]
    if not pending:
        raise HTTPException(status_code=400, detail="No remaining stops to place a demo blockage on.")

    # Walk the remaining path, remembering each leg's start/end.
    cur_lat = delivered[-1]["dest_lat"] if delivered else route.get("origin_lat")
    cur_lng = delivered[-1]["dest_lng"] if delivered else route.get("origin_lng")
    if cur_lat is None or cur_lng is None:
        cur_lat, cur_lng = pending[0]["dest_lat"], pending[0]["dest_lng"]

    legs: List[Dict[str, float]] = []
    for stop in pending:
        legs.append({"a_lat": cur_lat, "a_lng": cur_lng,
                     "b_lat": stop["dest_lat"], "b_lng": stop["dest_lng"]})
        cur_lat, cur_lng = stop["dest_lat"], stop["dest_lng"]

    # Prefer a longer leg so the demo circle is unambiguous.
    leg = max(legs, key=lambda l: haversine_distance_km(l["a_lat"], l["a_lng"], l["b_lat"], l["b_lng"]))
    # Random position along the leg, kept off the very ends (t in 0.2..0.8).
    t = 0.2 + random.random() * 0.6
    lat = leg["a_lat"] + (leg["b_lat"] - leg["a_lat"]) * t
    lng = leg["a_lng"] + (leg["b_lng"] - leg["a_lng"]) * t
    # Tiny random jitter so repeated clicks on the same leg are not identical.
    lat += (random.random() - 0.5) * 0.002
    lng += (random.random() - 0.5) * 0.002

    leg_km = haversine_distance_km(leg["a_lat"], leg["a_lng"], leg["b_lat"], leg["b_lng"])
    return {
        "latitude": round(lat, 6),
        "longitude": round(lng, 6),
        "radius_km": 2.0,
        "leg_distance_km": round(leg_km, 2),
        "position_on_leg": round(t, 2),
        "message": "Demo blockage dropped on the active path segment.",
    }


@router.post("/report-obstacle", response_model=Dict[str, Any])
def report_path_obstacle(
    req: ObstacleReportRequest,
    driver_id: str = "DRV-01",
    db: Session = Depends(get_db_session),
):
    """Driver reports a blockage → optimizer re-routes their remaining stops.

    1. Persists the obstacle as a circle no-go zone (ACTIVE).
    2. Re-solves the VRP for the driver's *undelivered* stops (delivered stops
       stay pinned) with every ACTIVE obstacle as a no-go zone.
    3. Updates the in-memory shift and returns a reroute summary (previous vs
       new stop order, remaining km, obstacles avoided) so the portal can show
       the re-optimized path immediately.
    """
    shift = DRIVER_SHIFTS.get(driver_id) or DRIVER_SHIFTS.get("DRV-01")
    if not shift:
        raise HTTPException(status_code=404, detail=f"Driver {driver_id} not found.")
    route = shift.get("assigned_route") or {}
    stops = route.get("stops") or []
    if not stops:
        raise HTTPException(status_code=400, detail="No active route to re-optimize.")

    delivered = [s for s in stops if s.get("status") == "DELIVERED"]
    pending = [s for s in stops if s.get("status") != "DELIVERED"]
    if not pending:
        raise HTTPException(status_code=400, detail="All stops are delivered — nothing to re-route.")

    try:
        ob_type = validate_obstacle_input(req.obstacle_type, req.radius_km)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Driver's current position: last delivered stop, else the trip origin.
    cur_lat = delivered[-1]["dest_lat"] if delivered else route.get("origin_lat")
    cur_lng = delivered[-1]["dest_lng"] if delivered else route.get("origin_lng")
    if cur_lat is None or cur_lng is None:
        cur_lat, cur_lng = pending[0]["dest_lat"], pending[0]["dest_lng"]

    # Default blockage location: middle of the leg the driver is currently on.
    lat = req.latitude if req.latitude is not None else (cur_lat + pending[0]["dest_lat"]) / 2.0
    lng = req.longitude if req.longitude is not None else (cur_lng + pending[0]["dest_lng"]) / 2.0
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
        raise HTTPException(status_code=400, detail="latitude/longitude out of range.")

    try:
        obstacle = create_obstacle(
            db,
            obstacle_type=ob_type,
            latitude=lat,
            longitude=lng,
            radius_km=req.radius_km,
            description=req.description,
            reported_by=shift.get("driver_id", driver_id),
            vehicle_id=shift.get("vehicle_id"),
        )
    except Exception as exc:  # pragma: no cover - defensive (schema/DB issues)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to persist obstacle: {exc}")

    active_obstacles = load_obstacles(db, status="ACTIVE")
    previous_order = [s["order_id"] for s in pending]
    current_pos = {"lat": cur_lat, "lng": cur_lng}
    previous_remaining_km = _chain_distance_km(current_pos, pending, active_obstacles)
    straight_remaining_km = _chain_distance_km(current_pos, pending, None)

    # Re-optimize only the remaining stops; delivered stops stay pinned.
    vrp_orders = [
        {"id": s["order_id"], "customer_name": s.get("customer_name", "Customer"),
         "dest_lat": s["dest_lat"], "dest_lng": s["dest_lng"],
         "weight_kg": s.get("weight_kg", 5.0), "priority": s.get("priority", "NORMAL")}
        for s in pending
    ]
    solver = VRPOptimizer(
        warehouses=[{"id": "CURRENT_POS", "name": route.get("origin_name", "Current position"),
                     "lat": cur_lat, "lng": cur_lng}],
        orders=vrp_orders,
        vehicles=[{"id": shift.get("vehicle_id", "VEH"),
                   "name": shift.get("vehicle_name", "Vehicle"),
                   "capacity_kg": 99999.0,
                   "fuel_type": shift.get("fuel_type", "DIESEL"),
                   "status": "ACTIVE"}],
        obstacles=active_obstacles,
    )
    result = solver.solve_vrp()
    solved_route = (result.get("routes") or [None])[0]
    if not solved_route:
        raise HTTPException(status_code=500, detail="Re-optimization failed for the remaining stops.")

    new_order = [s["order_id"] for s in solved_route["stops"]]
    eta_by_order = {s["order_id"]: s.get("eta") for s in solved_route["stops"]}
    pending_by_order = {s["order_id"]: s for s in pending}

    # Rebuild: delivered prefix untouched (renumbered), pending in solved order.
    rebuilt: List[Dict[str, Any]] = []
    sequence = 1
    for stop in delivered:
        entry = dict(stop)
        entry["sequence"] = sequence
        rebuilt.append(entry)
        sequence += 1
    for order_id in new_order:
        entry = dict(pending_by_order[order_id])
        entry["sequence"] = sequence
        if eta_by_order.get(order_id):
            entry["eta"] = eta_by_order[order_id]
        rebuilt.append(entry)
        sequence += 1
    route["stops"] = rebuilt
    # Obstacle-aware path for the remaining stops: current position + detour
    # via-points + stops in the new order. The frontend draws this so the
    # driver sees the route physically bend around the blockage.
    route["geometry"] = solved_route.get("geometry") or []
    route["obstacles_avoided"] = solved_route.get("obstacles_avoided") or []
    # The naive straight-line path (no obstacle avoidance) for before/after
    # comparison in the portal.
    route["straight_geometry"] = [
        [cur_lat, cur_lng],
        *[[s["dest_lat"], s["dest_lng"]] for s in pending],
    ]

    # Recompute totals: already-driven head (origin → current) + solved remainder.
    head_km = 0.0
    head_lat = route.get("origin_lat") or cur_lat
    head_lng = route.get("origin_lng") or cur_lng
    for stop in delivered:
        head_km += obstacle_aware_leg(head_lat, head_lng, stop["dest_lat"], stop["dest_lng"], None)[0]
        head_lat, head_lng = stop["dest_lat"], stop["dest_lng"]
    new_total_km = round(head_km + solved_route["total_distance_km"], 1)
    fuel_multiplier = 0.15 if shift.get("fuel_type") == "ELECTRIC" else 0.28
    route["total_distance_km"] = new_total_km
    route["estimated_fuel_liters"] = round(new_total_km * fuel_multiplier, 1)
    route["carbon_emissions_kg"] = round(
        route["estimated_fuel_liters"] * (0.0 if shift.get("fuel_type") == "ELECTRIC" else 2.68), 1
    )
    route["last_reroute_at"] = obstacle.get("created_at")

    avoided = solved_route.get("obstacles_avoided") or []
    return {
        "status": "SUCCESS",
        "driver_id": shift.get("driver_id", driver_id),
        "obstacle": obstacle,
        "reroute": {
            "previous_order": previous_order,
            "new_order": new_order,
            "stops_resequenced": previous_order != new_order,
            "straight_remaining_km": round(straight_remaining_km, 2),
            "previous_remaining_km": round(previous_remaining_km, 2),
            "new_remaining_km": round(solved_route["total_distance_km"], 2),
            "obstacles_avoided": avoided,
            "solver_engine": result.get("solver_engine"),
            "message": (
                f"Remaining stops re-optimized around {len(avoided)} reported "
                f"blockage(s) across {len(pending)} pending stop(s)."
            ),
        },
        "updated_shift": shift,
    }

# Role-based credentials
CREDENTIALS = {
    'administrator': {'role': 'ADMIN', 'permissions': ['read', 'write', 'delete', 'manage_users']},
    'fleetmanager': {'role': 'FLEET_MANAGER', 'permissions': ['read', 'write', 'manage_vehicles', 'view_reports']},
    'warehousemanager': {'role': 'WAREHOUSE_MANAGER', 'permissions': ['read', 'write', 'manage_inventory', 'view_warehouse']},
}
