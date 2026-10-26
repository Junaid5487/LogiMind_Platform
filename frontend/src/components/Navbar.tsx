import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Navigation, Warehouse, Activity, Cpu, UserCheck, Truck, Boxes, Bot, Database } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

// Navigation items for each role
const adminNav: NavItem[] = [
  { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { id: 'routemap', label: 'Live Route VRP Map', icon: Navigation, roles: ['admin'] },
  { id: 'warehouse', label: 'Warehouse Hub', icon: Warehouse, roles: ['admin'] },
  { id: 'fleet', label: 'Fleet Health & XAI', icon: Activity, roles: ['admin'] },
  { id: 'simulator', label: 'Digital Twin Console', icon: Cpu, roles: ['admin'] },
  { id: 'database', label: 'Database Entry', icon: Database, roles: ['admin'] },
];

const fleetManagerNav: NavItem[] = [
  { id: 'fleetmgr', label: 'Fleet Operations', icon: Truck, roles: ['fleet_manager'] },
];

const warehouseManagerNav: NavItem[] = [
  { id: 'whmgr', label: 'Inventory Control', icon: Boxes, roles: ['warehouse_manager'] },
];

const driverNav: NavItem[] = [
  { id: 'driver', label: 'Driver Portal', icon: UserCheck, roles: ['driver'] },
];

// All nav items grouped by role
const roleNavs: { [key: string]: NavItem[] } = {
  admin: adminNav,
  fleet_manager: fleetManagerNav,
  warehouse_manager: warehouseManagerNav,
  driver: driverNav,
};

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCopilot: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenCopilot }) => {
  const [role, setRole] = useState<string>('admin');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  useEffect(() => {
    // Try to detect role from page body class
    const checkRole = () => {
      const bodyClass = document.body.className;
      if (bodyClass.includes('fleet_manager')) setRole('fleet_manager');
      else if (bodyClass.includes('warehouse_manager')) setRole('warehouse_manager');
      else if (bodyClass.includes('driver')) setRole('driver');
      else setRole('admin');
    };
    checkRole();
    const observer = new MutationObserver(checkRole);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const navItems = roleNavs[role] || adminNav;

  useEffect(() => {
    // Sync role selection with body classes
    const removeClasses = ['admin', 'fleet_manager', 'warehouse_manager', 'driver'];
    const body = document.body;
    removeClasses.forEach(cls => body.classList.remove(cls));
    if (role) body.classList.add(role);
  }, [role]);

  const navItemButtons = navItems.map((item) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        className={['px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2', isActive ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-md' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'].join(' ')}
      >
        <Icon className='w-4 h-4' />
        <span>{item.label}</span>
      </button>
    );
  });

  const roleLabel = role.replace('_', ' ');

  return (
    <nav className='glass-panel sticky top-0 z-40 px-6 py-3 border-b border-gray-800 flex items-center justify-between'>
      <div className='flex items-center gap-3'>
        <div className='w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20'>
          <Activity className='w-5 h-5 text-white' />
        </div>
        <div>
          <h1 className='text-base font-bold text-white tracking-wide'>LogiMind AI</h1>
          <p className='text-[10px] text-sky-400 font-semibold uppercase tracking-wider'>Enterprise Fleet & Logistics OS</p>
        </div>
      </div>

      <div className='hidden md:flex items-center gap-1 flex-wrap'>
        {navItemButtons}
      </div>

      <div className='relative' ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className='flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-gray-700/50 text-gray-300 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-purple-500'
          aria-haspopup='menu'
          aria-expanded={isMenuOpen}
        >
          <span className='text-gray-300 capitalize'>{roleLabel}</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} viewBox='0 0 24 24' fill='currentColor'>
            <path d='M6 9l6 6 6-6' />
          </svg>
        </button>

      {isMenuOpen && (
        <div className='absolute right-0 top-full mt-2 w-56 rounded-xl bg-gray-900/95 backdrop-blur p-2 shadow-2xl border border-gray-700 z-50'>
          <div className='space-y-1'>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setIsMenuOpen(false); }}
                  className={['w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left flex items-center gap-2', isActive ? 'bg-sky-500/20 text-sky-400' : 'text-gray-300 hover:text-gray-200 hover:bg-gray-800/60'].join(' ')}
                >
                  <Icon className='w-4 h-4' />
                  {item.label}
                </button>
              );
            })}
            <hr className='border-gray-700/60 my-1' />
            <div className='px-2 py-1'>
              <button
                onClick={() => { setRole('admin'); setIsMenuOpen(false); }}
                className={['w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left', role === 'admin' ? 'bg-sky-500/20 text-sky-400' : 'text-gray-300 hover:text-gray-200 hover:bg-gray-800/60'].join(' ')}
              >
                Switch to Admin
              </button>
            </div>
            <div className='px-2 py-1'>
              <button
                onClick={() => { setRole('fleet_manager'); setIsMenuOpen(false); }}
                className={['w-full px-3 py-1.5 rounded-md text-sm font-medium transition-colors text-left', role === 'fleet_manager' ? 'bg-sky-500/20 text-sky-400' : 'text-gray-300 hover:text-gray-200'].join(' ')}
              >
                Switch to Fleet Manager
              </button>
            </div>
            <div className='px-2 py-1'>
              <button
                onClick={() => { setRole('warehouse_manager'); setIsMenuOpen(false); }}
                className={['w-full px-3 py-1.5 rounded-md text-sm font-medium transition-colors text-left', role === 'warehouse_manager' ? 'bg-sky-500/20 text-sky-400' : 'text-gray-300 hover:text-gray-200'].join(' ')}
              >
                Switch to Warehouse Manager
              </button>
            </div>
            <div className='px-2 py-1'>
              <button
                onClick={() => { setRole('driver'); setIsMenuOpen(false); }}
                className={['w-full px-3 py-1.5 rounded-md text-sm font-medium transition-colors text-left', role === 'driver' ? 'bg-sky-500/20 text-sky-400' : 'text-gray-300 hover:text-gray-200'].join(' ')}
              >
                Switch to Driver
              </button>
            </div>
          </div>
        </div>
      )}

      </div>

      <div className='flex items-center gap-3'>
        <button
          onClick={onOpenCopilot}
          className='px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-2 shadow-lg shadow-purple-500/10'
        >
          <Bot className='w-4 h-4 text-purple-400' />
          <span>RAG Copilot</span>
        </button>
      </div>
    </nav>
  );
};
