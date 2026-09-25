from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any, Optional
from app.services.optimization.inventory_lp import InventoryLPOptimizer
from app.services.ml.forecaster import DemandForecaster

router = APIRouter(prefix="", tags=["Inventory LP & Demand Forecasting"])

class DemandForecastRequest(BaseModel):
    warehouse_id: str
    sku: str
    horizon_days: Optional[int] = 7

@router.post("/inventory/rebalance", response_model=Dict[str, Any])
def rebalance_inventory():
    warehouses = [
        {"id": "w1111111-1111-1111-1111-111111111111", "name": "Mumbai Central Logistics Hub", "location_lat": 19.0760, "location_lng": 72.8777},
        {"id": "w2222222-2222-2222-2222-222222222222", "name": "Navi Mumbai Cargo Distribution Center", "location_lat": 19.0330, "location_lng": 73.0297},
        {"id": "w3333333-3333-3333-3333-333333333333", "name": "Pune Industrial Fulfillment Hub", "location_lat": 18.5204, "location_lng": 73.8567}
    ]

    inventory_data = [
        {"inventory_id": "i1", "warehouse_id": "w1111111-1111-1111-1111-111111111111", "sku": "SKU-ELEC-101", "quantity": 140, "reorder_threshold": 30},
        {"inventory_id": "i2", "warehouse_id": "w2222222-2222-2222-2222-222222222222", "sku": "SKU-ELEC-101", "quantity": 12, "reorder_threshold": 30},
        {"inventory_id": "i3", "warehouse_id": "w3333333-3333-3333-3333-333333333333", "sku": "SKU-ELEC-101", "quantity": 55, "reorder_threshold": 30},
        {"inventory_id": "i4", "warehouse_id": "w1111111-1111-1111-1111-111111111111", "sku": "SKU-PHAR-201", "quantity": 45, "reorder_threshold": 15},
        {"inventory_id": "i5", "warehouse_id": "w2222222-2222-2222-2222-222222222222", "sku": "SKU-PHAR-201", "quantity": 8, "reorder_threshold": 15}
    ]

    optimizer = InventoryLPOptimizer(warehouses=warehouses, inventory_data=inventory_data)
    return optimizer.optimize_rebalance()

@router.post("/forecast/demand", response_model=Dict[str, Any])
def forecast_demand(req: DemandForecastRequest):
    forecaster = DemandForecaster()
    return forecaster.forecast_warehouse_demand(req.warehouse_id, req.sku, req.horizon_days)
