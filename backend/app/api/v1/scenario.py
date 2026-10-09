"""Manual scenario inputs (orders) — CRUD + bulk paste + demo/empty presets."""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies.database import get_db_session
from app.db.models import Order
from app.db.seed_data import DEMO_ORDERS, ORDER_PRIORITIES

router = APIRouter(prefix="/scenario", tags=["Scenario Builder"])


class OrderCreate(BaseModel):
    customer_name: str
    dest_lat: float
    dest_lng: float
    weight_kg: float = 10.0
    priority: str = "NORMAL"
    warehouse_id: Optional[str] = None


class OrderPatch(BaseModel):
    customer_name: Optional[str] = None
    dest_lat: Optional[float] = None
    dest_lng: Optional[float] = None
    weight_kg: Optional[float] = None
    priority: Optional[str] = None


class OrderBulkCreate(BaseModel):
    items: List[OrderCreate]


class ScenarioResetRequest(BaseModel):
    preset: str = "demo"  # "demo" | "empty"


def _validate_order_payload(customer_name, dest_lat, dest_lng, weight_kg, priority, warehouse_id=None):
    if not customer_name or not customer_name.strip():
        raise HTTPException(status_code=400, detail="customer_name is required.")
    if not (-90.0 <= dest_lat <= 90.0):
        raise HTTPException(status_code=400, detail="dest_lat must be between -90 and 90.")
    if not (-180.0 <= dest_lng <= 180.0):
        raise HTTPException(status_code=400, detail="dest_lng must be between -180 and 180.")
    if weight_kg is None or weight_kg <= 0:
        raise HTTPException(status_code=400, detail="weight_kg must be greater than 0.")
    if priority not in ORDER_PRIORITIES:
        raise HTTPException(status_code=400, detail=f"priority must be one of: {', '.join(ORDER_PRIORITIES)}.")


def _serialize(order: Order) -> Dict[str, Any]:
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
    }


@router.get("/orders", response_model=List[Dict[str, Any]])
def list_orders(db: Session = Depends(get_db_session)):
    orders = db.query(Order).order_by(Order.created_at.asc(), Order.order_id.asc()).all()
    return [_serialize(o) for o in orders]


@router.post("/orders", response_model=Dict[str, Any])
def create_order(req: OrderCreate, db: Session = Depends(get_db_session)):
    _validate_order_payload(req.customer_name, req.dest_lat, req.dest_lng, req.weight_kg, req.priority, req.warehouse_id)
    order = Order(
        customer_name=req.customer_name.strip(),
        dest_lat=req.dest_lat,
        dest_lng=req.dest_lng,
        weight_kg=req.weight_kg,
        priority=req.priority,
        warehouse_id=req.warehouse_id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return _serialize(order)

@router.post("/orders/bulk", response_model=Dict[str, Any])
def create_orders_bulk(req: OrderBulkCreate, db: Session = Depends(get_db_session)):
    if not req.items:
        raise HTTPException(status_code=400, detail="Provide at least one order to import.")
    for item in req.items:
        _validate_order_payload(item.customer_name, item.dest_lat, item.dest_lng, item.weight_kg, item.priority, item.warehouse_id)
    created = [
        Order(
            customer_name=item.customer_name.strip(),
            dest_lat=item.dest_lat,
            dest_lng=item.dest_lng,
            weight_kg=item.weight_kg,
            priority=item.priority,
            warehouse_id=item.warehouse_id,
        )
        for item in req.items
    ]
    db.add_all(created)
    db.commit()
    for c in created:
        db.refresh(c)
    return {"count": len(created), "created": [_serialize(c) for c in created]}


@router.patch("/orders/{order_id}", response_model=Dict[str, Any])
def update_order(order_id: str, req: OrderPatch, db: Session = Depends(get_db_session)):
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found.")

    name = req.customer_name if req.customer_name is not None else order.customer_name
    lat = req.dest_lat if req.dest_lat is not None else order.dest_lat
    lng = req.dest_lng if req.dest_lng is not None else order.dest_lng
    weight = req.weight_kg if req.weight_kg is not None else order.weight_kg
    priority = req.priority if req.priority is not None else order.priority
    _validate_order_payload(name, lat, lng, weight, priority)

    order.customer_name = name.strip()
    order.dest_lat = lat
    order.dest_lng = lng
    order.weight_kg = weight
    order.priority = priority
    db.commit()
    db.refresh(order)
    return _serialize(order)


@router.delete("/orders/{order_id}", response_model=Dict[str, Any])
def delete_order(order_id: str, db: Session = Depends(get_db_session)):
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found.")
    db.delete(order)
    db.commit()
    return {"deleted": True, "order_id": order_id}


@router.post("/reset", response_model=Dict[str, Any])
def reset_scenario(req: ScenarioResetRequest, db: Session = Depends(get_db_session)):
    """Restore the demo order set or clear all manual orders (warehouses/vehicles untouched)."""
    if req.preset not in ("demo", "empty"):
        raise HTTPException(status_code=400, detail="preset must be 'demo' or 'empty'.")

    deleted = db.query(Order).delete()
    created: List[Order] = []
    if req.preset == "demo":
        created = [Order(**o) for o in DEMO_ORDERS]
        db.add_all(created)
    db.commit()

    return {
        "preset": req.preset,
        "deleted_orders": deleted,
        "created_orders": len(created),
        "orders": db.query(Order).count(),
    }

