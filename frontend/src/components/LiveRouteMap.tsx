import React, { useEffect, useMemo, useState } from 'react';
import type { RouteItem, RouteLocation, WarehouseItem, VehicleItem, RouteObstacle, RouteComparison, ConstraintReport } from '../types';
import { RefreshCw, Navigation, Zap, CheckCircle2, Route as RouteIcon, MapPin, Flag, CircleDot, Construction, ShieldCheck } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SavingsBanner } from './SavingsBanner';

interface LiveRouteMapProps {
  warehouses: WarehouseItem[];
  vehicles: VehicleItem[];
  routes: RouteItem[];
  defaultRoutes: RouteItem[];
  /** Driver-reported path obstacles drawn as red no-go zones on the map. */
  obstacles?: RouteObstacle[];
  /** Naive-vs-optimized fleet-wide savings from last optimize run. */
  routeComparison?: RouteComparison | null;
  /** Constraint audit: excluded vehicles + cheapest-feasible-vehicle selection policy. */
  constraintReport?: ConstraintReport | null;
  onOptimize: (vehicleId?: string) => void;
  isOptimizing: boolean;
  solverEngine?: string;
  totalDistanceKm?: number;
  defaultDistanceKm?: number;
  lastRunAt?: string;
  optimizedAtLeastOnce: boolean;
  selectedVehicleId?: string;
  onSelectVehicle?: (vehicleId: string) => void;
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

// Green = trip start (vehicle / depot), Red = trip end (final drop).
// Bigger pins with a white ring + label badge so start/end are unmistakable.
const endpointIcon = (color: string, label: string): L.DivIcon =>
  new L.DivIcon({
    className: 'logimind-endpoint-pin',
    html: `<div style="position:relative;width:38px;height:48px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.55))">
      <svg viewBox="0 0 24 36" width="38" height="48"><path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="${color}" stroke="#ffffff" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="#ffffff"/><text x="12" y="15.5" text-anchor="middle" font-size="9" font-weight="900" fill="${color}" font-family="Arial,sans-serif">${label}</text></svg>
    </div>`,
    iconSize: [38, 48],
    iconAnchor: [19, 48],
    popupAnchor: [0, -44],
  });

const startIcon = endpointIcon('#16a34a', 'S');
const endIcon = endpointIcon('#dc2626', 'E');

// Small numbered dot for intermediate stops (no more identical green pins everywhere).
const numberedStopIcon = (n: number): L.DivIcon =>
  new L.DivIcon({
    className: 'logimind-stop-dot',
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:#0ea5e9;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,.5)">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -12],
  });

const routeColors = ['#38bdf8', '#34d399', '#a855f7', '#f59e0b', '#ec4899'];

type LatLng = [number, number];

/** Human-readable start/end text for a route card.
 *  Prefers backend start_location/end_location; derives from depot + last
 *  stop so even stale/cached routes render meaningful text. */
export function routeStartText(route: RouteItem, warehouses: WarehouseItem[]): string {
  const loc: RouteLocation | null | undefined = route.start_location;
  if (loc?.label) return loc.label;
  if (loc?.name) {
    const city = loc.city ? `, ${loc.city}` : '';
    const state = loc.state ? ` (${loc.state})` : '';
    return `${loc.name}${city}${state}`;
  }
  const depot = warehouses[0];
  if (depot) {
    const state = depot.state ? ` (${depot.state})` : '';
    return `${depot.name}, ${depot.city}${state}`;
  }
  return 'Depot origin';
}

export function routeEndText(route: RouteItem): string {
  const loc: RouteLocation | null | undefined = route.end_location;
  if (loc?.label) return loc.label;
  if (loc?.name) {
    return loc.order_id ? `${loc.name} (${loc.order_id})` : loc.name;
  }
  const stops = route.stops || [];
  const last = stops[stops.length - 1];
  if (last) {
    const oid = (last as { order_id?: string }).order_id;
    return oid ? `${last.customer_name} (${oid})` : last.customer_name;
  }
  return 'No stops assigned';
}

/** Snap a straight depot→stops line onto real roads via OSRM (free, no key).
 *  Falls back to the straight line if the service is unreachable. */
async function fetchRoadGeometry(points: LatLng[]): Promise<LatLng[]> {
  if (points.length < 2) return points;
  const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  const geom = data?.routes?.[0]?.geometry?.coordinates as Array<[number, number]> | undefined;
  if (!geom || geom.length < 2) throw new Error('OSRM empty geometry');
  return geom.map(([lng, lat]) => [lat, lng] as LatLng);
}

/** Auto-zoom the map to the focused route. */
const FitRouteBounds: React.FC<{ points: LatLng[] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points.map(([lat, lng]) => [lat, lng] as [number, number])), { padding: [36, 36] });
    }
  }, [map, points.join('|')]);
  return null;
};

export const LiveRouteMap: React.FC<LiveRouteMapProps> = ({ warehouses, vehicles, routes, defaultRoutes, obstacles = [], routeComparison = null, constraintReport = null, onOptimize, isOptimizing, solverEngine, totalDistanceKm, defaultDistanceKm, lastRunAt, optimizedAtLeastOnce, selectedVehicleId = 'ALL', onSelectVehicle, planner }) => {
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const activeObstacles = useMemo(() => obstacles.filter((o) => o.status === 'ACTIVE'), [obstacles]);

  const activeVehicle = selectedVehicleId && selectedVehicleId !== 'ALL' ? selectedVehicleId : 'ALL';
  // When a single vehicle is picked, spotlight only its route(s) + marker on the map.
  const visibleRoutes = activeVehicle === 'ALL' ? routes : routes.filter((r) => r.vehicle_id === activeVehicle);
  const visibleDefaultRoutes = activeVehicle === 'ALL' ? defaultRoutes : defaultRoutes.filter((r) => r.vehicle_id === activeVehicle);
  const visibleVehicles = activeVehicle === 'ALL' ? vehicles : vehicles.filter((v) => (v.id || (v as any).vehicle_id) === activeVehicle);

  useEffect(() => {
    setSelectedRoute((prev) => {
      if (visibleRoutes.length === 0) return null;
      if (prev && visibleRoutes.some((r) => r.route_id === prev.route_id)) return prev;
      return visibleRoutes[0];
    });
  }, [routes, activeVehicle]);

  // ---- Realistic road geometry -------------------------------------------
  // For each visible route, resolve depot → stop1 → stop2 … onto real roads
  // via OSRM so the polyline follows streets instead of straight segments.
  const [roadPaths, setRoadPaths] = useState<Record<string, LatLng[]>>({});
  const [roadLoading, setRoadLoading] = useState<boolean>(false);

  const straightPaths = useMemo(() => {
    const depot = warehouses.find((w) => typeof w.location_lat === 'number' && typeof w.location_lng === 'number');
    const depotPt: LatLng | null = depot ? [depot.location_lat, depot.location_lng] : null;
    const out: Record<string, LatLng[]> = {};
    const collect = (route: RouteItem) => {
      // Backend obstacle-aware geometry (depot + detour via-points + stops)
      // wins when present so the drawn path visibly steers around blockages.
      if (Array.isArray(route.geometry) && route.geometry.length >= 2) {
        out[route.route_id] = route.geometry;
        return;
      }
      const validStops = (route.stops || []).filter(
        (s) => typeof s.dest_lat === 'number' && typeof s.dest_lng === 'number' && !isNaN(s.dest_lat) && !isNaN(s.dest_lng)
      );
      const pts: LatLng[] = [
        ...(depotPt ? [depotPt] : []),
        ...validStops.map((s) => [s.dest_lat, s.dest_lng] as LatLng),
      ];
      if (pts.length >= 2) out[route.route_id] = pts;
    };
    for (const route of visibleRoutes) collect(route);
    for (const route of visibleDefaultRoutes) {
      if (!out[route.route_id]) collect(route);
    }
    return out;
  }, [visibleRoutes, visibleDefaultRoutes, warehouses]);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(straightPaths);
    if (entries.length === 0) {
      setRoadPaths({});
      setRoadLoading(false);
      return;
    }
    setRoadLoading(true);
    (async () => {
      const next: Record<string, LatLng[]> = {};
      // Sequential to stay kind to the free OSRM demo server.
      for (const [routeId, pts] of entries) {
        try {
          next[routeId] = await fetchRoadGeometry(pts);
        } catch {
          next[routeId] = pts; // offline fallback: straight segment
        }
        if (cancelled) return;
      }
      if (!cancelled) {
        setRoadPaths(next);
        setRoadLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(Object.keys(straightPaths)), JSON.stringify(Object.values(straightPaths).flat())]);

  const focusPoints: LatLng[] = useMemo(() => {
    if (selectedRoute && roadPaths[selectedRoute.route_id]?.length) return roadPaths[selectedRoute.route_id];
    if (selectedRoute && straightPaths[selectedRoute.route_id]?.length) return straightPaths[selectedRoute.route_id];
    const first = Object.values(roadPaths)[0] || Object.values(straightPaths)[0];
    return first || [];
  }, [selectedRoute, roadPaths, straightPaths]);

  // Geographic center of India — routes now span Mumbai <-> Delhi <-> Chennai/Kolkata.
  const mapCenter: [number, number] = [22.0, 79.0];

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

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={activeVehicle}
            onChange={(e) => onSelectVehicle?.(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-gray-900/80 border border-gray-700 text-xs text-white font-semibold outline-none focus:border-sky-500/60 min-w-[200px]"
            title="Choose which vehicle's optimized route to show"
          >
            <option value="ALL">All vehicles</option>
            {vehicles.map((v) => {
              const vid = v.id || (v as any).vehicle_id;
              return (
                <option key={vid} value={vid}>
                  {vid} — {v.name}
                </option>
              );
            })}
          </select>
          <button
            onClick={() => onOptimize(activeVehicle)}
            disabled={isOptimizing}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-sky-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
            <span>{isOptimizing ? 'Re-Solving Routes...' : activeVehicle === 'ALL' ? 'Optimize Route' : `Optimize ${activeVehicle}`}</span>
          </button>
        </div>
      </div>

      {activeVehicle !== 'ALL' && (
        <div className="glass-panel px-4 py-2.5 rounded-2xl text-xs text-emerald-300 border border-emerald-500/25 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Showing optimized route for <span className="font-bold">{activeVehicle}</span>
          {visibleRoutes.length > 0 && (
            <>— {visibleRoutes[0].stops.length} stops · {visibleRoutes[0].total_distance_km.toFixed(1)} km · {visibleRoutes[0].fuel_estimate_liters.toFixed(1)} L</>
          )}
          {routes.length > 0 && visibleRoutes.length === 0 && (
            <span className="text-amber-300">— no route yet for this vehicle, press Optimize.</span>
          )}
        </div>
      )}

      <div className="glass-panel px-4 py-2.5 rounded-2xl text-xs text-gray-300 border border-gray-800 flex items-center gap-4 flex-wrap">
        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-green-500" /> <b className="text-green-400">START</b> trip origin</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-500 border border-white inline-block" /> numbered delivery stop</span>
        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-red-500" /> <b className="text-red-400">END</b> final drop</span>
        <span className="ml-auto text-[11px] text-gray-500">{roadLoading ? 'Snapping path to real roads…' : 'Road-following path via OSRM'}</span>
      </div>

      {planner}

      <SavingsBanner defaultKm={defaultDistanceKm} optimizedKm={totalDistanceKm} visible={optimizedAtLeastOnce} comparison={routeComparison} />

      {constraintReport && (
        <div className="glass-panel px-4 py-3 rounded-2xl border border-gray-800 flex items-start gap-3 text-xs text-gray-300">
          <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sky-300">Constraint routing audit</p>
            <p className="text-[10px] leading-snug mt-0.5">
              {constraintReport.vehicles_dispatched} of {constraintReport.vehicles_evaluated} vehicles dispatched
              {constraintReport.excluded_vehicles.length > 0 && (
                <span className="text-rose-400 ml-2">· {constraintReport.excluded_vehicles.length} excluded</span>
              )}
            </p>
            <p className="text-[10px] text-gray-500 mt-1 italic">
              {constraintReport.selection}{' '}
              {constraintReport.excluded_vehicles.map((v) => `${v.vehicle_name}: ${v.reasons.join('; ')}`).join('; ')}
            </p>
          </div>
        </div>
      )}

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
            {activeObstacles.length > 0 && (
              <span className="inline-flex items-center gap-1 ml-2">
                <span className="inline-block w-3 h-3 rounded-full bg-rose-500/30 border-2 border-rose-500" /> reported obstacle
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-panel lg:col-span-2 p-2 rounded-2xl h-[560px] relative overflow-hidden border border-gray-800">
          <MapContainer center={mapCenter} zoom={5} className="logimind-map" style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {focusPoints.length >= 2 && <FitRouteBounds points={focusPoints} />}

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

            {visibleVehicles.filter(v => typeof v.current_lat === 'number' && typeof v.current_lng === 'number' && !isNaN(v.current_lat) && !isNaN(v.current_lng)).map((v) => (
              <Marker key={v.id || v.name} position={[v.current_lat, v.current_lng]} icon={vehicleIcon}>
                <Popup>
                  <div className="p-1">
                    <h4 className="font-bold text-emerald-400 text-sm">{v.id} - {v.name}</h4>
                    <p className="text-xs text-gray-300">Status: {v.status}</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Driver-reported obstacles: red dashed no-go zones the optimizer avoids */}
            {activeObstacles.map((ob) => (
              <Circle
                key={ob.obstacle_id}
                center={[ob.latitude, ob.longitude]}
                radius={ob.radius_km * 1000}
                pathOptions={{
                  color: '#fb7185',
                  weight: 2,
                  dashArray: '6, 6',
                  fillColor: '#ef4444',
                  fillOpacity: 0.15,
                }}
              >
                <Popup>
                  <div className="p-1">
                    <h4 className="font-bold text-rose-600 text-sm flex items-center gap-1">
                      <Construction className="w-3.5 h-3.5" /> {(ob.obstacle_type || 'OTHER').replace(/_/g, ' ')}
                    </h4>
                    <p className="text-xs text-gray-700">{ob.description || 'No description'}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      ~{Number(ob.radius_km) || 0} km no-go zone{ob.reported_by ? ` · reported by ${ob.reported_by}` : ''}
                    </p>
                  </div>
                </Popup>
              </Circle>
            ))}

            {/* Grey dashed baseline (road-snapped when available) */}
            {visibleDefaultRoutes.map((route) => {
              if (!route || !Array.isArray(route.stops) || route.stops.length === 0) return null;
              const validStops = route.stops.filter((s) => Number.isFinite(s.dest_lat) && Number.isFinite(s.dest_lng));
              if (validStops.length === 0) return null;
              const pts = roadPaths[route.route_id]?.length >= 2 ? roadPaths[route.route_id] : straightPaths[route.route_id];
              if (!pts || pts.length < 2) return null;
              return (
                <Polyline key={`default-${route.route_id}`} positions={pts} pathOptions={{ color: '#9ca3af', weight: 3, opacity: 0.65, dashArray: '8, 8' }} />
              );
            })}

            {visibleRoutes.map((route, idx) => {
              // Single-vehicle view: solid BLUE path (#3b82f6). ALL view: distinct color per route.
              const color = activeVehicle === 'ALL' ? routeColors[idx % routeColors.length] : '#3b82f6';
              const pts = roadPaths[route.route_id]?.length >= 2 ? roadPaths[route.route_id] : straightPaths[route.route_id];
              if (!pts || pts.length < 2) return null;
              const isFocused = !selectedRoute || selectedRoute.route_id === route.route_id;
              const validStops = (route.stops || []).filter(s => typeof s.dest_lat === 'number' && typeof s.dest_lng === 'number' && !isNaN(s.dest_lat) && !isNaN(s.dest_lng));
              const lastStop = validStops[validStops.length - 1];
              const midStops = validStops.slice(0, Math.max(0, validStops.length - 1));
              const startLabel = routeStartText(route, warehouses);
              const endLabel = routeEndText(route);

              return (
                <React.Fragment key={route.route_id}>
                  <Polyline positions={pts} pathOptions={{ color: '#ffffff', weight: isFocused ? 8 : 6, opacity: isFocused ? 0.35 : 0.15 }} />
                  <Polyline positions={pts} pathOptions={{ color, weight: isFocused ? 5 : 3.5, opacity: isFocused ? 1 : 0.5 }} />
                  {isFocused && (
                    <Marker position={pts[0]} icon={startIcon} zIndexOffset={1000}>
                      <Popup>
                        <div className="p-1">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-green-600 text-white">START</span>
                          <h4 className="font-bold text-white text-xs mt-1">{startLabel}</h4>
                          <p className="text-[11px] text-gray-400">{route.vehicle_id} · {route.vehicle_name} begins route</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  {isFocused && lastStop && (
                    <Marker position={[lastStop.dest_lat, lastStop.dest_lng]} icon={endIcon} zIndexOffset={1000}>
                      <Popup>
                        <div className="p-1">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-600 text-white">END</span>
                          <h4 className="font-bold text-white text-xs mt-1">{endLabel}</h4>
                          <p className="text-[11px] text-gray-400">Final stop · ETA {lastStop.eta}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  {midStops.map((stop) => (
                    <Marker key={stop.order_id} position={[stop.dest_lat, stop.dest_lng]} icon={numberedStopIcon(stop.sequence)}>
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
              {activeVehicle !== 'ALL' && (
                <div>Focused Vehicle: <span className="font-semibold text-emerald-300">{activeVehicle}</span></div>
              )}
              <div>Total Active Routes: <span className="font-semibold text-white">{visibleRoutes.length}</span></div>
              {activeObstacles.length > 0 && (
                <div>
                  Active Obstacles: <span className="font-semibold text-rose-400">{activeObstacles.length}</span>
                  <span className="text-rose-300/70"> (optimizer avoids these zones)</span>
                </div>
              )}
              {typeof totalDistanceKm === 'number' && (
                <div>Total Distance: <span className="font-semibold text-sky-400">{totalDistanceKm.toFixed(1)} km</span></div>
              )}
              <div>Estimated Fuel: <span className="font-semibold text-emerald-400">
                {visibleRoutes.reduce((acc, r) => acc + r.fuel_estimate_liters, 0).toFixed(1)} Liters
              </span></div>
              <div>CO2 Footprint: <span className="font-semibold text-purple-400">
                {visibleRoutes.reduce((acc, r) => acc + r.carbon_emissions_kg, 0).toFixed(1)} kg
              </span></div>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-2xl max-h-[420px] overflow-y-auto space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              {activeVehicle === 'ALL' ? 'Assigned Delivery Routes' : `Route · ${activeVehicle}`}
            </h4>
            {visibleRoutes.length === 0 && routes.length > 0 && activeVehicle !== 'ALL' && (
              <p className="text-[11px] text-amber-300">No optimized route for {activeVehicle} yet — press “Optimize {activeVehicle}”.</p>
            )}
            {visibleRoutes.map((route) => (
              <div
                key={route.route_id}
                onClick={() => setSelectedRoute(route)}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${
                  selectedRoute?.route_id === route.route_id
                    ? 'bg-sky-500/10 border-sky-500/40 shadow-lg shadow-sky-500/10'
                    : 'bg-gray-900/40 border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-sky-400">{route.route_id}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                      {route.stops.length} STOPS
                    </span>
                    {!!route.obstacles_avoided?.length && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 font-bold border border-rose-500/30"
                        title={route.obstacles_avoided.map((a) => (a?.obstacle_type || 'OTHER').replace(/_/g, ' ')).join(', ')}
                      >
                        AVOIDS {route.obstacles_avoided.length} OBSTACLE{route.obstacles_avoided.length > 1 ? 'S' : ''}
                      </span>
                    )}
                    {route.vehicle_selection && (
                      <>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold border ${route.vehicle_selection.status === 'FEASIBLE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}
                          title={route.vehicle_selection.reason}
                        >
                          {route.vehicle_selection.status === 'FEASIBLE' ? 'CHEAPEST FEASIBLE VEHICLE' : 'RANGE/RISK VIOLATED'}
                        </span>
                        {route.vehicle_selection.failure_risk_pct != null && route.vehicle_selection.failure_risk_pct >= 50 && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/30"
                            title="Failure risk above 50%"
                          >
                            RISK {route.vehicle_selection.failure_risk_pct}%
                          </span>
                        )}
                        {route.vehicle_selection.rejected_candidates?.length && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded bg-gray-500/10 text-gray-400 font-bold border border-gray-600/30"
                            title={route.vehicle_selection.rejected_candidates.map((c) => c.reasons.join('; ')).join(' · ')}
                          >
                            {route.vehicle_selection.rejected_candidates.length} VEHICLE{route.vehicle_selection.rejected_candidates.length > 1 ? 'S' : ''} SCREENED OUT
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="text-xs text-white font-medium mt-1">{route.vehicle_name} ({route.vehicle_id})</div>
                <div className="mt-2 space-y-1.5 rounded-lg bg-gray-950/60 border border-gray-800/80 px-2.5 py-2">
                  <div className="flex items-start gap-1.5 text-[11px] leading-snug">
                    <Flag className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-gray-500 font-semibold shrink-0">Start:</span>
                    <span className="text-gray-200 font-medium break-words">{routeStartText(route, warehouses)}</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-[11px] leading-snug">
                    <CircleDot className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-gray-500 font-semibold shrink-0">End:</span>
                    <span className="text-gray-200 font-medium break-words">{routeEndText(route)}</span>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 mt-1.5">
                  Driver {route.driver_id} · {route.total_distance_km} km · {route.fuel_estimate_liters} L fuel · {route.carbon_emissions_kg} kg CO2
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
