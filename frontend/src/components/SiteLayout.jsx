import { LogOut, UserRound } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CurrencySelector } from './CurrencySelector.jsx';
import { CurrencyNotice } from './CurrencyNotice.jsx';
import { Brand } from './Brand.jsx';
import { SearchForm } from './SearchForm.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { NotificationInbox } from './NotificationInbox.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { LogoutModal } from './LogoutModal.jsx';

const NavItem = ({ to, children, end = false }) => (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}>
    {children}
  </NavLink>
);

export const SiteLayout = () => {
  const { user, token, loading, logout, sessionMessage } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const navigate = useNavigate();
  const search = (term) => navigate(`/buscar?juego=${encodeURIComponent(term)}`);

  return (
    <div className="site-shell">
      <a href="#main-content" className="skip-link">Saltar al contenido</a>
      <header className="site-header">
        <div className="page-container header-main">
          <Brand />
          <div className="header-search">
            <SearchForm onSearch={search} variant="compact" />
          </div>
          <div className="header-actions">
            <CurrencySelector />
            {loading ? <span className="max-w-24 text-xs text-muted" role="status">Comprobando sesión...</span> : user ? <>
              <NotificationInbox key={user.id + ':' + token} />
              <span className="hidden max-w-32 truncate text-sm text-muted sm:block">{user.username}</span>
              <button type="button" onClick={() => setLogoutOpen(true)} className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm text-muted hover:text-text" aria-label="Cerrar sesión"><LogOut size={18} /><span className="hidden sm:inline">Salir</span></button>
            </> : <>
              <NavLink to="/iniciar-sesion" className="flex min-h-10 items-center gap-2 rounded-full border border-text/15 px-2.5 text-sm text-muted hover:border-primary hover:text-primary" aria-label="Iniciar sesión"><UserRound size={19} /><span className="hidden lg:inline">Iniciar sesión</span></NavLink>
              <NavLink to="/registro" className="button button-primary account-button">Crear cuenta</NavLink>
            </>}
            <ThemeToggle />
          </div>
        </div>
        <div className="header-navigation">
          <div className="page-container flex flex-wrap items-center justify-between gap-x-6">
            <nav aria-label="Navegación principal" className="flex flex-wrap gap-x-5 sm:gap-x-7">
              <NavItem to="/" end>Inicio</NavItem>
              <NavItem to="/buscar">Explorar juegos</NavItem>
              {user && !loading && <><NavItem to="/mis-favoritos">Mis favoritos</NavItem><NavItem to="/notificaciones">Notificaciones</NavItem></>}
            </nav>
          </div>
        </div>
      </header>
      {sessionMessage && <p className="border-b border-primary/20 bg-surface px-5 py-3 text-center text-sm text-primary" role="status">{sessionMessage}</p>}
      <CurrencyNotice />
      <Outlet />
      <footer className="site-footer">
        <div className="page-container footer-content">
          <div><Brand /><p>Encontrá tu próxima aventura.</p></div>
          <p>Precios de la región US. Confirmá el importe final en cada tienda.</p>
        </div>
      </footer>
      {logoutOpen && user && <LogoutModal key={user.id + ':' + token} onClose={() => setLogoutOpen(false)} onConfirm={() => { setLogoutOpen(false); logout(); }} />}
    </div>
  );
};
