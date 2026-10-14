from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies.database import get_db_session
from app.db.models import Warehouse, InventoryItem, Order, UNITS_PER_SQFT

router = APIRouter(prefix="/warehouses", tags=["Warehouses Hub"])

# Legacy demo utilization kept ONLY as a fallback when a seeded hub has no
# inventory rows yet (fresh DB before seed). Once stock exists, utilization is
# computed from real units (see _utilization_pct) for every hub.
DEMO_UTILIZATION_PCT = {
    "w1111111-1111-1111-1111-111111111111": 88.5,
    "w2222222-2222-2222-2222-222222222222": 74.0,
    "w3333333-3333-3333-3333-333333333333": 62.0,
}

DEMO_ID_ORDER = list(DEMO_UTILIZATION_PCT.keys())


def _utilization_pct(db, warehouse_id: str, capacity_sqft: float) -> float:
    """Real fill % = total units stored / units that fit in the floor area.

    Single capacity model: UNITS_PER_SQFT sqft consumed per unit. Falls back
    to the legacy demo figure only when the hub has zero inventory rows.
    """
    total_units = db.query(func.coalesce(func.sum(InventoryItem.quantity), 0)).filter(
        InventoryItem.warehouse_id == warehouse_id
    ).scalar() or 0
    if total_units <= 0:
        return DEMO_UTILIZATION_PCT.get(warehouse_id, 0.0)
    capacity_units = max(float(capacity_sqft or 0.0) * UNITS_PER_SQFT, 1.0)
    return round(min(total_units / capacity_units, 1.0) * 100.0, 1)


def _inventory_stats(db, warehouse_id: str):
    rows = db.query(InventoryItem).filter(InventoryItem.warehouse_id == warehouse_id).all()
    return (
        len({r.sku for r in rows}),
        sum(1 for r in rows if (r.quantity or 0) <= (r.reorder_threshold or 0)),
    )


def sort_warehouses(rows):
    """Deterministic depot ordering: seeded hubs first (stable depot = first row), then by name."""
    def key(w):
        try:
            return (0, DEMO_ID_ORDER.index(w.warehouse_id), "")
        except ValueError:
            return (1, 0, (w.warehouse_name or "").lower())
    return sorted(rows, key=key)


def _inventory_items(db, warehouse_id: str):
    return [
        {"sku": r.sku, "quantity": r.quantity, "reorder_threshold": r.reorder_threshold}
        for r in db.query(InventoryItem).filter(InventoryItem.warehouse_id == warehouse_id).all()
    ]


def _serialize(w: Warehouse, db: Session, is_depot: bool = False) -> Dict[str, Any]:
    total_skus, low_stock_count = _inventory_stats(db, w.warehouse_id)
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
        "current_utilization_pct": _utilization_pct(db, w.warehouse_id, w.storage_capacity_sqft),
        "total_skus": total_skus,
        "low_stock_count": low_stock_count,
        "status": w.status,
        "is_depot": is_depot,
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
    ordered = sort_warehouses(db.query(Warehouse).all())
    depot_id = ordered[0].warehouse_id if ordered else None
    return [_serialize(w, db, is_depot=(w.warehouse_id == depot_id)) for w in ordered]


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

    ordered = sort_warehouses(db.query(Warehouse).all())
    depot_id = ordered[0].warehouse_id if ordered else None
    return _serialize(wh, db, is_depot=(wh.warehouse_id == depot_id))


@router.delete("/{warehouse_id}", response_model=Dict[str, Any])
def delete_warehouse(warehouse_id: str, db: Session = Depends(get_db_session)):
    wh = db.query(Warehouse).filter(Warehouse.warehouse_id == warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail=f"Warehouse {warehouse_id} not found.")

    # Guarded delete: never orphan stock or scenario orders. The UI surfaces
    # these counts and asks the manager to move/delete them first.
    sku_count = db.query(InventoryItem).filter(InventoryItem.warehouse_id == warehouse_id).count()
    order_count = db.query(Order).filter(Order.warehouse_id == warehouse_id).count()
    if sku_count > 0 or order_count > 0:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Warehouse holds {sku_count} inventoried SKU row(s) and "
                f"{order_count} scenario order(s). Move or delete them first."
            ),
        )
    db.delete(wh)
    db.commit()

    return {"deleted": True, "warehouse_id": warehouse_id}

