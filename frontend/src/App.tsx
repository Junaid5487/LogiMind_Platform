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

import { fetchDashboardKPIs, fetchWarehouses, fetchVehicles, optimizeRoutes } from './services/api';
import type { DashboardKPIs, WarehouseItem, VehicleItem, RouteItem } from './types';

function MainApp() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loadingVrp, setLoadingVrp] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const [kpiRes, whRes, vehRes, vrpRes] = await Promise.all([
        fetchDashboardKPIs(),
        fetchWarehouses(),
        fetchVehicles(),
        optimizeRoutes()
      ]);

      setKpis(kpiRes);
      setWarehouses(whRes);
      setVehicles(vehRes);
      setRoutes(vrpRes.routes || []);
    } catch (e) {
      console.error("Error loading LogiMind platform data:", e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunVrpOptimization = async () => {
    setLoadingVrp(true);
    try {
      const vrpRes = await optimizeRoutes();
      setRoutes(vrpRes.routes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingVrp(false);
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

  return (
    <div className="min-h-screen bg-[#0b0f17] text-gray-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto">
        {activeTab === 'dashboard' && (
          <ExecutiveDashboard kpis={kpis} onNavigate={setActiveTab} />
        )}

        {activeTab === 'routemap' && (
          <LiveRouteMap
            warehouses={warehouses}
            vehicles={vehicles}
            routes={routes}
            onOptimize={handleRunVrpOptimization}
            isOptimizing={loadingVrp}
          />
        )}

        {activeTab === 'warehouse' && (
          <WarehouseHub warehouses={warehouses} />
        )}

        {activeTab === 'fleet' && (
          <FleetHealthPanel vehicles={vehicles} />
        )}

        {activeTab === 'simulator' && (
          <DigitalTwinConsole />
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
