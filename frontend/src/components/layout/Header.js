import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { Menu, MapPin, Bell, ChevronDown, LogOut, Settings, Sun, Moon, KeyRound } from 'lucide-react';
import { apiError, productLabel } from '../../lib/store';
import { API_URL as API } from '../../config';

const EMPTY_PWD = { current: '', new: '', confirm: '' };

const Header = ({ onMenuClick }) => {
  const { user, company, logout, isAdmin, changePassword } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [lowStock, setLowStock] = useState([]);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwd, setPwd] = useState(EMPTY_PWD);

  useEffect(() => {
    fetchLowStock();
  }, [location.pathname]); // eslint-disable-line

  const fetchLowStock = async () => {
    try {
      const res = await axios.get(`${API}/products`, { params: { include_inactive: false } });
      setLowStock(res.data.filter((p) => p.stock <= p.min_stock).sort((a, b) => a.stock - b.stock));
    } catch { /* silencioso */ }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    if (pwd.new !== pwd.confirm) {
      toast.error('As senhas novas não coincidem');
      return;
    }
    try {
      await changePassword(pwd.current, pwd.new);
      toast.success('Senha alterada');
      setPwdOpen(false);
      setPwd(EMPTY_PWD);
    } catch (err) {
      toast.error(apiError(err, 'Falha ao alterar a senha'));
    }
  };

  const initials = user?.name
    ? user.name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'VS';

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button className="topbar-btn" onClick={onMenuClick} title="Menu">
          <Menu className="h-5 w-5" />
        </button>
        <span className="topbar-divider hidden sm:block" />
        <div className="topbar-store">
          <MapPin className="h-4 w-4 flex-shrink-0" />
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
                <DropdownMenuItem onClick={() => navigate('/purchases')} className="justify-center text-violet-400">
                  Registrar compra
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <button className="topbar-btn" onClick={toggleTheme} title={isDark ? 'Usar tema claro' : 'Usar tema escuro'}>
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <span className="topbar-divider hidden sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="topbar-user">
              <div className="topbar-avatar">{initials}</div>
              <div className="hidden sm:block">
                <div className="topbar-user-name">{user?.name}</div>
                <div className="topbar-user-role">{isAdmin ? 'Administrador' : 'Vendedor'}</div>
              </div>
              <ChevronDown className="h-4 w-4 opacity-60" />
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
            <DropdownMenuItem onClick={() => setPwdOpen(true)}>
              <KeyRound className="h-4 w-4 mr-2" /> Alterar senha
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleTheme}>
              {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
              {isDark ? 'Tema claro' : 'Tema escuro'}
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="h-4 w-4 mr-2" /> Configurações
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-rose-500 focus:text-rose-500">
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Alterar senha</DialogTitle>
            <DialogDescription>Digite a senha atual e escolha uma nova</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPassword} className="space-y-4">
            <div className="space-y-1">
              <Label>Senha atual</Label>
              <Input type="password" required value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Nova senha</Label>
              <Input type="password" required minLength={6} value={pwd.new} onChange={(e) => setPwd({ ...pwd, new: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Confirmar nova senha</Label>
              <Input type="password" required value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPwdOpen(false)}>Cancelar</Button>
              <Button type="submit">Alterar senha</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default Header;
