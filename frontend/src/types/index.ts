export type UserRole = 'admin' | 'fleet_manager' | 'driver' | 'warehouse_manager';

export interface InventoryItem {
  inventory_id: string;
  warehouse_id: string;
  sku: string;
  item_name: string;
  quantity: number;
  reorder_threshold: number;
  unit: string;
}

export interface ShiftInventoryPayload {
  from_warehouse_id: string;
  to_warehouse_id: string;
  sku: string;
  quantity: number;
}

export interface ShiftInventoryResult {
  status: string;
  sku: string;
  quantity: number;
  from_warehouse: string;
  to_warehouse: string;
  source_item: InventoryItem;
  destination_item: InventoryItem;
}

export interface DriverListItem {
  driver_id: string;
  driver_name: string;
  license_number: string;
  phone?: string;
  experience_years: number;
  availability_status: string;
  rating_score: number;
  vehicle_id: string;
  vehicle_name: string;
  vehicle_type: string;
  route_id?: string | null;
}

export interface DriverItem {
  driver_id: string;
  driver_name: string;
  license_number: string;
  vehicle_id: string;
  vehicle_name: string;
  vehicle_type: string;
  fuel_type: string;
  fuel_level_pct: number;
  engine_temp_c: number;
  odometer_km: number;
  health_status: string;
  trip_status: string;
}

export interface DriverRouteStop {
  sequence: number;
  order_id: string;
  customer_name: string;
  address: string;
  dest_lat: number;
  dest_lng: number;
  eta: string;
  weight_kg: number;
  priority: string;
  status: string;
  delivered_at?: string;
  exception_note?: string;
  delay_minutes?: number;
  delay_reason?: string | null;
}

export interface DriverRoute {
  route_id: string;
  origin_name?: string;
  origin_address?: string;
  total_distance_km: number;
  estimated_fuel_liters: number;
  carbon_emissions_kg: number;
  stops: DriverRouteStop[];
}

export interface DriverActiveRoute {
  driver_id: string;
  driver_name: string;
  license_number: string;
  vehicle_id: string;
  vehicle_name: string;
  vehicle_type: string;
  fuel_type: string;
  fuel_level_pct: number;
  engine_temp_c: number;
  odometer_km: number;
  health_status: string;
  trip_status: string;
  failure_risk_pct?: number;
  assigned_route: DriverRoute;
}

export interface DashboardKPIs {
  active_vehicles: number;
  active_vehicles_trend: string;
  on_time_delivery_pct: number;
  on_time_trend: string;
  warehouse_capacity_pct: number;
  warehouse_capacity_trend: string;
  co2_savings_tons: number;
  co2_trend: string;
}

export interface WarehouseItem {
  id: string;
  name: string;
  city: string;
  state?: string;
  address?: string;
  location_lat: number;
  location_lng: number;
  capacity_sqft: number;
  storage_capacity_sqft?: number;
  current_utilization_pct: number;
  total_skus: number;
  low_stock_count: number;
  status?: string;
}

export interface VehicleItem {
  id: string;
  name: string;
  type: string;
  capacity_kg: number;
  fuel_type: string;
  current_lat: number;
  current_lng: number;
  status: string;
  fuel_level_pct: number;
  engine_temp_c: number;
  mileage_km: number;
  health_status: string;
  failure_risk_pct: number;
}

export interface RouteStop {
  sequence: number;
  order_id: string;
  customer_name: string;
  dest_lat: number;
  dest_lng: number;
  eta: string;
  priority: string;
}

export interface RouteItem {
  route_id: string;
  vehicle_id: string;
  vehicle_name: string;
  driver_id: string;
  total_distance_km: number;
  fuel_estimate_liters: number;
  carbon_emissions_kg: number;
  stops: RouteStop[];
  status: string;
}

export interface CopilotResponse {
  query: string;
  answer: string;
  citations: Array<{ document_id: string; title: string; type: string; excerpt: string }>;
  suggested_actions: Array<{ label: string; action: string; params: any }>;
  agent_trace: string[];
}

export interface SimulationResult {
  scenario_name: string;
  inputs?: any;
  baseline?: any;
  simulated?: any;
  deltas?: any;
  summary_explanation?: string;
}

export interface ScenarioOrder {
  order_id: string;
  customer_name: string;
  dest_lat: number;
  dest_lng: number;
  weight_kg: number;
  priority: string;
  status: string;
  warehouse_id?: string | null;
  created_at?: string;
}

export interface DefaultRoutesResult {
  routes: RouteItem[];
  total_distance_km: number;
  status: string;
  solver_engine: string;
  message?: string;
}

