import { useEffect, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { LiveRouteMap } from './components/LiveRouteMap';
import { WarehouseHub } from './components/WarehouseHub';
import { FleetHealthPanel } from './components/FleetHealthPanel';
import { CopilotChatDrawer } from './components/CopilotChatDrawer';
import { DigitalTwinConsole } from './components/DigitalTwinConsole';
import { AuthModal } from './components/auth/AuthModal';
import { DriverPortal } from './components/DriverPortal';
import { FleetManagerPortal } from './components/FleetManagerPortal';
import { WarehouseManagerPortal } from './components/WarehouseManagerPortal';

import { fetchDashboardKPIs, fetchWarehouses, fetchVehicles, fetchScenarioOrders, fetchDefaultRoutes, optimizeRoutes } from './services/api';
import type { DashboardKPIs, WarehouseItem, VehicleItem, RouteItem, ScenarioOrder, UserRole } from './types';
import { ScenarioPlanner } from './components/ScenarioPlanner';

const ROLE_DEFAULT_TAB: Record<UserRole, string> = {
  admin: 'dashboard',
  fleet_manager: 'fleetmgr',
  warehouse_manager: 'whmgr',
  driver: 'driver',
};

function MainApp() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [role, setRole] = useState<UserRole>('admin');
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [defaultRoutes, setDefaultRoutes] = useState<RouteItem[]>([]);
  const [orders, setOrders] = useState<ScenarioOrder[]>([]);
  const [loadingVrp, setLoadingVrp] = useState<boolean>(false);
  const [optimizedOnce, setOptimizedOnce] = useState<boolean>(false);
  const [vrpMeta, setVrpMeta] = useState<{ solverEngine?: string; totalDistanceKm?: number; defaultDistanceKm?: number; lastRunAt?: string }>({});

  const [driverId, setDriverId] = useState<string>('DRV-01');

  const loadData = async () => {
    try {
      const [kpiRes, whRes, vehRes, orderRes, defRes] = await Promise.all([
        fetchDashboardKPIs(),
        fetchWarehouses(),
        fetchVehicles(),
        fetchScenarioOrders().catch(() => [] as ScenarioOrder[]),
        fetchDefaultRoutes().catch(() => ({ routes: [] as RouteItem[], total_distance_km: 0, status: 'ERROR', solver_engine: 'default' })),
      ]);

      setKpis(kpiRes);
      setWarehouses(whRes);
      setVehicles(vehRes);
      setOrders(orderRes);
      // Default-first UX: the map shows the naive baseline immediately;
      // the optimized result appears only after the user presses "Optimize Route".
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
      console.error("Error loading LogiMind platform data:", e);
    }
  };

  const reloadScenario = async () => {
    try {
      const [whRes, vehRes, orderRes, defRes] = await Promise.all([
        fetchWarehouses(),
        fetchVehicles(),
        fetchScenarioOrders(),
        fetchDefaultRoutes(),
      ]);
      setWarehouses(whRes);
      setVehicles(vehRes);
      setOrders(orderRes);
      setDefaultRoutes(defRes.routes || []);
      setVrpMeta((prev) => ({ ...prev, defaultDistanceKm: defRes.total_distance_km }));
    } catch (e) {
      console.error("Error reloading scenario:", e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunVrpOptimization = async () => {
    setLoadingVrp(true);
    const startedAt = Date.now();
    try {
      const vrpRes = await optimizeRoutes();
      setRoutes(vrpRes.routes || []);
      setOptimizedOnce(true);
      setVrpMeta((prev) => ({
        ...prev,
        solverEngine: vrpRes.solver_engine,
        totalDistanceKm: vrpRes.total_distance_km,
        lastRunAt: new Date().toLocaleTimeString(),
      }));
    } catch (e) {
      console.error(e);
    } finally {
      // Keep the spinner visible long enough for the re-run to be perceptible
      const elapsed = Date.now() - startedAt;
      window.setTimeout(() => setLoadingVrp(false), Math.max(0, 700 - elapsed));
    }
  };

  const handleExecuteCopilotAction = (action: string) => {
    if (action === 'NAVIGATE_SIMULATOR') {
      setActiveTab('simulator');
      setIsCopilotOpen(false);
    } else if (action === 'RUN_VRP') {
      setActiveTab('routemap');
      handleRunVrpOptimization();
      setIsCopilotOpen(false);
    } else if (action === 'REBALANCE_LP') {
      setActiveTab('warehouse');
      setIsCopilotOpen(false);
    } else if (action === 'MAINTENANCE_SCHEDULE') {
      setActiveTab('fleet');
      setIsCopilotOpen(false);
    }
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setActiveTab(ROLE_DEFAULT_TAB[newRole]);
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-gray-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        role={role}
        onRoleChange={handleRoleChange}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto">
        {activeTab === 'dashboard' && role === 'admin' && (
          <ExecutiveDashboard kpis={kpis} onNavigate={setActiveTab} />
        )}

        {activeTab === 'routemap' && role === 'admin' && (
          <LiveRouteMap
            warehouses={warehouses}
            vehicles={vehicles}
            routes={routes}
            defaultRoutes={defaultRoutes}
            onOptimize={handleRunVrpOptimization}
            isOptimizing={loadingVrp}
            solverEngine={vrpMeta.solverEngine}
            totalDistanceKm={vrpMeta.totalDistanceKm}
            defaultDistanceKm={vrpMeta.defaultDistanceKm}
            lastRunAt={vrpMeta.lastRunAt}
            optimizedAtLeastOnce={optimizedOnce}
            planner={<ScenarioPlanner orders={orders} warehouses={warehouses} onReload={reloadScenario} />}
          />
        )}

        {activeTab === 'warehouse' && role === 'admin' && (
          <WarehouseHub warehouses={warehouses} />
        )}

        {activeTab === 'fleet' && role === 'admin' && (
          <FleetHealthPanel vehicles={vehicles} />
        )}

        {activeTab === 'simulator' && role === 'admin' && (
          <DigitalTwinConsole />
        )}

        {activeTab === 'fleetmgr' && role === 'fleet_manager' && (
          <FleetManagerPortal
            vehicles={vehicles}
            routes={routes}
            onOptimize={handleRunVrpOptimization}
            isOptimizing={loadingVrp}
            onReload={reloadScenario}
          />
        )}

        {activeTab === 'whmgr' && role === 'warehouse_manager' && (
          <WarehouseManagerPortal warehouses={warehouses} onReload={reloadScenario} />
        )}

        {activeTab === 'driver' && role === 'driver' && (
          <DriverPortal
            driverId={driverId}
            onStopCompleted={() => {}}
          />
        )}
      </main>

      <CopilotChatDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        onExecuteAction={handleExecuteCopilotAction}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
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
