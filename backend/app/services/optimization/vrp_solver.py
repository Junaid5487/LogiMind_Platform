import math
from typing import Any, Dict, List, Optional, Tuple

EARTH_RADIUS_KM = 6371.0
# Detour clearance kept around a reported blockage (radius * margin).
OBSTACLE_CLEARANCE_MARGIN = 1.15


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# ---------------------------------------------------------------------------
# Obstacle-aware leg geometry
# ---------------------------------------------------------------------------
# Driver-reported blockages are circles (center lat/lng + radius_km). A leg
# (straight segment between depot / stops) that clips a blockage is re-routed
# through a detour via-point on the obstacle's inflated boundary, so both
# Clarke-Wright savings and 2-Opt automatically prefer stop sequences whose
# legs stay clear of reported obstacles.

def _segment_hits_circle(
    ax: float, ay: float, bx: float, by: float,
    cx: float, cy: float, r: float,
) -> bool:
    """True when segment A→B (local km frame) enters the disk (C, r)."""
    if (ax - cx) ** 2 + (ay - cy) ** 2 <= r * r:
        return True
    if (bx - cx) ** 2 + (by - cy) ** 2 <= r * r:
        return True
    dx, dy = bx - ax, by - ay
    seg_len2 = dx * dx + dy * dy
    if seg_len2 == 0.0:
        return False
    t = ((cx - ax) * dx + (cy - ay) * dy) / seg_len2
    if t < 0.0 or t > 1.0:
        return False
    px, py = ax + t * dx, ay + t * dy
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r


def _escape_via_xy(
    inside_x: float, inside_y: float,
    other_x: float, other_y: float,
    cx: float, cy: float, r: float,
) -> Tuple[float, float]:
    """Boundary point that leads out of the disk, away from the obstacle center."""
    ex, ey = inside_x - cx, inside_y - cy
    norm = math.hypot(ex, ey)
    if norm < 1e-9:  # exactly at the center — escape toward the other endpoint
        ex, ey = other_x - cx, other_y - cy
        norm = math.hypot(ex, ey) or 1.0
    return cx + r * ex / norm, cy + r * ey / norm


def _detour_via_xy(
    ax: float, ay: float, bx: float, by: float,
    cx: float, cy: float, r: float,
) -> Tuple[float, float, float]:
    """Pick the shorter of the two boundary detours around disk (C, r).

    Returns (via_x, via_y, t) where t is the via's projection along A→B so
    multiple detours on one leg can be chained in travel order. When an
    endpoint sits inside the disk the via pushes straight out to the boundary
    (t=0 at the start, t=1 at the end).
    """
    if (ax - cx) ** 2 + (ay - cy) ** 2 <= r * r:
        vx, vy = _escape_via_xy(ax, ay, bx, by, cx, cy, r)
        return vx, vy, 0.0
    if (bx - cx) ** 2 + (by - cy) ** 2 <= r * r:
        vx, vy = _escape_via_xy(bx, by, ax, ay, cx, cy, r)
        return vx, vy, 1.0

    # Two candidates: midpoints of the short/long arcs A→B around the circle.
    ang_a = math.atan2(ay - cy, ax - cx)
    ang_b = math.atan2(by - cy, bx - cx)
    delta = ang_b - ang_a
    while delta > math.pi:
        delta -= 2.0 * math.pi
    while delta < -math.pi:
        delta += 2.0 * math.pi
    mid_short = ang_a + delta / 2.0
    mid_long = mid_short + (math.pi if delta <= 0.0 else -math.pi)

    best: Optional[Tuple[float, float]] = None
    best_cost = float("inf")
    for ang in (mid_short, mid_long):
        vx = cx + r * math.cos(ang)
        vy = cy + r * math.sin(ang)
        cost = math.hypot(vx - ax, vy - ay) + math.hypot(vx - bx, vy - by)
        if cost < best_cost:
            best = (vx, vy)
            best_cost = cost
    vx, vy = best  # type: ignore[misc]
    # Project onto A→B for ordering chained detours.
    dx, dy = bx - ax, by - ay
    seg_len2 = dx * dx + dy * dy
    t = ((vx - ax) * dx + (vy - ay) * dy) / seg_len2 if seg_len2 > 0.0 else 0.0
    return vx, vy, max(0.0, min(1.0, t))

def _obstacle_coords(ob: Any) -> Tuple[Optional[float], Optional[float]]:
    """Resolve an obstacle's (lat, lng) from either naming convention.

    ``dict.get(key, fallback)`` only falls back when the key is ABSENT, so a
    present-but-None ``latitude`` would mask a valid ``lat`` alias. Both keys
    are therefore resolved explicitly, and unusable entries return
    ``(None, None)`` so callers can skip them.
    """
    if not ob or not isinstance(ob, dict):
        return None, None
    lat = ob.get("latitude")
    if lat is None:
        lat = ob.get("lat")
    lng = ob.get("longitude")
    if lng is None:
        lng = ob.get("lng")
    if lat is None or lng is None:
        return None, None
    try:
        return float(lat), float(lng)
    except (TypeError, ValueError):
        return None, None


def obstacle_aware_leg(
    lat1: float, lng1: float, lat2: float, lng2: float,
    obstacles: Optional[List[Dict[str, Any]]],
) -> Tuple[float, List[Tuple[float, float]], List[str]]:
    """Distance for one leg A→B avoiding reported blockage circles.

    Returns ``(distance_km, via_points, avoided_ids)`` where ``via_points``
    are detour waypoints (lat/lng) between A and B, and ``avoided_ids`` are
    the obstacle ids this leg had to steer around. With no obstacles (or a
    zero-length leg) this reduces to plain haversine, so behavior without
    driver reports is identical to the original solver.
    """
    base = haversine_distance_km(lat1, lng1, lat2, lng2)
    if not obstacles or base == 0.0:
        return base, [], []

    # Local equirectangular frame (km) around the leg midpoint — accurate at
    # the city/regional scale this solver operates on.
    lat_ref = (lat1 + lat2) / 2.0
    lng_ref = (lng1 + lng2) / 2.0
    cos_ref = math.cos(math.radians(lat_ref)) or 1e-9

    def to_xy(lat: float, lng: float) -> Tuple[float, float]:
        x = math.radians(lng - lng_ref) * cos_ref * EARTH_RADIUS_KM
        y = math.radians(lat - lat_ref) * EARTH_RADIUS_KM
        return x, y

    def to_latlng(x: float, y: float) -> Tuple[float, float]:
        lat = lat_ref + math.degrees(y / EARTH_RADIUS_KM)
        lng = lng_ref + math.degrees(x / (EARTH_RADIUS_KM * cos_ref))
        return lat, lng

    ax, ay = to_xy(lat1, lng1)
    bx, by = to_xy(lat2, lng2)

    detours: List[Tuple[float, Tuple[float, float], str]] = []
    for ob in obstacles:
        ob_lat, ob_lng = _obstacle_coords(ob)
        if ob_lat is None or ob_lng is None:
            continue
        radius = float(ob.get("radius_km", 0.0) or 0.0)
        if radius <= 0.0:
            continue
        r_eff = radius * OBSTACLE_CLEARANCE_MARGIN
        cx, cy = to_xy(ob_lat, ob_lng)
        if not _segment_hits_circle(ax, ay, bx, by, cx, cy, r_eff):
            continue
        vx, vy, t = _detour_via_xy(ax, ay, bx, by, cx, cy, r_eff)
        ob_id = str(ob.get("obstacle_id") or ob.get("id") or "")
        detours.append((t, (vx, vy), ob_id))

    if not detours:
        return base, [], []

    # Chain the detour via-points in travel order along the leg.
    detours.sort(key=lambda item: item[0])
    waypoints: List[Tuple[float, float]] = [(ax, ay)]
    waypoints.extend(via for _, via, _ in detours)
    waypoints.append((bx, by))

    chain_km = 0.0
    latlng_pts = [to_latlng(pt[0], pt[1]) for pt in waypoints]
    for i in range(len(latlng_pts) - 1):
        p_lat, p_lng = latlng_pts[i]
        q_lat, q_lng = latlng_pts[i + 1]
        chain_km += haversine_distance_km(p_lat, p_lng, q_lat, q_lng)

    via_latlng = latlng_pts[1:-1]
    avoided_ids = [ob_id for _, _, ob_id in detours if ob_id]
    return chain_km, via_latlng, avoided_ids


# ---------------------------------------------------------------------------
# Business-constraint routing: cost / range / risk model
# ---------------------------------------------------------------------------
# Real constraints that map-planner style routing ignores: payload capacity,
# gauge-adjusted EV/fuel range, and vehicle health risk. Costs reuse the
# consumptions already baked into the solver (0.28 L/km diesel, 0.15 kWh/km EV),
# so per-route cost, the fleet ledger and the cheapest-feasible-vehicle choice
# all agree on one number.
DIESEL_USD_PER_LITER = 1.60
ELECTRICITY_USD_PER_KWH = 0.15
DIESEL_LITERS_PER_KM = 0.28
ELECTRIC_KWH_PER_KM = 0.15
DIESEL_FULL_TANK_RANGE_KM = 800.0
EV_FULL_CHARGE_RANGE_KM = 300.0
# Vehicles reporting this failure risk (or worse) are pulled from dispatch.
FAILURE_RISK_EXCLUDE_PCT = 70.0


def vehicle_cost_per_km(vehicle: Dict[str, Any]) -> float:
    """Operating cost in USD/km — electricity is far cheaper per km than diesel."""
    if str(vehicle.get("fuel_type", "")).upper() == "ELECTRIC":
        return round(ELECTRIC_KWH_PER_KM * ELECTRICITY_USD_PER_KWH, 4)
    return round(DIESEL_LITERS_PER_KM * DIESEL_USD_PER_LITER, 4)


def vehicle_usable_range_km(vehicle: Dict[str, Any]) -> float:
    """Gauge-adjusted range: full-tank/full-charge range scaled by fuel level.

    An explicit ``range_km`` on the vehicle dict (dispatch endpoint) wins over
    the fuel-type default.
    """
    explicit = vehicle.get("range_km")
    if explicit:
        return float(explicit)
    full = (EV_FULL_CHARGE_RANGE_KM
            if str(vehicle.get("fuel_type", "")).upper() == "ELECTRIC"
            else DIESEL_FULL_TANK_RANGE_KM)
    level = float(vehicle.get("fuel_level_pct", 100) or 100)
    level = min(max(level, 0.0), 100.0)
    return round(full * level / 100.0, 1)


def constraint_violations(vehicle: Dict[str, Any], load_kg: float, tour_km: float) -> List[str]:
    """Why ``vehicle`` cannot take a tour carrying ``load_kg`` over ``tour_km``.

    Returns an empty list when the vehicle is feasible for the tour.
    """
    reasons: List[str] = []
    if str(vehicle.get("status", "")).upper() == "MAINTENANCE":
        reasons.append("status MAINTENANCE")
    capacity = float(vehicle.get("capacity_kg", 1500.0) or 1500.0)
    if load_kg > capacity + 1e-6:
        reasons.append(f"load {load_kg:.0f} kg > capacity {capacity:.0f} kg")
    usable = vehicle_usable_range_km(vehicle)
    if tour_km > usable + 1e-6:
        reasons.append(f"tour {tour_km:.0f} km > usable range {usable:.0f} km")
    risk = float(vehicle.get("failure_risk_pct", 0) or 0)
    if risk >= FAILURE_RISK_EXCLUDE_PCT:
        reasons.append(f"failure risk {risk:.0f}% >= {FAILURE_RISK_EXCLUDE_PCT:.0f}%")
    return reasons


class VRPOptimizer:
    def __init__(self, warehouses: List[Dict], orders: List[Dict], vehicles: List[Dict],
                 obstacles: Optional[List[Dict]] = None):
        self.warehouses = warehouses
        self.orders = orders
        self.vehicles = vehicles
        # Driver-reported blockages; RESOLVED rows are ignored defensively
        # even if a caller passes an unfiltered list. Null entries and rows
        # without usable coordinates are dropped here so nothing downstream
        # (detour maths, summaries, API payloads) can read a null `.latitude`.
        self.obstacles = [
            ob for ob in (obstacles or [])
            if ob and isinstance(ob, dict)
            and str(ob.get("status", "ACTIVE")).upper() != "RESOLVED"
            and _obstacle_coords(ob)[0] is not None
        ]
        # Filled by solve_vrp(): vehicles dropped before assignment + why.
        self.excluded_vehicles: List[Dict[str, Any]] = []

    def solve_vrp(self) -> Dict[str, Any]:
        if not self.orders or not self.vehicles:
            return {"routes": [], "total_distance_km": 0.0, "status": "NO_ORDERS"}

        # Business-constraint pre-filter: maintenance units and vehicles over
        # the failure-risk threshold are pulled from dispatch BEFORE assignment
        # (per-route capacity/range feasibility is checked at assignment time).
        self.excluded_vehicles = []
        eligible = []
        for v in self.vehicles:
            if v.get("status") == "MAINTENANCE":
                # Kept out of assignment; recorded so the UI can explain it.
                self.excluded_vehicles.append(
                    {"vehicle_id": v.get("id"), "vehicle_name": v.get("name", "Vehicle"),
                     "reasons": ["status MAINTENANCE"]})
                continue
            risk = float(v.get("failure_risk_pct", 0) or 0)
            if risk >= FAILURE_RISK_EXCLUDE_PCT:
                self.excluded_vehicles.append(
                    {"vehicle_id": v.get("id"), "vehicle_name": v.get("name", "Vehicle"),
                     "reasons": [f"failure risk {risk:.0f}% >= {FAILURE_RISK_EXCLUDE_PCT:.0f}%"]})
                continue
            eligible.append(v)

        if eligible:
            self.active_vehicles = eligible
        else:
            # Every vehicle hit a hard filter — fall back to the raw fleet so
            # the optimizer still produces *some* plan instead of nothing.
            self.active_vehicles = self.vehicles
            self.excluded_vehicles = []

        return self._solve_clarke_wright_2opt()

    # -- Obstacle-aware edge cost -------------------------------------------
    def _leg_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Edge cost for savings/2-Opt: detoured around active blockages."""
        return obstacle_aware_leg(lat1, lng1, lat2, lng2, self.obstacles)[0]

    def _leg_detail(self, lat1: float, lng1: float, lat2: float, lng2: float):
        """Full leg result (distance, detour vias, avoided obstacle ids)."""
        return obstacle_aware_leg(lat1, lng1, lat2, lng2, self.obstacles)

    def _obstacle_summary(self, obstacle_ids: List[str]) -> List[Dict[str, Any]]:
        """Compact per-route record of the blockages a route steers around."""
        by_id = {
            str(ob.get("obstacle_id") or ob.get("id") or ""): ob
            for ob in self.obstacles
            if ob
        }
        out = []
        for oid in obstacle_ids:
            ob = by_id.get(oid)
            if not ob:
                continue
            # `dict.get(key, fallback)` only falls back when the key is ABSENT —
            # a present-but-None value would leak a null coordinate into the
            # response and crash clients that read `.latitude` directly.
            latitude, longitude = _obstacle_coords(ob)
            if latitude is None or longitude is None:
                # Nothing usable to draw — skip rather than emit a null point.
                continue
            radius_km = ob.get("radius_km")
            if radius_km is None:
                radius_km = 0.0
            out.append({
                "obstacle_id": oid,
                "obstacle_type": ob.get("obstacle_type") or "OTHER",
                "latitude": latitude,
                "longitude": longitude,
                "radius_km": radius_km,
            })
        return out

    def _solve_clarke_wright_2opt(self) -> Dict[str, Any]:
        depot = self.warehouses[0] if self.warehouses else {"lat": 19.0760, "lng": 72.8777}
        depot_lat = depot.get("lat") or depot.get("location_lat", 19.0760)
        depot_lng = depot.get("lng") or depot.get("location_lng", 72.8777)
        # Human-readable depot (start) location for the VRP summary cards.
        depot_name = depot.get("name") or "Mumbai Central Logistics Hub"
        depot_city = depot.get("city") or "Mumbai"
        depot_state = depot.get("state") or "MH"
        depot_address = depot.get("address") or "Bhiwandi Logistics Park, NH 160"
        start_location = {
            "name": depot_name,
            "city": depot_city,
            "state": depot_state,
            "address": depot_address,
            "lat": depot_lat,
            "lng": depot_lng,
            "label": f"{depot_name}, {depot_city}" + (f" ({depot_state})" if depot_state else ""),
        }

        num_orders = len(self.orders)
        if num_orders == 0:
            return {"routes": [], "total_distance_km": 0.0, "status": "NO_ORDERS"}

        # 1. Compute Distance from Depot to each order location
        #    (obstacle-aware: legs clipping a reported blockage pay the detour)
        depot_dists = [
            self._leg_distance(depot_lat, depot_lng, o["dest_lat"], o["dest_lng"])
            for o in self.orders
        ]

        # 2. Compute Inter-Order Distance Matrix (symmetric, obstacle-aware)
        dist_matrix = []
        for i in range(num_orders):
            row = []
            for j in range(num_orders):
                if i == j:
                    row.append(0.0)
                elif j < i:
                    row.append(dist_matrix[j][i])
                else:
                    d = self._leg_distance(
                        self.orders[i]["dest_lat"], self.orders[i]["dest_lng"],
                        self.orders[j]["dest_lat"], self.orders[j]["dest_lng"],
                    )
                    row.append(d)
            dist_matrix.append(row)

        # 3. Calculate Clarke-Wright Savings S_ij = d(0, i) + d(0, j) - d(i, j)
        savings = []
        for i in range(num_orders):
            for j in range(i + 1, num_orders):
                s_val = depot_dists[i] + depot_dists[j] - dist_matrix[i][j]
                savings.append((s_val, i, j))

        # Sort savings in descending order
        savings.sort(key=lambda x: x[0], reverse=True)

        # 4. Initialize individual routes (Depot -> i -> Depot)
        routes = [[i] for i in range(num_orders)]

        def find_route(idx):
            for r in routes:
                if idx in r:
                    return r
            return None

        # 5. Merge routes based on Clarke-Wright savings and vehicle capacity constraints
        num_vehicles = len(self.active_vehicles)
        min_capacity = min((v.get("capacity_kg", 1500.0) for v in self.active_vehicles), default=1500.0)
        max_stops_per_veh = max(1, math.ceil(num_orders / num_vehicles))
        merge_stop_cap = max_stops_per_veh + 1

        for s_val, i, j in savings:
            r_i = find_route(i)
            r_j = find_route(j)

            if r_i is not None and r_j is not None and r_i != r_j:
                if (r_i[-1] == i or r_i[0] == i) and (r_j[0] == j or r_j[-1] == j):
                    if r_i[0] == i:
                        r_i.reverse()
                    if r_j[-1] == j:
                        r_j.reverse()

                    combined_orders = r_i + r_j
                    combined_weight = sum(self.orders[idx].get("weight_kg", 5.0) for idx in combined_orders)

                    if (len(routes) > num_vehicles
                            and combined_weight <= min_capacity
                            and len(combined_orders) <= merge_stop_cap):
                        routes.remove(r_i)
                        routes.remove(r_j)
                        routes.append(combined_orders)

        # 5b. Split oversized tours so every active vehicle gets its own route.
        final_routes: List[List[int]] = []
        for r in routes:
            room = num_vehicles - (len(routes) - 1) - len(final_routes)
            if len(r) > merge_stop_cap and room > 1:
                head, tail = r[:merge_stop_cap], r[merge_stop_cap:]
                final_routes.append(head)
                while tail and (num_vehicles - (len(routes) - 1) - len(final_routes)) > 0:
                    final_routes.append(tail[:merge_stop_cap])
                    tail = tail[merge_stop_cap:]
                if tail:
                    final_routes[-1].extend(tail)
            else:
                final_routes.append(r)
        routes = final_routes

        # 6. Apply 2-Opt Local Search to each merged route
        optimized_routes = []
        for r in routes:
            optimized_r = self._apply_2opt(r, depot_lat, depot_lng, dist_matrix, depot_dists)
            optimized_routes.append(optimized_r)

        # 7. Assign optimized routes to vehicles under business constraints:
        #    payload capacity, gauge-adjusted range and health risk screen the
        #    unassigned pool, then the CHEAPEST feasible vehicle gets the tour.
        def _route_load(order_indices: List[int]) -> float:
            return sum(float(self.orders[i].get("weight_kg", 5.0)) for i in order_indices)

        def _route_tour_km(order_indices: List[int]) -> float:
            # Obstacle-aware tour length (depot → stops, no return leg — same
            # definition the stop builder below uses for total_distance_km).
            if not order_indices:
                return 0.0
            d = depot_dists[order_indices[0]]
            for a, b in zip(order_indices, order_indices[1:]):
                d += dist_matrix[a][b]
            return d

        assigned_routes = []
        total_dist_km = 0.0
        pool = list(self.active_vehicles)
        vehicle_by_id = {v.get("id"): v for v in self.active_vehicles}

        for v_idx, order_indices in enumerate(optimized_routes):
            load_kg = _route_load(order_indices)
            tour_km = _route_tour_km(order_indices)

            if not pool:
                if assigned_routes:
                    target_route = assigned_routes[-1]
                    # Overflow tour: append to the route whose vehicle we already
                    # assigned (NOT a positional guess — selection is no longer
                    # sequential), so fuel/cost recalculation uses the right type.
                    v_obj = vehicle_by_id.get(target_route.get("vehicle_id")) or self.active_vehicles[-1]
                    seq = len(target_route["stops"]) + 1
                    curr_lat = target_route["stops"][-1]["dest_lat"] if target_route["stops"] else depot_lat
                    curr_lng = target_route["stops"][-1]["dest_lng"] if target_route["stops"] else depot_lng
                    extra_dist = 0.0
                    if "geometry" not in target_route:
                        # Rebuild the path from depot + existing stops so the
                        # appended detours chain onto a complete polyline.
                        target_route["geometry"] = (
                            [[depot_lat, depot_lng]] +
                            [[s["dest_lat"], s["dest_lng"]] for s in target_route["stops"]]
                        )
                    target_route.setdefault("obstacles_avoided", [])
                    known_avoided = {a.get("obstacle_id") for a in target_route["obstacles_avoided"]}

                    for idx in order_indices:
                        order = self.orders[idx]
                        step_d, vias, leg_avoided = self._leg_detail(curr_lat, curr_lng, order["dest_lat"], order["dest_lng"])
                        extra_dist += step_d
                        for (v_lat, v_lng) in vias:
                            target_route["geometry"].append([v_lat, v_lng])
                        for ob_id in leg_avoided:
                            if ob_id and ob_id not in known_avoided:
                                known_avoided.add(ob_id)
                                target_route["obstacles_avoided"].extend(
                                    self._obstacle_summary([ob_id])
                                )
                        curr_lat, curr_lng = order["dest_lat"], order["dest_lng"]
                        target_route["geometry"].append([order["dest_lat"], order["dest_lng"]])
                        eta_mins = int((target_route["total_distance_km"] + extra_dist) / 40.0 * 60)
                        target_route["stops"].append({
                            "sequence": seq,
                            "order_id": order["id"],
                            "customer_name": order.get("customer_name", "Customer"),
                            "dest_lat": order["dest_lat"],
                            "dest_lng": order["dest_lng"],
                            "eta": f"+{eta_mins // 60}h {eta_mins % 60}m",
                            "priority": order.get("priority", "NORMAL")
                        })
                        seq += 1

                    target_route["total_distance_km"] = round(target_route["total_distance_km"] + extra_dist, 2)
                    fuel_mult = 0.15 if v_obj.get("fuel_type") == "ELECTRIC" else 0.28
                    target_route["fuel_estimate_liters"] = round(target_route["total_distance_km"] * fuel_mult, 1)
                    target_route["carbon_emissions_kg"] = round(target_route["fuel_estimate_liters"] * (0.0 if v_obj.get("fuel_type") == "ELECTRIC" else 2.68), 1)
                    # Overflow stops change the tour length → refresh ledger cost.
                    target_route["cost_usd"] = round(target_route["total_distance_km"] * vehicle_cost_per_km(v_obj), 2)
                    sel = target_route.get("vehicle_selection")
                    if isinstance(sel, dict):
                        sel["tour_distance_km"] = target_route["total_distance_km"]
                        sel["estimated_cost_usd"] = target_route["cost_usd"]
                    # Keep the fleet accumulator in sync with the grown route
                    # (the old code dropped extra_dist from the total).
                    total_dist_km += extra_dist
                    # Refresh end location after overflow stops were appended.
                    if target_route["stops"]:
                        last = target_route["stops"][-1]
                        target_route["end_location"] = {
                            "name": last.get("customer_name", "Customer"),
                            "order_id": last.get("order_id"),
                            "lat": last.get("dest_lat"),
                            "lng": last.get("dest_lng"),
                            "eta": last.get("eta"),
                            "sequence": last.get("sequence"),
                            "label": f"{last.get('customer_name', 'Customer')} ({last.get('order_id', '')})".strip(),
                        }
                continue

            # Screen the unassigned pool: capacity, gauge-adjusted range, risk.
            rejected: List[Dict[str, Any]] = []
            feasible: List[Dict[str, Any]] = []
            for cand in pool:
                violations = constraint_violations(cand, load_kg, tour_km)
                if violations:
                    rejected.append({
                        "vehicle_id": cand.get("id"),
                        "vehicle_name": cand.get("name", "Vehicle"),
                        "reasons": violations,
                    })
                else:
                    feasible.append(cand)

            if feasible:
                # Cheapest feasible vehicle wins (EVs undercut diesel ~12x/km).
                v_obj = min(feasible, key=vehicle_cost_per_km)
                selection_reason = f"cheapest of {len(feasible)} feasible vehicle(s)"
                constraint_status = "FEASIBLE"
            else:
                # Nothing fully feasible — least-violating fallback keeps the
                # tour served (existing behavior) but is flagged in the route.
                # Rank by violation count, then how badly the range is
                # overshoot (tour ÷ usable range), then cost — so the EV never
                # draws a 3,700 km haul a diesel truck can half-cover.
                def _fallback_rank(c: Dict[str, Any]) -> Any:
                    v_count = len(constraint_violations(c, load_kg, tour_km))
                    usable = max(vehicle_usable_range_km(c), 1e-6)
                    overshoot = tour_km / usable if tour_km > usable else 0.0
                    return (v_count, round(overshoot, 3), vehicle_cost_per_km(c))

                v_obj = min(pool, key=_fallback_rank)
                fallback_reasons = constraint_violations(v_obj, load_kg, tour_km)
                rejected = [r for r in rejected if r["vehicle_id"] != v_obj.get("id")]
                selection_reason = "no fully feasible vehicle — best-effort assignment"
                constraint_status = "VIOLATED"
            pool.remove(v_obj)

            route_stops = []
            curr_lat, curr_lng = depot_lat, depot_lng
            route_dist = 0.0
            seq = 1
            # Obstacle-aware path: depot + detour via-points + stops in order.
            path_geometry: List[List[float]] = [[depot_lat, depot_lng]]
            avoided_ids: List[str] = []

            for idx in order_indices:
                order = self.orders[idx]
                step_d, vias, leg_avoided = self._leg_detail(curr_lat, curr_lng, order["dest_lat"], order["dest_lng"])
                route_dist += step_d
                for (v_lat, v_lng) in vias:
                    path_geometry.append([v_lat, v_lng])
                for ob_id in leg_avoided:
                    if ob_id not in avoided_ids:
                        avoided_ids.append(ob_id)
                curr_lat, curr_lng = order["dest_lat"], order["dest_lng"]
                path_geometry.append([order["dest_lat"], order["dest_lng"]])

                eta_mins = int(route_dist / 40.0 * 60)
                route_stops.append({
                    "sequence": seq,
                    "order_id": order["id"],
                    "customer_name": order.get("customer_name", "Customer"),
                    "dest_lat": order["dest_lat"],
                    "dest_lng": order["dest_lng"],
                    "eta": f"+{eta_mins // 60}h {eta_mins % 60}m",
                    "priority": order.get("priority", "NORMAL")
                })
                seq += 1

            dist_km = round(route_dist, 2)

            fuel_multiplier = 0.15 if v_obj.get("fuel_type") == "ELECTRIC" else 0.28
            fuel_liters = round(dist_km * fuel_multiplier, 1)
            carbon_kg = round(fuel_liters * (0.0 if v_obj.get("fuel_type") == "ELECTRIC" else 2.68), 1)
            cost_usd = round(dist_km * vehicle_cost_per_km(v_obj), 2)

            last_stop = route_stops[-1] if route_stops else None
            assigned_routes.append({
                "route_id": f"RT-{v_obj['id']}-OPT",
                "vehicle_id": v_obj["id"],
                "vehicle_name": v_obj.get("name", "Vehicle"),
                "driver_id": f"DRV-{v_idx+1:02d}",
                "total_distance_km": dist_km,
                "fuel_estimate_liters": fuel_liters,
                "carbon_emissions_kg": carbon_kg,
                "cost_usd": cost_usd,
                # Business-constraint audit for this assignment: why THIS truck,
                # which candidates were screened out and for what.
                "vehicle_selection": {
                    "status": constraint_status,
                    "reason": selection_reason,
                    "load_kg": round(load_kg, 1),
                    "capacity_kg": v_obj.get("capacity_kg", 1500.0),
                    "tour_distance_km": round(tour_km, 2),
                    "usable_range_km": vehicle_usable_range_km(v_obj),
                    "fuel_type": v_obj.get("fuel_type", "DIESEL"),
                    "cost_per_km_usd": vehicle_cost_per_km(v_obj),
                    "estimated_cost_usd": cost_usd,
                    "failure_risk_pct": v_obj.get("failure_risk_pct", 0),
                    "rejected_candidates": rejected,
                },
                "stops": route_stops,
                "status": "OPTIMIZED",
                "geometry": path_geometry,
                "obstacles_avoided": self._obstacle_summary(avoided_ids),
                "start_location": dict(start_location),
                "end_location": {
                    "name": last_stop.get("customer_name", "Customer") if last_stop else None,
                    "order_id": last_stop.get("order_id") if last_stop else None,
                    "lat": last_stop.get("dest_lat") if last_stop else None,
                    "lng": last_stop.get("dest_lng") if last_stop else None,
                    "eta": last_stop.get("eta") if last_stop else None,
                    "sequence": last_stop.get("sequence") if last_stop else None,
                    "label": f"{last_stop.get('customer_name', 'Customer')} ({last_stop.get('order_id', '')})".strip() if last_stop else None,
                } if last_stop else None,
            })
            total_dist_km += dist_km

        engine = "Clarke-Wright Savings Algorithm + 2-Opt Local Search"
        if self.obstacles:
            engine += " + Obstacle Avoidance Rerouting"

        total_cost_usd = round(sum(r.get("cost_usd", 0.0) for r in assigned_routes), 2)
        total_carbon_kg = round(sum(r.get("carbon_emissions_kg", 0.0) for r in assigned_routes), 1)
        total_fuel_liters = round(sum(r.get("fuel_estimate_liters", 0.0) for r in assigned_routes), 1)

        # Fleet-wide constraint audit: which vehicles were kept out of dispatch
        # and which candidates each route rejected (capacity/range/risk).
        constraint_report = {
            "capacity_kg": "tour load must fit vehicle payload",
            "range": "tour km must fit gauge-adjusted range (fuel level × full-tank/charge range)",
            "risk": f"failure risk >= {FAILURE_RISK_EXCLUDE_PCT:.0f}% pulled from dispatch",
            "selection": "cheapest feasible vehicle per tour (USD/km)",
            "excluded_vehicles": self.excluded_vehicles,
            "vehicles_evaluated": len(self.vehicles),
            "vehicles_dispatched": len({r.get("vehicle_id") for r in assigned_routes}),
        }

        return {
            "routes": assigned_routes,
            "total_distance_km": round(total_dist_km, 2),
            "total_fuel_liters": total_fuel_liters,
            "total_carbon_kg": total_carbon_kg,
            "total_cost_usd": total_cost_usd,
            "solver_engine": engine,
            "obstacles_considered": len(self.obstacles),
            "constraint_report": constraint_report,
            "status": "SUCCESS"
        }

    def _apply_2opt(self, route_indices: List[int], depot_lat: float, depot_lng: float, dist_matrix: List[List[float]], depot_dists: List[float]) -> List[int]:
        if len(route_indices) <= 2:
            return route_indices

        best_route = list(route_indices)

        def calculate_total_dist(r):
            d = depot_dists[r[0]]
            for i in range(len(r) - 1):
                d += dist_matrix[r[i]][r[i+1]]
            d += depot_dists[r[-1]]
            return d

        best_dist = calculate_total_dist(best_route)
        improved = True

        while improved:
            improved = False
            for i in range(len(best_route) - 1):
                for j in range(i + 1, len(best_route)):
                    new_route = best_route[:i] + list(reversed(best_route[i:j+1])) + best_route[j+1:]
                    new_dist = calculate_total_dist(new_route)
                    if new_dist < best_dist - 0.001:
                        best_route = new_route
                        best_dist = new_dist
                        improved = True
                        break
                if improved:
                    break

        return best_route
