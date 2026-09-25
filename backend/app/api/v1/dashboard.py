from fastapi import APIRouter
from typing import Dict, Any

router = APIRouter(prefix="/dashboard", tags=["Executive Dashboard KPIs"])

@router.get("/kpis", response_model=Dict[str, Any])
def get_dashboard_kpis():
    return {
        "active_vehicles": 142,
        "active_vehicles_trend": "+8.4% vs last week",
        "on_time_delivery_pct": 98.4,
        "on_time_trend": "+1.2% SLA compliance",
        "warehouse_capacity_pct": 82.6,
        "warehouse_capacity_trend": "Optimal fill rate",
        "co2_savings_tons": 24.8,
        "co2_trend": "-14.2% carbon reduction"
    }
