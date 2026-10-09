"""Shared demo-scenario data used by backend seeding and the /scenario/reset endpoint.

Field names mirror the experiment benchmark instance format (dest_lat/dest_lng/
weight_kg/priority) so app-scenarios stay compatible with the research pipeline in
experiments/. The values are the original hardcoded demo orders from the legacy
/routes/optimize endpoint, kept byte-identical for demo continuity.
"""

DEMO_ORDERS = [
    {"order_id": "ORD-101", "customer_name": "Apex BioMed South Mumbai", "dest_lat": 18.9220, "dest_lng": 72.8347, "weight_kg": 35.0, "priority": "CRITICAL_COLD_CHAIN"},
    {"order_id": "ORD-102", "customer_name": "PharmaDist Thane West", "dest_lat": 19.2183, "dest_lng": 72.9781, "weight_kg": 85.0, "priority": "HIGH"},
    {"order_id": "ORD-103", "customer_name": "Reliance Retail Navi Mumbai", "dest_lat": 19.0330, "dest_lng": 73.0297, "weight_kg": 120.0, "priority": "NORMAL"},
    {"order_id": "ORD-104", "customer_name": "Tata Auto Component Pune", "dest_lat": 18.6298, "dest_lng": 73.7997, "weight_kg": 50.0, "priority": "HIGH"},
    {"order_id": "ORD-105", "customer_name": "Nashik Regional Cargo Depot", "dest_lat": 20.0059, "dest_lng": 73.7898, "weight_kg": 90.0, "priority": "NORMAL"},
]

ORDER_PRIORITIES = ("LOW", "NORMAL", "HIGH", "CRITICAL_COLD_CHAIN")
