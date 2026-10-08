import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from './Brand.jsx';

export const AuthShell = ({ eyebrow, title, subtitle, children }) => (
  <main className="min-h-screen bg-background px-5 py-6 sm:px-8">
    <div className="mx-auto max-w-7xl"><Brand /></div>
    <section className="mx-auto w-full max-w-md py-12 sm:py-16">
      <Link to="/" className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-md border border-text/15 px-3 text-sm text-muted transition hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><ArrowLeft size={16} /> Volver al inicio</Link>
      <p className="mb-3 text-sm text-primary">{eyebrow}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-text sm:text-4xl">{title}</h1>
      <p className="mt-4 text-sm leading-6 text-muted">{subtitle}</p>
      {children}
    </section>
  </main>
);
