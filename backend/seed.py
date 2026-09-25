import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import engine, Base, SessionLocal
from app.db.models import Role, User, Vehicle, Driver, Warehouse
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

        if not db.query(Vehicle).first():
            vehicles = [
                Vehicle(vehicle_id="V-101", registration_number="NY-TRK-101", vehicle_type="HEAVY_TRUCK", brand="Freightliner", model="M2 106", manufacturing_year=2022, capacity_kg=5000.0, fuel_type="DIESEL", status="AVAILABLE", odometer_km=62000.0),
                Vehicle(vehicle_id="V-102", registration_number="NJ-VAN-102", vehicle_type="EV_VAN", brand="Mercedes-Benz", model="eSprinter", manufacturing_year=2023, capacity_kg=1800.0, fuel_type="ELECTRIC", status="IN_TRANSIT", odometer_km=18500.0),
                Vehicle(vehicle_id="V-104", registration_number="PA-TRK-104", vehicle_type="EV_VAN", brand="Ford", model="E-Transit", manufacturing_year=2023, capacity_kg=1500.0, fuel_type="ELECTRIC", status="MAINTENANCE", odometer_km=31000.0)
            ]
            db.add_all(vehicles)
            db.commit()

        if not db.query(Warehouse).first():
            warehouses = [
                Warehouse(warehouse_id="w1111111-1111-1111-1111-111111111111", warehouse_name="Mumbai Central Logistics Hub", address="Bhiwandi Logistics Park, NH 160", city="Mumbai", state="MH", country="India", latitude=19.0760, longitude=72.8777, storage_capacity_sqft=120000.0, status="ACTIVE"),
                Warehouse(warehouse_id="w2222222-2222-2222-2222-222222222222", warehouse_name="Navi Mumbai Cargo Distribution Center", address="JNPT Port Expressway", city="Navi Mumbai", state="MH", country="India", latitude=19.0330, longitude=73.0297, storage_capacity_sqft=95000.0, status="ACTIVE"),
                Warehouse(warehouse_id="w3333333-3333-3333-3333-333333333333", warehouse_name="Pune Industrial Fulfillment Hub", address="Chakan MIDC Phase II", city="Pune", state="MH", country="India", latitude=18.5204, longitude=73.8567, storage_capacity_sqft=80000.0, status="ACTIVE")
            ]
            db.add_all(warehouses)
            db.commit()

        print("Database Seeding Completed Successfully.")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
