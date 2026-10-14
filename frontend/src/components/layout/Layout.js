import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // No celular o botão de menu abre a barra lateral; no computador ele a recolhe
  const toggleMenu = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) setSidebarCollapsed((v) => !v);
    else setMobileOpen(true);
  };

  return (
    <div className={`app-container${sidebarCollapsed ? ' sidebar-is-collapsed' : ''}`}>
      <Sidebar collapsed={sidebarCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <main className="main-content">
        <Header onMenuClick={toggleMenu} />
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
