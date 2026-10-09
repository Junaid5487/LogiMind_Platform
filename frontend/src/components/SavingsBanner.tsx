import React from 'react';
import { TrendingDown } from 'lucide-react';

interface SavingsBannerProps {
  defaultKm?: number;
  optimizedKm?: number;
  visible: boolean;
}

export const SavingsBanner: React.FC<SavingsBannerProps> = ({ defaultKm, optimizedKm, visible }) => {
  if (!visible || typeof defaultKm !== 'number' || typeof optimizedKm !== 'number' || defaultKm <= 0) return null;
  const saved = defaultKm - optimizedKm;
  const pct = (saved / defaultKm) * 100;
  return (
    <div className="glass-panel p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
        <TrendingDown className="w-4.5 h-4.5 text-white" />
      </div>
      <div className="text-xs">
        <p className="font-bold text-emerald-300">
          Optimized route saves {saved.toFixed(1)} km ({pct.toFixed(1)}% vs default)
        </p>
        <p className="text-gray-400 mt-0.5">
          Default baseline {defaultKm.toFixed(1)} km &rarr; Optimized {optimizedKm.toFixed(1)} km
        </p>
      </div>
    </div>
  );
};

export default SavingsBanner;
