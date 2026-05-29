import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Video, 
  AlertTriangle, 
  Car, 
  BarChart3, 
  Bell, 
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { motion } from 'framer-motion';

const SidebarItem = ({ icon: Icon, label, to, collapsed }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `
      flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200
      ${isActive 
        ? 'bg-primary text-white shadow-lg shadow-primary/20' 
        : 'text-gray-400 hover:bg-surface hover:text-white'}
    `}
  >
    <Icon size={22} />
    {!collapsed && <span className="font-medium whitespace-nowrap">{label}</span>}
  </NavLink>
);

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
    { icon: Video, label: 'Live Monitoring', to: '/monitoring' },
    { icon: AlertTriangle, label: 'Violations', to: '/violations' },
    { icon: Car, label: 'Vehicles', to: '/vehicles' },
    { icon: BarChart3, label: 'Analytics', to: '/analytics' },
    { icon: Bell, label: 'Notifications', to: '/notifications' },
    { icon: Settings, label: 'Settings', to: '/settings' },
  ];

  return (
    <motion.div
      animate={{ width: collapsed ? 80 : 260 }}
      className="h-screen bg-background border-r border-white/5 flex flex-col transition-all duration-300"
    >
      <div className="p-6 flex items-center gap-3">
        <div className="bg-primary p-2 rounded-xl">
          <ShieldAlert className="text-white" size={24} />
        </div>
        {!collapsed && (
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent"
          >
            TRAFFIC AI
          </motion.span>
        )}
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {menuItems.map((item) => (
          <SidebarItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="p-4 border-t border-white/5">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-3 rounded-lg bg-surface text-gray-400 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
    </motion.div>
  );
};

export default Sidebar;
