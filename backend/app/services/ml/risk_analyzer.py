from typing import List, Dict, Any

class RiskAnalyzer:
    def analyze_vehicle_health(self, vehicle: Dict, telemetry: List[Dict]) -> Dict[str, Any]:
        temp = vehicle.get("engine_temp_c", 85.0)
        mileage = vehicle.get("mileage_km", 40000.0)
        fuel_type = vehicle.get("fuel_type", "Diesel")

        engine_risk = 0.05
        if temp > 95.0:
            engine_risk += 0.55
        elif temp > 90.0:
            engine_risk += 0.25

        if mileage > 100000:
            engine_risk += 0.25

        engine_risk = min(0.99, round(engine_risk, 2))
        tire_risk = min(0.95, round(mileage / 120000.0 * 0.8, 2))

        if max(engine_risk, tire_risk) >= 0.55:
            status = "CRITICAL"
            recommendation = "Schedule immediate preventative maintenance. Remove vehicle from long-distance VRP assignments."
        elif max(engine_risk, tire_risk) > 0.40:
            status = "WARNING"
            recommendation = "Inspect cooling system and tire pressure within 48 hours."
        else:
            status = "HEALTHY"
            recommendation = "Vehicle operating within nominal safety parameters."

        return {
            "vehicle_id": vehicle["id"],
            "vehicle_name": vehicle.get("name", vehicle["id"]),
            "status": status,
            "overall_failure_risk": max(engine_risk, tire_risk),
            "component_risks": {
                "engine_cooling": engine_risk,
                "tires_suspension": tire_risk,
                "brakes": round(min(0.85, mileage / 90000.0 * 0.4), 2),
                "battery_electrical": 0.12 if fuel_type != "Electric" else round(temp / 100.0 * 0.3, 2)
            },
            "recommendation": recommendation,
            "shap_top_features": [
                {"feature": "Engine Temperature (°C)", "value": f"{temp}°C", "impact": "+0.45" if temp > 90 else "+0.02"},
                {"feature": "Odometer Mileage (km)", "value": f"{mileage:,} km", "impact": "+0.28" if mileage > 80000 else "+0.05"},
                {"feature": "Coolant Pressure Variance", "value": "High" if temp > 95 else "Normal", "impact": "+0.15"}
            ]
        }
