import React, { useState } from 'react';
import { runSimulation } from '../services/api';
import { Cpu, Play, AlertOctagon, TrendingDown, DollarSign, Navigation, Activity } from 'lucide-react';

export const DigitalTwinConsole: React.FC = () => {
  const [scenarioName, setScenarioName] = useState('Navi Mumbai Warehouse Shutdown Scenario');
  const [disabledWh, setDisabledWh] = useState('w2222222-2222-2222-2222-222222222222');
  const [disabledVeh, setDisabledVeh] = useState('');
  const [demandMultiplier, setDemandMultiplier] = useState(1.0);
  const [fuelPrice, setFuelPrice] = useState(4.20);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleRunSimulation = async () => {
    setLoading(true);
    try {
      const res = await runSimulation({
        scenario_name: scenarioName,
        disabled_warehouse_id: disabledWh || null,
        disabled_vehicle_id: disabledVeh || null,
        demand_multiplier: demandMultiplier,
        fuel_price_usd: fuelPrice
      });
      setSimulationResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    handleRunSimulation();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-400" />
            Digital Twin Monte Carlo Scenario Simulator
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            What-if operational stress testing for warehouse outages, vehicle breakdowns, fuel price surges & demand spikes.
          </p>
        </div>

        <button
          onClick={handleRunSimulation}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <Play className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Simulating 1,000 Monte Carlo Trials...' : 'Execute What-If Simulation'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-panel p-5 rounded-2xl space-y-4 border border-gray-800">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Scenario Controls</h3>

          <div>
            <label className="text-xs text-gray-300 font-medium block mb-1">Scenario Title</label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-300 font-medium block mb-1">Disrupted Node / Warehouse</label>
            <select
              value={disabledWh}
              onChange={(e) => setDisabledWh(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">None (Nominal Operations)</option>
              <option value="w2222222-2222-2222-2222-222222222222">Navi Mumbai Distribution Center (w2)</option>
              <option value="w1111111-1111-1111-1111-111111111111">Mumbai Central Logistics Hub (w1)</option>
              <option value="w3333333-3333-3333-3333-333333333333">Pune Industrial Fulfillment (w3)</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-300 font-medium block mb-1">Disabled Fleet Vehicle</label>
            <select
              value={disabledVeh}
              onChange={(e) => setDisabledVeh(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              <option value="">None (All Fleet Vehicles Available)</option>
              <option value="V-101">Tata Prima 5530.S (V-101 Heavy Truck)</option>
              <option value="V-102">Mahindra Treo Zor EV (V-102)</option>
              <option value="V-104">Ashok Leyland BADA DOST (V-104)</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <span>Order Volume Surge Multiplier</span>
              <span className="font-bold text-purple-400">{demandMultiplier.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={demandMultiplier}
              onChange={(e) => setDemandMultiplier(parseFloat(e.target.value))}
              className="w-full accent-purple-500 bg-gray-900"
            />
          </div>

          <div>
            <label className="text-xs text-gray-300 font-medium block mb-1">Fuel Price ($/Liter)</label>
            <input
              type="number"
              step="0.1"
              value={fuelPrice}
              onChange={(e) => setFuelPrice(parseFloat(e.target.value) || 4.20)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {simulationResult && (
            <div className="glass-panel p-6 rounded-2xl space-y-6 border border-purple-500/30">
              <div className="flex items-center justify-between pb-4 border-b border-gray-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 text-purple-400" />
                  {simulationResult.scenario_name || 'Simulation Results'}
                </h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  1,000 Monte Carlo Iterations
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="glass-card p-4 rounded-xl space-y-2 border border-gray-800">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span>Cost Impact Delta</span>
                  </div>
                  <div className={`text-xl font-bold ${simulationResult.deltas?.cost_usd_delta > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {simulationResult.deltas?.cost_usd_delta >= 0 ? '+' : ''}${simulationResult.deltas?.cost_usd_delta?.toLocaleString()} USD
                  </div>
                </div>

                <div className="glass-card p-4 rounded-xl space-y-2 border border-gray-800">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <span>On-Time SLA Impact</span>
                  </div>
                  <div className={`text-xl font-bold ${simulationResult.deltas?.sla_pct_delta < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {simulationResult.deltas?.sla_pct_delta >= 0 ? '+' : ''}{simulationResult.deltas?.sla_pct_delta}% SLA
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800">
                  <div className="text-[11px] text-gray-400">Distance</div>
                  <div className="text-sm font-bold text-white">{simulationResult.simulated?.total_distance_km} km</div>
                  <div className="text-[10px] text-purple-400">+{simulationResult.deltas?.distance_km_delta} km</div>
                </div>
                <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800">
                  <div className="text-[11px] text-gray-400">Fuel Usage</div>
                  <div className="text-sm font-bold text-white">{simulationResult.simulated?.total_fuel_liters} L</div>
                  <div className="text-[10px] text-purple-400">+{simulationResult.deltas?.fuel_liters_delta} L</div>
                </div>
                <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800">
                  <div className="text-[11px] text-gray-400">Fuel Cost</div>
                  <div className="text-sm font-bold text-white">${simulationResult.simulated?.total_fuel_cost_usd?.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400">Base: ${simulationResult.baseline?.total_fuel_cost_usd?.toLocaleString()}</div>
                </div>
                <div className="p-3 bg-gray-900/60 rounded-xl border border-gray-800">
                  <div className="text-[11px] text-gray-400">Required Routes</div>
                  <div className="text-sm font-bold text-white">{simulationResult.simulated?.total_routes} Active</div>
                  <div className="text-[10px] text-gray-400">Base: {simulationResult.baseline?.total_routes}</div>
                </div>
              </div>

              <p className="text-xs text-gray-300 italic bg-gray-900/60 p-4 rounded-xl border border-gray-800">
                {simulationResult.summary_explanation}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
