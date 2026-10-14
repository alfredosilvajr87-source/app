import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Menu, MapPin, Bell, ChevronDown, LogOut, Settings } from 'lucide-react';
import { productLabel } from '../../lib/store';
import { API_URL as API } from '../../config';

const Header = ({ onMenuClick }) => {
  const { user, company, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [lowStock, setLowStock] = useState([]);

  useEffect(() => {
    fetchLowStock();
  }, [location.pathname]); // eslint-disable-line

  const fetchLowStock = async () => {
    try {
      const res = await axios.get(`${API}/products`, { params: { include_inactive: false } });
      setLowStock(res.data.filter((p) => p.stock <= p.min_stock).sort((a, b) => a.stock - b.stock));
    } catch { /* silencioso */ }
  };

  const initials = user?.name
    ? user.name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'VS';

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button className="topbar-btn" onClick={onMenuClick} title="Menu">
          <Menu className="h-6 w-6" />
        </button>
        <span className="topbar-divider hidden sm:block" />
        <div className="topbar-store">
          <MapPin className="h-5 w-5 text-slate-300 flex-shrink-0" />
          <div className="min-w-0">
            <div className="topbar-store-name">{company?.name || 'Loja Principal'}</div>
            <span className="topbar-online">Online</span>
          </div>
        </div>
      </div>

      <div className="topbar-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="topbar-btn" title="Avisos de estoque">
              <Bell className="h-5 w-5" />
              {lowStock.length > 0 && <span className="topbar-badge">{lowStock.length}</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Repor estoque</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {lowStock.length === 0 ? (
              <p className="px-2 py-3 text-sm text-slate-400">Nenhum produto abaixo do mínimo</p>
            ) : (
              <>
                {lowStock.slice(0, 8).map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => navigate('/products')} className="justify-between gap-3">
                    <span className="truncate">{productLabel(p)}</span>
                    <span className={p.stock <= 0 ? 'status-critical' : 'status-low'}>{p.stock} / mín {p.min_stock}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/purchases')} className="justify-center text-violet-300">
                  Registrar compra
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="topbar-divider hidden sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="topbar-user">
              <div className="topbar-avatar">{initials}</div>
              <div className="hidden sm:block">
                <div className="topbar-user-name">{user?.name}</div>
                <div className="topbar-user-role">{isAdmin ? 'Administrador' : 'Vendedor'}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
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
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="h-4 w-4 mr-2" /> Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout} className="text-rose-400 focus:text-rose-400">
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
