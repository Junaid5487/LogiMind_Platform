from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.dependencies.database import get_db_session
from app.db.models import Vehicle, Order, Warehouse
from app.services.optimization.vrp_solver import VRPOptimizer
from app.services.optimization.default_router import build_default_routes, STRATEGY_LABELS
from app.api.v1.warehouses import sort_warehouses

router = APIRouter(prefix="/routes", tags=["Routes & VRP Optimization"])


def _load_scenario(db: Session):
    """Build solver-ready dicts from the persistent scenario store.

    Ordering is deterministic: seeded hubs first (stable depot), orders in
    creation order, vehicles by id. Status is passed through so MAINTENANCE
    vehicles are excluded from dispatch (solver behavior, unchanged).
    """
    warehouses = [
        {"id": w.warehouse_id, "name": w.warehouse_name, "lat": w.latitude, "lng": w.longitude,
         "city": w.city, "state": w.state, "address": w.address}
        for w in sort_warehouses(db.query(Warehouse).all())
    ]
    orders = [
        {"id": o.order_id, "customer_name": o.customer_name, "dest_lat": o.dest_lat,
         "dest_lng": o.dest_lng, "weight_kg": o.weight_kg, "priority": o.priority}
        for o in db.query(Order).order_by(Order.created_at.asc(), Order.order_id.asc()).all()
    ]
    vehicles = [
        {"id": v.vehicle_id,
         "name": f"{v.brand or ''} {v.model or ''}".strip() or v.vehicle_id,
         "capacity_kg": v.capacity_kg, "fuel_type": v.fuel_type, "status": v.status}
        for v in db.query(Vehicle).order_by(Vehicle.vehicle_id.asc()).all()
    ]
    return warehouses, orders, vehicles


@router.get("/default", response_model=Dict[str, Any])
def default_routes(
    strategy: str = "nearest_neighbor",
    vehicle_id: Optional[str] = None,
    db: Session = Depends(get_db_session),
):
    """Naive baseline route for the current scenario (grey dashed polyline in the UI).

    Pass ``vehicle_id`` to build the baseline for a single vehicle only.
    """
    if strategy not in STRATEGY_LABELS:
        raise HTTPException(status_code=400, detail=f"Unknown strategy '{strategy}'. Use: {', '.join(STRATEGY_LABELS)}.")
    warehouses, orders, vehicles = _load_scenario(db)
    if vehicle_id:
        vehicles = [v for v in vehicles if v.get("id") == vehicle_id]
        if not vehicles:
            raise HTTPException(status_code=404, detail=f"Vehicle {vehicle_id} not found.")
    return build_default_routes(warehouses=warehouses, orders=orders, vehicles=vehicles, strategy=strategy)


@router.post("/optimize", response_model=Dict[str, Any])
def optimize_fleet_routes(
    vehicle_id: Optional[str] = None,
    db: Session = Depends(get_db_session),
):
    """
    Executes the Clarke-Wright Savings heuristic with 2-Opt local search improvement
    to solve the multi-stop vehicle routing problem under capacity constraints.
    Reads the live scenario store (orders/warehouses/vehicles) instead of hardcoded data.

    Pass ``vehicle_id`` (e.g. ``?vehicle_id=V-101``) to optimize a single vehicle's
    tour only — the solver runs with just that vehicle so the map can show one
    differentiated route per vehicle.
    """
    warehouses, orders, vehicles = _load_scenario(db)

    if vehicle_id:
        vehicles = [v for v in vehicles if v.get("id") == vehicle_id]
        if not vehicles:
            raise HTTPException(status_code=404, detail=f"Vehicle {vehicle_id} not found.")

    if not orders:
        return {
            "routes": [],
            "total_distance_km": 0.0,
            "status": "NO_ORDERS",
            "message": "Add at least one order to plan routes.",
            "solver_engine": "Clarke-Wright Savings Algorithm + 2-Opt Local Search",
        }
    if not vehicles:
        return {
            "routes": [],
            "total_distance_km": 0.0,
            "status": "NO_VEHICLES",
            "message": "Add at least one vehicle to plan routes.",
            "solver_engine": "Clarke-Wright Savings Algorithm + 2-Opt Local Search",
        }

    solver = VRPOptimizer(warehouses=warehouses, orders=orders, vehicles=vehicles)
    return solver.solve_vrp()
