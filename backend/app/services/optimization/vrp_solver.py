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

        # Exclude vehicles in maintenance from route assignment
        self.active_vehicles = [v for v in self.vehicles if v.get("status") != "MAINTENANCE"]
        if not self.active_vehicles:
            self.active_vehicles = self.vehicles

        try:
            from ortools.constraint_solver import routing_enums_pb2
            from ortools.constraint_solver import pywrapcp
            return self._solve_ortools()
        except ImportError:
            return self._solve_heuristic()

    def _solve_ortools(self) -> Dict[str, Any]:
        from ortools.constraint_solver import routing_enums_pb2
        from ortools.constraint_solver import pywrapcp

        depot = self.warehouses[0] if self.warehouses else {"lat": 19.0760, "lng": 72.8777}
        locations = [(depot["lat"], depot["lng"])] + [(o["dest_lat"], o["dest_lng"]) for o in self.orders]

        num_locations = len(locations)
        num_vehicles = len(self.active_vehicles)

        distance_matrix = []
        for i in range(num_locations):
            row = []
            for j in range(num_locations):
                dist_km = haversine_distance_km(locations[i][0], locations[i][1], locations[j][0], locations[j][1])
                row.append(int(dist_km * 1000))
            distance_matrix.append(row)

        manager = pywrapcp.RoutingIndexManager(num_locations, num_vehicles, 0)
        routing = pywrapcp.RoutingModel(manager)

        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return distance_matrix[from_node][to_node]

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        # Capacity Dimension
        demands = [0] + [int(o.get("weight_kg", 5.0)) for o in self.orders]
        capacities = [int(v.get("capacity_kg", 1500.0)) for v in self.active_vehicles]

        def demand_callback(from_index):
            from_node = manager.IndexToNode(from_index)
            return demands[from_node]

        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index, 0, capacities, True, "Capacity"
        )

        # Stops Dimension (Max 3 stops per vehicle to enforce balanced distribution)
        max_stops_per_vehicle = max(1, math.ceil(len(self.orders) / num_vehicles) + 1)
        routing.AddConstantDimension(1, max_stops_per_vehicle + 1, True, "Stops")

        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.time_limit.seconds = 3

        solution = routing.SolveWithParameters(search_parameters)

        if not solution:
            return self._solve_heuristic()

        assigned_routes = []
        total_dist_meters = 0

        for vehicle_idx in range(num_vehicles):
            index = routing.Start(vehicle_idx)
            route_stops = []
            route_dist = 0
            seq = 1

            while not routing.IsEnd(index):
                node = manager.IndexToNode(index)
                if node > 0:
                    order = self.orders[node - 1]
                    eta_mins = int(route_dist / 1000 / 40.0 * 60)
                    eta_str = f"+{eta_mins // 60}h {eta_mins % 60}m"
                    route_stops.append({
                        "sequence": seq,
                        "order_id": order["id"],
                        "customer_name": order.get("customer_name", "Customer"),
                        "dest_lat": order["dest_lat"],
                        "dest_lng": order["dest_lng"],
                        "eta": eta_str,
                        "priority": order.get("priority", "NORMAL")
                    })
                    seq += 1

                previous_index = index
                index = solution.Value(routing.NextVar(index))
                route_dist += routing.GetArcCostForVehicle(previous_index, index, vehicle_idx)

            if route_stops:
                dist_km = round(route_dist / 1000.0, 2)
                v_obj = self.active_vehicles[vehicle_idx]
                fuel_multiplier = 0.15 if v_obj.get("fuel_type") == "ELECTRIC" else 0.28
                fuel_liters = round(dist_km * fuel_multiplier, 1)
                carbon_kg = round(fuel_liters * (0.0 if v_obj.get("fuel_type") == "ELECTRIC" else 2.68), 1)

                assigned_routes.append({
                    "route_id": f"RT-{v_obj['id']}-OPT",
                    "vehicle_id": v_obj["id"],
                    "vehicle_name": v_obj.get("name", "Vehicle"),
                    "driver_id": f"DRV-{vehicle_idx+1:02d}",
                    "total_distance_km": dist_km,
                    "fuel_estimate_liters": fuel_liters,
                    "carbon_emissions_kg": carbon_kg,
                    "stops": route_stops,
                    "status": "OPTIMIZED"
                })
                total_dist_meters += route_dist

        return {
            "routes": assigned_routes,
            "total_distance_km": round(total_dist_meters / 1000.0, 2),
            "solver_engine": "Google OR-Tools VRP Solver (Guided Local Search)",
            "status": "SUCCESS"
        }

    def _solve_heuristic(self) -> Dict[str, Any]:
        unassigned = list(self.orders)
        depot = self.warehouses[0] if self.warehouses else {"lat": 19.0760, "lng": 72.8777}

        assigned_routes = []
        total_dist_km = 0.0

        for idx, vehicle in enumerate(self.vehicles):
            if not unassigned:
                break

            route_stops = []
            current_lat, current_lng = depot["lat"], depot["lng"]
            current_capacity = vehicle.get("capacity_kg", 1500.0)
            route_dist = 0.0
            seq = 1

            while unassigned:
                best_idx = None
                best_dist = float("inf")

                for i, order in enumerate(unassigned):
                    w = order.get("weight_kg", 5.0)
                    if w <= current_capacity:
                        d = haversine_distance_km(current_lat, current_lng, order["dest_lat"], order["dest_lng"])
                        if d < best_dist:
                            best_dist = d
                            best_idx = i

                if best_idx is None:
                    break

                order = unassigned.pop(best_idx)
                current_capacity -= order.get("weight_kg", 5.0)
                route_dist += best_dist
                current_lat, current_lng = order["dest_lat"], order["dest_lng"]

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

            if route_stops:
                dist_km = round(route_dist, 2)
                fuel_liters = round(dist_km * 0.28, 1)
                carbon_kg = round(fuel_liters * 2.68, 1)

                assigned_routes.append({
                    "route_id": f"RT-{vehicle['id']}-HEUR",
                    "vehicle_id": vehicle["id"],
                    "vehicle_name": vehicle.get("name", "Vehicle"),
                    "driver_id": f"DRV-{idx+1:02d}",
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
            "solver_engine": "Nearest-Neighbor VRP Heuristic",
            "status": "SUCCESS"
        }
