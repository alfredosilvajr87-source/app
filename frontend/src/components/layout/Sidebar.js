import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Package,
  Receipt,
  Truck,
  BarChart3,
  Settings,
  Store,
  ChevronLeft,
  Users,
  Lock
} from 'lucide-react';
import { Button } from '../ui/button';

const Sidebar = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) => {
  const location = useLocation();
  const { isAdmin } = useAuth();

  const navItems = [
    { path: '/',          label: 'Painel',        icon: LayoutDashboard },
    { path: '/sales',     label: 'Vendas',        icon: Receipt },
    { path: '/purchases', label: 'Compras',       icon: Truck },
    { path: '/products',  label: 'Produtos',      icon: Package },
    { path: '/reports',   label: 'Relatórios',    icon: BarChart3 },
    { path: '/users',    label: 'Usuários',      icon: Users,     adminOnly: true },
    { path: '/settings',  label: 'Configurações', icon: Settings },
  ];

  // Bottom nav items (mobile) — most used by staff
  const bottomNavItems = [
    { path: '/',          label: 'Painel',   icon: LayoutDashboard },
    { path: '/sales',     label: 'Vendas',   icon: Receipt },
    { path: '/purchases', label: 'Compras',  icon: Truck },
    { path: '/products',  label: 'Produtos', icon: Package },
    { path: '/reports',   label: 'Relatórios', icon: BarChart3 },
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
              <Store className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="font-heading text-base font-black tracking-tight text-white">
                  Vape Store
                </h1>
                <p className="text-xs text-slate-500">Estoque e vendas</p>
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
