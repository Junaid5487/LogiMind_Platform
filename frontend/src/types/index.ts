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
  /** Obstacle-aware path: current position + detour via-points + stops. */
  geometry?: Array<[number, number]>;
  /** Naive straight-line path (no obstacle avoidance) for before/after view. */
  straight_geometry?: Array<[number, number]>;
  /** Blockages the current route was re-optimized around. */
  obstacles_avoided?: ObstacleAvoidance[];
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
  dollar_savings: number;
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
  is_depot?: boolean;
}

export interface SkuAvailability {
  sku: string;
  item_name: string;
  unit: string;
  total_quantity: number;
  warehouses: Array<{ warehouse_id: string; warehouse_name: string; quantity: number }>;
}

export interface TransferRecommendation {
  sku: string;
  from_warehouse_id: string;
  from_warehouse_name: string;
  to_warehouse_id: string;
  to_warehouse_name: string;
  quantity: number;
  distance_km?: number;
  estimated_cost?: number;
  estimated_cost_usd?: number;
  currency?: string;
  rationale?: string;
}

export interface RebalanceResult {
  recommendations: TransferRecommendation[];
  total_transfer_cost?: number;
  total_transfer_cost_usd?: number;
  currency?: string;
  solver_engine?: string;
  status?: string;
  solver_error?: string;
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

/** Why this vehicle got the tour: capacity/range/risk screen + cost model. */
export interface VehicleSelection {
  status: 'FEASIBLE' | 'VIOLATED';
  reason: string;
  load_kg: number;
  capacity_kg: number;
  tour_distance_km: number;
  usable_range_km: number;
  fuel_type: string;
  cost_per_km_usd: number;
  estimated_cost_usd: number;
  failure_risk_pct?: number;
  rejected_candidates: Array<{ vehicle_id: string; vehicle_name: string; reasons: string[] }>;
}

/** Fleet totals for one planning strategy (naive or optimized). */
export interface FleetTotals {
  distance_km: number;
  fuel_liters: number;
  carbon_kg: number;
  cost_usd: number;
}

/** Naive-vs-optimized savings returned by POST /routes/optimize. */
export interface RouteComparison {
  baseline_strategy: string;
  naive: FleetTotals;
  optimized: FleetTotals;
  saved: FleetTotals;
  saved_pct: { distance: number; cost: number; carbon: number };
}

/** Fleet-level constraint audit (excluded vehicles + selection policy). */
export interface ConstraintReport {
  capacity_kg: string;
  range: string;
  risk: string;
  selection: string;
  excluded_vehicles: Array<{ vehicle_id: string; vehicle_name: string; reasons: string[] }>;
  vehicles_evaluated: number;
  vehicles_dispatched: number;
}

/** A driver/manager-reported path blockage (circle no-go zone). */
export interface RouteObstacle {
  obstacle_id: string;
  obstacle_type: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  radius_km: number;
  reported_by?: string | null;
  vehicle_id?: string | null;
  status: 'ACTIVE' | 'RESOLVED';
  created_at?: string | null;
  resolved_at?: string | null;
}

/** Per-route record of the blockages an optimized route steers around. */
export interface ObstacleAvoidance {
  obstacle_id: string;
  obstacle_type: string;
  latitude: number;
  longitude: number;
  radius_km: number;
}

export interface RouteLocation {
  name?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  order_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  eta?: string | null;
  sequence?: number | null;
  label?: string | null;
}

export interface RouteItem {
  route_id: string;
  vehicle_id: string;
  vehicle_name: string;
  driver_id: string;
  total_distance_km: number;
  fuel_estimate_liters: number;
  carbon_emissions_kg: number;
  /** Operating cost for this tour (USD) — part of the cost/carbon ledger. */
  cost_usd?: number;
  /** Business-constraint audit: why this vehicle, who was screened out. */
  vehicle_selection?: VehicleSelection;
  stops: RouteStop[];
  status: string;
  start_location?: RouteLocation | null;
  end_location?: RouteLocation | null;
  /** Obstacle-aware path (depot + detour via-points + stops) for drawing. */
  geometry?: Array<[number, number]>;
  /** Blockages this route was re-optimized around. */
  obstacles_avoided?: ObstacleAvoidance[];
}

/** Full payload of POST /routes/optimize. */
export interface OptimizeResult {
  routes: RouteItem[];
  total_distance_km: number;
  total_fuel_liters?: number;
  total_carbon_kg?: number;
  total_cost_usd?: number;
  solver_engine: string;
  obstacles_considered?: number;
  comparison?: RouteComparison | null;
  constraint_report?: ConstraintReport | null;
  ledger_run_id?: string | null;
  status: string;
  message?: string;
}

/** One durable cost/carbon ledger row (GET /routes/ledger). */
export interface RouteLedgerEntry {
  id: string;
  run_id: string;
  created_at: string | null;
  scope: 'OPTIMIZE' | 'DISPATCH' | 'DRIVER_REROUTE' | string;
  route_id: string;
  vehicle_id: string | null;
  distance_km: number;
  fuel_liters: number;
  carbon_kg: number;
  cost_usd: number;
  solver_engine: string | null;
  detail?: { stops?: number; obstacles_avoided?: number; vehicle_selection_status?: string } | null;
}

export interface RouteLedgerResult {
  entries: RouteLedgerEntry[];
  count: number;
  totals: {
    runs: number;
    routes_logged: number;
    distance_km: number;
    fuel_liters: number;
    carbon_kg: number;
    cost_usd: number;
  };
}

/** A transfer trip planned from an LP recommendation (Feature: dispatch). */
export interface TransferTrip {
  recommendation: TransferRecommendation;
  trip: RouteItem & {
    source_warehouse_id: string;
    source_warehouse_name: string;
    destination_warehouse_id: string;
    destination_warehouse_name: string;
    sku?: string;
    quantity?: number;
  };
}

export interface DispatchResult {
  status: string;
  message: string;
  lp_status?: string;
  trips: TransferTrip[];
  total_distance_km: number;
  total_cost_usd: number;
  total_carbon_kg: number;
  constraint_report?: ConstraintReport | null;
  ledger_run_id?: string | null;
}

/** One Copilot audit-trail entry (GET /copilot/audit). */
export interface CopilotAuditEntry {
  id: string;
  created_at: string | null;
  query: string;
  intent: string;
  answer_preview: string | null;
  suggested_actions: Array<{ label: string; action: string; params: any }>;
}

/** Result of POST /driver/report-obstacle — obstacle + immediate re-route. */
export interface ObstacleReportResult {
  status: string;
  driver_id?: string;
  obstacle: RouteObstacle;
  reroute: {
    previous_order: string[];
    new_order: string[];
    stops_resequenced: boolean;
    straight_remaining_km: number;
    previous_remaining_km: number;
    new_remaining_km: number;
    obstacles_avoided: ObstacleAvoidance[];
    solver_engine?: string;
    message?: string;
  };
  updated_shift: DriverActiveRoute;
}

export interface CopilotResponse {
  query: string;
  /** Routed intent label (FLEET_HEALTH, INVENTORY_REBALANCE, SIMULATION, …). */
  intent?: string;
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

export interface VehicleConditionPayload {
  mileage_km?: number;
  engine_temp_c?: number;
  coolant_pressure_bar?: number;
  tire_wear_pct?: number;
  fuel_level_pct?: number;
  service_status?: string;
  inspection_notes?: string;
}

export interface ShapFeature {
  feature: string;
  value: string;
  impact: string;
}

export interface VehicleConditionResult {
  status: string;
  vehicle_id: string;
  vehicle_status: string;
  odometer_km: number;
  telemetry: any;
  risk_analysis: {
    vehicle_id: string;
    vehicle_name: string;
    status: string;
    overall_failure_risk: number;
    component_risks: {
      engine_cooling: number;
      tires_suspension: number;
      brakes: number;
      battery_electrical: number;
    };
    recommendation: string;
    shap_top_features: ShapFeature[];
  };
}

export interface InspectionLogItem {
  maintenance_log_id: string;
  service_type: string;
  component_serviced: string;
  service_date?: string;
  cost: number;
  status: string;
  failure_risk_score: number;
  description?: string;
}

export interface DailyDemandPrediction {
  day: string;
  day_number: number;
  predicted_demand: number;
  upper_bound: number;
  lower_bound: number;
}

export interface DemandForecastResult {
  warehouse_id: string;
  sku: string;
  horizon_days: number;
  total_predicted_volume: number;
  average_daily_volume: number;
  recommended_safety_stock: number;
  reorder_urgency: 'NORMAL' | 'WARNING' | 'CRITICAL';
  daily_forecast: DailyDemandPrediction[];
  model_version: string;
  summary_text?: string;
}


export interface ActivityChangeItem {
  timestamp: string;
  description: string;
  changed: boolean;
  error?: string;
}
