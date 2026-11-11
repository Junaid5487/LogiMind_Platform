from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.dependencies.database import get_db_session
from app.db.models import Warehouse, InventoryItem, Order, Vehicle
from app.db.seed_data import INVENTORY_SEEDS
from app.services.optimization.inventory_lp import InventoryLPOptimizer
from app.services.ml.forecaster import DemandForecaster, ForecastForecaster

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

class AddItemToHubRequest(BaseModel):
    sku: str
    item_name: str
    quantity: int
    reorder_threshold: int = 10
    unit: str = "units"
    customer_name: Optional[str] = None
    delivery_address: Optional[str] = None
    dest_lat: Optional[float] = None
    dest_lng: Optional[float] = None
    weight_kg: Optional[float] = None

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


def _serialize_order(order: Order) -> Dict[str, Any]:
    return {
        "order_id": order.order_id,
        "customer_name": order.customer_name,
        "dest_lat": order.dest_lat,
        "dest_lng": order.dest_lng,
        "weight_kg": order.weight_kg,
        "priority": order.priority,
        "status": order.status,
        "warehouse_id": order.warehouse_id,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
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


def create_inventory_item_record(
    db: Session,
    warehouse_id: str,
    sku: str,
    item_name: str,
    quantity: int,
    reorder_threshold: int = 10,
    unit: str = "units",
) -> Dict[str, Any]:
    if not sku.strip():
        raise HTTPException(status_code=400, detail="SKU is required")
    if not item_name.strip():
        raise HTTPException(status_code=400, detail="Item name is required")
    if quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity must be >= 0")
    _warehouse_or_404(db, warehouse_id)

    clean_sku = sku.strip().upper()
    existing = db.query(InventoryItem).filter(
        InventoryItem.warehouse_id == warehouse_id, InventoryItem.sku == clean_sku
    ).first()
    if existing:
        existing.quantity = (existing.quantity or 0) + quantity
        db.commit()
        db.refresh(existing)
        return {"status": "MERGED", "item": _serialize(existing)}

    item = InventoryItem(
        warehouse_id=warehouse_id,
        sku=clean_sku,
        item_name=item_name.strip(),
        quantity=quantity,
        reorder_threshold=max(reorder_threshold, 0),
        unit=unit.strip() or "units",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"status": "CREATED", "item": _serialize(item)}


@router.post("/inventory", response_model=Dict[str, Any], status_code=201)
def create_inventory_item(req: CreateInventoryItemRequest, db: Session = Depends(get_db_session)):
    return create_inventory_item_record(
        db,
        req.warehouse_id,
        req.sku,
        req.item_name,
        req.quantity,
        req.reorder_threshold,
        req.unit,
    )


@router.post("/warehouses/{warehouse_id}/items", response_model=Dict[str, Any], status_code=201)
def add_item_to_hub(warehouse_id: str, req: AddItemToHubRequest, db: Session = Depends(get_db_session)):
    """Add stock to a chosen hub. Optionally creates a delivery order and auto-generates routes."""
    result = create_inventory_item_record(
        db,
        warehouse_id,
        req.sku,
        req.item_name,
        req.quantity,
        req.reorder_threshold,
        req.unit,
    )

    delivery_order = None
    route = None
    if req.customer_name and req.customer_name.strip() and req.dest_lat is not None and req.dest_lng is not None:
        if not (-90.0 <= req.dest_lat <= 90.0):
            raise HTTPException(status_code=400, detail="dest_lat must be between -90 and 90.")
        if not (-180.0 <= req.dest_lng <= 180.0):
            raise HTTPException(status_code=400, detail="dest_lng must be between -180 and 180.")

        weight = req.weight_kg if req.weight_kg and req.weight_kg > 0 else 10.0
        order = Order(
            customer_name=req.customer_name.strip(),
            dest_lat=req.dest_lat,
            dest_lng=req.dest_lng,
            weight_kg=weight,
            priority="NORMAL",
            warehouse_id=warehouse_id,
            status="PENDING",
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        delivery_order = _serialize_order(order)

        try:
            from app.services.optimization.vrp_solver import VRPOptimizer
            from app.api.v1.warehouses import sort_warehouses
            from app.api.v1.vehicles import vehicle_telemetry

            wh_list = [
                {
                    "id": w.warehouse_id,
                    "name": w.warehouse_name,
                    "lat": w.latitude,
                    "lng": w.longitude,
                }
                for w in sort_warehouses(db.query(Warehouse).all())
            ]
            ord_list = [
                {
                    "id": o.order_id,
                    "customer_name": o.customer_name,
                    "dest_lat": o.dest_lat,
                    "dest_lng": o.dest_lng,
                    "weight_kg": o.weight_kg,
                    "priority": o.priority,
                }
                for o in db.query(Order).order_by(Order.created_at.asc(), Order.order_id.asc()).all()
            ]
            veh_list = [
                {
                    "id": v.vehicle_id,
                    "name": f"{v.brand or ''} {v.model or ''}".strip() or v.vehicle_id,
                    "capacity_kg": v.capacity_kg,
                    "fuel_type": v.fuel_type,
                    "status": v.status,
                    **vehicle_telemetry(v.vehicle_id),
                }
                for v in db.query(Vehicle).order_by(Vehicle.vehicle_id.asc()).all()
            ]
            if ord_list and veh_list:
                solver = VRPOptimizer(warehouses=wh_list, orders=ord_list, vehicles=veh_list)
                route = solver.solve_vrp()
            else:
                route = {"status": "NO_ORDERS_OR_VEHICLES", "routes": []}
        except Exception as exc:
            route = {"status": "ROUTE_GENERATION_FAILED", "error": str(exc), "routes": []}

    return {
        **result,
        "delivery_order": delivery_order,
        "route": route,
    }


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


@router.get("/forecast/products", response_model=List[Dict[str, Any]])
def forecast_products(warehouse_id: str, horizon_days: int = 7, multiplier: float = 1.0):
    """Products in demand with quantities"""
    forecaster = DemandForecaster()
    return forecaster.forecast_products_in_demand(warehouse_id, horizon_days=horizon_days, what_if_multiplier=multiplier)


@router.get("/forecast/vehicles-needed", response_model=Dict[str, Any])
def forecast_vehicles_needed(warehouse_id: str, horizon_days: int = 7, export: bool = True, multiplier: float = 1.0):
    """Vehicles needed for export/import"""
    forecaster = DemandForecaster()
    return forecaster.forecast_vehicles_needed(warehouse_id, horizon_days=horizon_days, export=export, what_if_multiplier=multiplier)


@router.get("/forecast/summary", response_model=Dict[str, Any])
def forecast_summary(warehouse_id: str, horizon_days: int = 7, multiplier: float = 1.0):
    """Complete warehouse demand summary"""
    forecaster = DemandForecaster()
    return forecaster.forecast_warehouse_summary(warehouse_id, horizon_days=horizon_days, what_if_multiplier=multiplier)


@router.get("/forecast/analytics", response_model=Dict[str, Any])
def forecast_analytics(warehouse_id: str = "ALL", horizon_days: int = 7, mode: str = "EXPORT", multiplier: float = 1.0):
    """Unified ML forecasting analytics across demand, fleet, storage, and procurement"""
    forecaster = DemandForecaster()
    return forecaster.forecast_full_analytics(warehouse_id, horizon_days=horizon_days, mode=mode, what_if_multiplier=multiplier)
