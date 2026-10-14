from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.dependencies.database import get_db_session
from app.db.models import Warehouse, InventoryItem
from app.db.seed_data import INVENTORY_SEEDS
from app.services.optimization.inventory_lp import InventoryLPOptimizer
from app.services.ml.forecaster import DemandForecaster

router = APIRouter(prefix="", tags=["Inventory Management"])

# INR per km transfer cost used by the LP optimizer UI estimates.
TRANSFER_COST_INR_PER_KM = 12.0

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

class UpdateInventoryItemRequest(BaseModel):
    quantity: Optional[int] = None
    reorder_threshold: Optional[int] = None
    item_name: Optional[str] = None
    unit: Optional[str] = None


class DemandForecastRequest(BaseModel):
    warehouse_id: str
    sku: str
    horizon_days: Optional[int] = 7


def _serialize(item: InventoryItem) -> Dict[str, Any]:
    return {
        "inventory_id": item.inventory_id,
        "warehouse_id": item.warehouse_id,
        "sku": item.sku,
        "item_name": item.item_name,
        "quantity": item.quantity,
        "reorder_threshold": item.reorder_threshold,
        "unit": item.unit,
    }


def _warehouse_or_404(db: Session, warehouse_id: str) -> Warehouse:
    wh = db.query(Warehouse).filter(Warehouse.warehouse_id == warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail=f"Unknown warehouse {warehouse_id}")
    return wh


def _warehouse_payload(db: Session) -> List[Dict[str, Any]]:
    """Live warehouse list for the LP optimizer — always from the DB so newly
    added hubs participate and deleted hubs never receive ghost transfers."""
    return [
        {"id": w.warehouse_id, "name": w.warehouse_name,
         "location_lat": w.latitude, "location_lng": w.longitude}
        for w in db.query(Warehouse).all()
    ]


def _inventory_payload(db: Session) -> List[Dict[str, Any]]:
    return [_serialize(i) for i in db.query(InventoryItem).all()]


def _warehouse_name(db: Session, warehouse_id: str) -> str:
    wh = db.query(Warehouse).filter(Warehouse.warehouse_id == warehouse_id).first()
    return wh.warehouse_name if wh else warehouse_id


@router.get("/inventory", response_model=List[Dict[str, Any]])
def get_inventory(warehouse_id: Optional[str] = None, db: Session = Depends(get_db_session)):
    q = db.query(InventoryItem)
    if warehouse_id:
        q = q.filter(InventoryItem.warehouse_id == warehouse_id)
    return [_serialize(i) for i in q.order_by(InventoryItem.sku.asc()).all()]


@router.get("/inventory/skus", response_model=List[Dict[str, Any]])
def list_skus(warehouse_id: Optional[str] = None, db: Session = Depends(get_db_session)):
    """Distinct SKUs (with per-warehouse availability) for dropdowns."""
    q = db.query(InventoryItem)
    if warehouse_id:
        q = q.filter(InventoryItem.warehouse_id == warehouse_id)
    by_sku: Dict[str, Dict[str, Any]] = {}
    for i in q.all():
        entry = by_sku.setdefault(i.sku, {
            "sku": i.sku, "item_name": i.item_name, "unit": i.unit,
            "total_quantity": 0, "warehouses": [],
        })
        entry["total_quantity"] += i.quantity or 0
        entry["warehouses"].append({
            "warehouse_id": i.warehouse_id,
            "warehouse_name": _warehouse_name(db, i.warehouse_id),
            "quantity": i.quantity,
        })
    return sorted(by_sku.values(), key=lambda e: e["sku"])

@router.post("/inventory", response_model=Dict[str, Any], status_code=201)
def create_inventory_item(req: CreateInventoryItemRequest, db: Session = Depends(get_db_session)):
    if not req.sku.strip():
        raise HTTPException(status_code=400, detail="SKU is required")
    if not req.item_name.strip():
        raise HTTPException(status_code=400, detail="Item name is required")
    if req.quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity must be >= 0")
    _warehouse_or_404(db, req.warehouse_id)

    sku = req.sku.strip().upper()
    existing = db.query(InventoryItem).filter(
        InventoryItem.warehouse_id == req.warehouse_id, InventoryItem.sku == sku
    ).first()
    if existing:
        # Merge into an existing SKU row at this warehouse instead of duplicating it
        existing.quantity = (existing.quantity or 0) + req.quantity
        db.commit()
        db.refresh(existing)
        return {"status": "MERGED", "item": _serialize(existing)}

    item = InventoryItem(
        warehouse_id=req.warehouse_id,
        sku=sku,
        item_name=req.item_name.strip(),
        quantity=req.quantity,
        reorder_threshold=max(req.reorder_threshold, 0),
        unit=req.unit.strip() or "units",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"status": "CREATED", "item": _serialize(item)}

@router.patch("/inventory/{inventory_id}", response_model=Dict[str, Any])
def update_inventory_item(inventory_id: str, req: UpdateInventoryItemRequest, db: Session = Depends(get_db_session)):
    """Edit quantity / threshold / name in place (no delete + re-add needed)."""
    item = db.query(InventoryItem).filter(InventoryItem.inventory_id == inventory_id).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Inventory item {inventory_id} not found")
    if req.quantity is not None:
        if req.quantity < 0:
            raise HTTPException(status_code=400, detail="Quantity must be >= 0")
        item.quantity = req.quantity
    if req.reorder_threshold is not None:
        if req.reorder_threshold < 0:
            raise HTTPException(status_code=400, detail="Reorder threshold must be >= 0")
        item.reorder_threshold = req.reorder_threshold
    if req.item_name is not None:
        if not req.item_name.strip():
            raise HTTPException(status_code=400, detail="Item name is required")
        item.item_name = req.item_name.strip()
    if req.unit is not None:
        item.unit = req.unit.strip() or "units"
    db.commit()
    db.refresh(item)
    return {"status": "UPDATED", "item": _serialize(item)}

@router.delete("/inventory/{inventory_id}", response_model=Dict[str, Any])
def delete_inventory_item(inventory_id: str, db: Session = Depends(get_db_session)):
    item = db.query(InventoryItem).filter(InventoryItem.inventory_id == inventory_id).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Inventory item {inventory_id} not found")
    payload = _serialize(item)
    db.delete(item)
    db.commit()
    return {"status": "REMOVED", "item": payload}

@router.post("/inventory/shift", response_model=Dict[str, Any])
def shift_inventory(req: ShiftInventoryRequest, db: Session = Depends(get_db_session)):
    if req.from_warehouse_id == req.to_warehouse_id:
        raise HTTPException(status_code=400, detail="Source and destination warehouses must differ")
    if req.quantity <= 0:
        raise HTTPException(status_code=400, detail="Shift quantity must be > 0")
    _warehouse_or_404(db, req.from_warehouse_id)
    _warehouse_or_404(db, req.to_warehouse_id)

    source = db.query(InventoryItem).filter(
        InventoryItem.warehouse_id == req.from_warehouse_id, InventoryItem.sku == req.sku
    ).first()
    if source is None:
        raise HTTPException(status_code=404, detail=f"SKU {req.sku} not stocked at source warehouse")
    if req.quantity > (source.quantity or 0):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot shift {req.quantity}: only {source.quantity} available at source",
        )

    dest = db.query(InventoryItem).filter(
        InventoryItem.warehouse_id == req.to_warehouse_id, InventoryItem.sku == req.sku
    ).first()
    source.quantity = (source.quantity or 0) - req.quantity
    if dest is None:
        dest = InventoryItem(
            warehouse_id=req.to_warehouse_id,
            sku=source.sku,
            item_name=source.item_name,
            quantity=req.quantity,
            reorder_threshold=source.reorder_threshold,
            unit=source.unit,
        )
        db.add(dest)
    else:
        dest.quantity = (dest.quantity or 0) + req.quantity
    db.commit()
    db.refresh(source)
    db.refresh(dest)

    return {
        "status": "SHIFTED",
        "sku": source.sku,
        "quantity": req.quantity,
        "from_warehouse": _warehouse_name(db, req.from_warehouse_id),
        "to_warehouse": _warehouse_name(db, req.to_warehouse_id),
        "source_item": _serialize(source),
        "destination_item": _serialize(dest),
    }

@router.post("/inventory/rebalance", response_model=Dict[str, Any])
def rebalance_inventory(db: Session = Depends(get_db_session)):
    optimizer = InventoryLPOptimizer(
        warehouses=_warehouse_payload(db),
        inventory_data=_inventory_payload(db),
        cost_per_km=TRANSFER_COST_INR_PER_KM,
        currency="₹",
    )
    return optimizer.optimize_rebalance()

@router.post("/forecast/demand", response_model=Dict[str, Any])
def forecast_demand(req: DemandForecastRequest):
    forecaster = DemandForecaster()
    return forecaster.forecast_warehouse_demand(req.warehouse_id, req.sku, req.horizon_days)
