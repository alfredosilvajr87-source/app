import { useAuth } from '../../context/AuthContext';
import { useUnit } from '../../context/UnitContext';
import { useEffect, useState } from 'react';
import axios from 'axios';
import BACKEND_URL from '../../config';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import {
  Building2, ChevronDown, LogOut, ChefHat, Shield,
  Sun, Moon, User, AlertTriangle, Package, ShoppingCart,
} from 'lucide-react';
import { API_URL as API } from '../../config';

const Header = ({ onMenuClick }) => {
  const { user, company, logout, isAdmin } = useAuth();
  const { units, currentUnit, selectUnit } = useUnit();
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [kpis, setKpis] = useState({ total: 0, critical: 0, pending_orders: 0 });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    if (currentUnit) fetchKpis();
  }, [currentUnit]); // eslint-disable-line

  const fetchKpis = async () => {
    try {
      const [stockRes, ordersRes] = await Promise.all([
        axios.get(`${API}/reports/stock-status/${currentUnit.id}`),
        axios.get(`${API}/orders/${currentUnit.id}?status=pending`),
      ]);
      const critical = stockRes.data.filter(i => i.status === 'critical').length;
      setKpis({ total: stockRes.data.length, critical, pending_orders: ordersRes.data.length });
    } catch { /* silent */ }
  };

  const initials = company?.name
    ? company.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'KP';

  return (
    <header className="dark-header">
      {/* Left: logo + company */}
      <div className="dark-header-left">
        <button className="mobile-menu-btn lg:hidden" onClick={onMenuClick}>
          <span style={{ fontSize: 20 }}>☰</span>
        </button>
        <div className="dark-header-logo-wrap">
          {company?.logo_url ? (
            <img src={company.logo_url.startsWith('/api')
              ? `${BACKEND_URL}${company.logo_url}`
              : company.logo_url}
              alt={company?.name}
              className="dark-header-logo-img"
            />
          ) : (
            <div className="dark-header-logo-icon">
              <ChefHat className="h-4 w-4 text-white" />
            </div>
          )}
          <div className="dark-header-company-info">
            <span className="dark-header-company-name">{company?.name || 'Kitchen Pro'}</span>
            {isAdmin && (
              <span className="dark-header-admin-badge">
                <Shield className="h-2.5 w-2.5" /> Admin
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: KPI chips */}
      {currentUnit && (
        <div className="dark-header-kpis">
          <div className="dark-kpi-chip">
            <Package className="h-3 w-3 text-slate-400" />
            <span className="dark-kpi-val">{kpis.total}</span>
            <span className="dark-kpi-lbl">items</span>
          </div>
          {kpis.critical > 0 && (
            <div className="dark-kpi-chip dark-kpi-chip--danger">
              <AlertTriangle className="h-3 w-3" />
              <span className="dark-kpi-val">{kpis.critical}</span>
              <span className="dark-kpi-lbl">critical</span>
            </div>
          )}
          {kpis.pending_orders > 0 && (
            <div className="dark-kpi-chip dark-kpi-chip--info">
              <ShoppingCart className="h-3 w-3" />
              <span className="dark-kpi-val">{kpis.pending_orders}</span>
              <span className="dark-kpi-lbl">orders</span>
            </div>
          )}
        </div>
      )}

      {/* Right: unit selector + theme + user */}
      <div className="dark-header-right">
        {/* Unit selector */}
        {units.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="dark-unit-btn">
                <Building2 className="h-3.5 w-3.5" />
                <span>{currentUnit?.name || 'Select'}</span>
                {currentUnit?.initials && <span className="dark-unit-initials">{currentUnit.initials}</span>}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Switch Unit</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {units.map(unit => (
                <DropdownMenuItem
                  key={unit.id}
                  onClick={() => selectUnit(unit)}
                  className={currentUnit?.id === unit.id ? 'bg-slate-100' : ''}
                >
                  <Building2 className="h-4 w-4 mr-2 text-slate-500" />
                  {unit.name}
                  <span className="ml-auto text-xs text-slate-400">{unit.initials}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Dark mode toggle */}
        <button className="dark-icon-btn" onClick={() => setIsDark(v => !v)} title="Toggle theme">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="dark-user-btn">
              <div className="dark-avatar">{initials}</div>
              <span className="dark-user-name hidden sm:block">{user?.name}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{user?.name}</span>
                <span className="text-xs text-slate-500">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
