import type { DashboardKPIs } from '../types';
import { TrendingUp, Clock, Truck, Warehouse, DollarSign, ShieldAlert, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';

interface ExecutiveDashboardProps {
  kpis: DashboardKPIs | null;
  onNavigate: (tab: string) => void;
}

const mockDemandTrend = [
  { date: 'Mon', demand: 320, baseline: 300 },
  { date: 'Tue', demand: 410, baseline: 310 },
  { date: 'Wed', demand: 480, baseline: 330 },
  { date: 'Thu', demand: 520, baseline: 350 },
  { date: 'Fri', demand: 610, baseline: 380 },
  { date: 'Sat', demand: 390, baseline: 320 },
  { date: 'Sun', demand: 280, baseline: 290 },
];

const mockFleetDistribution = [
  { type: 'Heavy Diesel', active: 4, maintenance: 0 },
  { type: 'Medium Diesel', active: 2, maintenance: 0 },
  { type: 'EV Cargo Van', active: 3, maintenance: 1 },
];

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ kpis, onNavigate }) => {
  return (
    <div className="p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-900/20 via-gray-900 to-indigo-900/20">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            Operations Control Tower
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
              OPTIMIZED REAL-TIME
            </span>
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            AI-driven demand forecasting, Clarke-Wright Savings & 2-Opt vehicle route optimization, and predictive fleet health telemetry.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('routemap')}
            className="px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-semibold border border-sky-500/30 transition-all flex items-center gap-1.5"
          >
            <span>View Live Route VRP</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('simulator')}
            className="px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-semibold border border-purple-500/30 transition-all flex items-center gap-1.5"
          >
            <span>Run Digital Twin</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">On-Time Delivery SLA</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-white">{kpis ? `${kpis.on_time_delivery_pct}%` : '98.4%'}</div>
            <div className="flex items-center gap-1 text-xs text-emerald-400 mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+3.4% vs static dispatch</span>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">Active Fleet Utilization</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-white">{kpis ? `${kpis.active_vehicles} Vehicles` : '142 Active'}</div>
            <div className="text-xs text-gray-400 mt-1">
              Dispatched across regional routes
            </div>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">Avg Warehouse Capacity</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Warehouse className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-white">{kpis ? `${kpis.warehouse_capacity_pct}%` : '82.6%'}</div>
            <div className="text-xs text-amber-400 mt-1 font-medium">
              PuLP LP rebalancing active
            </div>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">Monthly Fuel Savings</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-white">$2,410</div>
            <div className="text-xs text-purple-400 mt-1">
              {kpis ? `${kpis.co2_savings_tons} tons CO2 reduced` : '24.8 tons CO2 reduced'}
            </div>
          </div>
        </div>
      </div>

      {/* Charts & Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Demand Forecasting Chart */}
        <div className="glass-panel lg:col-span-2 p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Order Demand Forecast & Seasonality</h3>
              <p className="text-xs text-gray-400">Prophet + LightGBM 7-Day Predicted Volume vs Baseline</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              94.2% Model Confidence
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockDemandTrend}>
                <defs>
                  <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem', color: '#fff' }} />
                <Area type="monotone" dataKey="demand" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#colorDemand)" name="Predicted Orders" />
                <Area type="monotone" dataKey="baseline" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="4 4" fill="none" name="Historical Baseline" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fleet Distribution & Risk Alerts */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Fleet Operational Status</h3>
            <p className="text-xs text-gray-400 mb-4">Live Vehicle Type Breakdown</p>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockFleetDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="type" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.5rem', color: '#fff' }} />
                  <Bar dataKey="active" fill="#34d399" radius={[4, 4, 0, 0]} name="Active Vehicles" />
                  <Bar dataKey="maintenance" fill="#ef4444" radius={[4, 4, 0, 0]} name="In Maintenance" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-800">
            <div className="flex items-center justify-between text-xs text-gray-300">
              <span className="flex items-center gap-1.5 font-semibold text-amber-400">
                <ShieldAlert className="w-4 h-4" />
                Vehicle Risk Warning
              </span>
              <span className="text-gray-400 font-mono">V-104 (Ford EV)</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              High Engine Temp (98.5°C) detected. SHAP score: 0.88. Removed from long-distance VRP assignments.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
