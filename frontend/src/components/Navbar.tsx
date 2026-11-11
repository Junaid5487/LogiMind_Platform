// frontend/src/components/Navbar.tsx
import React from 'react';
import {
  Package,
  MapPin,
  Truck,
  Cpu,
  Database,
  BarChart3,
  FileText,
  HelpCircle,
  Box,
  TrendingUp,
} from 'lucide-react';

export const Navbar: React.FC<{
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCopilot: () => void;
}> = ({ activeTab, setActiveTab, onOpenCopilot }) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={18} /> },
    { id: 'mlpredictor', label: 'ML Predictor', icon: <TrendingUp size={18} /> },
    { id: 'routemap', label: 'Route Map', icon: <MapPin size={18} /> },
    { id: 'warehouse', label: 'Warehouse Hub', icon: <Package size={18} /> },
    { id: 'fleet', label: 'Fleet Health', icon: <Truck size={18} /> },
    { id: 'simulator', label: 'Digital Twin', icon: <Cpu size={18} /> },
    { id: 'fleetmgr', label: 'Fleet Manager', icon: <Package size={18} /> },
    { id: 'whmgr', label: 'Warehouse Manager', icon: <Box size={18} /> },
    { id: 'driver', label: 'Driver Portal', icon: <Truck size={18} /> },
    { id: 'database', label: 'Database', icon: <Database size={18} /> },
    { id: 'livechanges', label: 'Live Changes', icon: <FileText size={18} /> },
  ];

  return (
    <nav className='bg-[#111827] border-b border-[#2a3e5a] sticky top-0 z-50 shadow-md'>
      <div className='max-w-7xl mx-auto px-4 py-3 flex items-center justify-between'>
        <div className='flex items-center gap-3 overflow-x-auto no-scrollbar'>
          <h1 className='text-lg font-bold text-white tracking-wide shrink-0 mr-2 flex items-center gap-2'>
            <span className="text-blue-500 font-extrabold">Logi</span>Mind
          </h1>
          <div className='flex gap-1 flex-nowrap shrink-0'>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id || (tab.id === 'mlpredictor' && activeTab === 'forecast');
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#1f2937]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className='flex items-center gap-2 shrink-0 ml-3'>
          <button
            onClick={onOpenCopilot}
            className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-semibold hover:from-blue-500 hover:to-cyan-500 transition-all shadow-sm'
          >
            <HelpCircle size={16} />
            <span className='hidden sm:inline'>Copilot</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
