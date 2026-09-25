from typing import List, Dict, Any

class RiskAnalyzer:
    def analyze_vehicle_health(self, vehicle: Dict, telemetry: List[Dict]) -> Dict[str, Any]:
        temp = vehicle.get("engine_temp_c", 85.0)
        mileage = vehicle.get("mileage_km", 40000.0)
        fuel_type = str(vehicle.get("fuel_type", "DIESEL"))
        coolant_press = vehicle.get("coolant_pressure_bar", 2.0)
        tire_wear = vehicle.get("tire_wear_pct", 35)

        engine_risk = 0.05
        if temp > 95.0:
            engine_risk += 0.65
        elif temp > 90.0:
            engine_risk += 0.35
        elif temp > 87.0:
            engine_risk += 0.18

        if mileage > 100000:
            engine_risk += 0.25
        elif mileage > 80000:
            engine_risk += 0.15

        engine_risk = min(0.99, round(engine_risk, 2))
        tire_risk = min(0.95, round(tire_wear / 100.0 * 0.9, 2))
        brake_risk = round(min(0.85, mileage / 110000.0 * 0.7), 2)
        battery_risk = 0.08 if fuel_type.upper() != "ELECTRIC" else round(min(0.70, mileage / 80000.0 * 0.4 + (temp / 100.0 * 0.2)), 2)

        overall_risk = max(engine_risk, tire_risk, brake_risk)

        if overall_risk >= 0.70:
            status = "CRITICAL"
            recommendation = "CRITICAL WARNING: High temperature / component wear detected. Schedule immediate maintenance and remove vehicle from VRP dispatch."
        elif overall_risk >= 0.35:
            status = "WARNING"
            recommendation = "ELEVATED RISK: Inspect engine cooling system and tire tread within 48 hours."
        else:
            status = "HEALTHY"
            recommendation = "NOMINAL: Vehicle operating within standard optimal parameters."

        shap_features = [
            {"feature": "Engine Temperature (°C)", "value": f"{temp}°C", "impact": f"+{min(0.55, round((temp - 75) * 0.02, 2)):.2f}" if temp > 80 else "+0.02"},
            {"feature": "Odometer Mileage (km)", "value": f"{mileage:,.0f} km", "impact": f"+{min(0.35, round(mileage / 300000.0, 2)):.2f}"},
            {"feature": "Coolant Pressure (bar)", "value": f"{coolant_press} bar", "impact": "+0.22" if coolant_press > 2.5 else "+0.04"},
            {"feature": "Tire Wear Index (%)", "value": f"{tire_wear}%", "impact": f"+{min(0.40, round(tire_wear / 200.0, 2)):.2f}"}
        ]

        return {
            "vehicle_id": vehicle["id"],
            "vehicle_name": vehicle.get("name", vehicle["id"]),
            "status": status,
            "overall_failure_risk": round(overall_risk, 2),
            "component_risks": {
                "engine_cooling": engine_risk,
                "tires_suspension": tire_risk,
                "brakes": brake_risk,
                "battery_electrical": battery_risk
            },
            "recommendation": recommendation,
            "shap_top_features": shap_features
        }
