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
