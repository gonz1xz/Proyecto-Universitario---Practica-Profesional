import { AlertTriangle, Gamepad2, Search, SearchX } from 'lucide-react';
import { GameCard } from './GameCard.jsx';

const StatusMessage = ({ icon: Icon, title, children, isError = false }) => (
  <section className={`mx-auto flex max-w-2xl items-start gap-4 rounded-lg border p-5 sm:items-center sm:p-6 ${isError ? 'border-accent/30 bg-surface' : 'border-text/10 bg-surface'}`} aria-live="polite">
    <span className={`grid size-10 shrink-0 place-items-center rounded-md ${isError ? 'bg-accent text-background' : 'bg-primary text-background'}`} aria-hidden="true"><Icon size={22} /></span>
    <div>
      <h2 className="font-semibold text-text">{title}</h2>
      <p className="mt-1 text-sm font-medium leading-6 text-muted">{children}</p>
    </div>
  </section>
);

export const GameResults = ({ games, status, searchedTerm, errorMessage, onShowPrices }) => {
  if (status === 'loading') {
    return <StatusMessage icon={Gamepad2} title="Buscando en el catálogo">Consultando el catálogo de juegos...</StatusMessage>;
  }

  if (status === 'empty') {
    return <StatusMessage icon={SearchX} title="No encontramos ese juego">No aparecieron resultados para “{searchedTerm}”. Probá con un nombre más corto.</StatusMessage>;
  }

  if (status === 'error') {
    return <StatusMessage icon={AlertTriangle} title="Algo salió mal" isError>{errorMessage}</StatusMessage>;
  }

  if (status === 'success') {
    return (
      <section aria-live="polite">
        <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">Resultados para “{searchedTerm}”</h2>
          </div>
          <span className="text-sm text-muted">{games.length} {games.length === 1 ? 'resultado' : 'resultados'}</span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {games.map((game) => <GameCard key={game.id} game={game} onShowPrices={onShowPrices} />)}
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 text-center">
      <span className="mx-auto grid size-12 place-items-center text-primary"><Search size={27} /></span>
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-text">Empezá por el juego que tenés en mente</h2>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-muted">Usá el buscador para encontrar un título y comparar sus precios.</p>
    </section>
  );
};
