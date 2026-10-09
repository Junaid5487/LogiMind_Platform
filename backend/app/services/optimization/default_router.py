"""Naive baseline route builders used by GET /routes/default.

The optimized pipeline (VRPOptimizer: Clarke-Wright + 2-Opt) is intentionally
untouched — these strategies exist purely to give the UI a "default route" the
user can improve on by pressing "Optimize Route".

Strategies:
  nearest_neighbor — greedy nearest-customer-first from the depot (classic NN)
  sequential       — priority-first insertion order (CRITICAL > HIGH > NORMAL > LOW)
  per_order        — one depot round-trip per order (worst case, biggest savings)

Response shape mirrors VRPOptimizer.solve_vrp() exactly (routes/total_distance_km/
solver_engine/status) with route-level status "DEFAULT".
"""
import math
from typing import Any, Dict, List, Tuple

from app.services.optimization.vrp_solver import haversine_distance_km

STRATEGIES = ("nearest_neighbor", "sequential", "per_order")

STRATEGY_LABELS = {
    "nearest_neighbor": "Nearest-Neighbor baseline (greedy from depot)",
    "sequential": "Sequential entry-order baseline (priority first)",
    "per_order": "One round-trip per order baseline (worst case)",
}

_PRIORITY_RANK = {"CRITICAL_COLD_CHAIN": 0, "HIGH": 1, "NORMAL": 2, "LOW": 3}


def _depot_coords(warehouses: List[Dict]) -> Tuple[float, float]:
    if not warehouses:
        return 19.0760, 72.8777  # legacy default depot (Mumbai)
    depot = warehouses[0]
    lat = depot.get("lat") or depot.get("location_lat") or 19.0760
    lng = depot.get("lng") or depot.get("location_lng") or 72.8777
    return float(lat), float(lng)


def _active_vehicles(vehicles: List[Dict]) -> List[Dict]:
    active = [v for v in vehicles if v.get("status") != "MAINTENANCE"]
    return active if active else list(vehicles)


def _feasible(order: Dict, load_kg: float, stops: int, max_load_kg: float, max_stops: int) -> bool:
    return load_kg + float(order.get("weight_kg", 0.0)) <= max_load_kg and stops < max_stops


def _nearest_neighbor_groups(orders: List[Dict], depot_lat: float, depot_lng: float,
                             max_load_kg: float, max_stops: int) -> List[List[Dict]]:
    remaining = list(orders)
    groups: List[List[Dict]] = []
    current: List[Dict] = []
    load_kg = 0.0
    curr_lat, curr_lng = depot_lat, depot_lng

    while remaining:
        feasible = [o for o in remaining if _feasible(o, load_kg, len(current), max_load_kg, max_stops)]
        if not feasible:
            if current:
                groups.append(current)
                current, load_kg = [], 0.0
                curr_lat, curr_lng = depot_lat, depot_lng
                continue
            # Single oversized order that no vehicle can carry → force it onto its own route
            pick = min(remaining, key=lambda o: haversine_distance_km(curr_lat, curr_lng, o["dest_lat"], o["dest_lng"]))
        else:
            pick = min(feasible, key=lambda o: haversine_distance_km(curr_lat, curr_lng, o["dest_lat"], o["dest_lng"]))

        remaining.remove(pick)
        current.append(pick)
        load_kg += float(pick.get("weight_kg", 0.0))
        curr_lat, curr_lng = pick["dest_lat"], pick["dest_lng"]

    if current:
        groups.append(current)
    return groups

def _sequential_groups(orders: List[Dict], max_load_kg: float, max_stops: int) -> List[List[Dict]]:
    ordered = sorted(orders, key=lambda o: _PRIORITY_RANK.get(o.get("priority", "NORMAL"), 2))
    groups: List[List[Dict]] = []
    current: List[Dict] = []
    load_kg = 0.0

    for order in ordered:
        if current and not _feasible(order, load_kg, len(current), max_load_kg, max_stops):
            groups.append(current)
            current, load_kg = [], 0.0
        current.append(order)
        load_kg += float(order.get("weight_kg", 0.0))

    if current:
        groups.append(current)
    return groups


def build_default_routes(warehouses: List[Dict], orders: List[Dict], vehicles: List[Dict],
                         strategy: str = "nearest_neighbor") -> Dict[str, Any]:
    label = STRATEGY_LABELS.get(strategy, STRATEGY_LABELS["nearest_neighbor"])

    if not orders:
        return {
            "routes": [],
            "total_distance_km": 0.0,
            "status": "NO_ORDERS",
            "message": "Add at least one order to plan routes.",
            "solver_engine": label,
        }
    if not vehicles:
        return {
            "routes": [],
            "total_distance_km": 0.0,
            "status": "NO_VEHICLES",
            "message": "Add at least one vehicle to plan routes.",
            "solver_engine": label,
        }

    active = _active_vehicles(vehicles)
    depot_lat, depot_lng = _depot_coords(warehouses)

    # Same fairness rules as the solver: global capacity ceiling + even stop distribution
    max_load_kg = max((float(v.get("capacity_kg", 1500.0)) for v in active), default=1500.0)
    max_stops = max(1, math.ceil(len(orders) / len(active)))

    if strategy == "sequential":
        groups = _sequential_groups(orders, max_load_kg, max_stops)
    elif strategy == "per_order":
        groups = [[o] for o in orders]
    else:
        groups = _nearest_neighbor_groups(orders, depot_lat, depot_lng, max_load_kg, max_stops)

    routes: List[Dict[str, Any]] = []
    used_route_ids: set = set()
    total_dist_km = 0.0

    for g_idx, group in enumerate(groups):
        v_obj = active[g_idx % len(active)]
        route_id = f"RT-{v_obj['id']}-DEF"
        if route_id in used_route_ids:
            route_id = f"RT-{v_obj['id']}-DEF-{g_idx + 1}"
        used_route_ids.add(route_id)

        curr_lat, curr_lng = depot_lat, depot_lng
        route_dist = 0.0
        stops: List[Dict[str, Any]] = []
        seq = 1
        for order in group:
            route_dist += haversine_distance_km(curr_lat, curr_lng, order["dest_lat"], order["dest_lng"])
            curr_lat, curr_lng = order["dest_lat"], order["dest_lng"]
            eta_mins = int(route_dist / 40.0 * 60)
            stops.append({
                "sequence": seq,
                "order_id": order["id"],
                "customer_name": order.get("customer_name", "Customer"),
                "dest_lat": order["dest_lat"],
                "dest_lng": order["dest_lng"],
                "eta": f"+{eta_mins // 60}h {eta_mins % 60}m",
                "priority": order.get("priority", "NORMAL"),
            })
            seq += 1

        # Return to depot (matches the solver's tour-length definition)
        route_dist += haversine_distance_km(curr_lat, curr_lng, depot_lat, depot_lng)

        dist_km = round(route_dist, 2)
        fuel_multiplier = 0.15 if v_obj.get("fuel_type") == "ELECTRIC" else 0.28
        fuel_liters = round(dist_km * fuel_multiplier, 1)
        carbon_kg = round(fuel_liters * (0.0 if v_obj.get("fuel_type") == "ELECTRIC" else 2.68), 1)

        routes.append({
            "route_id": route_id,
            "vehicle_id": v_obj["id"],
            "vehicle_name": v_obj.get("name", "Vehicle"),
            "driver_id": f"DRV-{(g_idx % len(active)) + 1:02d}",
            "total_distance_km": dist_km,
            "fuel_estimate_liters": fuel_liters,
            "carbon_emissions_kg": carbon_kg,
            "stops": stops,
            "status": "DEFAULT",
        })
        total_dist_km += dist_km

    return {
        "routes": routes,
        "total_distance_km": round(total_dist_km, 2),
        "solver_engine": label,
        "status": "SUCCESS",
    }

