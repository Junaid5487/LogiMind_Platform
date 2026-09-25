from fastapi import APIRouter
from typing import Dict, Any
from app.services.optimization.vrp_solver import VRPOptimizer

router = APIRouter(prefix="/routes", tags=["Routes & VRP Optimization"])

@router.post("/optimize", response_model=Dict[str, Any])
def optimize_fleet_routes():
    """
    Executes Google OR-Tools Metaheuristic Multi-Stop VRP Optimizer.
    """
    warehouses = [
        {"id": "w1111111-1111-1111-1111-111111111111", "name": "Mumbai Central Logistics Hub", "lat": 19.0760, "lng": 72.8777},
        {"id": "w2222222-2222-2222-2222-222222222222", "name": "Navi Mumbai Cargo Distribution Center", "lat": 19.0330, "lng": 73.0297},
        {"id": "w3333333-3333-3333-3333-333333333333", "name": "Pune Industrial Fulfillment Hub", "lat": 18.5204, "lng": 73.8567}
    ]

    orders = [
        {"id": "ORD-101", "customer_name": "Apex BioMed South Mumbai", "dest_lat": 18.9220, "dest_lng": 72.8347, "weight_kg": 35.0, "priority": "CRITICAL_COLD_CHAIN"},
        {"id": "ORD-102", "customer_name": "PharmaDist Thane West", "dest_lat": 19.2183, "dest_lng": 72.9781, "weight_kg": 85.0, "priority": "HIGH"},
        {"id": "ORD-103", "customer_name": "Reliance Retail Navi Mumbai", "dest_lat": 19.0330, "dest_lng": 73.0297, "weight_kg": 120.0, "priority": "NORMAL"},
        {"id": "ORD-104", "customer_name": "Tata Auto Component Pune", "dest_lat": 18.6298, "dest_lng": 73.7997, "weight_kg": 50.0, "priority": "HIGH"},
        {"id": "ORD-105", "customer_name": "Nashik Regional Cargo Depot", "dest_lat": 20.0059, "dest_lng": 73.7898, "weight_kg": 90.0, "priority": "NORMAL"}
    ]

    vehicles = [
        {"id": "V-101", "name": "Tata Prima 5530.S", "capacity_kg": 5000.0, "fuel_type": "DIESEL"},
        {"id": "V-102", "name": "Mahindra Treo Zor EV", "capacity_kg": 1800.0, "fuel_type": "ELECTRIC"},
        {"id": "V-104", "name": "Ashok Leyland BADA DOST", "capacity_kg": 1500.0, "fuel_type": "ELECTRIC"}
    ]

    solver = VRPOptimizer(warehouses=warehouses, orders=orders, vehicles=vehicles)
    return solver.solve_vrp()
