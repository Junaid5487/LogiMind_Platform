import React, { useState } from 'react';
import type { ScenarioOrder, WarehouseItem } from '../types';
import { addScenarioOrder, removeScenarioOrder, resetScenario } from '../services/api';
import { Plus, Trash2, PackagePlus, RotateCcw, Eraser, AlertTriangle } from 'lucide-react';

interface ScenarioPlannerProps {
  orders: ScenarioOrder[];
  warehouses: WarehouseItem[];
  onReload: () => Promise<void>;
}

const PRIORITIES = ['CRITICAL_COLD_CHAIN', 'HIGH', 'NORMAL', 'LOW'];

const EMPTY_ORDER_FORM = {
  customer_name: '',
  dest_lat: '19.0760',
  dest_lng: '72.8777',
  weight_kg: '25',
  priority: 'NORMAL',
};

export const ScenarioPlanner: React.FC<ScenarioPlannerProps> = ({ orders, warehouses, onReload }) => {
  const [form, setForm] = useState({ ...EMPTY_ORDER_FORM });
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const notify = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 4000);
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim()) { notify('error', 'Customer name is required'); return; }
    const dest_lat = Number(form.dest_lat);
    const dest_lng = Number(form.dest_lng);
    const weight_kg = Number(form.weight_kg);
    if (!Number.isFinite(dest_lat) || dest_lat < -90 || dest_lat > 90) { notify('error', 'Latitude must be between -90 and 90'); return; }
    if (!Number.isFinite(dest_lng) || dest_lng < -180 || dest_lng > 180) { notify('error', 'Longitude must be between -180 and 180'); return; }
    if (!Number.isFinite(weight_kg) || weight_kg <= 0) { notify('error', 'Weight must be greater than 0 kg'); return; }
    if (!PRIORITIES.includes(form.priority)) { notify('error', 'Select a valid priority'); return; }
    setBusy(true);
    try {
      await addScenarioOrder({
        customer_name: form.customer_name.trim(), dest_lat, dest_lng, weight_kg,
        priority: form.priority, warehouse_id: warehouses[0]?.id ?? null,
      });
      setForm({ ...EMPTY_ORDER_FORM });
      setShowForm(false);
      notify('success', 'Order added to scenario');
      await onReload();
    } catch (err: any) {
      notify('error', err.message || 'Failed to add order');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveOrder = async (order: ScenarioOrder) => {
    if (!window.confirm(`Remove order for ${order.customer_name}?`)) return;
    setBusy(true);
    try {
      await removeScenarioOrder(order.order_id);
      notify('success', 'Order removed');
      await onReload();
    } catch (err: any) {
      notify('error', err.message || 'Failed to remove order');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (preset: 'demo' | 'empty') => {
    if (!window.confirm(preset === 'demo' ? 'Restore the 5 demo orders?' : 'Remove ALL scenario orders?')) return;
    setBusy(true);
    try {
      const res = await resetScenario(preset);
      notify('success', `Scenario reset (${res.preset}) — ${res.orders} order(s)`);
      await onReload();
    } catch (err: any) {
      notify('error', err.message || 'Failed to reset scenario');
    } finally {
      setBusy(false);
    }
  };

  const priorityBadge = (p: string) => {
    if (p === 'CRITICAL_COLD_CHAIN') return 'bg-red-500/15 text-red-400 border-red-500/30';
    if (p === 'HIGH') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    if (p === 'LOW') return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
    return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
  };

  return (
    <section className="glass-panel p-5 rounded-2xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <PackagePlus className="w-4 h-4 text-sky-400" />
          Scenario Planner — Orders ({orders.length})
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-all flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Order
          </button>
          <button onClick={() => handleReset('demo')} disabled={busy} title="Restore the 5 demo orders"
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50">
            <RotateCcw className="w-3.5 h-3.5" /> Demo
          </button>
          <button onClick={() => handleReset('empty')} disabled={busy} title="Remove all scenario orders"
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50">
            <Eraser className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      </div>
      {message && (
        <p className={`text-xs px-3 py-2 rounded-lg border ${message.type === 'success'
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
          {message.text}
        </p>
      )}



      {showForm && (
        <form onSubmit={handleAddOrder} className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-gray-900/50 border border-gray-800">
          <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            placeholder="Customer name *" className="col-span-2 sm:col-span-3 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500" />
          <input value={form.dest_lat} onChange={(e) => setForm({ ...form, dest_lat: e.target.value })}
            placeholder="Lat (-90..90)" inputMode="decimal" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500" />
          <input value={form.dest_lng} onChange={(e) => setForm({ ...form, dest_lng: e.target.value })}
            placeholder="Lng (-180..180)" inputMode="decimal" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500" />
          <input value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
            placeholder="Weight kg" inputMode="decimal" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-sky-500" />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500">
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button type="submit" disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-all disabled:opacity-50">
            {busy ? 'Adding...' : 'Save Order'}
          </button>
          <button type="button" onClick={() => setShowForm(false)}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-all">
            Cancel
          </button>
        </form>
      )}

      {orders.length === 0 ? (
        <p className="text-xs text-gray-500 py-4 text-center flex items-center justify-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          No orders in this scenario. Add one above or press Demo to restore the sample set.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-800">
                <th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3 text-right">Weight</th>
                <th className="py-2 pr-3">Priority</th>
                <th className="py-2 pr-3 hidden sm:table-cell">Coords</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_id} className="border-b border-gray-800/60 hover:bg-gray-900/40 transition-all">
                  <td className="py-2.5 pr-3">
                    <p className="font-bold text-white">{o.customer_name}</p>
                    <p className="text-[10px] text-gray-500 font-mono">{o.order_id}</p>
                  </td>
                  <td className="py-2.5 pr-3 text-right text-gray-300">{o.weight_kg} kg</td>
                  <td className="py-2.5 pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityBadge(o.priority)}`}>
                      {o.priority}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-gray-500 font-mono hidden sm:table-cell">
                    {o.dest_lat.toFixed(3)}, {o.dest_lng.toFixed(3)}
                  </td>
                  <td className="py-2.5 text-right">
                    <button onClick={() => handleRemoveOrder(o)} disabled={busy} title={`Remove ${o.customer_name}`}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all disabled:opacity-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default ScenarioPlanner;
