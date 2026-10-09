import React, { useEffect, useState } from 'react';
import type { RouteItem, WarehouseItem, VehicleItem } from '../types';
import { RefreshCw, Navigation, Fuel, Zap, CheckCircle2, Route as RouteIcon } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SavingsBanner } from './SavingsBanner';

interface LiveRouteMapProps {
  warehouses: WarehouseItem[];
  vehicles: VehicleItem[];
  routes: RouteItem[];
  defaultRoutes: RouteItem[];
  onOptimize: () => void;
  isOptimizing: boolean;
  solverEngine?: string;
  totalDistanceKm?: number;
  defaultDistanceKm?: number;
  lastRunAt?: string;
  optimizedAtLeastOnce: boolean;
  planner: React.ReactNode;
}

// Inline SVG pin rendered as a data URI so markers never depend on external
// CDNs (raw.githubusercontent.com is blocked by Chrome's ORB in some cases).
const pinDataUrl = (color: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36"><path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="${color}" stroke="#ffffff" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="#ffffff"/></svg>`
  )}`;

const warehouseIcon = new L.Icon({
  iconUrl: pinDataUrl('#a855f7'),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [0, -36]
});

const vehicleIcon = new L.Icon({
  iconUrl: pinDataUrl('#22d3ee'),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [0, -36]
});

const stopIcon = new L.Icon({
  iconUrl: pinDataUrl('#22c55e'),
  iconSize: [20, 32],
  iconAnchor: [10, 32],
  popupAnchor: [0, -28]
});

const routeColors = ['#38bdf8', '#34d399', '#a855f7', '#f59e0b', '#ec4899'];

export const LiveRouteMap: React.FC<LiveRouteMapProps> = ({ warehouses, vehicles, routes, defaultRoutes, onOptimize, isOptimizing, solverEngine, totalDistanceKm, defaultDistanceKm, lastRunAt, optimizedAtLeastOnce, planner }) => {
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);

  useEffect(() => {
    setSelectedRoute((prev) => {
      if (routes.length === 0) return null;
      if (prev && routes.some((r) => r.route_id === prev.route_id)) return prev;
      return routes[0];
    });
  }, [routes]);

  const mapCenter: [number, number] = [19.0760, 72.8777];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Navigation className="w-5 h-5 text-sky-400" />
            Live Route VRP Map & Dispatch Control
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Clarke-Wright Savings heuristic with 2-Opt local search for multi-stop vehicle routing under capacity constraints.
          </p>
          {lastRunAt && !isOptimizing && (
            <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Solver completed at {lastRunAt}
              {typeof totalDistanceKm === 'number' && <> &mdash; {totalDistanceKm.toFixed(1)} km total</>}
            </p>
          )}
        </div>

        <button
          onClick={onOptimize}
          disabled={isOptimizing}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-sky-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
          <span>{isOptimizing ? 'Re-Solving Routes...' : 'Optimize Route'}</span>
        </button>
      </div>

      {planner}

      <SavingsBanner defaultKm={defaultDistanceKm} optimizedKm={totalDistanceKm} visible={optimizedAtLeastOnce} />

      <div className="glass-panel p-4 rounded-2xl flex items-center gap-3 text-xs">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-gray-500 to-gray-700 flex items-center justify-center shadow-lg shrink-0">
          <RouteIcon className="w-4 h-4 text-white" />
        </div>
        <div className="text-gray-400">
          <p className="font-semibold text-gray-200">
            Default baseline route {typeof defaultDistanceKm === 'number' ? <span>— {defaultDistanceKm.toFixed(1)} km</span> : ''}
          </p>
          <p className="mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="inline-block w-8 border-t-2 border-dashed border-gray-400" /> grey dashed = current default
            <span className="inline-block w-8 border-t-2 border-sky-400 ml-2" /> solid = optimized
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-panel lg:col-span-2 p-2 rounded-2xl h-[560px] relative overflow-hidden border border-gray-800">
          <MapContainer center={mapCenter} zoom={7} className="logimind-map" style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {warehouses.filter(wh => typeof wh.location_lat === 'number' && typeof wh.location_lng === 'number' && !isNaN(wh.location_lat) && !isNaN(wh.location_lng)).map((wh) => (
              <Marker key={wh.id} position={[wh.location_lat, wh.location_lng]} icon={warehouseIcon}>
                <Popup>
                  <div className="p-1">
                    <h4 className="font-bold text-sky-400 text-sm">{wh.name}</h4>
                    <p className="text-xs text-gray-300">{wh.city}</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {vehicles.filter(v => typeof v.current_lat === 'number' && typeof v.current_lng === 'number' && !isNaN(v.current_lat) && !isNaN(v.current_lng)).map((v) => (
              <Marker key={v.id || v.name} position={[v.current_lat, v.current_lng]} icon={vehicleIcon}>
                <Popup>
                  <div className="p-1">
                    <h4 className="font-bold text-emerald-400 text-sm">{v.id} - {v.name}</h4>
                    <p className="text-xs text-gray-300">Status: {v.status}</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Default baseline polylines (grey dashed, underneath) */}
            {defaultRoutes.map((route) => {
              if (!route || !Array.isArray(route.stops) || route.stops.length === 0) return null;
              const validStops = route.stops.filter((s) => Number.isFinite(s.dest_lat) && Number.isFinite(s.dest_lng));
              if (validStops.length === 0) return null;
              let depotPos: [number, number] | null = null;
              if (warehouses.length > 0) {
                depotPos = [warehouses[0].location_lat, warehouses[0].location_lng];
              }
              const points: [number, number][] = [
                ...(depotPos ? [depotPos] : []),
                ...validStops.map((s) => [s.dest_lat, s.dest_lng] as [number, number]),
                ...(depotPos ? [depotPos] : []),
              ];
              return (
                <Polyline key={`default-${route.route_id}`} positions={points} pathOptions={{ color: '#9ca3af', weight: 3, opacity: 0.65, dashArray: '8, 8' }} />
              );
            })}

            {routes.map((route, idx) => {
              const color = routeColors[idx % routeColors.length];
              const depot = warehouses.find(w => typeof w.location_lat === 'number' && typeof w.location_lng === 'number') || { location_lat: 40.7128, location_lng: -74.0060 };
              const validStops = (route.stops || []).filter(s => typeof s.dest_lat === 'number' && typeof s.dest_lng === 'number' && !isNaN(s.dest_lat) && !isNaN(s.dest_lng));
              const points: [number, number][] = [
                [depot.location_lat, depot.location_lng],
                ...validStops.map(s => [s.dest_lat, s.dest_lng] as [number, number])
              ];

              return (
                <React.Fragment key={route.route_id}>
                  {points.length >= 2 && <Polyline positions={points} color={color} weight={4} opacity={0.8} dashArray="8, 8" />}
                  {validStops.map((stop) => (
                    <Marker key={stop.order_id} position={[stop.dest_lat, stop.dest_lng]} icon={stopIcon}>
                      <Popup>
                        <div className="p-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400">
                            STOP #{stop.sequence}
                          </span>
                          <h4 className="font-bold text-white text-xs mt-1">{stop.customer_name}</h4>
                          <p className="text-[11px] text-gray-400">ETA: {stop.eta}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </React.Fragment>
              );
            })}
          </MapContainer>
        </div>

        <div className="space-y-4">
          <div className="glass-panel p-4 rounded-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-sky-400" />
              VRP Solution Summary
            </h3>
            <div className="text-xs text-gray-400 space-y-1">
              <div>Solver Engine: <span className="font-semibold text-white">{solverEngine || 'Clarke-Wright Savings + 2-Opt'}</span></div>
              <div>Total Active Routes: <span className="font-semibold text-white">{routes.length}</span></div>
              {typeof totalDistanceKm === 'number' && (
                <div>Total Distance: <span className="font-semibold text-sky-400">{totalDistanceKm.toFixed(1)} km</span></div>
              )}
              <div>Estimated Fuel: <span className="font-semibold text-emerald-400">
                {routes.reduce((acc, r) => acc + r.fuel_estimate_liters, 0).toFixed(1)} Liters
              </span></div>
              <div>CO2 Footprint: <span className="font-semibold text-purple-400">
                {routes.reduce((acc, r) => acc + r.carbon_emissions_kg, 0).toFixed(1)} kg
              </span></div>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-2xl max-h-[420px] overflow-y-auto space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assigned Delivery Routes</h4>
            {routes.map((route) => (
              <div
                key={route.route_id}
                onClick={() => setSelectedRoute(route)}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${
                  selectedRoute?.route_id === route.route_id
                    ? 'bg-sky-500/10 border-sky-500/40 shadow-lg shadow-sky-500/10'
                    : 'bg-gray-900/40 border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400">{route.route_id}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                    {route.stops.length} STOPS
                  </span>
                </div>
                <div className="text-xs text-white font-medium mt-1">{route.vehicle_name} ({route.vehicle_id})</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
