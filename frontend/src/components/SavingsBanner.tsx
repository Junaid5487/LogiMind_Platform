import React from 'react';
import { TrendingDown, DollarSign, Wind, PackageCheck } from 'lucide-react';

interface SavingsBannerProps {
  defaultKm?: number;
  optimizedKm?: number;
  visible: boolean;
  /** Optional fleet-wide comparison (naive vs optimized) with cost & carbon. */
  comparison?: {
    saved?: { distance_km: number; fuel_liters: number; carbon_kg: number; cost_usd: number };
    saved_pct?: { distance: number; cost: number; carbon: number };
    naive?: { cost_usd: number; carbon_kg: number; distance_km: number };
    optimized?: { cost_usd: number; carbon_kg: number; distance_km: number };
  } | null;
}

export const SavingsBanner: React.FC<SavingsBannerProps> = ({ defaultKm, optimizedKm, visible, comparison }) => {
  if (!visible) return null;

  // Fallback: compute from default/optimized km when no full comparison is provided.
  const savedKm = typeof defaultKm === 'number' && typeof optimizedKm === 'number' && defaultKm > 0
    ? defaultKm - optimizedKm
    : (comparison?.saved?.distance_km ?? 0);
  const pct = defaultKm && defaultKm > 0 ? (savedKm / defaultKm) * 100 : (comparison?.saved_pct?.distance ?? 0);
  const savedFuel = comparison?.saved?.fuel_liters ?? 0;
  const savedCo2 = comparison?.saved?.carbon_kg ?? 0;
  const savedUsd = comparison?.saved?.cost_usd ?? 0;

  return (
    <div className="glass-panel p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col md:flex-row md:items-center gap-4">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
        <TrendingDown className="w-4.5 h-4.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-emerald-300 text-sm">
          {savedKm > 0
            ? `Optimized route saves ${savedKm.toFixed(1)} km (${pct.toFixed(1)}% vs default)`
            : 'Route optimization ready — press “Optimize Route” to see savings'}
        </p>
        {savedFuel > 0 || savedCo2 > 0 || savedUsd > 0 ? (
          <p className="text-gray-400 text-[10px] mt-1">
            {savedFuel > 0 ? `${savedFuel.toFixed(0)} L fuel saved · ` : ''}
            {savedCo2 > 0 ? `${savedCo2.toFixed(0)} kg CO₂ avoided · ` : ''}
            ${savedUsd > 0 ? `$${savedUsd.toFixed(2)} cost saved` : ''}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {savedFuel > 0 && (
          <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-300 text-[10px] font-medium border border-blue-500/30 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Fuel: {savedFuel.toFixed(0)} L
          </span>
        )}
        {savedCo2 > 0 && (
          <span className="px-2 py-1 rounded bg-sky-500/10 text-sky-300 text-[10px] font-medium border border-sky-500/30 flex items-center gap-1">
            <PackageCheck className="w-3 h-3" /> CO₂: {savedCo2.toFixed(0)} kg
          </span>
        )}
        {savedUsd > 0 && (
          <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 text-[10px] font-medium border border-emerald-500/30 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> ${savedUsd.toFixed(2)} saved
          </span>
        )}
      </div>
    </div>
  );
};

export default SavingsBanner;
