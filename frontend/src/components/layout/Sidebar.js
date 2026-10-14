import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import {
  Home,
  ShoppingCart,
  Package,
  Box,
  BarChart3,
  Users,
  Wallet,
  Calculator,
  Settings,
  Lock
} from 'lucide-react';

export const BrandLockup = ({ collapsed = false }) => (
  <div className="sidebar-brand">
    <img src="/logo-mark.png" alt="Vapor Serrano" />
    {!collapsed && (
      <div className="brand-wordmark">
        <span className="brand-name">VAPOR <span className="text-brand-gradient">SERRANO</span></span>
        <span className="brand-tagline">VAPES • LÍQUIDOS • ACESSÓRIOS</span>
      </div>
    )}
  </div>
);

const Sidebar = ({ collapsed, mobileOpen, setMobileOpen }) => {
  const location = useLocation();
  const { isAdmin } = useAuth();

  const navItems = [
    { path: '/',          label: 'Painel',        icon: Home },
    { path: '/sales',     label: 'Vendas',        icon: ShoppingCart },
    { path: '/purchases', label: 'Compras',       icon: Package },
    { path: '/products',  label: 'Produtos',      icon: Box },
    { path: '/cash',      label: 'Caixa',         icon: Calculator },
    { path: '/reports',  label: 'Relatórios',    icon: BarChart3 },
    { path: '/finance',   label: 'Financeiro',    icon: Wallet,    adminOnly: true },
    { path: '/users',     label: 'Funcionários',  icon: Users,     adminOnly: true },
    { path: '/settings',  label: 'Configurações', icon: Settings,  adminOnly: true },
  ];

  // Barra inferior (celular) — telas mais usadas no balcão
  const bottomNavItems = [
    { path: '/',          label: 'Painel',     icon: Home },
    { path: '/sales',     label: 'Vendas',     icon: ShoppingCart },
    { path: '/purchases', label: 'Compras',    icon: Package },
    { path: '/cash',      label: 'Caixa',      icon: Calculator },
    { path: '/reports',   label: 'Relatórios', icon: BarChart3 },
  ];

  return (
    <>
      {mobileOpen && (
        <div className="sidebar-overlay lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn('sidebar', collapsed && 'sidebar-collapsed', mobileOpen && 'open')} data-testid="sidebar">
        <BrandLockup collapsed={collapsed} />

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            if (item.adminOnly && !isAdmin) return null;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={cn('sidebar-nav-item', isActive && 'active')}
              >
                <Icon />
                {!collapsed && (
                  <span className="flex items-center gap-2">
                    {item.label}
                    {item.adminOnly && <Lock className="!h-3.5 !w-3.5 opacity-50" />}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="sidebar-slogan">
            <span>Mais que vapor,</span><br />é estilo de vida.
          </div>
        )}
      </aside>

      <nav className="bottom-nav lg:hidden">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink key={item.path} to={item.path} className={cn('bottom-nav-item', isActive && 'active')}>
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
