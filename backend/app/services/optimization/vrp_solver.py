import math
from typing import List, Dict, Any

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class VRPOptimizer:
    def __init__(self, warehouses: List[Dict], orders: List[Dict], vehicles: List[Dict]):
        self.warehouses = warehouses
        self.orders = orders
        self.vehicles = vehicles

    def solve_vrp(self) -> Dict[str, Any]:
        if not self.orders or not self.vehicles:
            return {"routes": [], "total_distance_km": 0.0, "status": "NO_ORDERS"}

        # Filter out vehicles in maintenance from route assignment
        self.active_vehicles = [v for v in self.vehicles if v.get("status") != "MAINTENANCE"]
        if not self.active_vehicles:
            self.active_vehicles = self.vehicles

        return self._solve_clarke_wright_2opt()

    def _solve_clarke_wright_2opt(self) -> Dict[str, Any]:
        depot = self.warehouses[0] if self.warehouses else {"lat": 19.0760, "lng": 72.8777}
        depot_lat = depot.get("lat") or depot.get("location_lat", 19.0760)
        depot_lng = depot.get("lng") or depot.get("location_lng", 72.8777)

        num_orders = len(self.orders)
        if num_orders == 0:
            return {"routes": [], "total_distance_km": 0.0, "status": "NO_ORDERS"}

        # 1. Compute Distance from Depot to each order location
        depot_dists = [haversine_distance_km(depot_lat, depot_lng, o["dest_lat"], o["dest_lng"]) for o in self.orders]

        # 2. Compute Inter-Order Distance Matrix
        dist_matrix = []
        for i in range(num_orders):
            row = []
            for j in range(num_orders):
                if i == j:
                    row.append(0.0)
                else:
                    d = haversine_distance_km(self.orders[i]["dest_lat"], self.orders[i]["dest_lng"],
                                              self.orders[j]["dest_lat"], self.orders[j]["dest_lng"])
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
        max_capacity = max((v.get("capacity_kg", 1500.0) for v in self.active_vehicles), default=1500.0)
        max_stops_per_veh = max(1, math.ceil(num_orders / len(self.active_vehicles)))

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

                    if combined_weight <= max_capacity and len(combined_orders) <= (max_stops_per_veh + 2):
                        routes.remove(r_i)
                        routes.remove(r_j)
                        routes.append(combined_orders)

        # 6. Apply 2-Opt Local Search to each merged route
        optimized_routes = []
        for r in routes:
            optimized_r = self._apply_2opt(r, depot_lat, depot_lng, dist_matrix, depot_dists)
            optimized_routes.append(optimized_r)

        # 7. Assign optimized routes to active vehicles
        assigned_routes = []
        total_dist_km = 0.0

        for v_idx, order_indices in enumerate(optimized_routes):
            if v_idx >= len(self.active_vehicles):
                if assigned_routes:
                    v_obj = self.active_vehicles[-1]
                    target_route = assigned_routes[-1]
                    seq = len(target_route["stops"]) + 1
                    curr_lat = target_route["stops"][-1]["dest_lat"] if target_route["stops"] else depot_lat
                    curr_lng = target_route["stops"][-1]["dest_lng"] if target_route["stops"] else depot_lng
                    extra_dist = 0.0

                    for idx in order_indices:
                        order = self.orders[idx]
                        step_d = haversine_distance_km(curr_lat, curr_lng, order["dest_lat"], order["dest_lng"])
                        extra_dist += step_d
                        curr_lat, curr_lng = order["dest_lat"], order["dest_lng"]
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
                continue

            v_obj = self.active_vehicles[v_idx]
            route_stops = []
            curr_lat, curr_lng = depot_lat, depot_lng
            route_dist = 0.0
            seq = 1

            for idx in order_indices:
                order = self.orders[idx]
                step_d = haversine_distance_km(curr_lat, curr_lng, order["dest_lat"], order["dest_lng"])
                route_dist += step_d
                curr_lat, curr_lng = order["dest_lat"], order["dest_lng"]

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

            assigned_routes.append({
                "route_id": f"RT-{v_obj['id']}-OPT",
                "vehicle_id": v_obj["id"],
                "vehicle_name": v_obj.get("name", "Vehicle"),
                "driver_id": f"DRV-{v_idx+1:02d}",
                "total_distance_km": dist_km,
                "fuel_estimate_liters": fuel_liters,
                "carbon_emissions_kg": carbon_kg,
                "stops": route_stops,
                "status": "OPTIMIZED"
            })
            total_dist_km += dist_km

        return {
            "routes": assigned_routes,
            "total_distance_km": round(total_dist_km, 2),
            "solver_engine": "Clarke-Wright Savings Algorithm + 2-Opt Local Search",
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
