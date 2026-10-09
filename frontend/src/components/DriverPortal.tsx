import React, { useEffect, useState } from 'react';
import type { DriverActiveRoute, DriverRouteStop } from '../types';
import { fetchDriverActiveRoute, updateDriverStopStatus } from '../services/api';
import { Truck, RotateCcw, Gauge, Clock, Home, CheckCircle2, AlertTriangle, MapPin, ArrowRight, Timer } from 'lucide-react';

interface DriverPortalProps {
  driverId?: string;
  onStopCompleted?: (stop: DriverRouteStop) => void;
}

export const DriverPortal: React.FC<DriverPortalProps> = ({
  driverId = 'DRV-01',
  onStopCompleted,
}) => {
  const [activeRoute, setActiveRoute] = useState<DriverActiveRoute | null>(null);
  const [currentStopIndex, setCurrentStopIndex] = useState<number>(0);
  const [tripStarted, setTripStarted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [exceptionNote, setExceptionNote] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => { loadRoute(); }, [driverId]);

  const loadRoute = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchDriverActiveRoute(driverId);
      setActiveRoute(data);
      const firstPending = data.assigned_route?.stops?.findIndex(
        (s: DriverRouteStop) => s.status !== 'DELIVERED'
      ) ?? -1;
      if (firstPending >= 0) setCurrentStopIndex(firstPending);
    } catch (e: any) {
      setError(e.message || 'Failed to load driver route');
      setActiveRoute(null);
    } finally { setLoading(false); }
  };

  const handleStartTrip = async () => {
    if (!activeRoute) return;
    setTripStarted(true);
    try {
      await updateDriverStopStatus(activeRoute.assigned_route.stops[0]?.order_id || '', 'IN_TRANSIT', undefined, driverId);
      setCurrentStopIndex(0);
    } catch (e: any) { setError(e.message || 'Failed to start trip'); }
  };

  const handleConfirmDelivery = async (stop: DriverRouteStop) => {
    try {
      await updateDriverStopStatus(stop.order_id, 'DELIVERED', undefined, driverId);
      setCurrentStopIndex(prev => {
        const next = prev + 1;
        if (next >= (activeRoute?.assigned_route?.stops?.length || 0)) return (activeRoute?.assigned_route?.stops?.length || 0) - 1;
        return next;
      });
      onStopCompleted?.(stop);
    } catch (e: any) { setError(e.message || 'Failed to confirm delivery'); }
  };

  const handleReportException = async (status: 'DELAYED' | 'IN_TRANSIT') => {
    if (!exceptionNote.trim()) { setError('Please describe the exception before reporting.'); return; }
    try {
      const stop = activeRoute?.assigned_route?.stops?.find(s => s.status !== 'DELIVERED');
      if (!stop) { setError('No active stop to report an exception for.'); return; }
      await updateDriverStopStatus(stop.order_id, status, exceptionNote.trim(), driverId);
      setExceptionNote('');
      setError('');
      if (status === 'DELAYED') {
        setCurrentStopIndex(prev => prev + 1 >= (activeRoute?.assigned_route?.stops?.length || 0) ? (activeRoute?.assigned_route?.stops?.length || 0) - 1 : prev + 1);
      }
    } catch (e: any) { setError(e.message || 'Failed to report exception'); }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center"><div className="text-white text-sm font-medium">Loading driver portal...</div></div>;
  }

  if (!activeRoute) {
    return <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center"><div className="text-white text-sm text-gray-400">{error || 'No active route assigned to this driver.'}</div></div>;
  }

  const stops = activeRoute.assigned_route?.stops || [];
  const currentStop = currentStopIndex >= 0 && currentStopIndex < stops.length ? stops[currentStopIndex] : null;
  const pendingStops = stops.filter(s => s.status !== 'DELIVERED');
  const deliveredCount = stops.filter(s => s.status === 'DELIVERED').length;
  const remainingStops = stops.length - deliveredCount;
  const originName = activeRoute.assigned_route?.origin_name || 'Assigned Depot';
  const originAddress = activeRoute.assigned_route?.origin_address || '';
  const delayedStops = stops.filter(s => (s.delay_minutes ?? 0) > 0 || s.status === 'DELAYED');

  return (
    <div className="min-h-screen bg-[#0b0f17] text-gray-100">
      <header className="glass-panel sticky top-0 z-40 px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Driver Portal</h1>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{activeRoute.driver_name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${activeRoute.trip_status === 'IN_PROGRESS' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
            {activeRoute.trip_status === 'IN_PROGRESS' ? 'ON SHIFT' : 'OFF SHIFT'}
          </span>
          <button onClick={loadRoute} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-all" title="Refresh"><RotateCcw className="w-4 h-4" /></button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {/* Vehicle & Telemetry Card */}
        <section className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{activeRoute.vehicle_name}</h2>
              <p className="text-[11px] text-gray-400 font-semibold">Vehicle {activeRoute.vehicle_id} | {activeRoute.vehicle_type}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-3 rounded-xl border border-gray-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><Gauge className="w-3 h-3" /> Fuel / Battery</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${activeRoute.fuel_level_pct}%`, background: activeRoute.fuel_level_pct > 40 ? '#34d399' : activeRoute.fuel_level_pct > 20 ? '#f59e0b' : '#ef4444' }} />
                </div>
                <span className="text-xs font-bold text-white">{activeRoute.fuel_level_pct}%</span>
              </div>
            </div>

            <div className="glass-card p-3 rounded-xl border border-gray-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><Gauge className="w-3 h-3" /> Engine Temp</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, ((activeRoute.engine_temp_c - 60) / 40) * 100)}%`, background: activeRoute.engine_temp_c > 96 ? '#ef4444' : activeRoute.engine_temp_c > 90 ? '#f59e0b' : '#34d399' }} />
                </div>
                <span className="text-xs font-bold text-white">{activeRoute.engine_temp_c.toFixed(1)} C</span>
              </div>
            </div>

            <div className="glass-card p-3 rounded-xl border border-gray-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><Clock className="w-3 h-3" /> Odometer</div>
              <div className="text-xs font-bold text-white">{activeRoute.odometer_km.toLocaleString()} km</div>
            </div>

            <div className="glass-card p-3 rounded-xl border border-gray-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><Gauge className="w-3 h-3" /> Safety Health</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${activeRoute.failure_risk_pct || 15}%`, background: (activeRoute.health_status || 'NORMAL') === 'CRITICAL' ? '#ef4444' : (activeRoute.health_status || 'NORMAL') === 'WARNING' ? '#f59e0b' : '#34d399' }} />
                </div>
                <span className="text-xs font-bold text-white">{(activeRoute.failure_risk_pct || 15).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-800">
            <div className="text-center"><div className="text-xl font-bold text-white">{activeRoute.assigned_route?.total_distance_km || 0} km</div><div className="text-[10px] text-gray-400 font-semibold">Total Route</div></div>
            <div className="text-center"><div className="text-xl font-bold text-white">{stops.filter(s => s.status === 'IN_TRANSIT' || s.status === 'PENDING').length}</div><div className="text-[10px] text-gray-400 font-semibold">Active Stops</div></div>
            <div className="text-center"><div className="text-xl font-bold text-white">{remainingStops}</div><div className="text-[10px] text-gray-400 font-semibold">Remaining</div></div>
          </div>
        </section>
        {/* Shift Status Bar */}
        <section className="glass-panel p-4 rounded-2xl border border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeRoute.trip_status === 'IN_PROGRESS' ? <><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-sm font-bold text-emerald-400">Trip Active</span></> : <><Gauge className="w-4 h-4 text-amber-400" /><span className="text-sm font-bold text-amber-400">Trip Ready</span></>}
            </div>
            <span className="text-xs text-gray-400">{activeRoute.trip_status}</span>
          </div>

          {!tripStarted && activeRoute.trip_status !== 'IN_PROGRESS' && (
            <button onClick={handleStartTrip} className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-sky-500/20 transition-all">Start Shift / Begin Trip</button>
          )}
          {tripStarted && <div className="text-xs text-gray-400 text-center">Trip started. You are on stop <strong>{currentStopIndex + 1}</strong> of <strong>{stops.length}</strong>.</div>}
        </section>
        {/* Delivery Itinerary */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Home className="w-4 h-4 text-sky-400" /> Delivery Itinerary <span className="text-[10px] font-normal text-gray-400 ml-1">({pendingStops.length} pending)</span></h3>
            <button onClick={loadRoute} className="text-xs text-gray-400 hover:text-gray-200 transition-all"><RotateCcw className="w-4 h-4" /></button>
          </div>

          <div className="glass-card p-3 rounded-xl border border-gray-800 mb-3 flex items-center gap-2 text-xs text-gray-300">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-emerald-400 shrink-0">From:</span>
            <span className="truncate">{originName}{originAddress ? ` (${originAddress})` : ''}</span>
            <ArrowRight className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="text-sky-400 font-semibold shrink-0">To:</span>
            <span className="truncate">{stops.map(s => s.address).join(' | ')}</span>
          </div>

          <div className="space-y-2">
            {stops.map((stop: DriverRouteStop, idx: number) => {
              const isCurrent = idx === currentStopIndex;
              const isDelivered = stop.status === 'DELIVERED';
              const isPending = stop.status === 'PENDING' || stop.status === 'IN_TRANSIT';
              const isDelayed = stop.status === 'DELAYED';

              return (
                <div key={stop.order_id} className={`glass-card p-4 rounded-xl border transition-all cursor-pointer ${isCurrent ? 'border-sky-500/40 bg-sky-500/5 shadow-lg shadow-sky-500/10' : isDelivered ? 'border-gray-800 bg-gray-900/30 opacity-60' : isDelayed ? 'border-amber-500/30 bg-amber-500/5' : 'border-gray-800 bg-gray-900/30'}`} onClick={() => { if (!isCurrent && isPending) setCurrentStopIndex(idx); }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${isCurrent ? 'bg-sky-500/30 text-sky-400' : isDelivered ? 'bg-emerald-500/20 text-emerald-400' : isDelayed ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700 text-gray-300'}`}>
                        {isDelivered ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <div>
                        <h4 className={`text-sm font-bold text-white ${isCurrent ? 'underline' : ''}`}>{stop.customer_name}</h4>
                        <p className="text-[10px] text-gray-400 font-semibold">Order {stop.order_id} | Stop #{stop.sequence}</p>
                      </div>
                    </div>

                    <div className={`px-2 py-1 rounded-full text-[10px] font-bold ${stop.priority === 'CRITICAL_COLD_CHAIN' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : stop.priority === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-gray-700/50 text-gray-400 border border-gray-700/50'}`}>
                      {stop.priority}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> ETA: {stop.eta}</span>
                    {stop.weight_kg > 0 && <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> {stop.weight_kg.toFixed(0)} kg</span>}
                    {stop.exception_note && <span className="flex items-center gap-1 text-amber-400"><AlertTriangle className="w-3 h-3" /> {stop.exception_note}</span>}
                  </div>

                  <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-gray-500">
                    <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="truncate"><span className="text-emerald-400">From {originName}</span> <ArrowRight className="w-2.5 h-2.5 inline" /> <span className="text-sky-400">To {stop.address}</span></span>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex gap-1.5">
                      {!isCurrent && !isDelivered && <button onClick={() => handleConfirmDelivery(stop)} disabled={isDelayed} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all disabled:opacity-40">Mark Delivered</button>}
                      {isCurrent && <button onClick={() => handleConfirmDelivery(stop)} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/30 hover:bg-emerald-500/40 text-emerald-400 border border-emerald-500/40 shadow-md shadow-emerald-500/10 transition-all">Continue to Next Stop</button>}
                    </div>

                    {isPending && <div className="flex gap-1">
                      <button onClick={() => handleReportException('DELAYED')} disabled={!exceptionNote.trim()} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 transition-all disabled:opacity-40">Delay</button>
                    </div>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        {/* Focus View for Current Stop */}
        {currentStop && (
          <div className="glass-card p-4 rounded-xl border border-sky-500/30">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-sky-400 flex items-center gap-2"><Home className="w-4 h-4" /> Focus View - Stop {currentStopIndex + 1} of {stops.length}</h4>
              <span className="text-[10px] text-gray-400">{currentStop.status}</span>
            </div>
            <p className="text-sm text-white font-semibold">{currentStop.customer_name}</p>
            <p className="text-xs text-gray-400">{currentStop.address}</p>
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1"><Clock className="w-3 h-3" /> ETA: {currentStop.eta}</p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-400">
              <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300">{currentStop.weight_kg?.toFixed(0)} kg</span>
              <span className={`px-2 py-0.5 rounded text-gray-300 ${currentStop.priority === 'CRITICAL_COLD_CHAIN' ? 'bg-rose-900/40 text-rose-300' : currentStop.priority === 'HIGH' ? 'bg-amber-900/40 text-amber-300' : 'bg-gray-800 text-gray-300'}`}>{currentStop.priority}</span>
            </div>
          </div>
        )}

        {/* Exception Report */}
        <section className="glass-panel p-4 rounded-2xl border border-gray-800 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Report Exception / Delay</h3>
          <textarea value={exceptionNote} onChange={(e) => setExceptionNote(e.target.value)} placeholder="Describe the issue (e.g., Traffic Congestion, Customer Unavailable, Cold Chain Seal Warning, Dead Battery)..." className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none" rows={2} />
          <div className="flex gap-2">
            <button onClick={() => handleReportException('DELAYED')} disabled={!exceptionNote.trim()} className="flex-1 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-bold border border-amber-500/30 transition-all disabled:opacity-40">Report Delay</button>
            <button onClick={() => handleReportException('IN_TRANSIT')} className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold border border-gray-700 transition-all">Continue</button>
          </div>
          {error && <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/30">{error}</div>}
        </section>

        {/* Transport Delays */}
        <section className="glass-panel p-4 rounded-2xl border border-gray-800 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Timer className="w-4 h-4 text-amber-400" /> Delays During Transport
            {delayedStops.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">{delayedStops.length}</span>
            )}
          </h3>
          {delayedStops.length === 0 ? (
            <p className="text-xs text-gray-500">No delays reported on this route. All stops on schedule.</p>
          ) : (
            <div className="space-y-2">
              {delayedStops.map(stop => (
                <div key={stop.order_id} className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">{stop.order_id} - {stop.customer_name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{stop.delay_reason || stop.exception_note || 'Delay reported'}</p>
                  </div>
                  <span className="shrink-0 px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                    +{stop.delay_minutes ?? 0} min
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="text-center text-[10px] text-gray-600 py-4 border-t border-gray-800">LogiMind AI | Driver Dispatch and Delivery Execution Portal | Role: <span className="text-white font-bold">{activeRoute.driver_name}</span></footer>
    </div>
  );
};

export default DriverPortal;
