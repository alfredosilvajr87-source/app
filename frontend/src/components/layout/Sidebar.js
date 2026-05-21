import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  CheckSquare,
  AlertTriangle,
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
    { path: '/',            label: 'Dashboard',   icon: LayoutDashboard },
    { path: '/sections',    label: 'Sections',    icon: Layers,        adminOnly: true },
    { path: '/items',       label: 'Items',       icon: Package,       adminOnly: true },
    { path: '/daily-entry', label: 'Daily Entry', icon: ClipboardList },
    { path: '/daily-prep',  label: 'Daily Prep',  icon: CheckSquare },
    { path: '/daily-waste', label: 'Daily Waste', icon: AlertTriangle },
    { path: '/orders',      label: 'Orders',      icon: ShoppingCart },
    { path: '/reports',     label: 'Reports',     icon: BarChart3,     adminOnly: true },
    { path: '/users',       label: 'Users',       icon: Users,         adminOnly: true },
    { path: '/settings',    label: 'Settings',    icon: Settings },
  ];

  // Bottom nav items (mobile) — most used by staff
  const bottomNavItems = [
    { path: '/',            label: 'Home',    icon: LayoutDashboard },
    { path: '/daily-entry', label: 'Entry',   icon: ClipboardList },
    { path: '/daily-prep',  label: 'Prep',    icon: CheckSquare },
    { path: '/orders',      label: 'Orders',  icon: ShoppingCart },
    { path: '/daily-waste', label: 'Waste',   icon: AlertTriangle },
  ];

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
        className={cn('sidebar', collapsed && 'sidebar-collapsed', mobileOpen && 'open')}
        data-testid="sidebar"
      >
        {/* Logo */}
        <div className="sidebar-logo-area">
          <div className="flex items-center gap-3">
            <div className="sidebar-logo-icon flex-shrink-0">
              <ChefHat className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="font-heading text-base font-black tracking-tight text-white">
                  Kitchen Pro
                </h1>
                <p className="text-xs text-slate-500">Inventory</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            if (item.adminOnly && !isAdmin) return null;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                data-testid={`nav-${item.path.replace('/', '') || 'dashboard'}`}
                className={cn('sidebar-nav-item', isActive && 'active')}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && (
                  <span className="flex items-center gap-2 text-sm">
                    {item.label}
                    {item.adminOnly && <Lock className="h-3 w-3 opacity-40" />}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Collapse button - desktop only */}
        <div className="hidden lg:block p-3 border-t border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full justify-center text-slate-400 hover:text-white hover:bg-slate-800"
            data-testid="sidebar-collapse-btn"
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          </Button>
        </div>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="bottom-nav lg:hidden">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn('bottom-nav-item', isActive && 'active')}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
};

export default Sidebar;
