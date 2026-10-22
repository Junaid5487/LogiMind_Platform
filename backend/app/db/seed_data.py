"""Shared demo-scenario data used by backend seeding and the /scenario/reset endpoint.

Field names mirror the experiment benchmark instance format (dest_lat/dest_lng/
weight_kg/priority) so app-scenarios stay compatible with the research pipeline in
experiments/.

All locations are REAL Indian cities, spread far apart (>= ~180 km between any
two points) so routes, map pins and the START(green)/END(red) markers are visually
distinct instead of clustering around Mumbai.
"""

# Real city coordinates (lat, lng) — all inside India.
CITIES = {
    # Depot + hubs (each far apart: Mumbai <-> Delhi ~1150km, Delhi <-> Bengaluru
    # ~1750km, Mumbai <-> Bengaluru ~840km)
    "Mumbai": (19.0760, 72.8777),
    "New Delhi": (28.6139, 77.2090),
    "Bengaluru": (12.9716, 77.5946),
    "Nagpur": (21.1458, 79.0882),
    # Delivery destinations — each >= ~180km from every other point
    "Jaipur": (26.9124, 75.7873),
    "Ahmedabad": (23.0225, 72.5714),
    "Lucknow": (26.8467, 80.9462),
    "Bhopal": (23.2599, 77.4126),
    "Chennai": (13.0827, 80.2707),
    "Hyderabad": (17.3850, 78.4867),
    "Kolkata": (22.5726, 88.3639),
    "Indore": (22.7196, 75.8577),
}

WAREHOUSE_SEEDS = [
    {"warehouse_id": "w1111111-1111-1111-1111-111111111111", "warehouse_name": "Mumbai Central Logistics Hub",
     "address": "Bhiwandi Logistics Park, NH 160", "city": "Mumbai", "state": "MH", "country": "India",
     "latitude": 19.0760, "longitude": 72.8777, "storage_capacity_sqft": 120000.0, "status": "ACTIVE"},
    {"warehouse_id": "w2222222-2222-2222-2222-222222222222", "warehouse_name": "Delhi NCR Distribution Center",
     "address": "Kundli Industrial Area, NH-44", "city": "New Delhi", "state": "DL", "country": "India",
     "latitude": 28.6139, "longitude": 77.2090, "storage_capacity_sqft": 95000.0, "status": "ACTIVE"},
    {"warehouse_id": "w3333333-3333-3333-3333-333333333333", "warehouse_name": "Bengaluru South Fulfillment Hub",
     "address": "Hosur Road Industrial Layout", "city": "Bengaluru", "state": "KA", "country": "India",
     "latitude": 12.9716, "longitude": 77.5946, "storage_capacity_sqft": 80000.0, "status": "ACTIVE"},
    {"warehouse_id": "w4444444-4444-4444-4444-444444444444", "warehouse_name": "Kolkata Port Logistics Centre",
     "address": "Taratala Industrial Area, Port Road", "city": "Kolkata", "state": "WB", "country": "India",
     "latitude": 22.5726, "longitude": 88.3639, "storage_capacity_sqft": 85000.0, "status": "ACTIVE"},
    {"warehouse_id": "w5555555-5555-5555-5555-555555555555", "warehouse_name": "Chennai Auto & Cargo Terminal",
     "address": "Sriperumbudur High-Tech Corridor", "city": "Chennai", "state": "TN", "country": "India",
     "latitude": 13.0827, "longitude": 80.2707, "storage_capacity_sqft": 90000.0, "status": "ACTIVE"},
    {"warehouse_id": "w6666666-6666-6666-6666-666666666666", "warehouse_name": "Hyderabad Tech & Pharma Gateway",
     "address": "Shamshabad Cargo Terminal Zone", "city": "Hyderabad", "state": "TS", "country": "India",
     "latitude": 17.3850, "longitude": 78.4867, "storage_capacity_sqft": 75000.0, "status": "ACTIVE"},
    {"warehouse_id": "w7777777-7777-7777-7777-777777777777", "warehouse_name": "Nagpur Zero-Mile Multimodal Cargo Hub",
     "address": "MIHAN Special Economic Zone, NH-44", "city": "Nagpur", "state": "MH", "country": "India",
     "latitude": 21.1458, "longitude": 79.0882, "storage_capacity_sqft": 110000.0, "status": "ACTIVE"},
]

VEHICLE_SEEDS = [
    {"vehicle_id": "V-101", "registration_number": "MH-TRK-101", "vehicle_type": "HEAVY_TRUCK",
     "brand": "Tata", "model": "Prima 5530.S", "manufacturing_year": 2022,
     "capacity_kg": 5000.0, "fuel_type": "DIESEL", "status": "AVAILABLE", "odometer_km": 62000.0},
    {"vehicle_id": "V-102", "registration_number": "DL-VAN-102", "vehicle_type": "EV_VAN",
     "brand": "Mahindra", "model": "Treo Zor EV", "manufacturing_year": 2023,
     "capacity_kg": 1800.0, "fuel_type": "ELECTRIC", "status": "AVAILABLE", "odometer_km": 18500.0},
    {"vehicle_id": "V-103", "registration_number": "KA-TRK-103", "vehicle_type": "HEAVY_TRUCK",
     "brand": "Eicher", "model": "Pro 3019", "manufacturing_year": 2021,
     "capacity_kg": 6000.0, "fuel_type": "DIESEL", "status": "AVAILABLE", "odometer_km": 115000.0},
    {"vehicle_id": "V-104", "registration_number": "MH-TRK-104", "vehicle_type": "REFRIGERATED_TRUCK",
     "brand": "Ashok Leyland", "model": "BADA DOST", "manufacturing_year": 2023,
     "capacity_kg": 2500.0, "fuel_type": "DIESEL", "status": "MAINTENANCE", "odometer_km": 31000.0},
    {"vehicle_id": "V-105", "registration_number": "TS-VAN-105", "vehicle_type": "EV_VAN",
     "brand": "Tata", "model": "Ace Gold EV", "manufacturing_year": 2024,
     "capacity_kg": 1200.0, "fuel_type": "ELECTRIC", "status": "AVAILABLE", "odometer_km": 14200.0},
    {"vehicle_id": "V-106", "registration_number": "WB-TRK-106", "vehicle_type": "HEAVY_TRUCK",
     "brand": "BharatBenz", "model": "2823R Heavy Cargo", "manufacturing_year": 2022,
     "capacity_kg": 8000.0, "fuel_type": "DIESEL", "status": "AVAILABLE", "odometer_km": 84200.0},
]

# Vehicle live positions and telemetry — parked at respective regional hubs.
VEHICLE_TELEMETRY = {
    "V-101": {"current_lat": 19.0760, "current_lng": 72.8777, "fuel_level_pct": 88, "engine_temp_c": 85.0, "health_status": "NORMAL", "failure_risk_pct": 15, "coolant_pressure_bar": 2.1, "tire_wear_pct": 30},
    "V-102": {"current_lat": 28.6139, "current_lng": 77.2090, "fuel_level_pct": 75, "engine_temp_c": 88.0, "health_status": "NORMAL", "failure_risk_pct": 22, "coolant_pressure_bar": 1.9, "tire_wear_pct": 25},
    "V-103": {"current_lat": 12.9716, "current_lng": 77.5946, "fuel_level_pct": 81, "engine_temp_c": 87.0, "health_status": "NORMAL", "failure_risk_pct": 25, "coolant_pressure_bar": 2.0, "tire_wear_pct": 42},
    "V-104": {"current_lat": 21.1458, "current_lng": 79.0882, "fuel_level_pct": 92, "engine_temp_c": 98.5, "health_status": "WARNING", "failure_risk_pct": 60, "coolant_pressure_bar": 2.7, "tire_wear_pct": 58},
    "V-105": {"current_lat": 17.3850, "current_lng": 78.4867, "fuel_level_pct": 90, "engine_temp_c": 82.0, "health_status": "NORMAL", "failure_risk_pct": 12, "coolant_pressure_bar": 1.8, "tire_wear_pct": 18},
    "V-106": {"current_lat": 22.5726, "current_lng": 88.3639, "fuel_level_pct": 85, "engine_temp_c": 86.5, "health_status": "NORMAL", "failure_risk_pct": 20, "coolant_pressure_bar": 2.2, "tire_wear_pct": 35},
}

DEMO_ORDERS = [
    {"order_id": "ORD-101", "customer_name": "Jaipur Retail Park", "dest_lat": 26.9124, "dest_lng": 75.7873, "weight_kg": 35.0, "priority": "CRITICAL_COLD_CHAIN"},
    {"order_id": "ORD-102", "customer_name": "Ahmedabad Pharma Distributors", "dest_lat": 23.0225, "dest_lng": 72.5714, "weight_kg": 85.0, "priority": "HIGH"},
    {"order_id": "ORD-103", "customer_name": "Lucknow Consumer Goods Depot", "dest_lat": 26.8467, "dest_lng": 80.9462, "weight_kg": 120.0, "priority": "NORMAL"},
    {"order_id": "ORD-104", "customer_name": "Bhopal Auto Components", "dest_lat": 23.2599, "dest_lng": 77.4126, "weight_kg": 50.0, "priority": "HIGH"},
    {"order_id": "ORD-105", "customer_name": "Chennai Electronics Hub", "dest_lat": 13.0827, "dest_lng": 80.2707, "weight_kg": 90.0, "priority": "NORMAL"},
    {"order_id": "ORD-106", "customer_name": "Hyderabad Life Sciences", "dest_lat": 17.3850, "dest_lng": 78.4867, "weight_kg": 65.0, "priority": "HIGH"},
    {"order_id": "ORD-107", "customer_name": "Kolkata Portside Traders", "dest_lat": 22.5726, "dest_lng": 88.3639, "weight_kg": 110.0, "priority": "NORMAL"},
    {"order_id": "ORD-108", "customer_name": "Indore FMCG Warehouse", "dest_lat": 22.7196, "dest_lng": 75.8577, "weight_kg": 75.0, "priority": "LOW"},
    {"order_id": "ORD-109", "customer_name": "Coimbatore Machinery Hub", "dest_lat": 11.0168, "dest_lng": 76.9558, "weight_kg": 95.0, "priority": "NORMAL"},
    {"order_id": "ORD-110", "customer_name": "Patna Agro & Chemical Center", "dest_lat": 25.5941, "dest_lng": 85.1376, "weight_kg": 115.0, "priority": "HIGH"},
]

# Persistent inventory seed rows across all 7 nationwide logistics hubs.
INVENTORY_SEEDS = [
    # SKU-ELEC-101: Electronic Components Kit
    {"warehouse_id": "w1111111-1111-1111-1111-111111111111", "sku": "SKU-ELEC-101", "item_name": "Electronic Components Kit", "quantity": 180, "reorder_threshold": 40, "unit": "units"},
    {"warehouse_id": "w2222222-2222-2222-2222-222222222222", "sku": "SKU-ELEC-101", "item_name": "Electronic Components Kit", "quantity": 15, "reorder_threshold": 35, "unit": "units"},
    {"warehouse_id": "w3333333-3333-3333-3333-333333333333", "sku": "SKU-ELEC-101", "item_name": "Electronic Components Kit", "quantity": 90, "reorder_threshold": 30, "unit": "units"},
    {"warehouse_id": "w4444444-4444-4444-4444-444444444444", "sku": "SKU-ELEC-101", "item_name": "Electronic Components Kit", "quantity": 25, "reorder_threshold": 30, "unit": "units"},
    {"warehouse_id": "w5555555-5555-5555-5555-555555555555", "sku": "SKU-ELEC-101", "item_name": "Electronic Components Kit", "quantity": 60, "reorder_threshold": 25, "unit": "units"},
    {"warehouse_id": "w6666666-6666-6666-6666-666666666666", "sku": "SKU-ELEC-101", "item_name": "Electronic Components Kit", "quantity": 110, "reorder_threshold": 35, "unit": "units"},
    {"warehouse_id": "w7777777-7777-7777-7777-777777777777", "sku": "SKU-ELEC-101", "item_name": "Electronic Components Kit", "quantity": 40, "reorder_threshold": 30, "unit": "units"},

    # SKU-PHAR-201: Cold-Chain Pharmaceutical Supplies
    {"warehouse_id": "w1111111-1111-1111-1111-111111111111", "sku": "SKU-PHAR-201", "item_name": "Pharmaceutical Supplies", "quantity": 65, "reorder_threshold": 20, "unit": "boxes"},
    {"warehouse_id": "w2222222-2222-2222-2222-222222222222", "sku": "SKU-PHAR-201", "item_name": "Pharmaceutical Supplies", "quantity": 8, "reorder_threshold": 20, "unit": "boxes"},
    {"warehouse_id": "w3333333-3333-3333-3333-333333333333", "sku": "SKU-PHAR-201", "item_name": "Pharmaceutical Supplies", "quantity": 85, "reorder_threshold": 25, "unit": "boxes"},
    {"warehouse_id": "w6666666-6666-6666-6666-666666666666", "sku": "SKU-PHAR-201", "item_name": "Pharmaceutical Supplies", "quantity": 140, "reorder_threshold": 30, "unit": "boxes"},
    {"warehouse_id": "w7777777-7777-7777-7777-777777777777", "sku": "SKU-PHAR-201", "item_name": "Pharmaceutical Supplies", "quantity": 12, "reorder_threshold": 20, "unit": "boxes"},

    # SKU-AUTO-301: Precision Automotive Fasteners
    {"warehouse_id": "w1111111-1111-1111-1111-111111111111", "sku": "SKU-AUTO-301", "item_name": "Automotive Fasteners Pack", "quantity": 250, "reorder_threshold": 50, "unit": "cartons"},
    {"warehouse_id": "w5555555-5555-5555-5555-555555555555", "sku": "SKU-AUTO-301", "item_name": "Automotive Fasteners Pack", "quantity": 310, "reorder_threshold": 60, "unit": "cartons"},
    {"warehouse_id": "w7777777-7777-7777-7777-777777777777", "sku": "SKU-AUTO-301", "item_name": "Automotive Fasteners Pack", "quantity": 45, "reorder_threshold": 50, "unit": "cartons"},

    # SKU-FMCG-401: Consumer Goods Express Pack
    {"warehouse_id": "w1111111-1111-1111-1111-111111111111", "sku": "SKU-FMCG-401", "item_name": "FMCG Daily Essentials", "quantity": 420, "reorder_threshold": 80, "unit": "cases"},
    {"warehouse_id": "w2222222-2222-2222-2222-222222222222", "sku": "SKU-FMCG-401", "item_name": "FMCG Daily Essentials", "quantity": 380, "reorder_threshold": 80, "unit": "cases"},
    {"warehouse_id": "w4444444-4444-4444-4444-444444444444", "sku": "SKU-FMCG-401", "item_name": "FMCG Daily Essentials", "quantity": 290, "reorder_threshold": 70, "unit": "cases"},
]

ORDER_PRIORITIES = ("LOW", "NORMAL", "HIGH", "CRITICAL_COLD_CHAIN")


def seed_database_if_empty(db):
    """Self-healing seeder: ensures all default warehouses, vehicles, and inventories exist."""
    from app.db.models import Warehouse, Vehicle, InventoryItem, Order, Role, User, Driver

    # 1. Seed Warehouses
    for w_seed in WAREHOUSE_SEEDS:
        existing = db.query(Warehouse).filter(Warehouse.warehouse_id == w_seed["warehouse_id"]).first()
        if not existing:
            db.add(Warehouse(**w_seed))

    # 2. Seed Vehicles
    for v_seed in VEHICLE_SEEDS:
        existing = db.query(Vehicle).filter(Vehicle.vehicle_id == v_seed["vehicle_id"]).first()
        if not existing:
            db.add(Vehicle(**v_seed))

    # 3. Seed Inventory Items
    for inv_seed in INVENTORY_SEEDS:
        existing = db.query(InventoryItem).filter(
            InventoryItem.warehouse_id == inv_seed["warehouse_id"],
            InventoryItem.sku == inv_seed["sku"]
        ).first()
        if not existing:
            db.add(InventoryItem(**inv_seed))

    # 4. Seed Orders if empty
    if db.query(Order).count() == 0:
        for ord_seed in DEMO_ORDERS:
            db.add(Order(**ord_seed))

    # 5. Ensure Default Roles & Driver User
    driver_role = db.query(Role).filter(Role.role_name == "driver").first()
    if not driver_role:
        driver_role = Role(role_name="driver", description="Fleet Driver Persona")
        db.add(driver_role)
        db.flush()

    default_user = db.query(User).filter(User.email == "driver@logimind.ai").first()
    if not default_user:
        default_user = User(
            full_name="Rajesh Kumar",
            email="driver@logimind.ai",
            password_hash="$2b$12$e8Y6/demo_hash",
            phone_number="+91 98765 43210",
            status="ACTIVE",
            role_id=driver_role.role_id,
        )
        db.add(default_user)
        db.flush()

    default_driver = db.query(Driver).filter(Driver.user_id == default_user.user_id).first()
    if not default_driver:
        db.add(Driver(
            user_id=default_user.user_id,
            license_number="DL-IND-2022-9842",
            license_expiry="2028-12-31",
            experience_years=8,
            availability_status="AVAILABLE",
            rating_score=4.9,
        ))

    db.commit()

