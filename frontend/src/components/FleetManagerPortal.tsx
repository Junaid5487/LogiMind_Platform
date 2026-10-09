import React, { useEffect, useState } from 'react';
import type { VehicleItem, RouteItem, DriverListItem } from '../types';
import { fetchDrivers, addDriver, removeDriver, addVehicle, removeVehicle } from '../services/api';
import { Users, Plus, Trash2, Truck, Navigation, RotateCcw, ShieldCheck, Star, Phone } from 'lucide-react';

interface FleetManagerPortalProps {
  vehicles: VehicleItem[];
  routes: RouteItem[];
  onOptimize: () => void;
  isOptimizing: boolean;
  onReload: () => Promise<void>;
}

const FUEL_TYPES = ['DIESEL', 'PETROL', 'CNG', 'ELECTRIC'];
const VEHICLE_TYPES = ['LIGHT_TRUCK', 'HEAVY_TRUCK', 'EV_VAN', 'REFRIGERATED_TRUCK', 'TRAILER'];

const EMPTY_VEHICLE_FORM = {
  brand: '',
  model: '',
  vehicle_type: 'LIGHT_TRUCK',
  capacity_kg: '1500',
  fuel_type: 'DIESEL',
};

const EMPTY_FORM = {
  driver_name: '',
  license_number: '',
  vehicle_id: 'V-101',
  phone: '',
  experience_years: '0',
};

export const FleetManagerPortal: React.FC<FleetManagerPortalProps> = ({ vehicles, routes, onOptimize, isOptimizing, onReload }) => {
  const [drivers, setDrivers] = useState<DriverListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showForm, setShowForm] = useState<boolean>(false);
  const [vehicleForm, setVehicleForm] = useState({ ...EMPTY_VEHICLE_FORM });
  const [showVehicleForm, setShowVehicleForm] = useState<boolean>(false);
  const [fleetBusy, setFleetBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { loadDrivers(); }, []);

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const data = await fetchDrivers();
      setDrivers(data);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load drivers' });
    } finally {
      setLoading(false);
    }
  };

  const notify = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 4000);
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.driver_name.trim() || !form.license_number.trim()) {
      notify('error', 'Name and license number are required');
      return;
    }
    const vehicle = vehicles.find(v => v.id === form.vehicle_id);
    try {
      const res = await addDriver({
        driver_name: form.driver_name.trim(),
        license_number: form.license_number.trim(),
        vehicle_id: form.vehicle_id,
        vehicle_name: vehicle?.name || form.vehicle_id,
        vehicle_type: vehicle?.type || 'EV_VAN',
        phone: form.phone.trim() || undefined,
        experience_years: Number(form.experience_years) || 0,
      });
      setDrivers(prev => [...prev, res.driver]);
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      notify('success', `Driver ${res.driver.driver_name} added (${res.driver.driver_id})`);
    } catch (err: any) {
      notify('error', err.message || 'Failed to add driver');
    }
  };

  const handleRemoveDriver = async (driver: DriverListItem) => {
    if (!window.confirm(`Remove driver ${driver.driver_name} (${driver.driver_id})?`)) return;
    try {
      await removeDriver(driver.driver_id);
      setDrivers(prev => prev.filter(d => d.driver_id !== driver.driver_id));
      notify('success', `${driver.driver_name} removed from registry`);
    } catch (err: any) {
      notify('error', err.message || 'Failed to remove driver');
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleForm.brand.trim()) { notify('error', 'Vehicle name (brand) is required'); return; }
    const capacity_kg = Number(vehicleForm.capacity_kg);
    if (!Number.isFinite(capacity_kg) || capacity_kg <= 0) { notify('error', 'Capacity must be greater than 0 kg'); return; }
    setFleetBusy(true);
    try {
      const v = await addVehicle({
        brand: vehicleForm.brand.trim(),
        model: vehicleForm.model.trim() || undefined,
        vehicle_type: vehicleForm.vehicle_type,
        capacity_kg,
        fuel_type: vehicleForm.fuel_type,
      });
      setVehicleForm({ ...EMPTY_VEHICLE_FORM });
      setShowVehicleForm(false);
      notify('success', `Vehicle ${v.id} (${v.name}) added to fleet`);
      await onReload();
    } catch (err: any) {
      notify('error', err.message || 'Failed to add vehicle');
    } finally {
      setFleetBusy(false);
    }
  };

  const handleRemoveVehicle = async (vehicle: VehicleItem) => {
    if (!window.confirm(`Remove vehicle ${vehicle.name} (${vehicle.id})?`)) return;
    setFleetBusy(true);
    try {
      await removeVehicle(vehicle.id);
      notify('success', `${vehicle.id} removed from fleet`);
      await onReload();
    } catch (err: any) {
      notify('error', err.message || 'Failed to remove vehicle');
    } finally {
      setFleetBusy(false);
    }
  };

  return (
    <div className="py-6 px-4 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Fleet Manager Portal</h1>
            <p className="text-[11px] text-gray-400">Fleet overview, route optimization and driver management</p>
          </div>
        </div>
        <button onClick={loadDrivers} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-all" title="Refresh">
          <RotateCcw className="w-4 h-4" />
        </button>
      </header>

      {/* ── Fleet vehicles: add/remove ─────────────────────────── */}
      <section className="glass-panel p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-400" /> Fleet Vehicles ({vehicles.length})
          </h2>
          <button onClick={() => setShowVehicleForm(!showVehicleForm)}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Vehicle
          </button>
        </div>
        {showVehicleForm && (
          <form onSubmit={handleAddVehicle} className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-gray-900/50 border border-gray-800">
            <input value={vehicleForm.brand} onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })}
              placeholder="Vehicle name * (e.g. Tata Ace)" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" />
            <input value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
              placeholder="Model (optional)" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" />
            <input value={vehicleForm.capacity_kg} onChange={(e) => setVehicleForm({ ...vehicleForm, capacity_kg: e.target.value })}
              placeholder="Capacity kg" inputMode="decimal" className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" />
            <select value={vehicleForm.vehicle_type} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value })}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500">
              {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={vehicleForm.fuel_type} onChange={(e) => setVehicleForm({ ...vehicleForm, fuel_type: e.target.value })}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500">
              {FUEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="flex gap-2">
              <button type="submit" disabled={fleetBusy}
                className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all disabled:opacity-50">
                {fleetBusy ? 'Adding...' : 'Save'}
              </button>
              <button type="button" onClick={() => setShowVehicleForm(false)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-all">
                Cancel
              </button>
            </div>
          </form>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-800">
                <th className="py-2 pr-3">Vehicle</th>
                <th className="py-2 pr-3 text-right">Capacity</th>
                <th className="py-2 pr-3">Fuel</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="border-b border-gray-800/60 hover:bg-gray-900/40 transition-all">
                  <td className="py-2.5 pr-3">
                    <p className="font-bold text-white">{v.name}</p>
                    <p className="text-[10px] text-gray-500">{v.id} | {v.type}</p>
                  </td>
                  <td className="py-2.5 pr-3 text-right text-gray-300">{v.capacity_kg} kg</td>
                  <td className="py-2.5 pr-3 text-gray-400">{v.fuel_type}</td>
                  <td className="py-2.5 pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${v.status === 'MAINTENANCE'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <button onClick={() => handleRemoveVehicle(v)} disabled={fleetBusy} title={`Remove ${v.name}`}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all disabled:opacity-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-gray-500">No vehicles in fleet. Add one to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {message && (
        <div className={`text-xs font-semibold p-3 rounded-xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {message.text}
        </div>
      )}

      {/* Fleet Overview */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Fleet Overview <span className="text-[10px] font-normal text-gray-400">({vehicles.length} vehicles)</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {vehicles.map(v => (
            <div key={v.id} className="glass-card p-4 rounded-xl border border-gray-800 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">{v.name}</h3>
                  <p className="text-[10px] text-gray-400 font-semibold">{v.id} | {v.type} | {v.fuel_type}</p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${v.status === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : v.status === 'MAINTENANCE' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-sky-500/20 text-sky-400 border-sky-500/30'}`}>
                  {v.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-900/60 rounded-lg p-2">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider">Fuel</p>
                  <p className="text-xs font-bold text-white">{v.fuel_level_pct}%</p>
                </div>
                <div className="bg-gray-900/60 rounded-lg p-2">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider">Capacity</p>
                  <p className="text-xs font-bold text-white">{v.capacity_kg} kg</p>
                </div>
                <div className="bg-gray-900/60 rounded-lg p-2">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider">Health</p>
                  <p className={`text-xs font-bold ${v.health_status === 'NORMAL' ? 'text-emerald-400' : 'text-amber-400'}`}>{v.health_status}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Route Optimization */}
      <section className="glass-panel p-4 rounded-2xl border border-gray-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Navigation className="w-4 h-4 text-sky-400" /> Route Optimization <span className="text-[10px] font-normal text-gray-400">({routes.length} routes)</span>
          </h2>
          <button
            onClick={onOptimize}
            disabled={isOptimizing}
            className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-xs font-bold border border-sky-500/30 transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
            {isOptimizing ? 'Optimizing...' : 'Run VRP Optimization'}
          </button>
        </div>

        <div className="space-y-2">
          {routes.length === 0 && (
            <p className="text-xs text-gray-500">No optimized routes yet. Click "Run VRP Optimization".</p>
          )}
          {routes.map(r => (
            <div key={r.route_id} className="bg-gray-900/40 border border-gray-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-[10px] font-bold">
                  {r.stops.length}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{r.route_id} <span className="text-gray-500 font-normal">({r.vehicle_name})</span></p>
                  <p className="text-[10px] text-gray-400">Driver {r.driver_id} | {r.total_distance_km} km | {r.fuel_estimate_liters} L fuel | {r.carbon_emissions_kg} kg CO2</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">{r.status}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Driver Management */}
      <section className="glass-panel p-4 rounded-2xl border border-gray-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" /> Drivers <span className="text-[10px] font-normal text-gray-400">({drivers.length} registered)</span>
          </h2>
          <button
            onClick={() => setShowForm(s => !s)}
            className="px-3.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-bold border border-purple-500/30 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> {showForm ? 'Close' : 'Add Driver'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAddDriver} className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Full Name *</label>
              <input value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} placeholder="e.g. Suresh Iyer"
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">License Number *</label>
              <input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} placeholder="e.g. MH-05-2024-0011223"
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Assign Vehicle</label>
              <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500">
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.id})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91-..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Exp. (yrs)</label>
                <input type="number" min="0" value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500" />
              </div>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold border border-purple-400/50 transition-all flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Register Driver
              </button>
            </div>
          </form>
        )}

        {loading && <p className="text-xs text-gray-500">Loading drivers...</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-800">
                <th className="py-2 pr-3">Driver</th>
                <th className="py-2 pr-3">License</th>
                <th className="py-2 pr-3">Vehicle</th>
                <th className="py-2 pr-3">Route</th>
                <th className="py-2 pr-3">Rating</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.driver_id} className="border-b border-gray-800/60 hover:bg-gray-900/40 transition-all">
                  <td className="py-2.5 pr-3">
                    <p className="font-bold text-white">{d.driver_name}</p>
                    <p className="text-[10px] text-gray-500">{d.driver_id} | {d.experience_years} yrs exp{d.phone ? ` | ${d.phone}` : ''}</p>
                  </td>
                  <td className="py-2.5 pr-3 text-gray-400">{d.license_number}</td>
                  <td className="py-2.5 pr-3">
                    <p className="text-gray-300">{d.vehicle_name}</p>
                    <p className="text-[10px] text-gray-500">{d.vehicle_id} | {d.vehicle_type}</p>
                  </td>
                  <td className="py-2.5 pr-3 text-gray-400">{d.route_id || <span className="text-gray-600">Unassigned</span>}</td>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-1 text-amber-400 font-bold"><Star className="w-3 h-3" /> {d.rating_score.toFixed(1)}</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${d.availability_status === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-sky-500/20 text-sky-400 border-sky-500/30'}`}>
                      {d.availability_status}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => handleRemoveDriver(d)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
                      title={`Remove ${d.driver_name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && drivers.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-center text-gray-500">No drivers registered.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="text-center text-[10px] text-gray-600 pt-2 border-t border-gray-800">
        LogiMind AI | Fleet Operations Console | Role: <span className="text-white font-bold">Fleet Manager</span>
      </footer>
    </div>
  );
};

export default FleetManagerPortal;
