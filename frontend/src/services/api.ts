import type { DashboardKPIs, WarehouseItem, VehicleItem, RouteItem, CopilotResponse, SimulationResult, DriverListItem, InventoryItem, ShiftInventoryPayload, ShiftInventoryResult, ScenarioOrder, DefaultRoutesResult } from '../types';

const API_BASE_URL = typeof window !== 'undefined' && window.location.origin.includes('5173')
  ? 'http://localhost:8000/api/v1'
  : `${window.location.origin}/api/v1`;

function getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem('logimind_token');
  const headers: Record<string, string> = {
    ...customHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchDashboardKPIs(): Promise<DashboardKPIs> {
  try {
    const res = await fetch(`${API_BASE_URL}/dashboard/kpis`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch KPIs');
    return await res.json();
  } catch (e) {
    return {
      active_vehicles: 142,
      active_vehicles_trend: "+8.4% vs last week",
      on_time_delivery_pct: 98.4,
      on_time_trend: "+1.2% SLA compliance",
      warehouse_capacity_pct: 82.6,
      warehouse_capacity_trend: "Optimal fill rate",
      co2_savings_tons: 24.8,
      co2_trend: "-14.2% carbon reduction"
    };
  }
}

export async function fetchWarehouses(): Promise<WarehouseItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/warehouses`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch warehouses');
    return await res.json();
  } catch (e) {
    return [
      { id: 'w1111111-1111-1111-1111-111111111111', name: 'Mumbai Central Logistics Hub', city: 'Mumbai', state: 'MH', address: 'Bhiwandi Logistics Park, NH 160', location_lat: 19.0760, location_lng: 72.8777, capacity_sqft: 120000, current_utilization_pct: 88.5, total_skus: 450, low_stock_count: 0, status: 'ACTIVE' },
      { id: 'w2222222-2222-2222-2222-222222222222', name: 'Navi Mumbai Cargo Distribution Center', city: 'Navi Mumbai', state: 'MH', address: 'JNPT Port Expressway', location_lat: 19.0330, location_lng: 73.0297, capacity_sqft: 95000, current_utilization_pct: 74.0, total_skus: 310, low_stock_count: 2, status: 'ACTIVE' },
      { id: 'w3333333-3333-3333-3333-333333333333', name: 'Pune Industrial Fulfillment Hub', city: 'Pune', state: 'MH', address: 'Chakan MIDC Phase II', location_lat: 18.5204, location_lng: 73.8567, capacity_sqft: 80000, current_utilization_pct: 62.0, total_skus: 280, low_stock_count: 0, status: 'ACTIVE' }
    ];
  }
}

export async function fetchVehicles(): Promise<VehicleItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/vehicles`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch vehicles');
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((v: any) => ({
        id: v.id || v.vehicle_id,
        name: v.name || `${v.brand || ''} ${v.model || ''}`.trim() || v.vehicle_id,
        type: v.type || v.vehicle_type || 'EV_VAN',
        capacity_kg: v.capacity_kg || 1500,
        fuel_type: v.fuel_type || 'ELECTRIC',
        current_lat: v.current_lat ?? 19.0760,
        current_lng: v.current_lng ?? 72.8777,
        status: v.status || 'AVAILABLE',
        fuel_level_pct: v.fuel_level_pct ?? 85,
        engine_temp_c: v.engine_temp_c ?? 88,
        mileage_km: v.mileage_km || v.odometer_km || 20000,
        health_status: v.health_status || (v.status === 'MAINTENANCE' ? 'WARNING' : 'NORMAL'),
        failure_risk_pct: v.failure_risk_pct ?? (v.status === 'MAINTENANCE' ? 60 : 15)
      }));
    }
    return [];
  } catch (e) {
    return [
      { id: 'V-101', name: 'Tata Prima 5530.S', type: 'HEAVY_TRUCK', capacity_kg: 5000, fuel_type: 'DIESEL', current_lat: 19.0760, current_lng: 72.8777, status: 'AVAILABLE', fuel_level_pct: 88, engine_temp_c: 85, mileage_km: 62000, health_status: 'NORMAL', failure_risk_pct: 15 },
      { id: 'V-102', name: 'Mahindra Treo Zor EV', type: 'EV_VAN', capacity_kg: 1800, fuel_type: 'ELECTRIC', current_lat: 19.0330, current_lng: 73.0297, status: 'IN_TRANSIT', fuel_level_pct: 75, engine_temp_c: 88, mileage_km: 18500, health_status: 'NORMAL', failure_risk_pct: 22 },
      { id: 'V-104', name: 'Ashok Leyland BADA DOST', type: 'EV_VAN', capacity_kg: 1500, fuel_type: 'ELECTRIC', current_lat: 18.5204, current_lng: 73.8567, status: 'MAINTENANCE', fuel_level_pct: 92, engine_temp_c: 98.5, mileage_km: 31000, health_status: 'WARNING', failure_risk_pct: 60 }
    ];
  }
}

export async function optimizeRoutes(): Promise<{ routes: RouteItem[]; total_distance_km: number; solver_engine: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/routes/optimize`, { method: 'POST', headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to run VRP optimizer');
    return await res.json();
  } catch (e) {
    return {
      solver_engine: "Clarke-Wright Savings Algorithm + 2-Opt Local Search",
      total_distance_km: 142.5,
      routes: [
        {
          route_id: 'RT-V101-OPT',
          vehicle_id: 'V-101',
          vehicle_name: 'Tata Prima 5530.S',
          driver_id: 'DRV-01',
          total_distance_km: 82.5,
          fuel_estimate_liters: 23.1,
          carbon_emissions_kg: 61.9,
          status: 'OPTIMIZED',
          stops: [
            { sequence: 1, order_id: 'ORD-101', customer_name: 'Apex BioMed South Mumbai', dest_lat: 18.9220, dest_lng: 72.8347, eta: '+0h 25m', priority: 'CRITICAL_COLD_CHAIN' },
            { sequence: 2, order_id: 'ORD-102', customer_name: 'PharmaDist Thane West', dest_lat: 19.2183, dest_lng: 72.9781, eta: '+0h 55m', priority: 'HIGH' }
          ]
        },
        {
          route_id: 'RT-V102-OPT',
          vehicle_id: 'V-102',
          vehicle_name: 'Mahindra Treo Zor EV',
          driver_id: 'DRV-02',
          total_distance_km: 60.0,
          fuel_estimate_liters: 16.8,
          carbon_emissions_kg: 45.0,
          status: 'OPTIMIZED',
          stops: [
            { sequence: 1, order_id: 'ORD-103', customer_name: 'Reliance Retail Navi Mumbai', dest_lat: 19.0330, dest_lng: 73.0297, eta: '+0h 40m', priority: 'HIGH' },
            { sequence: 2, order_id: 'ORD-105', customer_name: 'Nashik Regional Cargo Depot', dest_lat: 20.0059, dest_lng: 73.7898, eta: '+1h 45m', priority: 'NORMAL' }
          ]
        }
      ]
    };
  }
}

export async function rebalanceInventory(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/inventory/rebalance`, { method: 'POST', headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to run LP rebalance');
    return await res.json();
  } catch (e) {
    return {
      status: "OPTIMAL",
      solver_engine: "PuLP Linear Programming Simplex/CBC Solver",
      total_transfer_cost_usd: 134.68,
      recommendations: [
        { sku: "SKU-ELEC-101", from_warehouse_id: "w1111111-1111-1111-1111-111111111111", from_warehouse_name: "Mumbai Central Logistics Hub", to_warehouse_id: "w2222222-2222-2222-2222-222222222222", to_warehouse_name: "Navi Mumbai Cargo Center", quantity: 48, estimated_cost_usd: 102.61, rationale: "Prevents stockout at Navi Mumbai by shifting surplus from Mumbai Central." }
      ]
    };
  }
}

export async function forecastDemand(warehouseId: string, sku: string, horizonDays: number = 7): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/forecast/demand`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ warehouse_id: warehouseId, sku, horizon_days: horizonDays }),
    });
    if (!res.ok) throw new Error('Failed to fetch forecast');
    return await res.json();
  } catch (e) {
    return {
      sku,
      warehouse_id: warehouseId,
      forecast_horizon_days: horizonDays,
      total_predicted_volume: 980,
      average_daily_volume: 140.0
    };
  }
}

export async function askCopilot(query: string): Promise<CopilotResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/copilot/ask`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error('Failed to send query to Copilot');
    return await res.json();
  } catch (e) {
    return {
      query,
      answer: "I analyzed the operational SOPs and live system telemetry. Vehicle V-104 is currently flagged for maintenance due to radiator coolant temperature elevation (98.5\u00b0C). Re-running the route optimizer (Clarke-Wright Savings + 2-Opt) is recommended.",
      citations: [{ document_id: "DOC-SOP-002", title: "Fleet Maintenance SOP", type: "SOP", excerpt: "Engine temp exceeding 96°C triggers maintenance alert." }],
      suggested_actions: [
        { label: "Run VRP Optimization", action: "RUN_VRP", params: {} },
        { label: "View Maintenance Panel", action: "MAINTENANCE_SCHEDULE", params: {} }
      ],
      agent_trace: ["1. Intent Classification: Operational Logistics Query", "2. Grounded natural language response generated"]
    };
  }
}

export async function runSimulation(params: any): Promise<SimulationResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/simulate`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to run scenario simulation');
    return await res.json();
  } catch (e) {
    return {
      scenario_name: params.scenario_name || "Baseline Simulation",
      summary_explanation: "Simulation completed. Network load balance shifts automatically to adjacent fulfillment nodes."
    };
  }
}

export async function fetchVehicleHealth(vehicleId: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/fleet/${vehicleId}/health`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch vehicle health');
    return await res.json();
  } catch (e) {
    return {
      vehicle_id: vehicleId,
      status: "CRITICAL",
      overall_failure_risk: 0.60,
      component_risks: { engine_cooling: 0.60, tires_suspension: 0.25, brakes: 0.20, battery_electrical: 0.12 },
      recommendation: "Schedule immediate preventative maintenance.",
      shap_top_features: [
        { feature: "Engine Temperature (°C)", value: "98.5°C", impact: "+0.45" },
        { feature: "Odometer Mileage (km)", value: "62,000 km", impact: "+0.28" }
      ]
    };
  }
}

export async function fetchDriverActiveRoute(driverId: string = "DRV-01"): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/driver/me/route?driver_id=${driverId}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch driver route');
    return await res.json();
  } catch (e) {
    return {
      driver_id: driverId,
      driver_name: "Rahul Sharma",
      license_number: "MH-04-2022-0094821",
      vehicle_id: "V-101",
      vehicle_name: "Tata Prima 5530.S",
      vehicle_type: "HEAVY_TRUCK",
      fuel_type: "DIESEL",
      fuel_level_pct: 88,
      engine_temp_c: 85.0,
      odometer_km: 62000.0,
      health_status: "NORMAL",
      trip_status: "IN_PROGRESS",
      assigned_route: {
        route_id: "RT-V101-OPT",
        total_distance_km: 82.5,
        estimated_fuel_liters: 23.1,
        carbon_emissions_kg: 61.9,
        stops: [
          { sequence: 1, order_id: "ORD-101", customer_name: "Apex BioMed South Mumbai", address: "Colaba Industrial Estate, South Mumbai", dest_lat: 18.9220, dest_lng: 72.8347, eta: "+0h 25m", weight_kg: 250.0, priority: "CRITICAL_COLD_CHAIN", status: "DELIVERED", delivered_at: "09:45 AM" },
          { sequence: 2, order_id: "ORD-102", customer_name: "PharmaDist Thane West", address: "Ghoshal Logistics Hub, Thane", dest_lat: 19.2183, dest_lng: 72.9781, eta: "+0h 55m", weight_kg: 180.0, priority: "HIGH", status: "IN_TRANSIT", delivered_at: null }
        ]
      }
    };
  }
}

export async function updateDriverStopStatus(orderId: string, status: string, exceptionNote?: string, driverId: string = "DRV-01", delayMinutes?: number): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/driver/stops/${orderId}/status?driver_id=${driverId}`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status, exception_note: exceptionNote, delay_minutes: delayMinutes }),
    });
    if (!res.ok) throw new Error('Failed to update stop status');
    return await res.json();
  } catch (e) {
    return { status: "SUCCESS", order_id: orderId, new_status: status };
  }
}

export async function fetchDrivers(): Promise<DriverListItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/drivers`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch drivers');
    return await res.json();
  } catch (e) {
    return [
      { driver_id: 'DRV-01', driver_name: 'Rahul Sharma', license_number: 'MH-04-2022-0094821', phone: '+91-98200-11223', experience_years: 8, availability_status: 'ON_TRIP', rating_score: 4.8, vehicle_id: 'V-101', vehicle_name: 'Tata Prima 5530.S', vehicle_type: 'HEAVY_TRUCK', route_id: 'RT-V101-OPT' },
      { driver_id: 'DRV-02', driver_name: 'Amit Varma', license_number: 'MH-12-2023-0182743', phone: '+91-98765-44556', experience_years: 4, availability_status: 'ON_TRIP', rating_score: 4.6, vehicle_id: 'V-102', vehicle_name: 'Mahindra Treo Zor EV', vehicle_type: 'EV_VAN', route_id: 'RT-V102-OPT' },
    ];
  }
}

export interface CreateDriverPayload {
  driver_name: string;
  license_number: string;
  vehicle_id: string;
  vehicle_name: string;
  vehicle_type?: string;
  phone?: string;
  experience_years?: number;
}

export async function addDriver(payload: CreateDriverPayload): Promise<{ status: string; driver: DriverListItem }> {
  const res = await fetch(`${API_BASE_URL}/drivers`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = 'Failed to add driver';
    try { const err = await res.json(); detail = err.detail || detail; } catch { /* keep default */ }
    throw new Error(detail);
  }
  return await res.json();
}

export async function removeDriver(driverId: string): Promise<{ status: string; driver: DriverListItem }> {
  const res = await fetch(`${API_BASE_URL}/drivers/${driverId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to remove driver');
  return await res.json();
}

export async function fetchInventory(): Promise<InventoryItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/inventory`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch inventory');
    return await res.json();
  } catch (e) {
    return [
      { inventory_id: 'INV-01', warehouse_id: 'w1111111-1111-1111-1111-111111111111', sku: 'SKU-ELEC-101', item_name: 'Electronic Components Kit', quantity: 140, reorder_threshold: 30, unit: 'units' },
      { inventory_id: 'INV-02', warehouse_id: 'w2222222-2222-2222-2222-222222222222', sku: 'SKU-ELEC-101', item_name: 'Electronic Components Kit', quantity: 12, reorder_threshold: 30, unit: 'units' },
      { inventory_id: 'INV-03', warehouse_id: 'w3333333-3333-3333-3333-333333333333', sku: 'SKU-ELEC-101', item_name: 'Electronic Components Kit', quantity: 55, reorder_threshold: 30, unit: 'units' },
      { inventory_id: 'INV-04', warehouse_id: 'w1111111-1111-1111-1111-111111111111', sku: 'SKU-PHAR-201', item_name: 'Pharmaceutical Supplies', quantity: 45, reorder_threshold: 15, unit: 'boxes' },
      { inventory_id: 'INV-05', warehouse_id: 'w2222222-2222-2222-2222-222222222222', sku: 'SKU-PHAR-201', item_name: 'Pharmaceutical Supplies', quantity: 8, reorder_threshold: 15, unit: 'boxes' },
    ];
  }
}

export interface CreateInventoryItemPayload {
  warehouse_id: string;
  sku: string;
  item_name: string;
  quantity: number;
  reorder_threshold: number;
  unit: string;
}

export async function addInventoryItem(payload: CreateInventoryItemPayload): Promise<{ status: string; item: InventoryItem }> {
  const res = await fetch(`${API_BASE_URL}/inventory`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = 'Failed to add inventory item';
    try { const err = await res.json(); detail = err.detail || detail; } catch { /* keep default */ }
    throw new Error(detail);
  }
  return await res.json();
}

export async function removeInventoryItem(inventoryId: string): Promise<{ status: string; item: InventoryItem }> {
  const res = await fetch(`${API_BASE_URL}/inventory/${inventoryId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    let detail = 'Failed to remove inventory item';
    try { const err = await res.json(); detail = err.detail || detail; } catch { /* keep default */ }
    throw new Error(detail);
  }
  return await res.json();
}

export async function shiftInventory(payload: ShiftInventoryPayload): Promise<ShiftInventoryResult> {
  const res = await fetch(`${API_BASE_URL}/inventory/shift`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = 'Failed to shift inventory';
    try { const err = await res.json(); detail = err.detail || detail; } catch { /* keep default */ }
    throw new Error(detail);
  }
  return await res.json();
}

async function parseApiError(res: Response, fallback: string): Promise<never> {
  let detail = fallback;
  try { const err = await res.json(); detail = err.detail || detail; } catch { /* keep default */ }
  throw new Error(detail);
}



export interface CreateOrderPayload {
  customer_name: string;
  dest_lat: number;
  dest_lng: number;
  weight_kg: number;
  priority: string;
  warehouse_id?: string | null;
}

export async function fetchScenarioOrders(): Promise<ScenarioOrder[]> {
  const res = await fetch(`${API_BASE_URL}/scenario/orders`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch scenario orders');
  return await res.json();
}

export async function addScenarioOrder(payload: CreateOrderPayload): Promise<ScenarioOrder> {
  const res = await fetch(`${API_BASE_URL}/scenario/orders`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseApiError(res, 'Failed to add order');
  return await res.json();
}

export async function removeScenarioOrder(orderId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/scenario/orders/${orderId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) await parseApiError(res, 'Failed to remove order');
}

export async function resetScenario(preset: 'demo' | 'empty'): Promise<{ preset: string; orders: number }> {
  const res = await fetch(`${API_BASE_URL}/scenario/reset`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ preset }),
  });
  if (!res.ok) await parseApiError(res, 'Failed to reset scenario');
  return await res.json();
}

export async function fetchDefaultRoutes(strategy = 'nearest_neighbor'): Promise<DefaultRoutesResult> {
  const res = await fetch(`${API_BASE_URL}/routes/default?strategy=${strategy}`, { headers: getHeaders() });
  if (!res.ok) await parseApiError(res, 'Failed to fetch default routes');
  return await res.json();
}

export interface CreateVehiclePayload {
  brand: string;
  model?: string;
  vehicle_type?: string;
  capacity_kg: number;
  fuel_type?: string;
  status?: string;
}

export async function addVehicle(payload: CreateVehiclePayload): Promise<VehicleItem> {
  const res = await fetch(`${API_BASE_URL}/vehicles`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseApiError(res, 'Failed to add vehicle');
  const v = await res.json();
  return {
    id: v.id || v.vehicle_id,
    name: v.name || v.vehicle_id,
    type: v.type || v.vehicle_type || 'LIGHT_TRUCK',
    capacity_kg: v.capacity_kg || 1500,
    fuel_type: v.fuel_type || 'DIESEL',
    current_lat: v.current_lat ?? 19.0760,
    current_lng: v.current_lng ?? 72.8777,
    status: v.status || 'AVAILABLE',
    fuel_level_pct: v.fuel_level_pct ?? 80,
    engine_temp_c: v.engine_temp_c ?? 85,
    mileage_km: v.mileage_km || v.odometer_km || 0,
    health_status: v.health_status || 'NORMAL',
    failure_risk_pct: v.failure_risk_pct ?? 20,
  };
}

export async function removeVehicle(vehicleId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/vehicles/${vehicleId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) await parseApiError(res, 'Failed to remove vehicle');
}

export interface CreateWarehousePayload {
  name: string;
  city: string;
  state?: string;
  address?: string;
  location_lat: number;
  location_lng: number;
  capacity_sqft?: number;
}

export async function addWarehouse(payload: CreateWarehousePayload): Promise<WarehouseItem> {
  const res = await fetch(`${API_BASE_URL}/warehouses`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseApiError(res, 'Failed to add warehouse');
  return await res.json();
}

export async function removeWarehouse(warehouseId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/warehouses/${warehouseId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) await parseApiError(res, 'Failed to remove warehouse');
}

