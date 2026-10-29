import { useEffect, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { LiveRouteMap } from './components/LiveRouteMap';
import { WarehouseHub } from './components/WarehouseHub';
import { FleetHealthPanel } from './components/FleetHealthPanel';
import { DigitalTwinConsole } from './components/DigitalTwinConsole';
import { CopilotChatDrawer } from './components/CopilotChatDrawer';
import { AuthModal } from './components/auth/AuthModal';
import { DriverPortal } from './components/DriverPortal';
import { FleetManagerPortal } from './components/FleetManagerPortal';
import { WarehouseManagerPortal } from './components/WarehouseManagerPortal';
import { fetchDashboardKPIs, fetchWarehouses, fetchVehicles, fetchScenarioOrders, fetchDefaultRoutes, fetchObstacles, optimizeRoutes } from './services/api';
import type { DashboardKPIs, WarehouseItem, VehicleItem, RouteItem, ScenarioOrder, UserRole, RouteObstacle, RouteComparison, ConstraintReport } from './types';
import { ScenarioPlanner } from './components/ScenarioPlanner';
import { DatabaseEntry } from './components/DatabaseEntry';
import { LiveChanges } from './components/LiveChanges';

function MainApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [defaultRoutes, setDefaultRoutes] = useState<RouteItem[]>([]);
  const [obstacles, setObstacles] = useState<RouteObstacle[]>([]);
  const [orders, setOrders] = useState<ScenarioOrder[]>([]);
  const [loadingVrp, setLoadingVrp] = useState(false);
  const [optimizedOnce, setOptimizedOnce] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('ALL');
  const [vrpMeta, setVrpMeta] = useState<{ solverEngine?: string; totalDistanceKm?: number; defaultDistanceKm?: number; lastRunAt?: string }>({});
  const [routeComparison, setRouteComparison] = useState<RouteComparison | null>(null);
  const [constraintReport, setConstraintReport] = useState<ConstraintReport | null>(null);
  const [driverId, setDriverId] = useState('DRV-01');
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  const loadData = async () => {
    try {
      const [kpiRes, whRes, vehRes, orderRes, defRes, obsRes] = await Promise.all([
        fetchDashboardKPIs(),
        fetchWarehouses(),
        fetchVehicles(),
        fetchScenarioOrders().catch(() => []),
        fetchDefaultRoutes().catch(() => ({ routes: [], total_distance_km: 0, status: 'ERROR', solver_engine: 'default' })),
        fetchObstacles().catch(() => []),
      ]);

      setKpis(kpiRes);
      setWarehouses(whRes);
      setVehicles(vehRes);
      setOrders(orderRes);
      setObstacles(obsRes);
      setDefaultRoutes(defRes.routes || []);
      setRoutes([]);
      setOptimizedOnce(false);
      setVrpMeta({
        solverEngine: undefined,
        totalDistanceKm: undefined,
        defaultDistanceKm: defRes.total_distance_km,
        lastRunAt: new Date().toLocaleTimeString(),
      });
    } catch (e) {
      console.error('Error loading LogiMind platform data:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunVrpOptimization = async () => {
    setLoadingVrp(true);
    try {
      const result = await optimizeRoutes();
      setRoutes(result.routes || []);
      setVrpMeta({
        solverEngine: result.solver_engine,
        totalDistanceKm: result.total_distance_km,
        defaultDistanceKm: result.total_distance_km,
        lastRunAt: new Date().toLocaleTimeString(),
      });
      setOptimizedOnce(true);
      if (result.comparison) {
        setRouteComparison({
          baseline_strategy: result.comparison.baseline_strategy,
          naive: result.comparison.naive,
          optimized: result.comparison.optimized,
          saved: result.comparison.saved,
          saved_pct: result.comparison.saved_pct,
        });
      }
      if (result.constraint_report) {
        setConstraintReport({
          capacity_kg: result.constraint_report.capacity_kg,
          range: result.constraint_report.range,
          risk: result.constraint_report.risk,
          selection: result.constraint_report.selection,
          excluded_vehicles: result.constraint_report.excluded_vehicles,
          vehicles_evaluated: result.constraint_report.vehicles_evaluated,
          vehicles_dispatched: result.constraint_report.vehicles_dispatched || 0,
        });
      }
    } catch (e) {
      console.error('Optimization error:', e);
    } finally {
      setLoadingVrp(false);
    }
  };

  const reloadScenario = async () => {
    loadData();
  };

  return (
    <div className='min-h-screen bg-[#0b0f17] text-gray-100 flex flex-col'>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCopilot={() => setIsCopilotOpen(true)}
      />

      <main className='flex-1 max-w-7xl w-full mx-auto'>
        {activeTab === 'dashboard' && (
          <ExecutiveDashboard
            kpis={kpis}
            vehicles={vehicles}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
            onOptimizeVehicle={handleRunVrpOptimization}
            isOptimizing={loadingVrp}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'routemap' && (
          <LiveRouteMap
            warehouses={warehouses}
            vehicles={vehicles}
            routes={routes}
            defaultRoutes={defaultRoutes}
            obstacles={obstacles}
            onOptimize={handleRunVrpOptimization}
            isOptimizing={loadingVrp}
            solverEngine={vrpMeta.solverEngine}
            totalDistanceKm={vrpMeta.totalDistanceKm}
            defaultDistanceKm={vrpMeta.defaultDistanceKm}
            lastRunAt={vrpMeta.lastRunAt}
            optimizedAtLeastOnce={optimizedOnce}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
            routeComparison={routeComparison}
            constraintReport={constraintReport}
            planner={<ScenarioPlanner orders={orders} warehouses={warehouses} onReload={reloadScenario} />}
          />
        )}

        {activeTab === 'warehouse' && (
          <WarehouseHub warehouses={warehouses} onChanged={reloadScenario} />
        )}

        {activeTab === 'fleet' && (
          <FleetHealthPanel vehicles={vehicles} />
        )}

        {activeTab === 'simulator' && (
          <DigitalTwinConsole />
        )}

        {activeTab === 'fleetmgr' && (
          <FleetManagerPortal
            vehicles={vehicles}
            routes={routes}
            onOptimize={handleRunVrpOptimization}
            isOptimizing={loadingVrp}
            onReload={reloadScenario}
            constraintReport={constraintReport}
          />
        )}

        {activeTab === 'whmgr' && (
          <WarehouseManagerPortal warehouses={warehouses} onReload={reloadScenario} />
        )}

        {activeTab === 'driver' && (
          <DriverPortal
            driverId={driverId}
            onStopCompleted={() => {}}
            onTripCompleted={reloadScenario}
          />
        )}

        {activeTab === 'database' && (
          <DatabaseEntry />
        )}

        {activeTab === 'livechanges' && (
          <LiveChanges />
        )}
      </main>

      <CopilotChatDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        onExecuteAction={() => {}}
      />

      <AuthModal
        isOpen={false}
        onClose={() => {}}
      />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
