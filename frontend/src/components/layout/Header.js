import { useAuth } from '../../context/AuthContext';
import { useUnit } from '../../context/UnitContext';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Menu,
  Building2,
  ChevronDown,
  User,
  LogOut,
  Plus
} from 'lucide-react';

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { units, currentUnit, selectUnit } = useUnit();

  return (
    <header className="app-header" data-testid="app-header">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        data-testid="mobile-menu-btn"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Unit Selector */}
      <div className="flex items-center gap-4">
        {units.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 bg-slate-50 border-slate-200 hover:bg-slate-100"
                data-testid="unit-selector"
              >
                <Building2 className="h-4 w-4 text-slate-500" />
                <span className="font-medium">{currentUnit?.name || 'Select Unit'}</span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Switch Unit</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {units.map((unit) => (
                <DropdownMenuItem
                  key={unit.id}
                  onClick={() => selectUnit(unit)}
                  data-testid={`unit-option-${unit.id}`}
                  className={currentUnit?.id === unit.id ? 'bg-slate-100' : ''}
                >
                  <Building2 className="h-4 w-4 mr-2 text-slate-500" />
                  {unit.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* User Menu */}
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="gap-2"
              data-testid="user-menu"
            >
              <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              <span className="hidden sm:inline font-medium">{user?.name}</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{user?.name}</span>
                <span className="text-xs text-slate-500">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              data-testid="logout-btn"
              className="text-red-600 focus:text-red-600"
            >
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
