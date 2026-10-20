from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.dependencies.database import get_db_session
from app.db.models import Vehicle, Order, Warehouse, RouteLedger
from app.services.optimization.vrp_solver import VRPOptimizer, vehicle_cost_per_km
from app.services.optimization.default_router import build_default_routes, STRATEGY_LABELS
from app.services.optimization.obstacles import (
    load_obstacles, create_obstacle, resolve_obstacle,
    validate_obstacle_input,
)
from app.api.v1.warehouses import sort_warehouses
from app.api.v1.vehicles import vehicle_telemetry
from app.core.logging import logger
import json
import uuid

router = APIRouter(prefix="/routes", tags=["Routes & VRP Optimization"])


class ObstacleCreateRequest(BaseModel):
    """A driver/manager-reported blockage on a path segment (circle zone)."""

    obstacle_type: str = Field(..., examples=["ACCIDENT"])
    latitude: float
    longitude: float
    radius_km: float = 2.0
    description: Optional[str] = None
    reported_by: Optional[str] = None
    vehicle_id: Optional[str] = None


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
         "capacity_kg": v.capacity_kg, "fuel_type": v.fuel_type, "status": v.status,
         # Telemetry feeds the business-constraint solver: fuel_level_pct drives
         # the gauge-adjusted range guard, failure_risk_pct the risk exclusion.
         **vehicle_telemetry(v.vehicle_id)}
        for v in db.query(Vehicle).order_by(Vehicle.vehicle_id.asc()).all()
    ]
    return warehouses, orders, vehicles


def _fleet_totals(routes: List[Dict[str, Any]]) -> Dict[str, float]:
    """Distance / fuel / CO2 / USD rolled up over a route list."""
    return {
        "distance_km": round(sum(r.get("total_distance_km", 0.0) for r in routes), 2),
        "fuel_liters": round(sum(r.get("fuel_estimate_liters", 0.0) for r in routes), 1),
        "carbon_kg": round(sum(r.get("carbon_emissions_kg", 0.0) for r in routes), 1),
        "cost_usd": round(sum(r.get("cost_usd", 0.0) for r in routes), 2),
    }


def _persist_ledger(db: Session, routes: List[Dict[str, Any]], scope: str,
                    solver_engine: Optional[str]) -> Optional[str]:
    """Write one RouteLedger row per route (audit-only: failures never 500)."""
    run_id = str(uuid.uuid4())
    try:
        for r in routes:
            db.add(RouteLedger(
                run_id=run_id,
                scope=scope,
                route_id=str(r.get("route_id", ""))[:80],
                vehicle_id=r.get("vehicle_id"),
                distance_km=float(r.get("total_distance_km", 0.0) or 0.0),
                fuel_liters=float(r.get("fuel_estimate_liters", 0.0) or 0.0),
                carbon_kg=float(r.get("carbon_emissions_kg", 0.0) or 0.0),
                cost_usd=float(r.get("cost_usd", 0.0) or 0.0),
                solver_engine=solver_engine,
                detail=json.dumps({
                    "stops": len(r.get("stops") or []),
                    "obstacles_avoided": len(r.get("obstacles_avoided") or []),
                    "vehicle_selection_status": (r.get("vehicle_selection") or {}).get("status"),
                }),
            ))
        db.commit()
        return run_id
    except Exception as exc:  # pragma: no cover - defensive (ledger is advisory)
        db.rollback()
        logger.warning(f"Route ledger write skipped: {exc}")
        return None


def _validate_obstacle_payload(obstacle_type: str, radius_km: float) -> str:
    """Normalize/validate the shared fields of an obstacle report."""
    try:
        return validate_obstacle_input(obstacle_type, radius_km)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/obstacles", response_model=List[Dict[str, Any]])
def list_path_obstacles(
    status: str = "ACTIVE",
    db: Session = Depends(get_db_session),
):
    """Driver-reported path obstacles. Default: only ACTIVE blockages.

    ACTIVE obstacles are what the VRP optimizer avoids on its next run.
    """
    if status not in ("ACTIVE", "RESOLVED", "ALL"):
        raise HTTPException(status_code=400, detail="status must be ACTIVE, RESOLVED or ALL.")
    return load_obstacles(db, status=status)


@router.post("/obstacles", response_model=Dict[str, Any])
def report_path_obstacle(req: ObstacleCreateRequest, db: Session = Depends(get_db_session)):
    """Register a blockage (accident, road closure, flooding, …) as a circle zone.

    The next optimization run treats every ACTIVE obstacle as a no-go zone and
    re-sequences routes to keep vehicle legs outside it.
    """
    ob_type = _validate_obstacle_payload(req.obstacle_type, req.radius_km)
    if not (-90.0 <= req.latitude <= 90.0 and -180.0 <= req.longitude <= 180.0):
        raise HTTPException(status_code=400, detail="latitude/longitude out of range.")
    return create_obstacle(
        db,
        obstacle_type=ob_type,
        latitude=req.latitude,
        longitude=req.longitude,
        radius_km=req.radius_km,
        description=req.description,
        reported_by=req.reported_by,
        vehicle_id=req.vehicle_id,
    )


@router.delete("/obstacles/{obstacle_id}", response_model=Dict[str, Any])
def clear_path_obstacle(obstacle_id: str, db: Session = Depends(get_db_session)):
    """Mark a blockage as cleared — the optimizer stops avoiding it."""
    obstacle = resolve_obstacle(db, obstacle_id)
    if obstacle is None:
        raise HTTPException(status_code=404, detail=f"Obstacle {obstacle_id} not found.")
    return {"status": "RESOLVED", "obstacle": obstacle}


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
    # Single-vehicle view: validate the vehicle exists, but build the baseline
    # against the FULL fleet so each vehicle keeps its own distinct tour
    # (solving with one vehicle would hand it every order — the identical
    # routes the UI was showing).
    focus_vehicle_id: Optional[str] = None
    if vehicle_id:
        if not any(v.get("id") == vehicle_id for v in vehicles):
            raise HTTPException(status_code=404, detail=f"Vehicle {vehicle_id} not found.")
        focus_vehicle_id = vehicle_id
    result = build_default_routes(warehouses=warehouses, orders=orders, vehicles=vehicles, strategy=strategy)
    if focus_vehicle_id:
        focused = [r for r in result["routes"] if r.get("vehicle_id") == focus_vehicle_id]
        if not focused:
            return {
                "routes": [],
                "total_distance_km": 0.0,
                "status": "NO_ROUTE",
                "message": f"Vehicle {focus_vehicle_id} has no baseline route (e.g. it is in MAINTENANCE).",
                "solver_engine": result.get("solver_engine", "default"),
            }
        result = {
            **result,
            "routes": focused,
            "total_distance_km": round(sum(r.get("total_distance_km", 0.0) for r in focused), 2),
        }
    return result


@router.post("/optimize", response_model=Dict[str, Any])
def optimize_fleet_routes(
    vehicle_id: Optional[str] = None,
    db: Session = Depends(get_db_session),
):
    """
    Executes the Clarke-Wright Savings heuristic with 2-Opt local search improvement
    to solve the multi-stop vehicle routing problem under capacity constraints.
    Reads the live scenario store (orders/warehouses/vehicles) instead of hardcoded data.

    Pass ``vehicle_id`` (e.g. ``?vehicle_id=V-101``) to return only that vehicle's
    tour from a fleet-wide solve — the solver always runs against the FULL fleet
    so each vehicle keeps its own distinct route (solving with one vehicle would
    hand it every order: the identical tours the UI was showing).

    Every ACTIVE driver-reported obstacle is loaded and treated as a no-go
    zone: legs that would clip a blockage are re-routed via detour waypoints
    and 2-Opt re-sequences stops so the fleet gets a different, obstacle-free
    optimized path. Response includes ``obstacles_considered`` and each route
    carries ``obstacles_avoided`` + obstacle-aware ``geometry``.
    """
    warehouses, orders, vehicles = _load_scenario(db)
    active_obstacles = load_obstacles(db, status="ACTIVE")

    # Validate the vehicle exists, but solve against the FULL fleet so each
    # vehicle keeps its own distinct tour. Slicing happens AFTER the solve.
    focus_vehicle_id: Optional[str] = None
    if vehicle_id:
        if not any(v.get("id") == vehicle_id for v in vehicles):
            raise HTTPException(status_code=404, detail=f"Vehicle {vehicle_id} not found.")
        focus_vehicle_id = vehicle_id

    if not orders:
        return {
            "routes": [],
            "total_distance_km": 0.0,
            "status": "NO_ORDERS",
            "message": "Add at least one order to plan routes.",
            "solver_engine": "Clarke-Wright Savings Algorithm + 2-Opt Local Search",
            "obstacles_considered": len(active_obstacles),
        }
    if not vehicles:
        return {
            "routes": [],
            "total_distance_km": 0.0,
            "status": "NO_VEHICLES",
            "message": "Add at least one vehicle to plan routes.",
            "solver_engine": "Clarke-Wright Savings Algorithm + 2-Opt Local Search",
            "obstacles_considered": len(active_obstacles),
        }

    solver = VRPOptimizer(
        warehouses=warehouses,
        orders=orders,
        vehicles=vehicles,
        obstacles=active_obstacles,
    )
    result = solver.solve_vrp()

    # Fleet-wide savings comparison: same scenario through the naive
    # nearest-neighbor baseline vs the optimized solve — the headline
    # "beats Google Maps" numbers (km, fuel, CO2, USD).
    comparison: Optional[Dict[str, Any]] = None
    naive = build_default_routes(warehouses=warehouses, orders=orders, vehicles=vehicles,
                                 strategy="nearest_neighbor")
    naive_routes = naive.get("routes") or []
    # Baseline routes lack cost_usd — price them with the same fuel-type model.
    for r in naive_routes:
        veh = next((v for v in vehicles if v.get("id") == r.get("vehicle_id")), {})
        r["cost_usd"] = round(r.get("total_distance_km", 0.0) * vehicle_cost_per_km(veh), 2)
    naive_totals = _fleet_totals(naive_routes)
    optimized_totals = _fleet_totals(result.get("routes") or [])

    def _saved_pct(naive_v: float, opt_v: float) -> float:
        return round((naive_v - opt_v) / naive_v * 100.0, 1) if naive_v > 0 else 0.0

    if naive_totals["distance_km"] > 0:
        comparison = {
            "baseline_strategy": STRATEGY_LABELS.get("nearest_neighbor", "Nearest-Neighbor baseline"),
            "naive": naive_totals,
            "optimized": optimized_totals,
            "saved": {
                "distance_km": round(naive_totals["distance_km"] - optimized_totals["distance_km"], 2),
                "fuel_liters": round(naive_totals["fuel_liters"] - optimized_totals["fuel_liters"], 1),
                "carbon_kg": round(naive_totals["carbon_kg"] - optimized_totals["carbon_kg"], 1),
                "cost_usd": round(naive_totals["cost_usd"] - optimized_totals["cost_usd"], 2),
            },
            "saved_pct": {
                "distance": _saved_pct(naive_totals["distance_km"], optimized_totals["distance_km"]),
                "cost": _saved_pct(naive_totals["cost_usd"], optimized_totals["cost_usd"]),
                "carbon": _saved_pct(naive_totals["carbon_kg"], optimized_totals["carbon_kg"]),
            },
        }

    # Cost/carbon ledger: one durable row per optimized route (advisory).
    ledger_run_id = _persist_ledger(db, result.get("routes") or [], scope="OPTIMIZE",
                                    solver_engine=result.get("solver_engine"))
    result = {**result, "comparison": comparison, "ledger_run_id": ledger_run_id}

    if focus_vehicle_id:
        focused = [r for r in result["routes"] if r.get("vehicle_id") == focus_vehicle_id]
        if not focused:
            return {
                "routes": [],
                "total_distance_km": 0.0,
                "status": "NO_ROUTE",
                "message": f"Vehicle {focus_vehicle_id} has no optimized route (e.g. it is in MAINTENANCE).",
                "solver_engine": result.get("solver_engine", "Clarke-Wright Savings Algorithm + 2-Opt Local Search"),
                "obstacles_considered": len(active_obstacles),
                "comparison": comparison,
                "constraint_report": result.get("constraint_report"),
                "ledger_run_id": ledger_run_id,
            }
        # Single-vehicle view: slice routes but keep fleet comparison intact so
        # the banner still shows the whole-fleet savings story.
        return {
            **result,
            "routes": focused,
            "total_distance_km": round(sum(r.get("total_distance_km", 0.0) for r in focused), 2),
            "total_cost_usd": round(sum(r.get("cost_usd", 0.0) for r in focused), 2),
            "total_carbon_kg": round(sum(r.get("carbon_emissions_kg", 0.0) for r in focused), 1),
        }
    return result


@router.get("/ledger", response_model=Dict[str, Any])
def route_cost_ledger(
    limit: int = 50,
    scope: Optional[str] = None,
    db: Session = Depends(get_db_session),
):
    """Cost/carbon ledger: recent route runs + lifetime totals.

    The durable per-route cost/CO2 audit trail behind the UI badges — every
    optimizer / dispatch run appends rows (scope OPTIMIZE / DISPATCH).
    """
    q = db.query(RouteLedger)
    if scope:
        q = q.filter(RouteLedger.scope == scope)
    rows = q.order_by(RouteLedger.created_at.desc()).limit(max(1, min(limit, 500))).all()

    lifetime = db.query(RouteLedger).all()
    entries = [
        {
            "id": row.id,
            "run_id": row.run_id,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "scope": row.scope,
            "route_id": row.route_id,
            "vehicle_id": row.vehicle_id,
            "distance_km": row.distance_km,
            "fuel_liters": row.fuel_liters,
            "carbon_kg": row.carbon_kg,
            "cost_usd": row.cost_usd,
            "solver_engine": row.solver_engine,
            "detail": json.loads(row.detail) if row.detail else None,
        }
        for row in rows
    ]
    return {
        "entries": entries,
        "count": len(entries),
        "totals": {
            "runs": len({r.run_id for r in lifetime}),
            "routes_logged": len(lifetime),
            "distance_km": round(sum(r.distance_km or 0.0 for r in lifetime), 2),
            "fuel_liters": round(sum(r.fuel_liters or 0.0 for r in lifetime), 1),
            "carbon_kg": round(sum(r.carbon_kg or 0.0 for r in lifetime), 1),
            "cost_usd": round(sum(r.cost_usd or 0.0 for r in lifetime), 2),
        },
    }


# ---------------------------------------------------------------------------
# Inventory-aware dispatch: LP rebalance recommendations → VRP transfer trips
# ---------------------------------------------------------------------------

class DispatchTransferRequest(BaseModel):
    """Optional subset of LP recommendations to turn into transfer trips.

    When ``recommendations`` is omitted the endpoint runs the LP rebalance
    itself and dispatches every recommendation it produces.
    """
    recommendations: Optional[List[Dict[str, Any]]] = None


@router.post("/dispatch-transfers", response_model=Dict[str, Any])
def dispatch_inventory_transfers(req: DispatchTransferRequest, db: Session = Depends(get_db_session)):
    """Turn inventory rebalance recommendations into vehicle-ready transfer trips.

    Closed loop: LP says *what* to move between hubs → this endpoint plans
    *how*: each recommendation becomes a transfer order (source hub → dest
    hub, weight = units × 1 kg), the constraint-aware VRP assigns the
    cheapest feasible vehicle per trip, and the cost/carbon ledger records it.
    """
    recommendations = req.recommendations
    lp_status = "PROVIDED"
    if not recommendations:
        # Run the LP ourselves so dispatch works from a single click.
        from app.api.v1.inventory import (
            _warehouse_payload, _inventory_payload, TRANSFER_COST_INR_PER_KM,
        )
        from app.services.optimization.inventory_lp import InventoryLPOptimizer
        lp = InventoryLPOptimizer(
            warehouses=_warehouse_payload(db),
            inventory_data=_inventory_payload(db),
            cost_per_km=TRANSFER_COST_INR_PER_KM,
        )
        lp_result = lp.optimize_rebalance()
        recommendations = lp_result.get("recommendations") or []
        lp_status = lp_result.get("status", "UNKNOWN")

    if not recommendations:
        return {
            "status": "NO_TRANSFERS",
            "message": "Inventory is balanced — no transfer trips to dispatch.",
            "trips": [], "lp_status": lp_status,
            "total_distance_km": 0.0, "total_cost_usd": 0.0, "total_carbon_kg": 0.0,
        }

    warehouses, _, vehicles = _load_scenario(db)
    wh_by_id = {w["id"]: w for w in warehouses}
    active_obstacles = load_obstacles(db, status="ACTIVE")

    missing = [
        r for r in recommendations
        if r.get("from_warehouse_id") not in wh_by_id or r.get("to_warehouse_id") not in wh_by_id
    ]
    if missing:
        raise HTTPException(
            status_code=404,
            detail="Some recommendations reference warehouses unknown to the scenario store.",
        )

    trips: List[Dict[str, Any]] = []
    planned_routes: List[Dict[str, Any]] = []
    constraint_reports: List[Dict[str, Any]] = []
    # One synthetic order per recommendation; depot = that trip's SOURCE hub,
    # so each transfer solves origin → destination directly.
    for i, rec in enumerate(recommendations):
        src = wh_by_id[rec["from_warehouse_id"]]
        dst = wh_by_id[rec["to_warehouse_id"]]
        quantity = int(rec.get("quantity", 0) or 0)
        transfer_orders = [{
            "id": f"TRF-{i + 1}-{rec.get('sku', 'SKU')}",
            "customer_name": f"Transfer → {dst.get('name', 'Destination hub')}",
            "dest_lat": dst.get("lat"),
            "dest_lng": dst.get("lng"),
            "weight_kg": float(quantity),   # 1 unit ≈ 1 kg for dispatch fitting
            "priority": "HIGH",
        }]
        solver = VRPOptimizer(
            warehouses=[src],
            orders=transfer_orders,
            vehicles=vehicles,
            obstacles=active_obstacles,
        )
        result = solver.solve_vrp()
        route = (result.get("routes") or [None])[0]
        if not route:
            continue
        trips.append({
            "recommendation": rec,
            "trip": {
                **route,
                "source_warehouse_id": src["id"],
                "source_warehouse_name": src.get("name"),
                "destination_warehouse_id": dst["id"],
                "destination_warehouse_name": dst.get("name"),
                "sku": rec.get("sku"),
                "quantity": quantity,
            },
        })
        planned_routes.append(route)
        if result.get("constraint_report"):
            constraint_reports.append(result["constraint_report"])

    dispatch_run_id = _persist_ledger(
        db, planned_routes, scope="DISPATCH",
        solver_engine="Clarke-Wright + Business Constraints (transfer dispatch)",
    )

    return {
        "status": "DISPATCHED" if trips else "NO_ROUTE",
        "message": (
            f"{len(trips)} transfer trip(s) planned across {len(recommendations)} recommendation(s)."
            if trips else "No vehicle could serve the requested transfers."
        ),
        "lp_status": lp_status,
        "trips": trips,
        "total_distance_km": round(sum(t["trip"].get("total_distance_km", 0.0) for t in trips), 2),
        "total_cost_usd": round(sum(t["trip"].get("cost_usd", 0.0) for t in trips), 2),
        "total_carbon_kg": round(sum(t["trip"].get("carbon_emissions_kg", 0.0) for t in trips), 1),
        "constraint_report": constraint_reports[0] if constraint_reports else None,
        "ledger_run_id": dispatch_run_id,
    }
