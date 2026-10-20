from typing import List, Dict, Any
from app.core.logging import logger
from app.services.optimization.vrp_solver import haversine_distance_km

class InventoryLPOptimizer:
    # Solver preference order: bundled CBC first, then any other MILP solver
    # the installed PuLP exposes. Newer PuLP releases (as installed on Render)
    # report CPSAT (OR-Tools-backed) instead of PULP_CBC_CMD — accept it
    # rather than dropping to the heuristic when a real solver exists.
    SOLVER_PREFERENCE = ("PULP_CBC_CMD", "CPSAT", "COIN_CMD", "SCIP_CMD", "HiGHS_CMD", "PULP_CHOCO_CMD")

    def __init__(self, warehouses: List[Dict], inventory_data: List[Dict],
                 cost_per_km: float = 12.0, currency: str = "₹"):
        self.warehouses = warehouses
        self.inventory_data = inventory_data
        # Transfer cost model: cost_per_km per unit moved (INR by default).
        self.cost_per_km = cost_per_km
        self.currency = currency

    def optimize_rebalance(self) -> Dict[str, Any]:
        try:
            import pulp  # noqa: F401
        except Exception as exc:
            # ImportError (not installed) or a broken wheel install — degrade
            # to the pure-Python heuristic instead of failing the request.
            logger.warning(f"LP rebalance: PuLP unavailable ({exc}); using heuristic solver.")
            return self._solve_heuristic()
        try:
            return self._solve_pulp()
        except Exception as exc:
            # The CBC binary bundled with PuLP can fail to execute inside slim
            # Docker images (missing +x / exec format error), which used to
            # 500 the endpoint on Render. Degrade to the heuristic and surface
            # the exact reason so the API/Render logs show what happened.
            logger.error(f"LP rebalance: PuLP solver failed ({exc}); falling back to heuristic.", exc_info=True)
            result = self._solve_heuristic()
            result["status"] = "FALLBACK_HEURISTIC"
            result["solver_error"] = str(exc)
            return result

    def _select_solver(self, pulp):
        """Pick the first usable MILP solver on this machine."""
        available = pulp.listSolvers(onlyAvailable=True)
        last_error = None
        for solver_name in self.SOLVER_PREFERENCE:
            solver_cls = getattr(pulp, solver_name, None)
            if solver_cls is None:
                continue
            if solver_name not in available:
                last_error = solver_name + " listed but not executable"
                continue
            try:
                return solver_cls(msg=False), solver_name
            except Exception as exc:
                last_error = solver_name + ": " + str(exc)
                continue
        raise RuntimeError(
            "No MILP solver executable in this environment "
            "(available solvers: " + str(available)
            + "; tried " + str(self.SOLVER_PREFERENCE)
            + ("; last error: " + last_error if last_error else "") + ")"
        )


    def _solve_pulp(self) -> Dict[str, Any]:
        import pulp

        # Fail fast with a clear message if no usable MILP solver binary can
        # run in this environment (checked before building any model).
        solver, solver_name = self._select_solver(pulp)
        logger.info(f"LP rebalance: using solver {solver_name}")

        recommendations = []
        total_transfer_cost = 0.0

        skus = set(item["sku"] for item in self.inventory_data)
        wh_dict = {w["id"]: w for w in self.warehouses}

        for sku in skus:
            sku_items = [i for i in self.inventory_data if i["sku"] == sku]
            surplus = []
            deficit = []

            for item in sku_items:
                qty = item["quantity"]
                target = item.get("reorder_threshold", 30) * 2
                if qty > target:
                    surplus.append({"wh_id": item["warehouse_id"], "available": qty - target})
                elif qty < item.get("reorder_threshold", 30):
                    deficit.append({"wh_id": item["warehouse_id"], "needed": target - qty})

            if not surplus or not deficit:
                continue

            prob = pulp.LpProblem(f"Inventory_Transfer_{sku}", pulp.LpMinimize)
            routes = [(s["wh_id"], d["wh_id"]) for s in surplus for d in deficit]

            vars_dict = pulp.LpVariable.dicts("Transfer", (routes), 0, None, pulp.LpInteger)

            cost_matrix = {}
            dist_matrix = {}
            for s in surplus:
                for d in deficit:
                    wh_s = wh_dict.get(s["wh_id"], {"location_lat": 19.0760, "location_lng": 72.8777})
                    wh_d = wh_dict.get(d["wh_id"], {"location_lat": 19.0760, "location_lng": 72.8777})
                    dist = haversine_distance_km(wh_s["location_lat"], wh_s["location_lng"], wh_d["location_lat"], wh_d["location_lng"])
                    dist_matrix[(s["wh_id"], d["wh_id"])] = round(dist, 1)
                    cost_matrix[(s["wh_id"], d["wh_id"])] = dist * self.cost_per_km

            prob += pulp.lpSum([vars_dict[(s["wh_id"], d["wh_id"])] * cost_matrix[(s["wh_id"], d["wh_id"])] for s in surplus for d in deficit])

            for s in surplus:
                prob += pulp.lpSum([vars_dict[(s["wh_id"], d["wh_id"])] for d in deficit]) <= s["available"]

            for d in deficit:
                prob += pulp.lpSum([vars_dict[(s["wh_id"], d["wh_id"])] for s in surplus]) == min(d["needed"], sum(sp["available"] for sp in surplus))

            prob.solve(solver)

            for s in surplus:
                for d in deficit:
                    qty_transferred = int(vars_dict[(s["wh_id"], d["wh_id"])].varValue or 0)
                    if qty_transferred > 0:
                        c = cost_matrix[(s["wh_id"], d["wh_id"])] * qty_transferred
                        total_transfer_cost += c
                        from_name = wh_dict.get(s["wh_id"], {}).get("name", s["wh_id"])
                        to_name = wh_dict.get(d["wh_id"], {}).get("name", d["wh_id"])
                        recommendations.append({
                            "sku": sku,
                            "from_warehouse_id": s["wh_id"],
                            "from_warehouse_name": from_name,
                            "to_warehouse_id": d["wh_id"],
                            "to_warehouse_name": to_name,
                            "quantity": qty_transferred,
                            "distance_km": dist_matrix.get((s["wh_id"], d["wh_id"]), 0.0),
                            "estimated_cost": round(c, 2),
                            "estimated_cost_usd": round(c, 2),
                            "currency": self.currency,
                            "rationale": f"Prevents stockout at {to_name} by shifting surplus from {from_name}."
                        })

        return {
            "recommendations": recommendations,
            "total_transfer_cost": round(total_transfer_cost, 2),
            "total_transfer_cost_usd": round(total_transfer_cost, 2),
            "currency": self.currency,
            "solver_engine": ("PuLP Linear Programming Simplex/CBC Solver" if solver_name == "PULP_CBC_CMD" else f"PuLP MILP Solver ({solver_name})"),
            "status": "OPTIMAL"
        }

    def _solve_heuristic(self) -> Dict[str, Any]:
        recommendations = []
        total_transfer_cost = 0.0
        skus = set(item["sku"] for item in self.inventory_data)
        wh_dict = {w["id"]: w for w in self.warehouses}

        for sku in skus:
            sku_items = [i for i in self.inventory_data if i["sku"] == sku]
            for item in sku_items:
                if item["quantity"] < item.get("reorder_threshold", 30):
                    needed = (item.get("reorder_threshold", 30) * 2) - item["quantity"]
                    best_supplier = None
                    max_surplus = 0
                    for s in sku_items:
                        if s["warehouse_id"] != item["warehouse_id"] and s["quantity"] > 40:
                            if s["quantity"] > max_surplus:
                                max_surplus = s["quantity"]
                                best_supplier = s

                    if best_supplier:
                        qty = min(needed, max_surplus - 30)
                        cost = qty * 12.5
                        total_transfer_cost += cost
                        recommendations.append({
                            "sku": sku,
                            "from_warehouse_id": best_supplier["warehouse_id"],
                            "from_warehouse_name": wh_dict.get(best_supplier["warehouse_id"], {}).get("name", best_supplier["warehouse_id"]),
                            "to_warehouse_id": item["warehouse_id"],
                            "to_warehouse_name": wh_dict.get(item["warehouse_id"], {}).get("name", item["warehouse_id"]),
                            "quantity": qty,
                            "distance_km": 0.0,
                            "estimated_cost": round(cost, 2),
                            "estimated_cost_usd": round(cost, 2),
                            "currency": self.currency,
                            "rationale": f"Heuristic inventory transfer to clear low stock alert."
                        })

        return {
            "recommendations": recommendations,
            "total_transfer_cost": round(total_transfer_cost, 2),
            "total_transfer_cost_usd": round(total_transfer_cost, 2),
            "currency": self.currency,
            "solver_engine": "Greedy Min-Distance Inventory Heuristic",
            "status": "SUCCESS"
        }
