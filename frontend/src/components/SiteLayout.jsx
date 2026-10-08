import { LogOut, UserRound } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Brand } from './Brand.jsx';
import { SearchForm } from './SearchForm.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const NavItem = ({ to, children, end = false }) => (
  <NavLink to={to} end={end} className={({ isActive }) => `flex min-h-11 items-center text-sm transition ${isActive ? 'font-medium text-primary' : 'text-muted hover:text-text'}`}>
    {children}
  </NavLink>
);

export const SiteLayout = () => {
  const { user, loading, logout, sessionMessage } = useAuth();
  const navigate = useNavigate();
  const search = (term) => navigate(`/buscar?juego=${encodeURIComponent(term)}`);

  return (
    <div className="min-h-screen bg-background text-text">
      <header className="sticky top-0 z-40 border-b border-text/10 bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 py-4 sm:gap-5 sm:px-8 lg:gap-8">
          <Brand />
          <div className="order-last w-full md:order-none md:min-w-0 md:flex-1">
            <SearchForm onSearch={search} variant="compact" />
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {loading ? <span className="max-w-24 text-xs text-muted" role="status">Comprobando sesión...</span> : user ? <>
              <span className="hidden max-w-32 truncate text-sm text-muted sm:block">{user.username}</span>
              <button type="button" onClick={logout} className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm text-muted hover:text-text" aria-label="Cerrar sesión"><LogOut size={18} /><span className="hidden sm:inline">Salir</span></button>
            </> : <>
              <NavLink to="/iniciar-sesion" className="flex min-h-10 items-center gap-2 rounded-full border border-text/15 px-2.5 text-sm text-muted hover:border-primary hover:text-primary" aria-label="Iniciar sesión"><UserRound size={19} /><span className="hidden lg:inline">Iniciar sesión</span></NavLink>
              <NavLink to="/registro" className="rounded-md bg-primary px-3 py-2.5 text-xs font-semibold text-background hover:bg-primary/90 sm:px-4 sm:text-sm">Crear cuenta</NavLink>
            </>}
          </div>
        </div>
        <div className="border-t border-text/5">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 px-5 sm:px-8">
            <nav aria-label="Navegación principal" className="flex gap-6">
              <NavItem to="/" end>Inicio</NavItem>
              <NavItem to="/buscar">Explorar juegos</NavItem>
            </nav>
            {!user && !loading && <p className="pb-3 text-xs leading-5 text-muted lg:py-2">Registrate para recibir notificaciones sobre tus juegos favoritos.</p>}
          </div>
        </div>
      </header>
      {sessionMessage && <p className="border-b border-primary/20 bg-surface px-5 py-3 text-center text-sm text-primary" role="status">{sessionMessage}</p>}
      <Outlet />
      <footer className="border-t border-text/10 px-5 py-7 text-center text-xs text-muted">AuraPrices · Precios de videojuegos en un solo lugar</footer>
    </div>
  );
};
