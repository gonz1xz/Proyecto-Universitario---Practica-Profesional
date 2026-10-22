import { ArrowRight, Gamepad2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPopularGames, getGiveaways, getBestDeals } from '../services/gamesApi.js';
import { FavoriteButton } from '../components/FavoriteButton.jsx';
import { GameCard } from '../components/GameCard.jsx';
import { PriceModal } from '../components/PriceModal.jsx';

function GameImage({ game }) {
  const [failed, setFailed] = useState(false);
  const image = game?.assets?.banner600 || game?.assets?.banner300 || game?.assets?.boxart;
  useEffect(() => setFailed(false), [image]);
  return image && !failed
    ? <img src={image} alt={game?.title ? 'Portada de ' + game.title : ''} className="aspect-[16/9] w-full object-contain bg-background/40" loading="lazy" onError={() => setFailed(true)} />
    : <div className="grid aspect-[16/9] place-items-center bg-background/40 text-primary"><Gamepad2 size={44} aria-hidden="true" /></div>;
}

// Cada sección maneja su propia carga, error y reintento.
function HomeSection({ title, description, loadItems, emptyMessage, onLoaded, children }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setError('');
    loadItems(controller.signal)
      .then(data => { if (!controller.signal.aborted) { setItems(data); onLoaded?.(data); setStatus('success'); } })
      .catch(error => { if (!controller.signal.aborted) { setError(error.message); setStatus('error'); } });
    return () => controller.abort();
  }, [loadItems, retry, onLoaded]);
  return (
    <section className="border-t border-text/10 py-9" aria-busy={status === 'loading'}>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      <div className="mt-5" aria-live="polite">
        {status === 'loading' && <p className="py-8 text-sm text-muted">Cargando...</p>}
        {status === 'error' && <div className="rounded-lg border border-text/10 bg-surface p-5"><p className="text-sm text-primary" role="alert">{error}</p><button type="button" onClick={() => setRetry(current => current + 1)} className="mt-3 text-sm font-semibold text-primary hover:underline">Reintentar</button></div>}
        {status === 'success' && (items.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map(children)}</div> : <p className="rounded-lg border border-text/10 bg-surface p-6 text-sm text-muted">{emptyMessage}</p>)}
      </div>
    </section>
  );
}

function expirationLabel(expiry) {
  if (!expiry) return 'Consultá la vigencia en la tienda.';
  const date = new Date(expiry);
  return Number.isNaN(date.getTime()) ? 'Consultá la vigencia en la tienda.' : 'Hasta el ' + date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function externalUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export const HomePage = () => {
  const [selectedGame, setSelectedGame] = useState(null);
  const [popularGames, setPopularGames] = useState([]);
  const featuredGame = popularGames[0];
  const cardClass = 'overflow-hidden rounded-lg border border-text/10 bg-surface';
  const linkClass = 'mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline';

  return (
    <main className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
      <section className="grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-2">
        <div>
        <h1 className="max-w-2xl text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Encontrá el mejor precio para tu próximo juego.</h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-muted">Buscá un título y compará las ofertas de distintas tiendas.</p>
        <Link to="/buscar" className={linkClass}>Explorar juegos <ArrowRight size={17} /></Link>
        </div>
        {featuredGame && <Link to={'/buscar?juego=' + encodeURIComponent(featuredGame.title)} className="group overflow-hidden rounded-lg border border-text/10 bg-surface">
          <GameImage key={featuredGame.id} game={featuredGame} />
          <div className="flex items-center justify-between gap-4 p-5"><div><p className="mb-1 text-xs text-muted">El más popular en IsThereAnyDeal</p><h2 className="text-xl font-semibold">{featuredGame.title}</h2></div><ArrowRight size={20} className="shrink-0 text-primary" /></div>
        </Link>}
      </section>

      <HomeSection title="Juegos más populares" description="Los títulos más guardados en listas de deseados y colecciones de IsThereAnyDeal." loadItems={getPopularGames} onLoaded={setPopularGames} emptyMessage="No hay juegos populares disponibles en este momento.">
        {game => <article key={game.id} className={cardClass}>
          <div className="relative">
            <GameImage game={game} />
            <FavoriteButton game={game} />
          </div>
          <div className="p-4">
            <h3 className="font-semibold">{game.title}</h3>
            {Number.isInteger(game.position) && <p className="mt-2 text-xs text-muted">Puesto {game.position} en IsThereAnyDeal</p>}
            <Link to={'/buscar?juego=' + encodeURIComponent(game.title)} className={linkClass}>Comparar precios <ArrowRight size={16} /></Link>
          </div>
        </article>}
      </HomeSection>

      <HomeSection title="Regalos por tiempo limitado" description="Promociones para reclamar juegos gratis antes de que terminen." loadItems={getGiveaways} emptyMessage="No hay regalos disponibles en este momento.">
        {giveaway => {
          const url = externalUrl(giveaway.url) || externalUrl(giveaway.details);
          return <article key={giveaway.id} className={cardClass}>
            <GameImage game={giveaway.games?.[0]} />
            <div className="p-4">
              <h3 className="font-semibold">{giveaway.title}</h3>
              <p className="mt-2 text-sm font-semibold text-primary">Gratis</p>
              {giveaway.shop?.name && <p className="mt-1 text-xs text-muted">{giveaway.shop.name}</p>}
              <p className="mt-2 text-xs leading-5 text-muted">{expirationLabel(giveaway.expiry)}</p>
              {url && <a href={url} target="_blank" rel="noreferrer" className={linkClass}>Ver regalo <ArrowRight size={16} /></a>}
            </div>
          </article>;
        }}
      </HomeSection>

      <HomeSection title="Mejores ofertas" description="Juegos con descuentos del 80% al 90%, ordenados de mayor a menor." loadItems={getBestDeals} emptyMessage="No hay ofertas con descuentos del 80% al 90% en este momento.">
        {game => <GameCard key={game.id} game={game} onShowPrices={setSelectedGame} />}
      </HomeSection>
      {selectedGame && <PriceModal game={selectedGame} onClose={() => setSelectedGame(null)} />}
    </main>
  );
};
