import { useState } from 'react';
import type { WarehouseItem } from '../types';
import { rebalanceInventory } from '../services/api';
import { Warehouse, RefreshCw, AlertTriangle, ArrowRightLeft, PackageCheck } from 'lucide-react';

interface WarehouseHubProps {
  warehouses: WarehouseItem[];
}

export const WarehouseHub: React.FC<WarehouseHubProps> = ({ warehouses }) => {
  const [rebalanceData, setRebalanceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleRebalance = async () => {
    setLoading(true);
    try {
      const res = await rebalanceInventory();
      setRebalanceData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-amber-400" />
            Multi-Warehouse Inventory & Optimization Hub
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Linear Programming (PuLP / SciPy) transportation model minimizing inter-warehouse transfer costs.
          </p>
        </div>

        <button
          onClick={handleRebalance}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-semibold shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Running PuLP LP Solver...' : 'Trigger PuLP LP Rebalance'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {warehouses.map((wh) => (
          <div key={wh.id} className="glass-card p-5 rounded-2xl border border-gray-800 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  {wh.id}
                </span>
                <h3 className="text-base font-bold text-white mt-1">{wh.name}</h3>
                <p className="text-xs text-gray-400">{wh.city}</p>
              </div>

              {wh.low_stock_count > 0 ? (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="w-3 h-3" />
                  {wh.low_stock_count} LOW STOCK
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <PackageCheck className="w-3 h-3" />
                  NOMINAL
                </span>
              )}
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Capacity Utilization</span>
                <span className="font-semibold text-white">{wh.current_utilization_pct}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    wh.current_utilization_pct > 85 ? 'bg-red-500' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${wh.current_utilization_pct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 pt-3 border-t border-gray-800/80">
              <div>
                <div>Total Floor Area</div>
                <div className="font-semibold text-white">{(wh.capacity_sqft || wh.storage_capacity_sqft || 100000).toLocaleString()} sqft</div>
              </div>
              <div>
                <div>Active SKUs</div>
                <div className="font-semibold text-white">{wh.total_skus} Products</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {rebalanceData && (
        <div className="glass-panel p-6 rounded-2xl space-y-4 border border-amber-500/30">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-amber-400" />
              PuLP LP Optimal Transfer Recommendations
            </h3>
            <span className="text-xs font-semibold text-amber-300">
              Est. Total Cost: ${rebalanceData.total_transfer_cost_usd}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(rebalanceData.recommendations || []).map((rec: any, idx: number) => (
              <div key={idx} className="glass-card p-4 rounded-xl space-y-2 border border-gray-800">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-sky-400">{rec.sku}</span>
                  <span className="text-emerald-400 font-semibold">${rec.estimated_cost_usd}</span>
                </div>
                <div className="text-xs text-gray-300">
                  Shift <span className="font-bold text-amber-400">{rec.quantity} units</span> from{' '}
                  <span className="text-white font-medium">{rec.from_warehouse_name || rec.from_warehouse_id}</span> to{' '}
                  <span className="text-white font-medium">{rec.to_warehouse_name || rec.to_warehouse_id}</span>
                </div>
                <p className="text-[11px] text-gray-400 italic">{rec.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
