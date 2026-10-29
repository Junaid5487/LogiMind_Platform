"""Background activity simulator."""
import os
import time
import random
import threading
from typing import Optional, Dict, List
import collections
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.logging import logger
from app.db.session import SessionLocal
from app.db.models import Warehouse, Vehicle, InventoryItem, Order, MaintenanceLog
from app.db.seed_data import (
    WAREHOUSE_SEEDS, VEHICLE_SEEDS, INVENTORY_SEEDS, DEMO_ORDERS, CITIES,
)

SEEDED_WAREHOUSE_IDS = {w["warehouse_id"] for w in WAREHOUSE_SEEDS}
SEEDED_VEHICLE_IDS = {v["vehicle_id"] for v in VEHICLE_SEEDS}
SEEDED_ORDER_IDS = {o["order_id"] for o in DEMO_ORDERS}

MIN_VEHICLES = 3
MIN_WAREHOUSES = 3
MIN_INVENTORY = 5
MIN_ORDERS = 5

VEHICLE_TYPES = ["HEAVY_TRUCK", "EV_VAN", "REFRIGERATED_TRUCK", "LIGHT_TRUCK"]
VEHICLE_BRANDS = [
    ("Tata", "Prima 5530.S", "DIESEL", 5000.0),
    ("Mahindra", "Treo Zor EV", "ELECTRIC", 1800.0),
    ("Eicher", "Pro 3019", "DIESEL", 6000.0),
    ("Ashok Leyland", "BADA DOST", "DIESEL", 2500.0),
    ("BharatBenz", "2823R Heavy Cargo", "DIESEL", 8000.0),
]
SKUS = [
    ("SKU-ELEC-101", "Electronic Components Kit", "units"),
    ("SKU-PHAR-201", "Pharmaceutical Supplies", "boxes"),
    ("SKU-AUTO-301", "Automotive Fasteners Pack", "cartons"),
    ("SKU-FMCG-401", "FMCG Daily Essentials", "cases"),
]
PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL_COLD_CHAIN"]
CITY_NAMES = list(CITIES.keys())


def _gen_vehicle_id(db: Session) -> str:
    existing = {v.vehicle_id for v in db.query(Vehicle).all()}
    while True:
        vid = f"V-AUTO-{random.randint(100, 999)}"
        if vid not in existing:
            return vid


def _add_vehicle(db: Session) -> Optional[str]:
    vid = _gen_vehicle_id(db)
    brand, model, fuel, cap = random.choice(VEHICLE_BRANDS)
    v = Vehicle(
        vehicle_id=vid,
        registration_number=f"AUTO-{vid}",
        vehicle_type=random.choice(VEHICLE_TYPES),
        brand=brand,
        model=model,
        manufacturing_year=random.choice([2021, 2022, 2023, 2024]),
        capacity_kg=cap,
        fuel_type=fuel,
        status=random.choice(["AVAILABLE", "AVAILABLE", "AVAILABLE", "MAINTENANCE"]),
        odometer_km=round(random.uniform(5000.0, 90000.0), 1),
    )
    db.add(v)
    try:
        from app.api.v1.vehicles import VEHICLE_TELEMETRY_DEFAULTS, VEHICLE_TELEMETRY_FALLBACK
        VEHICLE_TELEMETRY_DEFAULTS[vid] = dict(VEHICLE_TELEMETRY_FALLBACK)
    except Exception:
        pass
    return f"added vehicle {vid}"


def _remove_vehicle(db: Session) -> Optional[str]:
    candidates = [v for v in db.query(Vehicle).all() if v.vehicle_id not in SEEDED_VEHICLE_IDS]
    if not candidates:
        return None
    if db.query(Vehicle).count() <= MIN_VEHICLES:
        return None
    v = random.choice(candidates)
    db.query(MaintenanceLog).filter(MaintenanceLog.vehicle_id == v.vehicle_id).delete()
    vid = v.vehicle_id
    db.delete(v)
    return f"removed vehicle {vid}"


def _add_warehouse(db: Session) -> Optional[str]:
    city = random.choice(CITY_NAMES)
    lat, lng = CITIES[city]
    wh = Warehouse(
        warehouse_name=f"{city} Auto Hub {random.randint(1, 99)}",
        address=f"Auto-generated logistics park, {city}",
        city=city,
        state=None,
        country="India",
        latitude=lat,
        longitude=lng,
        storage_capacity_sqft=random.choice([50000.0, 75000.0, 90000.0, 110000.0]),
        status="ACTIVE",
    )
    db.add(wh)
    db.flush()
    return f"added hub {wh.warehouse_name} ({wh.warehouse_id})"


def _remove_warehouse(db: Session) -> Optional[str]:
    candidates = []
    for w in db.query(Warehouse).all():
        if w.warehouse_id in SEEDED_WAREHOUSE_IDS:
            continue
        if db.query(InventoryItem).filter(InventoryItem.warehouse_id == w.warehouse_id).count() > 0:
            continue
        if db.query(Order).filter(Order.warehouse_id == w.warehouse_id).count() > 0:
            continue
        candidates.append(w)
    if not candidates:
        return None
    if db.query(Warehouse).count() <= MIN_WAREHOUSES:
        return None
    w = random.choice(candidates)
    wid = w.warehouse_id
    name = w.warehouse_name
    db.delete(w)
    return f"removed hub {name} ({wid})"


def _add_inventory(db: Session) -> Optional[str]:
    warehouses = db.query(Warehouse).all()
    if not warehouses:
        return None
    wh = random.choice(warehouses)
    existing_keys = {(i.warehouse_id, i.sku) for i in db.query(InventoryItem).all()}
    choices = [(sku, name, unit) for (sku, name, unit) in SKUS if (wh.warehouse_id, sku) not in existing_keys]
    if not choices:
        row = db.query(InventoryItem).filter(InventoryItem.warehouse_id == wh.warehouse_id).order_by(InventoryItem.inventory_id).first()
        if row is None:
            return None
        before = row.quantity or 0
        row.quantity = before + random.randint(5, 40)
        return f"replenished {row.sku} at {wh.warehouse_name} (+{row.quantity - before})"
    sku, name, unit = random.choice(choices)
    item = InventoryItem(
        warehouse_id=wh.warehouse_id,
        sku=sku,
        item_name=name,
        quantity=random.randint(20, 400),
        reorder_threshold=random.choice([20, 30, 40, 50, 60, 80]),
        unit=unit,
    )
    db.add(item)
    return f"added inventory {sku} to {wh.warehouse_name}"


def _remove_inventory(db: Session) -> Optional[str]:
    if db.query(InventoryItem).count() <= MIN_INVENTORY:
        return None
    item = random.choice(db.query(InventoryItem).all())
    payload = f"removed inventory {item.sku} from warehouse {item.warehouse_id}"
    db.delete(item)
    return payload


def _add_order(db: Session) -> Optional[str]:
    city = random.choice(CITY_NAMES)
    lat, lng = CITIES[city]
    warehouses = db.query(Warehouse).all()
    wh = random.choice(warehouses) if warehouses else None
    order = Order(
        customer_name=f"{city} Auto Customer {random.randint(1, 999)}",
        dest_lat=lat,
        dest_lng=lng,
        weight_kg=round(random.uniform(10.0, 150.0), 1),
        priority=random.choice(PRIORITIES),
        warehouse_id=wh.warehouse_id if wh else None,
        status="PENDING",
    )
    db.add(order)
    db.flush()
    return f"added route/order {order.order_id} -> {city}"


def _remove_order(db: Session) -> Optional[str]:
    if db.query(Order).count() <= MIN_ORDERS:
        return None
    order = random.choice(db.query(Order).all())
    oid = order.order_id
    db.delete(order)
    return f"removed route/order {oid}"


def perform_random_mutation(db: Session) -> Optional[str]:
    plan = [
        ("vehicle", _add_vehicle, _remove_vehicle),
        ("warehouse", _add_warehouse, _remove_warehouse),
        ("inventory", _add_inventory, _remove_inventory),
        ("order", _add_order, _remove_order),
    ]
    random.shuffle(plan)
    for _entity, add_fn, remove_fn in plan:
        for op_fn in random.sample([add_fn, remove_fn], 2):
            try:
                desc = op_fn(db)
                if desc:
                    return desc
            except Exception as exc:
                db.rollback()
                logger.warning(f"Activity simulator op failed: {exc}")
    return None


_started = False
_lock = threading.Lock()
_history = collections.deque(maxlen=500)
_history_lock = threading.Lock()
_last_run = None
_interval = 0
_disabled = False
_history = collections.deque(maxlen=500)
_history_lock = threading.Lock()
_last_run = None
_interval = 0
_disabled = False


def record_activity(description: str, changed: bool = True, error: Optional[str] = None):
    global _last_run
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "description": description,
        "changed": changed,
    }
    if error:
        entry["error"] = error
    with _history_lock:
        _history.appendleft(entry)
        _last_run = entry["timestamp"]


def get_recent_activity(limit: int = 100) -> List[Dict]:
    with _history_lock:
        items = list(_history)
    return items[:limit]


def get_activity_count() -> int:
    with _history_lock:
        return len(_history)


def get_simulator_status() -> Dict:
    return {
        "started": _started,
        "disabled": _disabled,
        "interval_seconds": _interval,
        "last_run_at": _last_run,
        "history_size": get_activity_count(),
    }


def _loop(interval: int):
    global _interval, _disabled
    _interval = interval
    while True:
        time.sleep(interval)
        try:
            db = SessionLocal()
            try:
                desc = perform_random_mutation(db)
                if desc:
                    db.commit()
                    logger.info(f"[activity] {desc}")
                    record_activity(desc, changed=True)
                else:
                    db.rollback()
                    logger.info("[activity] no eligible mutation this cycle")
                    record_activity("No eligible mutation this cycle", changed=False)
            finally:
                db.close()
        except Exception as exc:
            logger.error(f"Activity simulator cycle failed: {exc}", exc_info=True)
            record_activity(f"Cycle failed: {exc}", changed=False, error=str(exc))


def start_activity_simulator():
    global _started, _disabled
    with _lock:
        if _started:
            return
        _started = True
    interval = int(os.getenv("LOGIMIND_ACTIVITY_INTERVAL", "300"))
    if interval <= 0:
        _disabled = True
        logger.info("Activity simulator disabled (LOGIMIND_ACTIVITY_INTERVAL<=0)")
        return
    t = threading.Thread(target=_loop, args=(interval,), daemon=True, name="logimind-activity")
    t.start()
    logger.info(f"Activity simulator started (interval={interval}s)")
