import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import engine, Base, SessionLocal
from app.db.models import Role, User, Vehicle, Driver, Warehouse, Order, InventoryItem
from app.db.seed_data import DEMO_ORDERS, WAREHOUSE_SEEDS, VEHICLE_SEEDS, INVENTORY_SEEDS
from app.core.security.hashing import hash_password

def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if not db.query(Role).first():
            roles = [
                Role(role_id="r-admin", role_name="ADMIN", description="System Administrator"),
                Role(role_id="r-mgr", role_name="WAREHOUSE_MANAGER", description="Warehouse Manager"),
                Role(role_id="r-disp", role_name="DISPATCHER", description="Fleet Dispatcher"),
                Role(role_id="r-drv", role_name="DRIVER", description="Vehicle Driver")
            ]
            db.add_all(roles)
            db.commit()

        if not db.query(User).first():
            admin_user = User(
                user_id="u-admin",
                role_id="r-admin",
                full_name="System Administrator",
                email="admin@logimind.ai",
                password_hash=hash_password("AdminPass123!"),
                phone_number="+1-555-0100",
                status="ACTIVE"
            )
            db.add(admin_user)
            db.commit()

        # Upsert vehicles so dataset refreshes apply on re-seed
        # (old Mumbai-cluster rows are replaced by the new spread-out seeds).
        for v_seed in VEHICLE_SEEDS:
            existing = db.query(Vehicle).filter(Vehicle.vehicle_id == v_seed["vehicle_id"]).first()
            if existing:
                for k, val in v_seed.items():
                    setattr(existing, k, val)
            else:
                db.add(Vehicle(**v_seed))
        # Drop legacy demo vehicles not in the new seed set.
        db.query(Vehicle).filter(~Vehicle.vehicle_id.in_([v["vehicle_id"] for v in VEHICLE_SEEDS])).delete(synchronize_session=False)
        db.commit()

        # Upsert warehouses (Mumbai hub stays depot = first row; others move to
        # Delhi / Bengaluru so hubs are spread across the country).
        for w_seed in WAREHOUSE_SEEDS:
            existing = db.query(Warehouse).filter(Warehouse.warehouse_id == w_seed["warehouse_id"]).first()
            if existing:
                for k, val in w_seed.items():
                    setattr(existing, k, val)
            else:
                db.add(Warehouse(**w_seed))
        db.commit()

        # Refresh demo orders: wipe old cluster + insert the 8 spread-out orders.
        db.query(Order).delete()
        db.add_all([Order(**o) for o in DEMO_ORDERS])
        db.commit()

        # Seed persistent inventory rows once (preserve manager edits on re-seed).
        if db.query(InventoryItem).count() == 0:
            db.add_all([InventoryItem(**row) for row in INVENTORY_SEEDS])
            db.commit()

        print("Database Seeding Completed Successfully.")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
