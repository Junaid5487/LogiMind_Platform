import React, { useEffect, useMemo, useState } from 'react';
import type { WarehouseItem, InventoryItem, SkuAvailability, DemandForecastResult } from '../types';
import { fetchInventory, fetchSkuAvailability, addInventoryItem, updateInventoryItem, removeInventoryItem, shiftInventory, addWarehouse, removeWarehouse, fetchDemandForecast } from '../services/api';
import { Boxes, Plus, Trash2, ArrowRightLeft, AlertTriangle, PackageCheck, Warehouse, PackagePlus, Search, Pencil, ChevronDown, ChevronLeft, ChevronRight, TrendingUp, BarChart2, Calendar, X, AlertCircle, CheckCircle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';


interface WarehouseManagerPortalProps {
  warehouses: WarehouseItem[];
  onReload: () => Promise<void>;
}

const EMPTY_ITEM_FORM = {
  warehouse_id: 'w1111111-1111-1111-1111-111111111111',
  sku: '',
  item_name: '',
  quantity: '',
  reorder_threshold: '10',
  unit: 'units',
};

const EMPTY_SHIFT_FORM = {
  sku: '',
  from_warehouse_id: 'w1111111-1111-1111-1111-111111111111',
  to_warehouse_id: 'w2222222-2222-2222-2222-222222222222',
  quantity: '',
};

const PAGE_SIZE = 10;

export const WarehouseManagerPortal: React.FC<WarehouseManagerPortalProps> = ({ warehouses, onReload }) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [skus, setSkus] = useState<SkuAvailability[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [itemForm, setItemForm] = useState({ ...EMPTY_ITEM_FORM });
  const [shiftForm, setShiftForm] = useState({ ...EMPTY_SHIFT_FORM });
  const [showItemForm, setShowItemForm] = useState<boolean>(false);
  const [showShiftForm, setShowShiftForm] = useState<boolean>(false);
  const [hubForm, setHubForm] = useState({ name: '', city: '', state: '', address: '', capacity_sqft: '50000', location_lat: '19.0760', location_lng: '72.8777' });
  const [showHubForm, setShowHubForm] = useState<boolean>(false);
  const [hubBusy, setHubBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tableSearch, setTableSearch] = useState('');
  const [hubFilter, setHubFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortKey, setSortKey] = useState<'sku' | 'qty' | 'hub'>('sku');
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editThreshold, setEditThreshold] = useState('');

  const [selectedForecastItem, setSelectedForecastItem] = useState<InventoryItem | null>(null);
  const [forecastHorizon, setForecastHorizon] = useState<number>(7);
  const [forecastData, setForecastData] = useState<DemandForecastResult | null>(null);
  const [forecastLoading, setForecastLoading] = useState<boolean>(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  const handleOpenForecast = async (item: InventoryItem, horizon: number = 7) => {
    setSelectedForecastItem(item);
    setForecastHorizon(horizon);
    setForecastLoading(true);
    setForecastError(null);
    try {
      const data = await fetchDemandForecast(item.warehouse_id, item.sku, horizon);
      setForecastData(data);
    } catch (e: any) {
      setForecastError(e.message || 'Failed to fetch demand forecast');
    } finally {
      setForecastLoading(false);
    }
  };

  const handleHorizonChange = async (horizon: number) => {
    if (!selectedForecastItem) return;
    setForecastHorizon(horizon);
    setForecastLoading(true);
    setForecastError(null);
    try {
      const data = await fetchDemandForecast(selectedForecastItem.warehouse_id, selectedForecastItem.sku, horizon);
      setForecastData(data);
    } catch (e: any) {
      setForecastError(e.message || 'Failed to fetch demand forecast');
    } finally {
      setForecastLoading(false);
    }
  };


  useEffect(() => { loadInventory(); }, []);
  useEffect(() => { // re-sync warehouse dropdown defaults when hubs change (#19)
    setItemForm(prev => ({ ...prev, warehouse_id: warehouses[0]?.id ?? prev.warehouse_id }));
    setShiftForm(prev => ({
      ...prev,
      from_warehouse_id: warehouses[0]?.id ?? prev.from_warehouse_id,
      to_warehouse_id: warehouses[1]?.id ?? warehouses[0]?.id ?? prev.to_warehouse_id,
    }));
  }, [warehouses]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const [inv, skuList] = await Promise.all([fetchInventory(), fetchSkuAvailability()]);
      setInventory(inv);
      setSkus(skuList);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load inventory' });
    } finally {
      setLoading(false);
    }
  };

  const notify = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 4000);
  };

  const whName = (id: string) => warehouses.find(w => w.id === id)?.name || id;

  const handleAddHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hubForm.name.trim()) { notify('error', 'Hub name is required'); return; }
    if (!hubForm.city.trim()) { notify('error', 'City is required'); return; }
    const location_lat = Number(hubForm.location_lat);
    const location_lng = Number(hubForm.location_lng);
    const capacity_sqft = Number(hubForm.capacity_sqft);
    if (!Number.isFinite(location_lat) || location_lat < -90 || location_lat > 90) { notify('error', 'Latitude must be between -90 and 90'); return; }
    if (!Number.isFinite(location_lng) || location_lng < -180 || location_lng > 180) { notify('error', 'Longitude must be between -180 and 180'); return; }
    if (!Number.isFinite(capacity_sqft) || capacity_sqft <= 0) { notify('error', 'Capacity must be greater than 0 sqft'); return; }
    setHubBusy(true);
    try {
      const w = await addWarehouse({
        name: hubForm.name.trim(),
        city: hubForm.city.trim(),
        state: hubForm.state.trim() || undefined,
        address: hubForm.address.trim() || undefined,
        location_lat, location_lng, capacity_sqft,
      });
      setHubForm({ name: '', city: '', state: '', address: '', capacity_sqft: '50000', location_lat: '19.0760', location_lng: '72.8777' });
      setShowHubForm(false);
      notify('success', `Hub ${w.name} added`);
      await onReload();
    } catch (err: any) {
      notify('error', err.message || 'Failed to add hub');
    } finally {
      setHubBusy(false);
    }
  };

  const handleRemoveHub = async (warehouseId: string) => {
    const hub = warehouses.find(w => w.id === warehouseId);
    const held = inventory.filter(i => i.warehouse_id === warehouseId).length;
    if (held > 0) {
      notify('error', `Cannot delete ${hub?.name || warehouseId}: it still holds ${held} stock row(s). Move or delete them first.`);
      return;
    }
    if (!window.confirm(`Delete hub ${hub?.name || warehouseId}? This cannot be undone.`)) return;
    setHubBusy(true);
    try {
      await removeWarehouse(warehouseId);
      notify('success', 'Hub deleted');
      await onReload();
    } catch (err: any) {
      notify('error', err.message || 'Failed to delete hub');
    } finally {
      setHubBusy(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.sku.trim() || !itemForm.item_name.trim()) { notify('error', 'SKU and item name are required'); return; }
    const quantity = Number(itemForm.quantity);
    const reorder_threshold = Number(itemForm.reorder_threshold);
    if (!Number.isFinite(quantity) || quantity < 0) { notify('error', 'Quantity must be >= 0'); return; }
    if (!Number.isFinite(reorder_threshold) || reorder_threshold < 0) { notify('error', 'Reorder threshold must be >= 0'); return; }
    try {
      const res = await addInventoryItem({
        warehouse_id: itemForm.warehouse_id,
        sku: itemForm.sku.trim(),
        item_name: itemForm.item_name.trim(),
        quantity,
        reorder_threshold,
        unit: itemForm.unit.trim() || 'units',
      });
      notify('success', res.status === 'MERGED' ? `Stock merged into ${res.item.sku}` : `Item ${res.item.sku} added`);
      setItemForm({ ...EMPTY_ITEM_FORM, warehouse_id: warehouses[0]?.id ?? itemForm.warehouse_id });
      setShowItemForm(false);
      await loadInventory();
      await onReload();
    } catch (err: any) {
      notify('error', err.message || 'Failed to add item');
    }
  };

  const startEdit = (item: InventoryItem) => {
    setEditing(item.inventory_id);
    setEditQty(String(item.quantity));
    setEditThreshold(String(item.reorder_threshold));
  };

  const handleSaveEdit = async (item: InventoryItem) => {
    const quantity = Number(editQty);
    const reorder_threshold = Number(editThreshold);
    if (!Number.isFinite(quantity) || quantity < 0) { notify('error', 'Quantity must be >= 0'); return; }
    if (!Number.isFinite(reorder_threshold) || reorder_threshold < 0) { notify('error', 'Reorder threshold must be >= 0'); return; }
    try {
      await updateInventoryItem(item.inventory_id, { quantity, reorder_threshold });
      setEditing(null);
      notify('success', `${item.sku} updated`);
      await loadInventory();
      await onReload();
    } catch (err: any) {
      notify('error', err.message || 'Failed to update item');
    }
  };

  const handleRemoveItem = async (item: InventoryItem) => {
    if (!window.confirm(`Remove ${item.item_name} (${item.sku}) from ${whName(item.warehouse_id)}?`)) return;
    try {
      await removeInventoryItem(item.inventory_id);
      setInventory(prev => prev.filter(i => i.inventory_id !== item.inventory_id));
      notify('success', `${item.sku} removed from ${whName(item.warehouse_id)}`);
      await loadInventory();
      await onReload();
    } catch (err: any) {
      notify('error', err.message || 'Failed to remove item');
    }
  };

  const handleShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftForm.sku) { notify('error', 'Select an SKU to transfer'); return; }
    if (shiftForm.from_warehouse_id === shiftForm.to_warehouse_id) {
      notify('error', 'Source and destination warehouses must differ');
      return;
    }
    const quantity = Number(shiftForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) { notify('error', 'Quantity must be greater than 0'); return; }
    const srcAvail = skus.find(s => s.sku === shiftForm.sku)?.warehouses.find(w => w.warehouse_id === shiftForm.from_warehouse_id)?.quantity ?? 0;
    if (quantity > srcAvail) { notify('error', `Only ${srcAvail} available at source`); return; }
    if (!window.confirm(`Transfer ${quantity} x ${shiftForm.sku} from ${whName(shiftForm.from_warehouse_id)} to ${whName(shiftForm.to_warehouse_id)}?`)) return;
    try {
      const res = await shiftInventory({
        from_warehouse_id: shiftForm.from_warehouse_id,
        to_warehouse_id: shiftForm.to_warehouse_id,
        sku: shiftForm.sku,
        quantity,
      });
      setShiftForm({ ...EMPTY_SHIFT_FORM });
      setShowShiftForm(false);
      notify('success', `Transferred ${res.quantity} x ${res.sku} to ${res.to_warehouse}`);
      await loadInventory();
      await onReload();
    } catch (err: any) {
      notify('error', err.message || 'Failed to shift inventory');
    }
  };

  const filteredSorted = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    const rows = inventory.filter(item => {
      if (hubFilter !== 'ALL' && item.warehouse_id !== hubFilter) return false;
      if (statusFilter === 'LOW' && !((item.quantity || 0) <= (item.reorder_threshold || 0))) return false;
      if (statusFilter === 'OK' && !((item.quantity || 0) > (item.reorder_threshold || 0))) return false;
      if (!q) return true;
      return [item.sku, item.item_name, whName(item.warehouse_id)].some(f => (f || '').toLowerCase().includes(q));
    });
    const dir = sortDir;
    rows.sort((a, b) => {

      if (sortKey === 'qty') return ((a.quantity || 0) - (b.quantity || 0)) * dir;
      if (sortKey === 'hub') return whName(a.warehouse_id).localeCompare(whName(b.warehouse_id)) * dir;
      return a.sku.localeCompare(b.sku) * dir;
    });
    return rows;
  }, [inventory, tableSearch, hubFilter, statusFilter, sortKey, sortDir, warehouses]);

  const pageCount = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filteredSorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: 'sku' | 'qty' | 'hub') => {
    if (sortKey === key) {
      setSortDir(d => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const sourceSkus = useMemo(() => {
    const out: SkuAvailability[] = [];
    for (const s of skus) {
      const atSource = s.warehouses.find(w => w.warehouse_id === shiftForm.from_warehouse_id);
      if (atSource && (atSource.quantity || 0) > 0) out.push(s);
    }
    return out;
  }, [skus, shiftForm.from_warehouse_id]);

  const selectedSrcQty = sourceSkus.find(s => s.sku === shiftForm.sku)?.warehouses.find(w => w.warehouse_id === shiftForm.from_warehouse_id)?.quantity ?? 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-panel p-4 rounded-2xl border border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Warehouse className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Warehouse Manager Portal</h1>
            <p className="text-[11px] text-gray-400">Hubs, stock ledger, and inter-hub transfers ({warehouses.length} hubs, {inventory.length} rows)</p>
          </div>
        </div>
        <button
          onClick={loadInventory}
          className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold border border-gray-700 transition-all"
        >
          Refresh stock
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-xs font-semibold border ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'}`}>
          {message.text}
        </div>
      )}

      <section className="glass-panel p-4 rounded-2xl border border-gray-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-amber-400" /> Storage Hubs <span className="text-[10px] font-normal text-gray-400">({warehouses.length})</span>
          </h2>
          <button
            onClick={() => setShowHubForm(s => !s)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/30 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> {showHubForm ? 'Close' : 'Add Hub'}
          </button>
        </div>

        {showHubForm && (
          <form onSubmit={handleAddHub} className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-gray-900/40 border border-gray-800 rounded-xl p-3">
            <input value={hubForm.name} onChange={(e) => setHubForm({ ...hubForm, name: e.target.value })} placeholder="Hub name *" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500" />
            <input value={hubForm.city} onChange={(e) => setHubForm({ ...hubForm, city: e.target.value })} placeholder="City *" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500" />
            <input value={hubForm.state} onChange={(e) => setHubForm({ ...hubForm, state: e.target.value })} placeholder="State (e.g. MH)" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500" />
            <input value={hubForm.address} onChange={(e) => setHubForm({ ...hubForm, address: e.target.value })} placeholder="Address" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500" />
            <input value={hubForm.location_lat} onChange={(e) => setHubForm({ ...hubForm, location_lat: e.target.value })} placeholder="Latitude" inputMode="decimal" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500" />
            <input value={hubForm.location_lng} onChange={(e) => setHubForm({ ...hubForm, location_lng: e.target.value })} placeholder="Longitude" inputMode="decimal" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500" />
            <input value={hubForm.capacity_sqft} onChange={(e) => setHubForm({ ...hubForm, capacity_sqft: e.target.value })} placeholder="Capacity sqft" inputMode="numeric" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500" />
            <button type="submit" disabled={hubBusy} className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all disabled:opacity-50">
              {hubBusy ? 'Saving...' : 'Save Hub'}
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {warehouses.map(w => {
            const held = inventory.filter(i => i.warehouse_id === w.id).length;
            return (
              <div key={w.id} className="flex items-center justify-between gap-2 bg-gray-900/40 border border-gray-800 rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{w.name} {w.is_depot && <span className="text-[9px] text-amber-300 font-extrabold">DEPOT</span>}</p>
                  <p className="text-[10px] text-gray-500">{w.city}{w.state ? `, ${w.state}` : ''} - {w.current_utilization_pct}% fill - {held} SKU rows</p>
                </div>
                <button
                  onClick={() => handleRemoveHub(w.id)}
                  disabled={hubBusy}
                  title={held > 0 ? `Holds ${held} stock row(s) - move or delete them first` : `Delete ${w.name}`}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all disabled:opacity-40 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass-panel p-4 rounded-2xl border border-gray-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Boxes className="w-4 h-4 text-sky-400" /> Inventory Ledger <span className="text-[10px] font-normal text-gray-400">({filteredSorted.length} rows)</span>
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowShiftForm(s => !s)} className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5" /> {showShiftForm ? 'Close' : 'Transfer'}
            </button>
            <button onClick={() => setShowItemForm(s => !s)} className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-500/30 flex items-center gap-1.5">
              <PackagePlus className="w-3.5 h-3.5" /> {showItemForm ? 'Close' : 'Add Stock'}
            </button>
          </div>
        </div>
        {showItemForm && (
          <form onSubmit={handleAddItem} className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-gray-900/40 border border-gray-800 rounded-xl p-3">
            <select value={itemForm.warehouse_id} onChange={(e) => setItemForm({ ...itemForm, warehouse_id: e.target.value })} className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white">
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <input value={itemForm.sku} onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })} placeholder="SKU *" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500" />
            <input value={itemForm.item_name} onChange={(e) => setItemForm({ ...itemForm, item_name: e.target.value })} placeholder="Item name *" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500" />
            <input value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} placeholder="Quantity" inputMode="numeric" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500" />
            <input value={itemForm.reorder_threshold} onChange={(e) => setItemForm({ ...itemForm, reorder_threshold: e.target.value })} placeholder="Reorder at" inputMode="numeric" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500" />
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-bold">Save Item</button>
          </form>
        )}
        {showShiftForm && (
          <form onSubmit={handleShift} className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-gray-900/40 border border-gray-800 rounded-xl p-3">
            <select value={shiftForm.from_warehouse_id} onChange={(e) => setShiftForm({ ...shiftForm, from_warehouse_id: e.target.value, sku: '' })} className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white">
              {warehouses.map(w => <option key={w.id} value={w.id}>From: {w.name}</option>)}
            </select>
            <select value={shiftForm.to_warehouse_id} onChange={(e) => setShiftForm({ ...shiftForm, to_warehouse_id: e.target.value })} className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white">

              {warehouses.map(w => <option key={w.id} value={w.id}>To: {w.name}</option>)}
            </select>
            <select value={shiftForm.sku} onChange={(e) => setShiftForm({ ...shiftForm, sku: e.target.value })} className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white">
              <option value="">Select SKU {sourceSkus.length > 0 ? `(${sourceSkus.length} at source)` : '(none at source)'}</option>
              {sourceSkus.map(s => {
                const q = s.warehouses.find(w => w.warehouse_id === shiftForm.from_warehouse_id)?.quantity ?? 0;
                return <option key={s.sku} value={s.sku}>{s.sku} - {q} available</option>;
              })}
            </select>
            <input value={shiftForm.quantity} onChange={(e) => setShiftForm({ ...shiftForm, quantity: e.target.value })} placeholder={selectedSrcQty > 0 ? `Qty (max ${selectedSrcQty})` : 'Qty'} inputMode="numeric" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500" />
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold col-span-2 md:col-span-2">Confirm Transfer</button>
          </form>
        )}

        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={tableSearch} onChange={(e) => { setTableSearch(e.target.value); setPage(0); }} placeholder="Search SKU, item name or hub..." className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-gray-900/80 border border-gray-700 text-xs text-white placeholder-gray-500 outline-none" />
          </div>
          <select value={hubFilter} onChange={(e) => { setHubFilter(e.target.value); setPage(0); }} className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white">
            <option value="ALL">All hubs</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white">
            <option value="ALL">All statuses</option>
            <option value="LOW">Low stock</option>
            <option value="OK">In stock</option>
          </select>
        </div>
        {loading ? (
          <p className="text-xs text-gray-400 py-6 text-center">Loading inventory...</p>
        ) : filteredSorted.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">No inventory rows match the current filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-gray-500 border-b border-gray-800">
                  <th className="py-2 pr-3"><button onClick={() => toggleSort('sku')}>Item</button></th>
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3"><button onClick={() => toggleSort('hub')}>Warehouse</button></th>
                  <th className="py-2 pr-3 text-right"><button onClick={() => toggleSort('qty')} className="ml-auto">Qty</button></th>
                  <th className="py-2 pr-3 text-right">Reorder At</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(item => {
                  const isLow = (item.quantity || 0) <= (item.reorder_threshold || 0);
                  const isEditing = editing === item.inventory_id;
                  return (
                    <tr key={item.inventory_id} className="border-b border-gray-800/60 hover:bg-gray-900/40">
                      <td className="py-2.5 pr-3 text-white font-medium">{item.item_name}</td>
                      <td className="py-2.5 pr-3"><span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono text-[10px]">{item.sku}</span></td>
                      <td className="py-2.5 pr-3 text-gray-300">{whName(item.warehouse_id)}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold text-white">
                        {isEditing ? (
                          <input value={editQty} onChange={(e) => setEditQty(e.target.value)} inputMode="numeric" className="w-20 bg-gray-900 border border-sky-500/50 rounded px-2 py-1 text-xs text-white text-right" />
                        ) : (<>{item.quantity} <span className="text-gray-500 font-normal">{item.unit}</span></>)}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-gray-400">
                        {isEditing ? (
                          <input value={editThreshold} onChange={(e) => setEditThreshold(e.target.value)} inputMode="numeric" className="w-16 bg-gray-900 border border-sky-500/50 rounded px-2 py-1 text-xs text-white text-right" />
                        ) : (item.reorder_threshold)}
                      </td>
                      <td className="py-2.5 pr-3">
                        {isLow ? (
                          <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold">LOW STOCK</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">IN STOCK</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <button onClick={() => handleSaveEdit(item)} className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">Save</button>
                              <button onClick={() => setEditing(null)} className="px-2 py-1 rounded-lg bg-gray-800 text-gray-300 text-[10px] font-bold border border-gray-700">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleOpenForecast(item, 7)}
                                className="p-1.5 rounded-lg hover:bg-amber-500/20 text-gray-400 hover:text-amber-400 transition-colors"
                                title={`Forecast demand for ${item.sku}`}
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg hover:bg-sky-500/20 text-gray-400 hover:text-sky-300" title={`Edit ${item.sku}`}><Pencil className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                          <button onClick={() => handleRemoveItem(item)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400" title={`Remove ${item.sku}`}><Trash2 className="w-3.5 h-3.5" /></button>

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {/* AI Stock Demand Forecast Modal */}
      {selectedForecastItem && (
        <div className="fixed inset-0 z-[2000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-amber-500/30 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedForecastItem(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Stock Demand Forecast</h3>
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/30 text-sky-300 font-mono text-[10px] font-bold">
                    {selectedForecastItem.sku}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {selectedForecastItem.item_name} · {whName(selectedForecastItem.warehouse_id)}
                </p>
              </div>
            </div>

            {/* Horizon Selector */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <span className="text-xs text-gray-400 font-medium">Forecast Horizon:</span>
              <div className="flex items-center gap-1.5">
                {[7, 14, 30].map(h => (
                  <button
                    key={h}
                    onClick={() => handleHorizonChange(h)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      forecastHorizon === h
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {h} Days
                  </button>
                ))}
              </div>
            </div>

            {forecastLoading ? (
              <div className="py-16 text-center text-xs text-amber-400 flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span>Generating Prophet + LightGBM demand projection...</span>
              </div>
            ) : forecastError ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                {forecastError}
              </div>
            ) : forecastData ? (
              <div className="space-y-4">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl bg-gray-950/60 border border-gray-800">
                    <span className="text-[10px] text-gray-400 font-semibold block">On-Hand Stock</span>
                    <span className="text-base font-extrabold text-white mt-0.5 block">
                      {selectedForecastItem.quantity} <span className="text-xs font-normal text-gray-400">{selectedForecastItem.unit}</span>
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-950/60 border border-gray-800">
                    <span className="text-[10px] text-gray-400 font-semibold block">Projected Volume</span>
                    <span className="text-base font-extrabold text-amber-400 mt-0.5 block">
                      {forecastData.total_predicted_volume} <span className="text-xs font-normal text-gray-400">units</span>
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-950/60 border border-gray-800">
                    <span className="text-[10px] text-gray-400 font-semibold block">Daily Burn Rate</span>
                    <span className="text-base font-extrabold text-sky-400 mt-0.5 block">
                      ~{forecastData.average_daily_volume} <span className="text-xs font-normal text-gray-400">/day</span>
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-950/60 border border-gray-800">
                    <span className="text-[10px] text-gray-400 font-semibold block">Buffer Safety Stock</span>
                    <span className="text-base font-extrabold text-purple-400 mt-0.5 block">
                      {forecastData.recommended_safety_stock} <span className="text-xs font-normal text-gray-400">units</span>
                    </span>
                  </div>
                </div>

                {/* Stockout Risk Bar */}
                <div className="p-3 rounded-xl bg-gray-950/60 border border-gray-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {selectedForecastItem.quantity < forecastData.total_predicted_volume ? (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span className="text-gray-300">
                      Estimated runway: <b className="text-white">
                        {(selectedForecastItem.quantity / Math.max(1, forecastData.average_daily_volume)).toFixed(1)} days
                      </b> before depletion.
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    selectedForecastItem.quantity < forecastData.total_predicted_volume
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}>
                    {selectedForecastItem.quantity < forecastData.total_predicted_volume ? 'REORDER URGENT' : 'STOCK HEALTHY'}
                  </span>
                </div>

                {/* Recharts Area Chart */}
                <div className="h-56 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecastData.daily_forecast} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="day" stroke="#6b7280" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.75rem', fontSize: '11px' }}
                        labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="upper_bound" stroke="#d97706" strokeDasharray="4 4" fill="none" name="95% Upper Bound" />
                      <Area type="monotone" dataKey="predicted_demand" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#predGrad)" name="Predicted Daily Demand" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <p className="text-[11px] text-gray-400 italic bg-gray-950/40 p-2.5 rounded-xl border border-gray-800">
                  {forecastData.summary_text}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <footer className="text-center text-[10px] text-gray-500 uppercase tracking-widest pt-2">
        LogiMind AI - Warehouse Manager Portal
      </footer>
    </div>
  );
};

