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
]

# Vehicle live positions — parked at their home hubs (Mumbai / Delhi / Bengaluru).
VEHICLE_TELEMETRY = {
    "V-101": {"current_lat": 19.0760, "current_lng": 72.8777},
    "V-102": {"current_lat": 28.6139, "current_lng": 77.2090},
    "V-103": {"current_lat": 12.9716, "current_lng": 77.5946},
    "V-104": {"current_lat": 21.1458, "current_lng": 79.0882},
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
]


# Persistent inventory seed rows (mirror the legacy in-memory demo registry).
INVENTORY_SEEDS = [
    {"warehouse_id": "w1111111-1111-1111-1111-111111111111", "sku": "SKU-ELEC-101", "item_name": "Electronic Components Kit", "quantity": 140, "reorder_threshold": 30, "unit": "units"},
    {"warehouse_id": "w2222222-2222-2222-2222-222222222222", "sku": "SKU-ELEC-101", "item_name": "Electronic Components Kit", "quantity": 12, "reorder_threshold": 30, "unit": "units"},
    {"warehouse_id": "w3333333-3333-3333-3333-333333333333", "sku": "SKU-ELEC-101", "item_name": "Electronic Components Kit", "quantity": 55, "reorder_threshold": 30, "unit": "units"},
    {"warehouse_id": "w1111111-1111-1111-1111-111111111111", "sku": "SKU-PHAR-201", "item_name": "Pharmaceutical Supplies", "quantity": 45, "reorder_threshold": 15, "unit": "boxes"},
    {"warehouse_id": "w2222222-2222-2222-2222-222222222222", "sku": "SKU-PHAR-201", "item_name": "Pharmaceutical Supplies", "quantity": 8, "reorder_threshold": 15, "unit": "boxes"},
]

ORDER_PRIORITIES = ("LOW", "NORMAL", "HIGH", "CRITICAL_COLD_CHAIN")
