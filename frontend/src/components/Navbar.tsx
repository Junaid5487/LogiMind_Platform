import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Navigation, Warehouse, Activity, Cpu, Bot, User, LogOut, UserCheck, Users, Truck, Boxes } from 'lucide-react';
import type { UserRole } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCopilot: () => void;
  onOpenAuth: () => void;
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const ALL_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { id: 'routemap', label: 'Live Route VRP Map', icon: Navigation, roles: ['admin'] },
  { id: 'warehouse', label: 'Warehouse Hub', icon: Warehouse, roles: ['admin'] },
  { id: 'fleet', label: 'Fleet Health & XAI', icon: Activity, roles: ['admin'] },
  { id: 'simulator', label: 'Digital Twin Console', icon: Cpu, roles: ['admin'] },
  { id: 'driver', label: 'Driver Portal', icon: UserCheck, roles: ['driver'] },
  { id: 'fleetmgr', label: 'Fleet Operations', icon: Truck, roles: ['fleet_manager'] },
  { id: 'whmgr', label: 'Inventory Control', icon: Boxes, roles: ['warehouse_manager'] },
];

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenCopilot, onOpenAuth, role, onRoleChange }) => {
  const { token, user, logout } = useAuth();

  const navItems = ALL_NAV_ITEMS.filter(item => item.roles.includes(role));

  const roleSwitcher = (
    <div className="flex items-center gap-1 glass-card px-2 py-1 rounded-xl border border-gray-800">
      <span className="text-[10px] text-gray-400 font-semibold uppercase">Role:</span>
      <select
        value={role}
        onChange={(e) => onRoleChange(e.target.value as UserRole)}
        className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
      >
        <option value="admin" className="text-gray-200">Administrator</option>
        <option value="fleet_manager" className="text-gray-200">Fleet Manager</option>
        <option value="warehouse_manager" className="text-gray-200">Warehouse Manager</option>
        <option value="driver" className="text-gray-200">Driver</option>
      </select>
    </div>
  );

  return (
    <nav className="glass-panel sticky top-0 z-40 px-6 py-3 border-b border-gray-800 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-wide">LogiMind AI</h1>
          <p className="text-[10px] text-sky-400 font-semibold uppercase tracking-wider">Enterprise Fleet & Logistics OS</p>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-1 flex-wrap">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                isActive
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-md'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {roleSwitcher}
        <button
          onClick={onOpenCopilot}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-2 shadow-lg shadow-purple-500/10"
        >
          <Bot className="w-4 h-4 text-purple-400" />
          <span>RAG Copilot</span>
        </button>

        {token && user ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-300 font-medium hidden sm:inline">{user.full_name || user.email}</span>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold transition-all flex items-center gap-1.5 border border-gray-700"
          >
            <User className="w-4 h-4 text-sky-400" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </nav>
  );
};
