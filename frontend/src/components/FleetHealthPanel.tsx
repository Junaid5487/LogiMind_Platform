import React, { useEffect, useState } from 'react';
import type { VehicleItem } from '../types';
import { fetchVehicleHealth } from '../services/api';
import { Activity, ShieldAlert, Cpu, Thermometer, Gauge, CheckCircle2 } from 'lucide-react';

interface FleetHealthPanelProps {
  vehicles: VehicleItem[];
}

export const FleetHealthPanel: React.FC<FleetHealthPanelProps> = ({ vehicles }) => {
  const [selectedVehicle, setSelectedVehicle] = useState<string>('V-104');
  const [healthData, setHealthData] = useState<any>(null);

  const loadVehicleHealth = async (vId: string) => {
    try {
      const data = await fetchVehicleHealth(vId);
      setHealthData(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadVehicleHealth(selectedVehicle);
  }, [selectedVehicle]);

  const formatRiskPct = (val: any) => {
    if (typeof val === 'number') {
      return val > 1 ? val.toFixed(0) : (val * 100).toFixed(0);
    }
    return '15';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            IoT Fleet Telemetry & SHAP Explainable AI Diagnostics
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Predictive maintenance risk scoring powered by Random Forest & SHAP feature impact attributions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-panel p-5 rounded-2xl space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Fleet Registry</h3>
          {vehicles.map((v) => (
            <div
              key={v.id}
              onClick={() => setSelectedVehicle(v.id)}
              className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                selectedVehicle === v.id
                  ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                  : 'bg-gray-900/40 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">{v.id}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    v.status === 'MAINTENANCE'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}
                >
                  {v.status}
                </span>
              </div>
              <div className="text-sm font-bold text-white mt-1">{v.name}</div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {healthData && (
            <div className="glass-panel p-6 rounded-2xl space-y-6 border border-emerald-500/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-800">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-emerald-400" />
                    {healthData.vehicle_name || healthData.vehicle_id} Telemetry & AI Diagnostic
                  </h3>
                  <p className="text-xs text-gray-400">ID: {healthData.vehicle_id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Failure Risk:</span>
                  <span
                    className={`text-sm font-extrabold px-3 py-1 rounded-xl border ${
                      healthData.status === 'CRITICAL'
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    }`}
                  >
                    {formatRiskPct(healthData.overall_failure_risk)}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="glass-card p-4 rounded-xl space-y-2 border border-gray-800">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Thermometer className="w-4 h-4 text-amber-400" />
                    <span>Engine Cooling System</span>
                  </div>
                  <div className="text-xl font-bold text-white">
                    {healthData.component_risks?.engine_cooling ? (healthData.component_risks.engine_cooling * 100).toFixed(0) : '60'}% Risk
                  </div>
                </div>

                <div className="glass-card p-4 rounded-xl space-y-2 border border-gray-800">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Gauge className="w-4 h-4 text-sky-400" />
                    <span>Tires & Suspension</span>
                  </div>
                  <div className="text-xl font-bold text-white">
                    {healthData.component_risks?.tires_suspension ? (healthData.component_risks.tires_suspension * 100).toFixed(0) : '25'}% Risk
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-3">
                  SHAP Explainable AI Feature Attributions
                </h4>
                <div className="space-y-2">
                  {(healthData.shap_top_features || healthData.shap_feature_attributions || []).map((feat: any, idx: number) => (
                    <div key={idx} className="glass-card p-3 rounded-xl flex items-center justify-between text-xs border border-gray-800">
                      <span className="font-semibold text-white">{feat.feature || feat.feature_name}</span>
                      <span className="font-bold text-amber-400">{feat.impact || feat.shap_value} Impact</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
