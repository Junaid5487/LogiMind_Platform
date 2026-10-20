import { useState, useEffect, useMemo } from 'react';
import type { WarehouseItem, InventoryItem, RebalanceResult, TransferRecommendation, TransferTrip, DispatchResult } from '../types';
import { fetchInventory, rebalanceInventory, shiftInventory, dispatchTransferTrips } from '../services/api';
import { Warehouse, RefreshCw, AlertTriangle, ArrowRightLeft, PackageCheck, Search, ChevronDown, ChevronUp, CheckCircle2, Star, Boxes, Truck } from 'lucide-react';

interface WarehouseHubProps {
  warehouses: WarehouseItem[];
  onChanged?: () => Promise<void>;
}

const PAGE_SIZE = 6;

export const WarehouseHub: React.FC<WarehouseHubProps> = ({ warehouses, onChanged }) => {
  const [rebalanceData, setRebalanceData] = useState<RebalanceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [invLoading, setInvLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [applying, setApplying] = useState<string | null>(null);
  const [dispatchData, setDispatchData] = useState<DispatchResult | null>(null);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null);

  const whName = (id: string) => warehouses.find(w => w.id === id)?.name || id;

  const loadAll = async () => {
    setError(null);
    setInvLoading(true);
    try {
      setInventory(await fetchInventory());
    } catch (e: any) {
      setError(e.message || 'Failed to load warehouse data');
    } finally {
      setInvLoading(false);
    }
  };

  const handleRebalance = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await rebalanceInventory();
      setRebalanceData(res);
      setNotice((res.recommendations || []).length === 0 ? 'balanced' : null);
    } catch (e: any) {
      setError(e.message || 'LP optimizer failed - check backend and retry');
    } finally {
      setLoading(false);
    }
  };

  const handleDispatchTransferTrips = async () => {
    setDispatchLoading(true);
    setDispatchError(null);
    setDispatchNotice(null);
    try {
      const res = await dispatchTransferTrips();
      setDispatchData(res);
      const trips = res.trips || [];
      setDispatchNotice(
        trips.length === 0 ? 'No transfer trips needed - inventory is balanced.' : `Scheduled ${trips.length} transfer trip${trips.length > 1 ? 's' : ''}.`
      );
      if (res.status === 'OPTIMAL') {
        // Refresh inventory + rebalance so the hub cards reflect the new stock plan.
        await loadAll();
        await handleRebalance();
      }
    } catch (e: any) {
      setDispatchError(e.message || 'Failed to dispatch transfer trips - check backend and retry');
    } finally {
      setDispatchLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    handleRebalance();
  }, []);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, lowOnly]);

  const stockByHub = useMemo(() => {
    const map: Record<string, InventoryItem[]> = {};
    for (const row of inventory) {
      (map[row.warehouse_id] = map[row.warehouse_id] || []).push(row);
    }
    return map;
  }, [inventory]);

  const filteredHubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return warehouses.filter(w => {
      if (lowOnly && (w.low_stock_count || 0) === 0) return false;
      if (!q) return true;
      return [w.name, w.city, w.state || '', w.id].some(f => (f || '').toLowerCase().includes(q));
    });
  }, [warehouses, search, lowOnly]);

  const handleApply = async (rec: TransferRecommendation) => {
    const key = `${rec.from_warehouse_id}->${rec.to_warehouse_id}:${rec.sku}`;
    if (!window.confirm(`Apply transfer of ${rec.quantity} x ${rec.sku} from ${rec.from_warehouse_name} to ${rec.to_warehouse_name}?`)) return;
    setApplying(key);
    try {
      const res = await shiftInventory({
        from_warehouse_id: rec.from_warehouse_id,
        to_warehouse_id: rec.to_warehouse_id,
        sku: rec.sku,
        quantity: rec.quantity,
      });
      setRebalanceData(prev => prev ? { ...prev, recommendations: (prev.recommendations || []).filter(r => r !== rec) } : prev);
      setNotice(`Transferred ${res.quantity} x ${res.sku} - refresh recommendations to re-check balance.`);

      await loadAll();
      await onChanged?.();
    } catch (e: any) {
      setError(e.message || 'Failed to apply transfer');
    } finally {
      setApplying(null);
    }
  };

  const toggleHub = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const totalCost = rebalanceData?.total_transfer_cost ?? rebalanceData?.total_transfer_cost_usd ?? 0;
  const currency = rebalanceData?.currency || '\u20B9';

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-amber-400" />
            Multi-Warehouse Inventory and Optimization Hub
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Linear Programming (PuLP / SciPy) transportation model minimizing inter-warehouse transfer costs.
          </p>
        </div>
        <button
          onClick={handleRebalance}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Running PuLP LP Solver...' : 'Trigger PuLP LP Rebalance'}</span>
        </button>
        <button
          onClick={handleDispatchTransferTrips}
          disabled={dispatchLoading || loading}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-50">
          <Truck className={`w-4 h-4 ${dispatchLoading ? 'animate-spin' : ''}`} />
          <span>{dispatchLoading ? 'Scheduling trips...' : 'Create Transfer Trips'}</span>
        </button>
      </div>

      {error && (
        <div className="glass-panel p-4 rounded-2xl border border-red-500/40 flex items-center justify-between gap-3">
          <p className="text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </p>
          <button
            onClick={() => { loadAll(); handleRebalance(); }}
            className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold border border-red-500/30 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {notice && notice !== 'balanced' && (
        <div className="glass-panel p-3 rounded-2xl border border-emerald-500/30">
          <p className="text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hubs by name, city, state or ID..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-900/80 border border-gray-700 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500/60"
          />
        </div>
        <button
          onClick={() => setLowOnly(v => !v)}
          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${lowOnly ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-gray-900/60 text-gray-400 border-gray-700'}`}
        >
          <AlertTriangle className="w-3.5 h-3.5" /> Low stock only
        </button>
      </div>

      {invLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="glass-card p-5 rounded-2xl border border-gray-800 space-y-3 animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-2/3" />
              <div className="h-3 bg-gray-800 rounded w-1/3" />
              <div className="h-2 bg-gray-800 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filteredHubs.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-8">No hubs match the current filter.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHubs.slice(0, visibleCount).map((wh) => {
              const rows = stockByHub[wh.id] || [];
              const totalUnits = rows.reduce((a, r) => a + (r.quantity || 0), 0);
              const capacityUnits = Math.max((wh.capacity_sqft || wh.storage_capacity_sqft || 100000) * 0.02, 1);
              const isOpen = !!expanded[wh.id];
              const utilPct = Math.min(wh.current_utilization_pct, 100);
              return (
                <div key={wh.id} className="glass-card p-5 rounded-2xl border border-gray-800 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                        {wh.id.slice(0, 8)}...
                      </span>
                      <h3 className="text-base font-bold text-white mt-1 flex items-center gap-1.5 flex-wrap">
                        {wh.name}
                        {wh.is_depot && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                            <Star className="w-2.5 h-2.5" /> DISPATCH DEPOT
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-400">{wh.city}{wh.state ? `, ${wh.state}` : ''}</p>
                    </div>
                    {(wh.low_stock_count || 0) > 0 ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        {wh.low_stock_count} LOW STOCK
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
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
                        className={`h-full rounded-full transition-all ${wh.current_utilization_pct > 85 ? 'bg-red-500' : 'bg-emerald-400'}`}
                        style={{ width: `${utilPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {totalUnits.toLocaleString('en-IN')} units stored of ~{Math.round(capacityUnits).toLocaleString('en-IN')} capacity
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 pt-3 border-t border-gray-800/80">
                    <div>
                      <div>Total Floor Area</div>
                      <div className="font-semibold text-white">{(wh.capacity_sqft || wh.storage_capacity_sqft || 100000).toLocaleString('en-IN')} sqft</div>
                    </div>
                    <div>
                      <div>Active SKUs</div>
                      <div className="font-semibold text-white">{wh.total_skus} Products</div>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleHub(wh.id)}
                    className="w-full px-3 py-1.5 rounded-lg bg-gray-900/60 hover:bg-gray-800 text-gray-300 text-[11px] font-bold border border-gray-800 flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    {isOpen ? 'Hide stock' : `View stock (${rows.length} rows)`}
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {isOpen && (
                    <div className="rounded-xl border border-gray-800 overflow-hidden">
                      {rows.length === 0 ? (
                        <p className="text-[11px] text-gray-500 p-3 text-center">No stock rows at this hub yet.</p>
                      ) : (
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-[9px] uppercase text-gray-500 border-b border-gray-800 bg-gray-950/60">
                              <th className="text-left py-1.5 px-2">SKU</th>
                              <th className="text-right py-1.5 px-2">Qty</th>
                              <th className="text-left py-1.5 px-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(r => {
                              const low = (r.quantity || 0) <= (r.reorder_threshold || 0);
                              return (
                                <tr key={r.inventory_id} className="border-b border-gray-800/50">
                                  <td className="py-1.5 px-2">
                                    <p className="text-white font-semibold font-mono">{r.sku}</p>
                                    <p className="text-gray-500 truncate max-w-[160px]">{r.item_name}</p>
                                  </td>
                                  <td className="py-1.5 px-2 text-right text-white font-semibold">{r.quantity} <span className="text-gray-500 font-normal">{r.unit}</span></td>
                                  <td className="py-1.5 px-2">
                                    {low ? <span className="text-red-400 font-bold">LOW</span> : <span className="text-emerald-400 font-bold">OK</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {visibleCount < filteredHubs.length && (
            <div className="text-center">
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="px-4 py-2 rounded-xl bg-gray-900/70 hover:bg-gray-800 text-gray-300 text-xs font-bold border border-gray-700 transition-all"
              >
                Show more ({filteredHubs.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {rebalanceData && (
        <div className="glass-panel p-6 rounded-2xl space-y-4 border border-amber-500/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-amber-400" />
              PuLP LP Optimal Transfer Recommendations
            </h3>
            <span className="text-xs font-semibold text-amber-300">{currency}{Number(totalCost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} total</span>
          </div>
          <p className="text-[11px] text-gray-500 flex items-center gap-2 flex-wrap">
            <span>Engine: {rebalanceData.solver_engine || 'PuLP Linear Programming'}</span>
            {rebalanceData.status && <span className="text-gray-600">• Status: {rebalanceData.status}</span>}
          </p>
          {rebalanceData.status === 'FALLBACK_HEURISTIC' && (
            <p className="text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                PuLP CBC solver unavailable in this environment - showing heuristic transfers instead.
                {rebalanceData.solver_error ? ` (${rebalanceData.solver_error})` : ''}
              </span>
            </p>
          )}
          {(rebalanceData.recommendations || []).length === 0 ? (
            <p className="text-xs text-emerald-300 flex items-center gap-2 py-2">
              <CheckCircle2 className="w-4 h-4" /> All warehouses balanced - no transfers needed.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(rebalanceData.recommendations || []).map((rec, idx) => {
                const key = `${rec.from_warehouse_id}->${rec.to_warehouse_id}:${rec.sku}`;
                const cost = rec.estimated_cost ?? rec.estimated_cost_usd ?? 0;
                const cur = rec.currency || currency;
                const costLabel = `${cur}${Number(cost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
                return (
                  <div key={idx} className="glass-card p-4 rounded-xl space-y-2 border border-gray-800">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-sky-400 font-mono">{rec.sku}</span>
                      <span className="text-emerald-400 font-semibold">{costLabel}{typeof rec.distance_km === 'number' ? ` - ${rec.distance_km} km` : ''}</span>
                    </div>
                    <div className="text-xs text-gray-300">
                      Shift <span className="font-bold text-amber-400">{rec.quantity} units</span> from{' '}
                      <span className="text-white font-medium">{rec.from_warehouse_name || whName(rec.from_warehouse_id)}</span> to{' '}
                      <span className="text-white font-medium">{rec.to_warehouse_name || whName(rec.to_warehouse_id)}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 italic">{rec.rationale}</p>
                    <button
                      onClick={() => handleApply(rec)}
                      disabled={applying === key}
                      className="w-full px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[11px] font-bold border border-emerald-500/30 transition-all disabled:opacity-50"
                    >
                      {applying === key ? 'Applying...' : `Apply transfer (${rec.quantity} x ${rec.sku})`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {dispatchData && (
        <div className="glass-panel p-4 rounded-2xl border border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-sky-400 shrink-0" />
            <h4 className="text-xs font-bold text-white">Dispatched Transfer Trips</h4>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Status: <span className="text-emerald-400 font-semibold">{dispatchData.status}</span>{' '}
            {dispatchData.total_cost_usd != null && (
              <>· Total: {currency}{Number(dispatchData.total_cost_usd).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</>
            )}
          </p>
          {dispatchError && (
            <p className="text-xs text-red-300 mb-3">{dispatchError}</p>
          )}
          {(dispatchData.trips || []).length === 0 && dispatchNotice ? (
            <p className="text-xs text-emerald-300">
              <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" /> {dispatchNotice}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(dispatchData.trips || []).map((trip: TransferTrip, idx: number) => {
                const t = trip.trip;
                const rec = trip.recommendation;
                return (
                  <div key={idx} className="glass-card p-3 rounded-xl space-y-1.5 border border-gray-800">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-sky-400 font-mono">TRIP {idx + 1}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">{t.vehicle_name}</span>
                    </div>
                    <div className="text-xs text-gray-300 leading-snug">
                      {t.source_warehouse_name || t.start_location?.label} → {t.destination_warehouse_name || t.end_location?.label}<br />
                      <span className="text-amber-400 font-medium">{t.quantity} units × {t.sku}</span> · {t.total_distance_km?.toFixed(1)} km · est. {t.cost_usd != null ? currency + Number(t.cost_usd).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'}
                    </div>
                    <p className="text-[10px] text-gray-500 italic">{rec.rationale}</p>
                  </div>
                );
              })}
            </div>
          )}
          {dispatchNotice && (dispatchData.trips || []).length > 0 && (
            <p className="text-xs text-emerald-300 mt-3">
              <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" /> {dispatchNotice}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
