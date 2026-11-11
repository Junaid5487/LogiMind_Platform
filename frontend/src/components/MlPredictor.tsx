import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  Truck,
  Package,
  Layers,
  ThermometerSnowflake,
  Leaf,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCw,
  Search,
  Filter,
  ArrowUpRight,
  ShieldAlert,
  Calendar,
  Fuel,
  Zap,
  Box,
  Compass,
  DollarSign,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { fetchMlPredictorAnalytics, fetchWarehouses } from '../services/api';
import type {
  WarehouseItem,
  MlPredictorAnalytics,
  ProductForecastItem,
} from '../types';

interface MlPredictorProps {
  onNavigate?: (tab: string) => void;
}

export const MlPredictor: React.FC<MlPredictorProps> = ({ onNavigate }) => {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [horizonDays, setHorizonDays] = useState<number>(7);
  const [logisticsMode, setLogisticsMode] = useState<'EXPORT' | 'IMPORT'>('EXPORT');
  const [whatIfMultiplier, setWhatIfMultiplier] = useState<number>(1.0);

  const [activeForecasterTab, setActiveForecasterTab] = useState<
    'products' | 'fleet' | 'storage' | 'coldchain' | 'carbon' | 'procurement'
  >('products');

  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'NORMAL'>('ALL');
  const [selectedSkuDetail, setSelectedSkuDetail] = useState<ProductForecastItem | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [analytics, setAnalytics] = useState<MlPredictorAnalytics | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load warehouses list
  useEffect(() => {
    fetchWarehouses()
      .then((data) => setWarehouses(data || []))
      .catch((err) => console.error('Failed to load warehouses:', err));
  }, []);

  // Fetch ML Analytics
  const loadForecastData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchMlPredictorAnalytics(
        selectedWarehouseId,
        horizonDays,
        logisticsMode,
        whatIfMultiplier
      );
      setAnalytics(data);
      setLastRefreshedAt(new Date().toLocaleTimeString());
      if (data.products && data.products.length > 0 && !selectedSkuDetail) {
        setSelectedSkuDetail(data.products[0]);
      } else if (data.products && selectedSkuDetail) {
        const updated = data.products.find((p) => p.sku === selectedSkuDetail.sku);
        if (updated) setSelectedSkuDetail(updated);
      }
    } catch (err: any) {
      console.error('Error fetching ML predictor analytics:', err);
      setErrorMsg(err.message || 'Unable to load ML predictions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecastData();
  }, [selectedWarehouseId, horizonDays, logisticsMode, whatIfMultiplier]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    if (!analytics || !analytics.products) return [];
    return analytics.products.filter((p) => {
      const matchesSearch =
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.item_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesUrgency =
        urgencyFilter === 'ALL' || p.reorder_urgency === urgencyFilter;
      return matchesSearch && matchesUrgency;
    });
  }, [analytics, searchQuery, urgencyFilter]);

  // Aggregated daily trend for current view
  const overallDailyTrend = useMemo(() => {
    if (!analytics || !analytics.products || analytics.products.length === 0) return [];
    const daysCount = horizonDays;
    const dailySums: { [key: string]: { day: string; predicted_demand: number; upper_bound: number; lower_bound: number } } = {};

    analytics.products.forEach((prod) => {
      (prod.daily_forecast || []).forEach((df, idx) => {
        const key = df.day || `Day ${idx + 1}`;
        if (!dailySums[key]) {
          dailySums[key] = {
            day: key,
            predicted_demand: 0,
            upper_bound: 0,
            lower_bound: 0,
          };
        }
        dailySums[key].predicted_demand += df.predicted_demand || 0;
        dailySums[key].upper_bound += df.upper_bound || (df.predicted_demand * 1.15);
        dailySums[key].lower_bound += df.lower_bound || (df.predicted_demand * 0.85);
      });
    });

    return Object.values(dailySums);
  }, [analytics, horizonDays]);

  // Selected warehouse name helper
  const selectedWarehouseName = useMemo(() => {
    if (selectedWarehouseId === 'ALL') return 'All Logistics Warehouses (National Fleet)';
    const found = warehouses.find((w) => w.id === selectedWarehouseId);
    return found ? `${found.name} (${found.city})` : selectedWarehouseId;
  }, [selectedWarehouseId, warehouses]);

  return (
    <div className="py-6 px-4 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                ML Predictive Intelligence Suite
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Ensemble AI v1.1.5
                </span>
              </h1>
              <p className="text-xs md:text-sm text-gray-400">
                Multi-horizon product demand forecasting, export/import vehicle capacity estimation, warehouse storage simulation & ESG footprint modeling.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {lastRefreshedAt && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              Updated {lastRefreshedAt}
            </span>
          )}
          <button
            onClick={loadForecastData}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            <span>{loading ? 'Predicting...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Control Panel: Warehouse, Horizon, Mode & What-If Multiplier */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4 shadow-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Warehouse Selector */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-1.5">
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              Warehouse Node
            </label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors"
            >
              <option value="ALL">All Warehouses (Consolidated)</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.city})
                </option>
              ))}
            </select>
          </div>

          {/* Horizon Selector */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              Forecast Horizon
            </label>
            <div className="grid grid-cols-3 gap-1 bg-gray-900 p-1 border border-gray-800 rounded-xl">
              {[
                { label: '7 Days', val: 7 },
                { label: '14 Days', val: 14 },
                { label: '30 Days', val: 30 },
              ].map((h) => (
                <button
                  key={h.val}
                  type="button"
                  onClick={() => setHorizonDays(h.val)}
                  className={`py-1 rounded-lg text-xs font-semibold transition-all ${
                    horizonDays === h.val
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Logistics Mode Toggle: Export vs Import */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-1.5">
              <Truck className="w-3.5 h-3.5 text-emerald-400" />
              Logistics Mode
            </label>
            <div className="grid grid-cols-2 gap-1 bg-gray-900 p-1 border border-gray-800 rounded-xl">
              <button
                type="button"
                onClick={() => setLogisticsMode('EXPORT')}
                className={`py-1 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                  logisticsMode === 'EXPORT'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>🚚 Export (Outbound)</span>
              </button>
              <button
                type="button"
                onClick={() => setLogisticsMode('IMPORT')}
                className={`py-1 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                  logisticsMode === 'IMPORT'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>📥 Import (Inbound)</span>
              </button>
            </div>
          </div>

          {/* Scenario / What-If Multiplier */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Demand Scenario
              </label>
              <span className="text-xs font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {whatIfMultiplier}x{' '}
                {whatIfMultiplier > 1
                  ? '(Surge)'
                  : whatIfMultiplier < 1
                  ? '(Slump)'
                  : '(Normal)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={whatIfMultiplier}
                onChange={(e) => setWhatIfMultiplier(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <button
                type="button"
                onClick={() => setWhatIfMultiplier(0.8)}
                className="hover:text-gray-300"
              >
                0.8x Slump
              </button>
              <button
                type="button"
                onClick={() => setWhatIfMultiplier(1.0)}
                className="hover:text-gray-300"
              >
                1.0x Normal
              </button>
              <button
                type="button"
                onClick={() => setWhatIfMultiplier(1.3)}
                className="hover:text-gray-300"
              >
                1.3x Festive
              </button>
              <button
                type="button"
                onClick={() => setWhatIfMultiplier(1.6)}
                className="hover:text-gray-300"
              >
                1.6x Peak
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Top Level Metric Highlight Cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Total Demand */}
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-3.5 relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
              <span>Forecast Volume</span>
              <Package className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xl font-black text-white">
              {(analytics.summary.total_predicted_volume ?? 0).toLocaleString()}
              <span className="text-xs font-normal text-gray-400 ml-1">units</span>
            </div>
            <p className="text-[10px] text-blue-400 mt-1 font-medium">
              Over {horizonDays} days ({Math.round((analytics.summary.total_predicted_volume ?? 0) / horizonDays)}/day)
            </p>
          </div>

          {/* Card 2: Vehicles Needed */}
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-3.5 relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
              <span>{logisticsMode} Vehicles</span>
              <Truck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-white">
              {analytics.vehicle_requirements.vehicles_needed}
              <span className="text-xs font-normal text-gray-400 ml-1">trucks</span>
            </div>
            <p className="text-[10px] text-emerald-400 mt-1 font-medium">
              {analytics.vehicle_requirements.estimated_trips} round trips (
              {(analytics.vehicle_requirements.total_weight_kg ?? 0).toLocaleString()} kg)
            </p>
          </div>

          {/* Card 3: Stockout Urgency Alerts */}
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-3.5 relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
              <span>Reorder Risk</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black text-white">
              {analytics.summary.critical_stockouts_count + analytics.summary.warning_stockouts_count}
              <span className="text-xs font-normal text-gray-400 ml-1">SKUs</span>
            </div>
            <p className="text-[10px] text-red-400 mt-1 font-medium">
              {analytics.summary.critical_stockouts_count} Critical, {analytics.summary.warning_stockouts_count} Warning
            </p>
          </div>

          {/* Card 4: Warehouse Space Utilization */}
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-3.5 relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
              <span>Projected Storage</span>
              <Layers className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl font-black text-white">
              {analytics.storage_forecaster?.projected_utilization_pct ?? 0}%
            </div>
            <p className={`text-[10px] mt-1 font-medium ${
              (analytics.storage_forecaster?.status) === 'OVERFLOW_RISK'
                ? 'text-red-400'
                : (analytics.storage_forecaster?.status) === 'NEAR_CAPACITY'
                ? 'text-amber-400'
                : 'text-purple-400'
            }`}>
              {analytics.storage_forecaster?.status ?? 'OPTIMAL'} ({analytics.storage_forecaster?.pallets_required ?? 0} pallets)
            </p>
          </div>

          {/* Card 5: Fleet Readiness */}
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-3.5 relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
              <span>Fleet Readiness</span>
              <Zap className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xl font-black text-white">
              {analytics.vehicle_requirements.fleet_readiness_pct}%
            </div>
            <p className="text-[10px] text-cyan-400 mt-1 font-medium">
              {analytics.vehicle_requirements.active_fleet_count} vehicles active in DB
            </p>
          </div>

          {/* Card 6: ESG CO2 Impact */}
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-3.5 relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
              <span>ESG Carbon Footprint</span>
              <Leaf className="w-4 h-4 text-lime-400" />
            </div>
            <div className="text-xl font-black text-white">
              {analytics.vehicle_requirements.logistics_metrics.co2_emissions_kg}
              <span className="text-xs font-normal text-gray-400 ml-1">kg CO2</span>
            </div>
            <p className="text-[10px] text-lime-400 mt-1 font-medium">
              -{analytics.vehicle_requirements.logistics_metrics.ev_co2_savings_kg} kg via EV routes
            </p>
          </div>
        </div>
      )}

      {/* Forecaster Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 overflow-x-auto no-scrollbar pb-2">
        {[
          {
            id: 'products',
            label: 'Product Demand & Quantity Forecaster',
            icon: <Package className="w-4 h-4" />,
            badge: `${analytics?.products?.length || 0} SKUs`,
          },
          {
            id: 'fleet',
            label: 'Fleet & Vehicle Logistics Forecaster',
            icon: <Truck className="w-4 h-4" />,
            badge: `${analytics?.vehicle_requirements?.vehicles_needed || 0} Vehicles`,
          },
          {
            id: 'storage',
            label: 'Warehouse Capacity & Pallet Forecaster',
            icon: <Layers className="w-4 h-4" />,
            badge: `${analytics?.storage_forecaster?.projected_utilization_pct || 0}%`,
          },
          {
            id: 'coldchain',
            label: 'Cold Chain & Specialized Handling',
            icon: <ThermometerSnowflake className="w-4 h-4" />,
          },
          {
            id: 'carbon',
            label: 'Carbon Footprint & ESG Forecaster',
            icon: <Leaf className="w-4 h-4" />,
          },
          {
            id: 'procurement',
            label: 'Procurement & Reorder Schedule',
            icon: <ShieldAlert className="w-4 h-4" />,
            badge: `${analytics?.procurement_forecaster?.length || 0} Urgent`,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveForecasterTab(tab.id as any)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeForecasterTab === tab.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900 border border-transparent'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                activeForecasterTab === tab.id
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-800 text-gray-300'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: PRODUCT DEMAND & QUANTITY FORECASTER */}
      {activeForecasterTab === 'products' && (
        <div className="space-y-6">
          {/* Demand Curve Chart */}
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  {selectedSkuDetail
                    ? `Demand Projection: ${selectedSkuDetail.item_name} (${selectedSkuDetail.sku})`
                    : 'Consolidated Demand Curve (All SKUs)'}
                </h3>
                <p className="text-xs text-gray-400">
                  Daily forecasted units with 95% confidence intervals across {horizonDays}-day horizon
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400 bg-gray-900 px-2.5 py-1 rounded-lg border border-gray-800">
                  Model: {analytics?.model_metadata.engine}
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={
                    selectedSkuDetail && selectedSkuDetail.daily_forecast
                      ? selectedSkuDetail.daily_forecast
                      : overallDailyTrend
                  }
                >
                  <defs>
                    <linearGradient id="mlDemandFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="mlUpperFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="day" stroke="#9ca3af" fontSize={11} />
                  <YAxis stroke="#9ca3af" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      borderColor: '#374151',
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area
                    type="monotone"
                    dataKey="upper_bound"
                    stroke="#6366f1"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    fill="url(#mlUpperFill)"
                    name="Upper Bound (95% CI)"
                  />
                  <Area
                    type="monotone"
                    dataKey="predicted_demand"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill="url(#mlDemandFill)"
                    name="Predicted Demand (Units)"
                  />
                  <Area
                    type="monotone"
                    dataKey="lower_bound"
                    stroke="#94a3b8"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    fill="none"
                    name="Lower Bound"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Product Forecasts Table & Search */}
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-400" />
                  Products in Demand & Quantity Projections
                </h3>
                <p className="text-xs text-gray-400">
                  Which products will be in demand, required quantities, safety stock buffers and deficit warnings
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search SKU / product..."
                    className="bg-gray-900 border border-gray-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500"
                  />
                </div>

                <select
                  value={urgencyFilter}
                  onChange={(e) => setUrgencyFilter(e.target.value as any)}
                  className="bg-gray-900 border border-gray-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Urgencies</option>
                  <option value="CRITICAL">Critical Only</option>
                  <option value="WARNING">Warning</option>
                  <option value="NORMAL">Normal</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-gray-900/80 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">SKU Code</th>
                    <th className="py-3 px-4 font-bold">Product Name</th>
                    <th className="py-3 px-4 font-bold">Current Stock</th>
                    <th className="py-3 px-4 font-bold">Predicted Demand ({horizonDays}d)</th>
                    <th className="py-3 px-4 font-bold">Safety Stock</th>
                    <th className="py-3 px-4 font-bold">Surplus / Deficit</th>
                    <th className="py-3 px-4 font-bold">DOI</th>
                    <th className="py-3 px-4 font-bold">Urgency</th>
                    <th className="py-3 px-4 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 font-medium">
                  {filteredProducts.map((p) => {
                    const isSelected = selectedSkuDetail?.sku === p.sku;
                    const surplusDeficit = p.current_quantity - p.total_predicted_volume;
                    return (
                      <tr
                        key={p.sku}
                        onClick={() => setSelectedSkuDetail(p)}
                        className={`hover:bg-gray-800/40 transition-colors cursor-pointer ${
                          isSelected ? 'bg-blue-950/30 border-l-2 border-blue-500' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-white flex items-center gap-1.5">
                          {p.sku}
                          {p.handling_type === 'REFRIGERATED' && (
                            <span title="Refrigerated / Cold Chain">
                              <ThermometerSnowflake className="w-3.5 h-3.5 text-cyan-400" />
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-200">{p.item_name}</td>
                        <td className="py-3 px-4 text-gray-300 font-semibold">
                          {p.current_quantity.toLocaleString()} {p.unit || 'units'}
                        </td>
                        <td className="py-3 px-4 font-bold text-blue-400">
                          {p.total_predicted_volume.toLocaleString()} {p.unit || 'units'}
                          <span className="text-[10px] font-normal text-gray-500 ml-1">
                            (~{p.average_daily_volume}/day)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          {p.recommended_safety_stock.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`font-semibold ${
                            surplusDeficit < 0 ? 'text-red-400' : 'text-emerald-400'
                          }`}>
                            {surplusDeficit > 0 ? `+${surplusDeficit}` : surplusDeficit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-300">
                          {p.days_of_inventory} days
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.reorder_urgency === 'CRITICAL'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : p.reorder_urgency === 'WARNING'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {p.reorder_urgency}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSkuDetail(p);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-[11px] font-semibold border border-blue-500/30 transition-all"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-500">
                        No product demand forecasts match your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FLEET & VEHICLE LOGISTICS FORECASTER */}
      {activeForecasterTab === 'fleet' && analytics && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 border border-blue-800/40 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-4 h-4" /> Logistics Capacity Forecaster ({logisticsMode} Mode)
              </span>
              <h2 className="text-lg md:text-xl font-black text-white mt-1">
                {analytics.vehicle_requirements.vehicles_needed} Vehicles Needed for {logisticsMode === 'EXPORT' ? 'Outbound Distribution' : 'Inbound Replenishment'}
              </h2>
              <p className="text-xs text-gray-300 mt-1">
                Total payload volume of {(analytics.vehicle_requirements.total_predicted_volume ?? 0).toLocaleString()} units (
                {(analytics.vehicle_requirements.total_weight_kg ?? 0).toLocaleString()} kg). Average capacity per vehicle:{' '}
                {(analytics.vehicle_requirements.average_vehicle_capacity_kg ?? 0).toLocaleString()} kg.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="text-xs text-gray-400">Available Fleet</div>
                <div className="text-lg font-bold text-white">
                  {analytics.vehicle_requirements.active_fleet_count} Vehicles Ready
                </div>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-extrabold text-sm">
                {analytics.vehicle_requirements.fleet_readiness_pct}%
              </div>
            </div>
          </div>

          {/* Vehicle Type Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Refrigerated Trucks */}
            <div className="bg-[#111827] border border-cyan-500/20 rounded-2xl p-4 shadow-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                  <ThermometerSnowflake className="w-4 h-4" /> Refrigerated Reefer
                </span>
                <span className="text-lg font-extrabold text-white">
                  {analytics.vehicle_requirements.vehicle_type_breakdown['REFRIGERATED'] || 0}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Temperature controlled at 2°C to 8°C for Pharmaceutical & Vaccines.
              </p>
              <div className="text-[11px] text-cyan-300 font-semibold pt-1 border-t border-gray-800">
                Payload Cap: 2,500 kg per truck
              </div>
            </div>

            {/* Enclosed Electric Vans */}
            <div className="bg-[#111827] border border-emerald-500/20 rounded-2xl p-4 shadow-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> Enclosed Electric Van
                </span>
                <span className="text-lg font-extrabold text-white">
                  {analytics.vehicle_requirements.vehicle_type_breakdown['ENCLOSED_EV'] || 0}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Eco-friendly zero-emission fleet for Electronics Kits & Urban FMCG.
              </p>
              <div className="text-[11px] text-emerald-300 font-semibold pt-1 border-t border-gray-800">
                Payload Cap: 1,800 kg (Mahindra EV)
              </div>
            </div>

            {/* Flatbed Carriers */}
            <div className="bg-[#111827] border border-amber-500/20 rounded-2xl p-4 shadow-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Box className="w-4 h-4" /> Flatbed Transport
                </span>
                <span className="text-lg font-extrabold text-white">
                  {analytics.vehicle_requirements.vehicle_type_breakdown['FLATBED'] || 0}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Specialized open deck for Heavy Automotive Spares & Industrial Machinery.
              </p>
              <div className="text-[11px] text-amber-300 font-semibold pt-1 border-t border-gray-800">
                Payload Cap: 4,000 kg
              </div>
            </div>

            {/* Heavy Freight Hauler */}
            <div className="bg-[#111827] border border-indigo-500/20 rounded-2xl p-4 shadow-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Truck className="w-4 h-4" /> Heavy Commercial Truck
                </span>
                <span className="text-lg font-extrabold text-white">
                  {analytics.vehicle_requirements.vehicle_type_breakdown['HEAVY_TRUCK'] || 0}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                High-capacity long-haul freight for cross-hub volume distribution.
              </p>
              <div className="text-[11px] text-indigo-300 font-semibold pt-1 border-t border-gray-800">
                Payload Cap: 5,000 - 6,000 kg (Tata Prima)
              </div>
            </div>
          </div>

          {/* Operational Transport Metrics */}
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-blue-400" />
              Operational Transport & Fuel Projections
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800">
                <div className="text-xs text-gray-400">Estimated Travel Distance</div>
                <div className="text-lg font-extrabold text-white mt-1">
                  {(analytics.vehicle_requirements?.logistics_metrics?.estimated_distance_km ?? 0).toLocaleString()} km
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">Based on Clarke-Wright cluster centroids</div>
              </div>

              <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800">
                <div className="text-xs text-gray-400">Diesel Consumption</div>
                <div className="text-lg font-extrabold text-amber-400 mt-1">
                  {(analytics.vehicle_requirements?.logistics_metrics?.fuel_diesel_liters ?? 0).toLocaleString()} Liters
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">Fleet average 3.8 km/L</div>
              </div>

              <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800">
                <div className="text-xs text-gray-400">EV Electric Energy</div>
                <div className="text-lg font-extrabold text-cyan-400 mt-1">
                  {(analytics.vehicle_requirements?.logistics_metrics?.ev_energy_kwh ?? 0).toLocaleString()} kWh
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">0.75 kWh/km green transport</div>
              </div>

              <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800">
                <div className="text-xs text-gray-400">Logistics Budget Estimate</div>
                <div className="text-lg font-extrabold text-emerald-400 mt-1">
                  ₹{(analytics.vehicle_requirements?.logistics_metrics?.estimated_cost_inr ?? 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">₹14.5/km commercial standard</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: WAREHOUSE STORAGE & PALLET CAPACITY FORECASTER */}
      {activeForecasterTab === 'storage' && analytics && (
        <div className="space-y-6">
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  Warehouse Floor & Pallet Space Simulation
                </h3>
                <p className="text-xs text-gray-400">
                  Simulating warehouse floor and vertical rack occupancy based on {logisticsMode.toLowerCase()} flows
                </p>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                (analytics.storage_forecaster?.status) === 'OVERFLOW_RISK'
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : (analytics.storage_forecaster?.status) === 'NEAR_CAPACITY'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}>
                {analytics.storage_forecaster?.status ?? 'OPTIMAL'}
              </span>
            </div>

            {/* Gauge / Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-gray-400">Current Occupancy: {analytics.storage_forecaster?.current_utilization_pct ?? 0}%</span>
                <span className="text-purple-400">Projected: {analytics.storage_forecaster?.projected_utilization_pct ?? 0}%</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-3.5 overflow-hidden border border-gray-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (analytics.storage_forecaster?.projected_utilization_pct ?? 0) > 90
                      ? 'bg-gradient-to-r from-amber-500 to-red-500'
                      : (analytics.storage_forecaster?.projected_utilization_pct ?? 0) > 75
                      ? 'bg-gradient-to-r from-blue-500 to-amber-500'
                      : 'bg-gradient-to-r from-blue-600 to-emerald-500'
                  }`}
                  style={{ width: `${Math.min(analytics.storage_forecaster?.projected_utilization_pct ?? 0, 100)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="p-3.5 bg-gray-900 rounded-xl border border-gray-800">
                <div className="text-xs text-gray-400">Storage Floor Area</div>
                <div className="text-lg font-bold text-white mt-1">
                  {(analytics.storage_forecaster?.capacity_sqft ?? 0).toLocaleString()} sq.ft
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">High-bay automated racking</div>
              </div>

              <div className="p-3.5 bg-gray-900 rounded-xl border border-gray-800">
                <div className="text-xs text-gray-400">Projected Units Stored</div>
                <div className="text-lg font-bold text-purple-400 mt-1">
                  {(analytics.storage_forecaster?.projected_units ?? 0).toLocaleString()} units
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {logisticsMode === 'EXPORT' ? 'After outbound dispatches' : 'After inbound replenishment'}
                </div>
              </div>

              <div className="p-3.5 bg-gray-900 rounded-xl border border-gray-800">
                <div className="text-xs text-gray-400">Standard Pallets Needed</div>
                <div className="text-lg font-bold text-cyan-400 mt-1">
                  {(analytics.storage_forecaster?.pallets_required ?? 0).toLocaleString()} Pallets
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">ISO standard 1200x1000mm pallet slots</div>
              </div>

              <div className="p-3.5 bg-gray-900 rounded-xl border border-gray-800">
                <div className="text-xs text-gray-400">Capacity Buffer</div>
                <div className="text-lg font-bold text-emerald-400 mt-1">
                  {Math.max(0, 100 - (analytics.storage_forecaster?.projected_utilization_pct ?? 0)).toFixed(1)}% Free
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">Headroom before overflow</div>
              </div>
            </div>
          </div>

          {/* Per-Warehouse Breakdown Table */}
          {analytics.storage_forecaster?.warehouses_breakdown && analytics.storage_forecaster.warehouses_breakdown.length > 0 && (
            <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-purple-400" />
                  Warehouse Node Capacity & Pallet Allocation
                </h3>
                <p className="text-xs text-gray-400">
                  Individual hub breakdown showing current vs. projected space utilization and pallet demand
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-800">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-gray-900/80 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">Warehouse Name</th>
                      <th className="py-3 px-4 font-bold">City</th>
                      <th className="py-3 px-4 font-bold">Floor Area</th>
                      <th className="py-3 px-4 font-bold">Current Units</th>
                      <th className="py-3 px-4 font-bold">Projected Units</th>
                      <th className="py-3 px-4 font-bold">Current Fill</th>
                      <th className="py-3 px-4 font-bold">Projected Fill</th>
                      <th className="py-3 px-4 font-bold">Pallets Needed</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 font-medium">
                    {analytics.storage_forecaster.warehouses_breakdown.map((wh) => (
                      <tr key={wh.warehouse_id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-white">{wh.warehouse_name}</td>
                        <td className="py-3 px-4 text-gray-400">{wh.city}</td>
                        <td className="py-3 px-4 text-gray-300">{(wh.capacity_sqft ?? 0).toLocaleString()} sq.ft</td>
                        <td className="py-3 px-4 text-gray-300 font-semibold">{(wh.current_units ?? 0).toLocaleString()}</td>
                        <td className="py-3 px-4 text-purple-400 font-bold">{(wh.projected_units ?? 0).toLocaleString()}</td>
                        <td className="py-3 px-4 text-gray-300">{wh.current_utilization_pct}%</td>
                        <td className="py-3 px-4">
                          <span className={`font-bold ${
                            wh.projected_utilization_pct > 90
                              ? 'text-red-400'
                              : wh.projected_utilization_pct > 75
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}>
                            {wh.projected_utilization_pct}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-cyan-400 font-bold">{(wh.pallets_required ?? 0).toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            wh.status === 'OVERFLOW_RISK'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : wh.status === 'NEAR_CAPACITY'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {wh.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COLD CHAIN & SPECIALIZED HANDLING */}
      {activeForecasterTab === 'coldchain' && analytics && (
        <div className="space-y-6">
          <div className="bg-[#111827] border border-cyan-500/20 rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ThermometerSnowflake className="w-5 h-5 text-cyan-400" />
              Cold Chain & Specialized Cargo Handling Forecast
            </h3>
            <p className="text-xs text-gray-400">
              Categorizing forecasted product shipments by temperature sensitivity, electrostatic protection, and heavy equipment transport.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-gray-900/60 border border-cyan-500/30 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                    <ThermometerSnowflake className="w-4 h-4" /> Cold Chain (2°C - 8°C)
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                    Active
                  </span>
                </div>
                <div className="text-2xl font-black text-white">
                  {analytics.products
                    .filter((p) => p.handling_type === 'REFRIGERATED')
                    .reduce((acc, p) => acc + (p.total_predicted_volume || 0), 0)
                    .toLocaleString()}{' '}
                  <span className="text-xs font-normal text-gray-400">units</span>
                </div>
                <p className="text-xs text-gray-400">
                  Pharmaceutical Supplies & Vaccines. Requires continuous telematics IoT temperature logging.
                </p>
              </div>

              <div className="bg-gray-900/60 border border-indigo-500/30 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-400 flex items-center gap-1">
                    <Zap className="w-4 h-4" /> Fragile Electronics
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                    Anti-Static
                  </span>
                </div>
                <div className="text-2xl font-black text-white">
                  {analytics.products
                    .filter((p) => p.handling_type === 'FRAGILE_ELECTRONICS')
                    .reduce((acc, p) => acc + (p.total_predicted_volume || 0), 0)
                    .toLocaleString()}{' '}
                  <span className="text-xs font-normal text-gray-400">units</span>
                </div>
                <p className="text-xs text-gray-400">
                  Electronic component kits and microprocessors requiring shock-proof cushioning.
                </p>
              </div>

              <div className="bg-gray-900/60 border border-amber-500/30 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                    <Box className="w-4 h-4" /> Heavy Industrial
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    Crane Required
                  </span>
                </div>
                <div className="text-2xl font-black text-white">
                  {analytics.products
                    .filter((p) => p.handling_type === 'HEAVY_MACHINERY')
                    .reduce((acc, p) => acc + (p.total_predicted_volume || 0), 0)
                    .toLocaleString()}{' '}
                  <span className="text-xs font-normal text-gray-400">units</span>
                </div>
                <p className="text-xs text-gray-400">
                  Automotive spares and mechanical assemblies requiring forklift or overhead crane loading.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CARBON FOOTPRINT & ESG IMPACT FORECASTER */}
      {activeForecasterTab === 'carbon' && analytics && (
        <div className="space-y-6">
          <div className="bg-[#111827] border border-lime-500/20 rounded-2xl p-5 shadow-lg space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Leaf className="w-5 h-5 text-lime-400" />
              Green Logistics & Carbon Footprint ESG Forecaster
            </h3>
            <p className="text-xs text-gray-400">
              Predicting carbon emissions for forecasted route dispatches and quantifying CO2 savings from electric fleet deployment.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-gray-900/60 rounded-xl border border-gray-800">
                <div className="text-xs text-gray-400">Projected Diesel Emissions</div>
                <div className="text-2xl font-black text-amber-400 mt-1">
                  {analytics.vehicle_requirements.logistics_metrics.co2_emissions_kg} kg CO2e
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Based on {analytics.vehicle_requirements.logistics_metrics.fuel_diesel_liters} Liters diesel @ 2.68 kg CO2/L
                </p>
              </div>

              <div className="p-4 bg-gray-900/60 rounded-xl border border-gray-800">
                <div className="text-xs text-gray-400">EV Fleet CO2 Reduction</div>
                <div className="text-2xl font-black text-lime-400 mt-1">
                  -{analytics.vehicle_requirements.logistics_metrics.ev_co2_savings_kg} kg CO2e
                </div>
                <p className="text-xs text-lime-500/80 mt-1">
                  Achieved by dispatching EV Vans (Mahindra Treo Zor / Tata Ace Gold EV)
                </p>
              </div>

              <div className="p-4 bg-gray-900/60 rounded-xl border border-gray-800">
                <div className="text-xs text-gray-400">Green Fleet Utilization</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">
                  92.4% Score
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Meets Scope 1 Corporate ESG Sustainability compliance guidelines
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: PROCUREMENT & REORDER URGENCY FORECASTER */}
      {activeForecasterTab === 'procurement' && analytics && (
        <div className="space-y-6">
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  Procurement Replenishment & Purchase Order Recommendations
                </h3>
                <p className="text-xs text-gray-400">
                  Recommended order quantities to prevent stockouts based on predicted demand and supplier lead times
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-gray-900/80 text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">SKU Code</th>
                    <th className="py-3 px-4 font-bold">Item Description</th>
                    <th className="py-3 px-4 font-bold">On Hand</th>
                    <th className="py-3 px-4 font-bold">Predicted Demand</th>
                    <th className="py-3 px-4 font-bold">Safety Buffer</th>
                    <th className="py-3 px-4 font-bold">Suggested PO Qty</th>
                    <th className="py-3 px-4 font-bold">Supplier Lead Time</th>
                    <th className="py-3 px-4 font-bold">Urgency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 font-medium">
                  {analytics.procurement_forecaster.map((p) => (
                    <tr key={p.sku} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-white">{p.sku}</td>
                      <td className="py-3 px-4 text-gray-200">{p.item_name}</td>
                      <td className="py-3 px-4">{p.current_qty}</td>
                      <td className="py-3 px-4 text-blue-400 font-bold">{p.predicted_demand}</td>
                      <td className="py-3 px-4 text-gray-400">{p.safety_stock}</td>
                      <td className="py-3 px-4 text-emerald-400 font-extrabold">
                        +{p.suggested_po_qty} units
                      </td>
                      <td className="py-3 px-4 text-gray-400">{p.lead_time_days} days buffer</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.urgency === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {p.urgency}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {analytics.procurement_forecaster.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-emerald-400 font-semibold">
                        All SKUs have sufficient stock buffers for the chosen horizon. No critical reorders needed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MlPredictor;
