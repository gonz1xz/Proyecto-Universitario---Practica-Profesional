import { ArrowLeft, Bell, Gamepad2, Heart, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from './Brand.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';

export const AuthShell = ({ title, subtitle, children }) => (
  <main className="auth-page">
    <div className="page-container flex items-center justify-between gap-4 py-6"><Brand /><ThemeToggle /></div>
    <div className="page-container auth-layout">
      <aside className="auth-story">
        <span className="auth-controller"><Gamepad2 size={92} strokeWidth={1.3} aria-hidden="true" /></span>
        <h2>Más juegos en tu radar.</h2>
        <p>Un lugar para descubrir, comparar y guardar lo que querés jugar.</p>
        <ul>
          <li><Search size={19} aria-hidden="true" /> Compará precios entre tiendas.</li>
          <li><Heart size={19} aria-hidden="true" /> Armá tu lista de favoritos.</li>
          <li><Bell size={19} aria-hidden="true" /> Recibí avisos de ofertas y precios.</li>
        </ul>
      </aside>
      <section className="auth-form-panel">
        <Link to="/" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> Volver al inicio</Link>
        <h1>{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{subtitle}</p>
        {children}
      </section>
    </div>
  </main>
);
