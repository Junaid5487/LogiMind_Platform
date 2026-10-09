from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.optimization.inventory_lp import InventoryLPOptimizer
from app.services.ml.forecaster import DemandForecaster

router = APIRouter(prefix="", tags=["Inventory Management"])

# In-memory inventory registry (mock data pattern, consistent with drivers registry)
WAREHOUSES: List[Dict[str, Any]] = [
    {"id": "w1111111-1111-1111-1111-111111111111", "name": "Mumbai Central Logistics Hub", "location_lat": 19.0760, "location_lng": 72.8777},
    {"id": "w2222222-2222-2222-2222-222222222222", "name": "Navi Mumbai Cargo Distribution Center", "location_lat": 19.0330, "location_lng": 73.0297},
    {"id": "w3333333-3333-3333-3333-333333333333", "name": "Pune Industrial Fulfillment Hub", "location_lat": 18.5204, "location_lng": 73.8567},
]

INVENTORY: List[Dict[str, Any]] = [
    {"inventory_id": "INV-01", "warehouse_id": "w1111111-1111-1111-1111-111111111111", "sku": "SKU-ELEC-101", "item_name": "Electronic Components Kit", "quantity": 140, "reorder_threshold": 30, "unit": "units"},
    {"inventory_id": "INV-02", "warehouse_id": "w2222222-2222-2222-2222-222222222222", "sku": "SKU-ELEC-101", "item_name": "Electronic Components Kit", "quantity": 12, "reorder_threshold": 30, "unit": "units"},
    {"inventory_id": "INV-03", "warehouse_id": "w3333333-3333-3333-3333-333333333333", "sku": "SKU-ELEC-101", "item_name": "Electronic Components Kit", "quantity": 55, "reorder_threshold": 30, "unit": "units"},
    {"inventory_id": "INV-04", "warehouse_id": "w1111111-1111-1111-1111-111111111111", "sku": "SKU-PHAR-201", "item_name": "Pharmaceutical Supplies", "quantity": 45, "reorder_threshold": 15, "unit": "boxes"},
    {"inventory_id": "INV-05", "warehouse_id": "w2222222-2222-2222-2222-222222222222", "sku": "SKU-PHAR-201", "item_name": "Pharmaceutical Supplies", "quantity": 8, "reorder_threshold": 15, "unit": "boxes"},
]

class CreateInventoryItemRequest(BaseModel):
    warehouse_id: str
    sku: str
    item_name: str
    quantity: int
    reorder_threshold: int = 10
    unit: str = "units"

class ShiftInventoryRequest(BaseModel):
    from_warehouse_id: str
    to_warehouse_id: str
    sku: str
    quantity: int

class DemandForecastRequest(BaseModel):
    warehouse_id: str
    sku: str
    horizon_days: Optional[int] = 7

def _next_inventory_id() -> str:
    existing = {i["inventory_id"] for i in INVENTORY}
    n = 1
    while f"INV-{n:02d}" in existing:
        n += 1
    return f"INV-{n:02d}"

def _warehouse_name(warehouse_id: str) -> str:
    for w in WAREHOUSES:
        if w["id"] == warehouse_id:
            return w["name"]
    return warehouse_id

@router.get("/inventory", response_model=List[Dict[str, Any]])
def get_inventory():
    return INVENTORY

@router.post("/inventory", response_model=Dict[str, Any], status_code=201)
def create_inventory_item(req: CreateInventoryItemRequest):
    if not req.sku.strip():
        raise HTTPException(status_code=400, detail="SKU is required")
    if not req.item_name.strip():
        raise HTTPException(status_code=400, detail="Item name is required")
    if req.quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity must be >= 0")
    if not any(w["id"] == req.warehouse_id for w in WAREHOUSES):
        raise HTTPException(status_code=400, detail=f"Unknown warehouse {req.warehouse_id}")

    # Merge into an existing SKU row at this warehouse instead of duplicating it
    for item in INVENTORY:
        if item["warehouse_id"] == req.warehouse_id and item["sku"] == req.sku.strip().upper():
            item["quantity"] += req.quantity
            return {"status": "MERGED", "item": item}

    new_item = {
        "inventory_id": _next_inventory_id(),
        "warehouse_id": req.warehouse_id,
        "sku": req.sku.strip().upper(),
        "item_name": req.item_name.strip(),
        "quantity": req.quantity,
        "reorder_threshold": max(req.reorder_threshold, 0),
        "unit": req.unit.strip() or "units",
    }
    INVENTORY.append(new_item)
    return {"status": "CREATED", "item": new_item}

@router.delete("/inventory/{inventory_id}", response_model=Dict[str, Any])
def delete_inventory_item(inventory_id: str):
    for idx, item in enumerate(INVENTORY):
        if item["inventory_id"] == inventory_id:
            removed = INVENTORY.pop(idx)
            return {"status": "REMOVED", "item": removed}
    raise HTTPException(status_code=404, detail=f"Inventory item {inventory_id} not found")

@router.post("/inventory/shift", response_model=Dict[str, Any])
def shift_inventory(req: ShiftInventoryRequest):
    if req.from_warehouse_id == req.to_warehouse_id:
        raise HTTPException(status_code=400, detail="Source and destination warehouses must differ")
    if req.quantity <= 0:
        raise HTTPException(status_code=400, detail="Shift quantity must be > 0")
    if not any(w["id"] == req.from_warehouse_id for w in WAREHOUSES):
        raise HTTPException(status_code=400, detail=f"Unknown source warehouse {req.from_warehouse_id}")
    if not any(w["id"] == req.to_warehouse_id for w in WAREHOUSES):
        raise HTTPException(status_code=400, detail=f"Unknown destination warehouse {req.to_warehouse_id}")

    source = next((i for i in INVENTORY if i["warehouse_id"] == req.from_warehouse_id and i["sku"] == req.sku), None)
    if source is None:
        raise HTTPException(status_code=404, detail=f"SKU {req.sku} not stocked at source warehouse")
    if req.quantity > source["quantity"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot shift {req.quantity}: only {source['quantity']} available at source",
        )

    dest = next((i for i in INVENTORY if i["warehouse_id"] == req.to_warehouse_id and i["sku"] == req.sku), None)
    source["quantity"] -= req.quantity
    if dest is None:
        dest = {
            "inventory_id": _next_inventory_id(),
            "warehouse_id": req.to_warehouse_id,
            "sku": source["sku"],
            "item_name": source["item_name"],
            "quantity": req.quantity,
            "reorder_threshold": source["reorder_threshold"],
            "unit": source["unit"],
        }
        INVENTORY.append(dest)
    else:
        dest["quantity"] += req.quantity

    return {
        "status": "SHIFTED",
        "sku": source["sku"],
        "quantity": req.quantity,
        "from_warehouse": _warehouse_name(req.from_warehouse_id),
        "to_warehouse": _warehouse_name(req.to_warehouse_id),
        "source_item": source,
        "destination_item": dest,
    }

@router.post("/inventory/rebalance", response_model=Dict[str, Any])
def rebalance_inventory():
    optimizer = InventoryLPOptimizer(warehouses=WAREHOUSES, inventory_data=INVENTORY)
    return optimizer.optimize_rebalance()

@router.post("/forecast/demand", response_model=Dict[str, Any])
def forecast_demand(req: DemandForecastRequest):
    forecaster = DemandForecaster()
    return forecaster.forecast_warehouse_demand(req.warehouse_id, req.sku, req.horizon_days)
