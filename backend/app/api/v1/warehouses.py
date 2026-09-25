from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter(prefix="/warehouses", tags=["Warehouses Hub"])

@router.get("", response_model=List[Dict[str, Any]])
def get_warehouses():
    return [
        {
            "id": "w1111111-1111-1111-1111-111111111111",
            "name": "Mumbai Central Logistics Hub",
            "city": "Mumbai",
            "state": "MH",
            "address": "Bhiwandi Logistics Park, NH 160",
            "location_lat": 19.0760,
            "location_lng": 72.8777,
            "capacity_sqft": 120000.0,
            "storage_capacity_sqft": 120000.0,
            "current_utilization_pct": 88.5,
            "total_skus": 450,
            "low_stock_count": 0,
            "status": "ACTIVE"
        },
        {
            "id": "w2222222-2222-2222-2222-222222222222",
            "name": "Navi Mumbai Cargo Distribution Center",
            "city": "Navi Mumbai",
            "state": "MH",
            "address": "JNPT Port Expressway",
            "location_lat": 19.0330,
            "location_lng": 73.0297,
            "capacity_sqft": 95000.0,
            "storage_capacity_sqft": 95000.0,
            "current_utilization_pct": 74.0,
            "total_skus": 310,
            "low_stock_count": 2,
            "status": "ACTIVE"
        },
        {
            "id": "w3333333-3333-3333-3333-333333333333",
            "name": "Pune Industrial Fulfillment Hub",
            "city": "Pune",
            "state": "MH",
            "address": "Chakan MIDC Phase II",
            "location_lat": 18.5204,
            "location_lng": 73.8567,
            "capacity_sqft": 80000.0,
            "storage_capacity_sqft": 80000.0,
            "current_utilization_pct": 62.0,
            "total_skus": 280,
            "low_stock_count": 0,
            "status": "ACTIVE"
        }
    ]
