import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import BACKEND_URL from '../../config';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  ChevronDown, LogOut, Store, Shield,
  Sun, Moon, AlertTriangle, Package,
} from 'lucide-react';
import { API_URL as API } from '../../config';

const Header = ({ onMenuClick }) => {
  const { user, company, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [kpis, setKpis] = useState({ units: 0, low: 0 });

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
    fetchKpis();
  }, [location.pathname]); // eslint-disable-line

  const fetchKpis = async () => {
    try {
      const res = await axios.get(`${API}/products`, { params: { include_inactive: false } });
      setKpis({
        units: res.data.reduce((sum, p) => sum + p.stock, 0),
        low: res.data.filter((p) => p.stock <= p.min_stock).length,
      });
    } catch { /* silent */ }
  };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'VS';

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
              <Store className="h-4 w-4 text-white" />
            </div>
          )}
          <div className="dark-header-company-info">
            <span className="dark-header-company-name">{company?.name || 'Vape Store'}</span>
            {isAdmin && (
              <span className="dark-header-admin-badge">
                <Shield className="h-2.5 w-2.5" /> Admin
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: KPI chips */}
      <div className="dark-header-kpis">
        <div className="dark-kpi-chip">
          <Package className="h-3 w-3 text-slate-400" />
          <span className="dark-kpi-val">{kpis.units}</span>
          <span className="dark-kpi-lbl">em estoque</span>
        </div>
        {kpis.low > 0 && (
          <div className="dark-kpi-chip dark-kpi-chip--danger">
            <AlertTriangle className="h-3 w-3" />
            <span className="dark-kpi-val">{kpis.low}</span>
            <span className="dark-kpi-lbl">repor</span>
          </div>
        )}
      </div>

      {/* Right: theme + user */}
      <div className="dark-header-right">
        <button className="dark-icon-btn" onClick={() => setIsDark(v => !v)} title="Alternar tema">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

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
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
