import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  ShoppingCart,
  BarChart3,
  Settings,
  ChefHat,
  ChevronLeft,
  Layers,
  Users,
  Lock
} from 'lucide-react';
import { Button } from '../ui/button';

const Sidebar = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) => {
  const location = useLocation();
  const { isAdmin } = useAuth();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/sections', label: 'Sections', icon: Layers, adminOnly: true },
    { path: '/items', label: 'Items', icon: Package },
    { path: '/daily-entry', label: 'Daily Entry', icon: ClipboardList },
    { path: '/orders', label: 'Orders', icon: ShoppingCart },
    { path: '/reports', label: 'Reports', icon: BarChart3 },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  // Add Users management for admin only
  if (isAdmin) {
    navItems.splice(navItems.length - 1, 0, { path: '/users', label: 'Users', icon: Users, adminOnly: true });
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay lg:hidden"
          onClick={() => setMobileOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}

      <aside
        className={cn(
          'sidebar',
          collapsed && 'sidebar-collapsed',
          mobileOpen && 'open'
        )}
        data-testid="sidebar"
      >
        {/* Logo */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-lg flex-shrink-0">
              <ChefHat className="h-6 w-6 text-white" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="font-heading text-lg font-black tracking-tight text-slate-900">
                  Inventory
                </h1>
                <p className="text-xs text-slate-500">Management</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isDisabled = item.adminOnly && !isAdmin;
            
            if (isDisabled) return null;
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                data-testid={`nav-${item.path.replace('/', '') || 'dashboard'}`}
                className={cn(
                  'sidebar-nav-item',
                  isActive && 'active'
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && (
                  <span className="flex items-center gap-2">
                    {item.label}
                    {item.adminOnly && <Lock className="h-3 w-3 text-blue-500" />}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Collapse button - desktop only */}
        <div className="hidden lg:block p-4 border-t border-slate-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full justify-center"
            data-testid="sidebar-collapse-btn"
          >
            <ChevronLeft className={cn('h-5 w-5 transition-transform', collapsed && 'rotate-180')} />
          </Button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
