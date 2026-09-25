import math
import random
from typing import Dict, Any

class DigitalTwinSimulator:
    def run_simulation(self, params: Dict[str, Any]) -> Dict[str, Any]:
        scenario_name = params.get("scenario_name", "Baseline Scenario")
        disabled_wh = params.get("disabled_warehouse_id")
        disabled_veh = params.get("disabled_vehicle_id")
        demand_mult = max(0.5, float(params.get("demand_multiplier", 1.0)))
        fuel_price = max(0.5, float(params.get("fuel_price_usd", 4.20)))

        base_distance = 1240.0 * demand_mult
        base_fuel_liters = 347.2 * demand_mult
        base_fuel_cost = round(base_fuel_liters * fuel_price, 2)
        base_sla = 98.4
        base_routes = int(math.ceil(14 * demand_mult))

        wh_weights = {
            "w1111111-1111-1111-1111-111111111111": {"name": "Mumbai Central Hub", "dist_factor": 0.28, "cost_penalty": 2450.0, "sla_penalty": -6.5, "extra_routes": 4},
            "w2222222-2222-2222-2222-222222222222": {"name": "Navi Mumbai Cargo Center", "dist_factor": 0.18, "cost_penalty": 1680.0, "sla_penalty": -4.2, "extra_routes": 3},
            "w3333333-3333-3333-3333-333333333333": {"name": "Pune Industrial Hub", "dist_factor": 0.12, "cost_penalty": 1120.0, "sla_penalty": -2.8, "extra_routes": 2}
        }

        veh_weights = {
            "V-101": {"name": "Tata Prima Heavy Truck (V-101)", "dist_factor": 0.14, "cost_penalty": 980.0, "sla_penalty": -3.5, "extra_routes": 2},
            "V-102": {"name": "Mahindra Treo Zor EV (V-102)", "dist_factor": 0.08, "cost_penalty": 520.0, "sla_penalty": -1.8, "extra_routes": 1},
            "V-104": {"name": "Ashok Leyland BADA DOST (V-104)", "dist_factor": 0.06, "cost_penalty": 410.0, "sla_penalty": -1.4, "extra_routes": 1}
        }

        wh_info = wh_weights.get(disabled_wh)
        veh_info = veh_weights.get(disabled_veh)

        dist_surge = 0.0
        cost_penalty = 0.0
        sla_impact = 0.0
        extra_routes = 0
        impact_reasons = []

        if wh_info:
            dist_surge += wh_info["dist_factor"]
            cost_penalty += wh_info["cost_penalty"]
            sla_impact += wh_info["sla_penalty"]
            extra_routes += wh_info["extra_routes"]
            impact_reasons.append(f"Disruption at {wh_info['name']} redirects order flow to secondary hubs.")

        if veh_info:
            dist_surge += veh_info["dist_factor"]
            cost_penalty += veh_info["cost_penalty"]
            sla_impact += veh_info["sla_penalty"]
            extra_routes += veh_info["extra_routes"]
            impact_reasons.append(f"Outage of {veh_info['name']} forces route splitting across available fleet.")

        if demand_mult > 1.0:
            surge_pct = round((demand_mult - 1.0) * 100, 1)
            dist_surge += (demand_mult - 1.0) * 0.15
            sla_impact -= (demand_mult - 1.0) * 3.0
            cost_penalty += (demand_mult - 1.0) * 850.0
            impact_reasons.append(f"{surge_pct}% order volume demand surge stresses fleet capacity.")

        seed_str = f"{scenario_name}_{disabled_wh}_{disabled_veh}_{demand_mult}_{fuel_price}"
        rng = random.Random(hash(seed_str))
        mc_samples_cost = []
        mc_samples_sla = []

        for _ in range(1000):
            sample_noise_dist = rng.normalvariate(0, 0.02)
            sample_noise_cost = rng.normalvariate(0, 40.0)
            sample_noise_sla = rng.normalvariate(0, 0.3)

            s_dist = base_distance * (1.0 + dist_surge + sample_noise_dist)
            s_fuel = base_fuel_liters * (1.0 + dist_surge + sample_noise_dist)
            s_cost = (s_fuel * fuel_price) + cost_penalty + sample_noise_cost
            s_sla = max(60.0, min(100.0, base_sla + sla_impact + sample_noise_sla))

            mc_samples_cost.append(s_cost)
            mc_samples_sla.append(s_sla)

        sim_fuel_cost = round(sum(mc_samples_cost) / len(mc_samples_cost), 2)
        sim_sla = round(sum(mc_samples_sla) / len(mc_samples_sla), 1)

        sim_distance = round(base_distance * (1.0 + dist_surge), 1)
        sim_fuel_liters = round(base_fuel_liters * (1.0 + dist_surge), 1)
        sim_routes = base_routes + extra_routes

        cost_delta = round(sim_fuel_cost - base_fuel_cost, 2)
        sla_delta = round(sim_sla - base_sla, 1)
        distance_delta = round(sim_distance - base_distance, 1)
        fuel_delta = round(sim_fuel_liters - base_fuel_liters, 1)

        summary_text = " ".join(impact_reasons) if impact_reasons else "Baseline operational state under nominal network conditions."

        return {
            "scenario_name": scenario_name,
            "inputs": params,
            "baseline": {
                "total_distance_km": round(base_distance, 1),
                "total_fuel_liters": round(base_fuel_liters, 1),
                "total_fuel_cost_usd": base_fuel_cost,
                "on_time_sla_pct": base_sla,
                "total_routes": base_routes
            },
            "simulated": {
                "total_distance_km": sim_distance,
                "total_fuel_liters": sim_fuel_liters,
                "total_fuel_cost_usd": sim_fuel_cost,
                "on_time_sla_pct": sim_sla,
                "total_routes": sim_routes
            },
            "deltas": {
                "distance_km_delta": distance_delta,
                "fuel_liters_delta": fuel_delta,
                "cost_usd_delta": cost_delta,
                "sla_pct_delta": sla_delta
            },
            "summary_explanation": f"Monte Carlo 1,000 Trial Simulation: {summary_text} (Cost Impact: ${cost_delta:+,} USD, SLA: {sla_delta:+}%)."
        }
