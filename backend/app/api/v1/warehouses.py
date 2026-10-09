from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies.database import get_db_session
from app.db.models import Warehouse
from app.api.v1 import inventory as inventory_registry

router = APIRouter(prefix="/warehouses", tags=["Warehouses Hub"])

# Legacy demo utilization kept for the three seeded hubs (UI telemetry chips);
# user-created warehouses report 0% until inventory telemetry exists.
DEMO_UTILIZATION_PCT = {
    "w1111111-1111-1111-1111-111111111111": 88.5,
    "w2222222-2222-2222-2222-222222222222": 74.0,
    "w3333333-3333-3333-3333-333333333333": 62.0,
}

DEMO_ID_ORDER = list(DEMO_UTILIZATION_PCT.keys())


def sort_warehouses(rows):
    """Deterministic depot ordering: seeded hubs first (stable depot = first row), then by name."""
    def key(w):
        try:
            return (0, DEMO_ID_ORDER.index(w.warehouse_id), "")
        except ValueError:
            return (1, 0, (w.warehouse_name or "").lower())
    return sorted(rows, key=key)


def _inventory_items(warehouse_id: str):
    return [i for i in inventory_registry.INVENTORY if i.get("warehouse_id") == warehouse_id]


def _serialize(w: Warehouse) -> Dict[str, Any]:
    items = _inventory_items(w.warehouse_id)
    return {
        "id": w.warehouse_id,
        "name": w.warehouse_name,
        "city": w.city,
        "state": w.state,
        "address": w.address,
        "location_lat": w.latitude,
        "location_lng": w.longitude,
        "capacity_sqft": w.storage_capacity_sqft,
        "storage_capacity_sqft": w.storage_capacity_sqft,
        "current_utilization_pct": DEMO_UTILIZATION_PCT.get(w.warehouse_id, 0.0),
        "total_skus": len({i.get("sku") for i in items}),
        "low_stock_count": sum(1 for i in items if (i.get("quantity", 0) or 0) <= (i.get("reorder_threshold", 0) or 0)),
        "status": w.status,
    }


class WarehouseCreate(BaseModel):
    name: str
    city: str
    state: Optional[str] = None
    address: Optional[str] = None
    location_lat: float
    location_lng: float
    capacity_sqft: float = 50000.0
    country: str = "India"


@router.get("", response_model=List[Dict[str, Any]])
def get_warehouses(db: Session = Depends(get_db_session)):
    return [_serialize(w) for w in sort_warehouses(db.query(Warehouse).all())]


@router.post("", response_model=Dict[str, Any])
def create_warehouse(req: WarehouseCreate, db: Session = Depends(get_db_session)):
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=400, detail="name is required.")
    if not req.city or not req.city.strip():
        raise HTTPException(status_code=400, detail="city is required.")
    if not (-90.0 <= req.location_lat <= 90.0):
        raise HTTPException(status_code=400, detail="location_lat must be between -90 and 90.")
    if not (-180.0 <= req.location_lng <= 180.0):
        raise HTTPException(status_code=400, detail="location_lng must be between -180 and 180.")
    if req.capacity_sqft is None or req.capacity_sqft <= 0:
        raise HTTPException(status_code=400, detail="capacity_sqft must be greater than 0.")

    wh = Warehouse(
        warehouse_name=req.name.strip(),
        address=req.address,
        city=req.city.strip(),
        state=req.state,
        country=req.country,
        latitude=req.location_lat,
        longitude=req.location_lng,
        storage_capacity_sqft=req.capacity_sqft,
        status="ACTIVE",
    )
    db.add(wh)
    db.commit()
    db.refresh(wh)

    # Keep the in-memory inventory registry aware of the new hub
    if not any(w.get("id") == wh.warehouse_id for w in inventory_registry.WAREHOUSES):
        inventory_registry.WAREHOUSES.append({
            "id": wh.warehouse_id,
            "name": wh.warehouse_name,
            "location_lat": wh.latitude,
            "location_lng": wh.longitude,
        })
    return _serialize(wh)


@router.delete("/{warehouse_id}", response_model=Dict[str, Any])
def delete_warehouse(warehouse_id: str, db: Session = Depends(get_db_session)):
    wh = db.query(Warehouse).filter(Warehouse.warehouse_id == warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail=f"Warehouse {warehouse_id} not found.")
    db.delete(wh)
    db.commit()

    inventory_registry.WAREHOUSES[:] = [w for w in inventory_registry.WAREHOUSES if w.get("id") != warehouse_id]
    inventory_registry.INVENTORY[:] = [i for i in inventory_registry.INVENTORY if i.get("warehouse_id") != warehouse_id]
    return {"deleted": True, "warehouse_id": warehouse_id}

