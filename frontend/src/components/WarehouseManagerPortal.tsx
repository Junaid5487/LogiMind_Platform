import React, { useEffect, useState } from 'react';
import type { WarehouseItem, InventoryItem } from '../types';
import { fetchInventory, addInventoryItem, removeInventoryItem, shiftInventory, addWarehouse, removeWarehouse } from '../services/api';
import { Boxes, Plus, Trash2, ArrowRightLeft, AlertTriangle, PackageCheck, Warehouse, PackagePlus } from 'lucide-react';

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

export const WarehouseManagerPortal: React.FC<WarehouseManagerPortalProps> = ({ warehouses, onReload }) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [itemForm, setItemForm] = useState({ ...EMPTY_ITEM_FORM });
  const [shiftForm, setShiftForm] = useState({ ...EMPTY_SHIFT_FORM });
  const [showItemForm, setShowItemForm] = useState<boolean>(false);
  const [showShiftForm, setShowShiftForm] = useState<boolean>(false);
  const [hubForm, setHubForm] = useState({ name: '', city: '', capacity_sqft: '50000', location_lat: '19.0760', location_lng: '72.8777' });
  const [showHubForm, setShowHubForm] = useState<boolean>(false);
  const [hubBusy, setHubBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { loadInventory(); }, []);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const data = await fetchInventory();
      setInventory(data);
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
      const w = await addWarehouse({ name: hubForm.name.trim(), city: hubForm.city.trim(), location_lat, location_lng, capacity_sqft });
      setHubForm({ name: '', city: '', capacity_sqft: '50000', location_lat: '19.0760', location_lng: '72.8777' });
      setShowHubForm(false);
      notify('success', `Hub ${w.name} added`);
      await onReload();
    } catch (err: any) {
      notify('error', err.message || 'Failed to add hub');
    } finally {
      setHubBusy(false);
    }
  };

  const handleRemoveHub = async (w: WarehouseItem) => {
    if (!window.confirm(`Remove hub ${w.name}? Its scenario orders and inventory stay orphaned.`)) return;
    setHubBusy(true);
    try {
      await removeWarehouse(w.id);
      notify('success', `${w.name} removed`);
      await onReload();
    } catch (err: any) {
      notify('error', err.message || 'Failed to remove hub');
    } finally {
      setHubBusy(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.sku.trim() || !itemForm.item_name.trim()) {
      notify('error', 'SKU and item name are required');
      return;
    }
    const qty = Number(itemForm.quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      notify('error', 'Quantity must be a number >= 0');
      return;
    }
    try {
      const res = await addInventoryItem({
        warehouse_id: itemForm.warehouse_id,
        sku: itemForm.sku.trim(),
        item_name: itemForm.item_name.trim(),
        quantity: qty,
        reorder_threshold: Number(itemForm.reorder_threshold) || 0,
        unit: itemForm.unit.trim() || 'units',
      });
      await loadInventory();
      setItemForm({ ...EMPTY_ITEM_FORM });
      setShowItemForm(false);
      notify('success', res.status === 'MERGED'
        ? `Merged ${qty} x ${res.item.sku} into stock at ${whName(res.item.warehouse_id)}`
        : `Added ${res.item.sku} (${res.item.inventory_id})`);
    } catch (err: any) {
      notify('error', err.message || 'Failed to add item');
    }
  };

  const handleRemoveItem = async (item: InventoryItem) => {
    if (!window.confirm(`Remove ${item.item_name} (${item.sku}) from ${whName(item.warehouse_id)}?`)) return;
    try {
      await removeInventoryItem(item.inventory_id);
      setInventory(prev => prev.filter(i => i.inventory_id !== item.inventory_id));
      notify('success', `${item.sku} removed from ${whName(item.warehouse_id)}`);
    } catch (err: any) {
      notify('error', err.message || 'Failed to remove item');
    }
  };

  const handleShiftItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(shiftForm.quantity);
    if (!shiftForm.sku) {
      notify('error', 'Select a SKU to shift');
      return;
    }
    if (shiftForm.from_warehouse_id === shiftForm.to_warehouse_id) {
      notify('error', 'Source and destination warehouses must differ');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      notify('error', 'Shift quantity must be > 0');
      return;
    }
    try {
      const res = await shiftInventory({
        from_warehouse_id: shiftForm.from_warehouse_id,
        to_warehouse_id: shiftForm.to_warehouse_id,
        sku: shiftForm.sku,
        quantity: qty,
      });
      await loadInventory();
      setShiftForm({ ...EMPTY_SHIFT_FORM });
      setShowShiftForm(false);
      notify('success', `Shifted ${res.quantity} x ${res.sku}: ${res.from_warehouse} -> ${res.to_warehouse}`);
    } catch (err: any) {
      notify('error', err.message || 'Failed to shift inventory');
    }
  };

  const lowStockCount = inventory.filter(i => i.quantity <= i.reorder_threshold).length;

  return (
    <div className="py-6 px-4 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Boxes className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Warehouse Inventory Control</h1>
            <p className="text-xs text-gray-400">Track stock, manage SKUs and shift inventory across facilities</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
            {inventory.length} SKUs
          </span>
          {lowStockCount > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {lowStockCount} Low Stock
            </span>
          )}
        </div>
      </header>

      {message && (
        <div className={`px-4 py-2.5 rounded-xl text-xs font-semibold border ${message.type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {warehouses.map(wh => {
          const items = inventory.filter(i => i.warehouse_id === wh.id);
          const units = items.reduce((sum, i) => sum + i.quantity, 0);
          const lows = items.filter(i => i.quantity <= i.reorder_threshold).length;
          return (
            <div key={wh.id} className="glass-card p-4 rounded-2xl border border-gray-800 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">{wh.name}</h3>
                    <p className="text-[10px] text-gray-500">{wh.city}, {wh.state}</p>
                  </div>
                </div>
                {lows > 0 ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                    <AlertTriangle className="w-3 h-3" /> {lows} LOW
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <PackageCheck className="w-3 h-3" /> OK
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-900/60 rounded-lg py-2">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">SKUs</div>
                  <div className="text-sm font-bold text-white">{items.length}</div>
                </div>
                <div className="bg-gray-900/60 rounded-lg py-2">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">Units</div>
                  <div className="text-sm font-bold text-white">{units.toLocaleString()}</div>
                </div>
                <div className="bg-gray-900/60 rounded-lg py-2">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">Fill</div>
                  <div className="text-sm font-bold text-white">{wh.current_utilization_pct}%</div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="glass-panel p-4 rounded-2xl border border-gray-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <PackagePlus className="w-4 h-4 text-sky-400" /> Stock Actions
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowItemForm(v => !v); setShowShiftForm(false); }}
              className="px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
            <button
              onClick={() => { setShowShiftForm(v => !v); setShowItemForm(false); }}
              className="px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" /> Shift Stock
            </button>
          </div>
        </div>

        {showItemForm && (
          <form onSubmit={handleAddItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-gray-900/50 p-3 rounded-xl border border-gray-800">
            <label className="space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-semibold">Warehouse</span>
              <select
                value={itemForm.warehouse_id}
                onChange={e => setItemForm(f => ({ ...f, warehouse_id: e.target.value }))}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-semibold">SKU</span>
              <input
                value={itemForm.sku}
                onChange={e => setItemForm(f => ({ ...f, sku: e.target.value }))}
                placeholder="SKU-ELEC-101"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-semibold">Item Name</span>
              <input
                value={itemForm.item_name}
                onChange={e => setItemForm(f => ({ ...f, item_name: e.target.value }))}
                placeholder="Electronic Components Kit"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-semibold">Qty</span>
              <input
                type="number"
                min={0}
                value={itemForm.quantity}
                onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="50"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-semibold">Reorder At</span>
              <input
                type="number"
                min={0}
                value={itemForm.reorder_threshold}
                onChange={e => setItemForm(f => ({ ...f, reorder_threshold: e.target.value }))}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </label>
            <button
              type="submit"
              className="self-end px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add to Stock
            </button>
          </form>
        )}

        {showShiftForm && (
          <form onSubmit={handleShiftItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-gray-900/50 p-3 rounded-xl border border-purple-500/20">
            <label className="space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-semibold">SKU</span>
              <select
                value={shiftForm.sku}
                onChange={e => setShiftForm(f => ({ ...f, sku: e.target.value }))}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">-- select SKU --</option>
                {Array.from(new Set(inventory.map(i => i.sku))).map(sku => (
                  <option key={sku} value={sku}>{sku}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-semibold">From</span>
              <select
                value={shiftForm.from_warehouse_id}
                onChange={e => setShiftForm(f => ({ ...f, from_warehouse_id: e.target.value }))}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-semibold">To</span>
              <select
                value={shiftForm.to_warehouse_id}
                onChange={e => setShiftForm(f => ({ ...f, to_warehouse_id: e.target.value }))}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-semibold">Qty to Move</span>
              <input
                type="number"
                min={1}
                value={shiftForm.quantity}
                onChange={e => setShiftForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="25"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </label>
            <button
              type="submit"
              className="self-end px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" /> Execute Shift
            </button>
            {shiftForm.sku && (
              <p className="lg:col-span-5 text-[11px] text-gray-400">
                Stock at source ({whName(shiftForm.from_warehouse_id)}):{' '}
                <span className="font-semibold text-white">
                  {inventory
                    .find(i => i.warehouse_id === shiftForm.from_warehouse_id && i.sku === shiftForm.sku)
                    ?.quantity ?? 0} units
                </span>
              </p>
            )}
          </form>
        )}

      </section>


      {/* ── Warehouse hubs: add/remove ───────────────────────────── */}
      <section className="glass-panel p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-purple-400" /> Warehouse Hubs ({warehouses.length})
          </h3>
          <button onClick={() => setShowHubForm(!showHubForm)}
            className="px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold transition-all flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Hub
          </button>
        </div>
        {showHubForm && (
          <form onSubmit={handleAddHub} className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-gray-900/50 border border-gray-800">
            <input value={hubForm.name} onChange={(e) => setHubForm({ ...hubForm, name: e.target.value })}
              placeholder="Hub name *" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
            <input value={hubForm.city} onChange={(e) => setHubForm({ ...hubForm, city: e.target.value })}
              placeholder="City *" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
            <input value={hubForm.capacity_sqft} onChange={(e) => setHubForm({ ...hubForm, capacity_sqft: e.target.value })}
              placeholder="Capacity sqft" inputMode="decimal" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
            <input value={hubForm.location_lat} onChange={(e) => setHubForm({ ...hubForm, location_lat: e.target.value })}
              placeholder="Lat (-90..90)" inputMode="decimal" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
            <input value={hubForm.location_lng} onChange={(e) => setHubForm({ ...hubForm, location_lng: e.target.value })}
              placeholder="Lng (-180..180)" inputMode="decimal" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
            <div className="flex gap-2">
              <button type="submit" disabled={hubBusy}
                className="flex-1 px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold transition-all disabled:opacity-50">
                {hubBusy ? 'Adding...' : 'Save'}
              </button>
              <button type="button" onClick={() => setShowHubForm(false)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-all">
                Cancel
              </button>
            </div>
          </form>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-gray-500 border-b border-gray-800">
                <th className="py-2 pr-3">Hub</th>
                <th className="py-2 pr-3">City</th>
                <th className="py-2 pr-3 text-right">Utilization</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr key={w.id} className="border-b border-gray-800/60 hover:bg-gray-900/40 transition-colors">
                  <td className="py-2.5 pr-3 text-white font-medium">{w.name}</td>
                  <td className="py-2.5 pr-3 text-gray-400">{w.city}</td>
                  <td className="py-2.5 pr-3 text-right text-gray-300">{w.current_utilization_pct.toFixed(1)}%</td>
                  <td className="py-2.5 text-right">
                    <button onClick={() => handleRemoveHub(w)} disabled={hubBusy} title={`Remove ${w.name}`}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all disabled:opacity-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {warehouses.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-gray-500">No warehouses. Add one to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>


      <section className="glass-panel p-4 rounded-2xl border border-gray-800 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Boxes className="w-4 h-4 text-amber-400" /> Inventory Ledger
        </h2>

        {loading ? (
          <p className="text-xs text-gray-400 py-6 text-center">Loading inventory...</p>
        ) : inventory.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">No inventory items. Add one to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-gray-500 border-b border-gray-800">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Warehouse</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 pr-3 text-right">Reorder At</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map(item => {
                  const isLow = item.quantity <= item.reorder_threshold;
                  return (
                    <tr key={item.inventory_id} className="border-b border-gray-800/60 hover:bg-gray-900/40 transition-colors">
                      <td className="py-2.5 pr-3 text-white font-medium">{item.item_name}</td>
                      <td className="py-2.5 pr-3">
                        <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono text-[10px]">
                          {item.sku}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-300">{whName(item.warehouse_id)}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold text-white">
                        {item.quantity} <span className="text-gray-500 font-normal">{item.unit}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right text-gray-400">{item.reorder_threshold}</td>
                      <td className="py-2.5 pr-3">
                        {isLow ? (
                          <span className="flex items-center gap-1 w-fit px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold">
                            <AlertTriangle className="w-3 h-3" /> LOW STOCK
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 w-fit px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                            <PackageCheck className="w-3 h-3" /> IN STOCK
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => handleRemoveItem(item)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
                          title={`Remove ${item.sku} from ${whName(item.warehouse_id)}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="text-center text-[10px] text-gray-500 uppercase tracking-widest pt-2">
        LogiMind AI &mdash; Warehouse Manager Portal
      </footer>
    </div>
  );
};
