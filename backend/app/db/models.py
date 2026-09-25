import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text, Enum
)
from sqlalchemy.orm import relationship
from app.db.session import Base

def generate_uuid():
    return str(uuid.uuid4())

class Role(Base):
    __tablename__ = "roles"
    role_id = Column(String(36), primary_key=True, default=generate_uuid)
    role_name = Column(String(50), unique=True, nullable=False)
    description = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="role")

class User(Base):
    __tablename__ = "users"
    user_id = Column(String(36), primary_key=True, default=generate_uuid)
    role_id = Column(String(36), ForeignKey("roles.role_id"), nullable=False)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    phone_number = Column(String(30))
    status = Column(String(20), default="ACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow)

    role = relationship("Role", back_populates="users")
    driver = relationship("Driver", back_populates="user", uselist=False)

class Driver(Base):
    __tablename__ = "drivers"
    driver_id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    license_number = Column(String(50), unique=True, nullable=False)
    license_expiry = Column(String(20))
    experience_years = Column(Integer, default=0)
    joining_date = Column(String(20))
    emergency_contact = Column(String(30))
    availability_status = Column(String(20), default="AVAILABLE")
    rating_score = Column(Float, default=5.0)

    user = relationship("User", back_populates="driver")

class Vehicle(Base):
    __tablename__ = "vehicles"
    vehicle_id = Column(String(36), primary_key=True, default=generate_uuid)
    registration_number = Column(String(50), unique=True, nullable=False)
    vehicle_type = Column(String(30), nullable=False)
    brand = Column(String(50))
    model = Column(String(50))
    manufacturing_year = Column(Integer)
    capacity_kg = Column(Float, nullable=False)
    fuel_type = Column(String(20), default="DIESEL")
    status = Column(String(20), default="AVAILABLE")
    odometer_km = Column(Float, default=0.0)

class Warehouse(Base):
    __tablename__ = "warehouses"
    warehouse_id = Column(String(36), primary_key=True, default=generate_uuid)
    manager_id = Column(String(36), ForeignKey("users.user_id"), nullable=True)
    warehouse_name = Column(String(100), nullable=False)
    address = Column(String(255))
    city = Column(String(50), nullable=False)
    state = Column(String(50))
    country = Column(String(50), default="USA")
    postal_code = Column(String(20))
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    storage_capacity_sqft = Column(Float, default=100000.0)
    status = Column(String(20), default="ACTIVE")

class Product(Base):
    __tablename__ = "products"
    product_id = Column(String(36), primary_key=True, default=generate_uuid)
    sku = Column(String(50), unique=True, nullable=False)
    product_name = Column(String(100), nullable=False)
    category = Column(String(50))
    brand = Column(String(50))
    description = Column(Text)
    unit = Column(String(20), default="Units")
    weight_kg = Column(Float, default=1.0)
    dimensions_cm = Column(String(30))
    unit_price = Column(Float, default=0.0)
    status = Column(String(20), default="ACTIVE")

class Inventory(Base):
    __tablename__ = "inventory"
    inventory_id = Column(String(36), primary_key=True, default=generate_uuid)
    warehouse_id = Column(String(36), ForeignKey("warehouses.warehouse_id"), nullable=False)
    product_id = Column(String(36), ForeignKey("products.product_id"), nullable=False)
    quantity_available = Column(Integer, default=0)
    reserved_quantity = Column(Integer, default=0)
    minimum_stock_level = Column(Integer, default=20)
    status = Column(String(20), default="IN_STOCK")

class Customer(Base):
    __tablename__ = "customers"
    customer_id = Column(String(36), primary_key=True, default=generate_uuid)
    customer_name = Column(String(100), nullable=False)
    company_name = Column(String(100))
    email = Column(String(100))
    phone_number = Column(String(30))
    address = Column(String(255))
    city = Column(String(50))
    state = Column(String(50))
    country = Column(String(50), default="USA")
    postal_code = Column(String(20))
    customer_type = Column(String(30), default="B2B")
    status = Column(String(20), default="ACTIVE")

class Shipment(Base):
    __tablename__ = "shipments"
    shipment_id = Column(String(36), primary_key=True, default=generate_uuid)
    tracking_number = Column(String(50), unique=True, nullable=False)
    customer_id = Column(String(36), ForeignKey("customers.customer_id"), nullable=False)
    origin_warehouse_id = Column(String(36), ForeignKey("warehouses.warehouse_id"), nullable=False)
    destination_address = Column(String(255), nullable=False)
    destination_city = Column(String(50), nullable=False)
    destination_latitude = Column(Float, nullable=False)
    destination_longitude = Column(Float, nullable=False)
    total_weight_kg = Column(Float, default=10.0)
    priority = Column(String(30), default="NORMAL")
    status = Column(String(30), default="PENDING")
    created_at = Column(DateTime, default=datetime.utcnow)

class Route(Base):
    __tablename__ = "routes"
    route_id = Column(String(36), primary_key=True, default=generate_uuid)
    route_name = Column(String(100), nullable=False)
    origin_warehouse_id = Column(String(36), ForeignKey("warehouses.warehouse_id"), nullable=False)
    destination_city = Column(String(50), nullable=False)
    distance_km = Column(Float, nullable=False)
    estimated_duration_minutes = Column(Integer)
    estimated_fuel_liters = Column(Float)

class Trip(Base):
    __tablename__ = "trips"
    trip_id = Column(String(36), primary_key=True, default=generate_uuid)
    driver_id = Column(String(36), ForeignKey("drivers.driver_id"), nullable=False)
    vehicle_id = Column(String(36), ForeignKey("vehicles.vehicle_id"), nullable=False)
    route_id = Column(String(36), ForeignKey("routes.route_id"), nullable=False)
    shipment_id = Column(String(36), ForeignKey("shipments.shipment_id"), nullable=True)
    start_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="IN_PROGRESS")
    start_odometer_km = Column(Float, default=0.0)
    remarks = Column(Text)

class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"
    maintenance_log_id = Column(String(36), primary_key=True, default=generate_uuid)
    vehicle_id = Column(String(36), ForeignKey("vehicles.vehicle_id"), nullable=False)
    service_type = Column(String(50), nullable=False)
    component_serviced = Column(String(100))
    service_date = Column(String(20))
    cost = Column(Float, default=0.0)
    service_center = Column(String(100))
    status = Column(String(20), default="IN_PROGRESS")
    failure_risk_score = Column(Float, default=0.0)
    description = Column(Text)
