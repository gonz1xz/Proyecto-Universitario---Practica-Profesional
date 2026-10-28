import { ArrowRight, Compass, Flame, Gift, Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPopularGames, getGiveaways, getBestDeals } from '../services/gamesApi.js';
import { FavoriteButton } from '../components/FavoriteButton.jsx';
import { GameArtwork } from '../components/GameArtwork.jsx';
import { GameCard } from '../components/GameCard.jsx';
import { PriceModal } from '../components/PriceModal.jsx';

// Cada sección conserva su carga y reintento: una consulta no bloquea las demás.
function HomeSection({ id, icon: Icon, title, description, loadItems, emptyMessage, onLoaded, children }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setError('');
    async function load() {
      try {
        const data = await loadItems(controller.signal);
        if (controller.signal.aborted) return;
        setItems(data);
        onLoaded?.(data);
        setStatus('success');
      } catch (error) {
        if (controller.signal.aborted) return;
        setError(error.message);
        setStatus('error');
      }
    }
    load();
    return () => controller.abort();
  }, [loadItems, retry, onLoaded]);

  return (
    <section id={id} className="home-section" aria-busy={status === 'loading'}>
      <div className="section-heading">
        <span className="section-icon"><Icon size={23} aria-hidden="true" /></span>
        <div><h2>{title}</h2><p>{description}</p></div>
      </div>
      <div className="mt-6" aria-live="polite">
        {status === 'loading' && <p className="status-panel">Cargando juegos...</p>}
        {status === 'error' && (
          <div className="status-panel">
            <p role="alert">{error}</p>
            <button type="button" onClick={() => setRetry(current => current + 1)} className="mt-3 text-primary underline">Reintentar</button>
          </div>
        )}
        {status === 'success' && (items.length
          ? <div className="game-grid">{items.map(children)}</div>
          : <p className="status-panel">{emptyMessage}</p>)}
      </div>
    </section>
  );
}

function expirationLabel(expiry) {
  if (!expiry) return 'Consultá la vigencia en la tienda.';
  const date = new Date(expiry);
  return Number.isNaN(date.getTime())
    ? 'Consultá la vigencia en la tienda.'
    : 'Hasta el ' + date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function externalUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

const gameSearchUrl = game => '/buscar?juego=' + encodeURIComponent(game.title);

export const HomePage = () => {
  const [selectedGame, setSelectedGame] = useState(null);
  const [popularGames, setPopularGames] = useState([]);
  const featuredGame = popularGames[0];

  return (
    <main id="main-content" className="page-container home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <span className="hero-symbol" aria-hidden="true"><Compass size={30} /></span>
          <h1 id="home-title">Tu próximo juego.<br />A tu mejor precio.</h1>
          <p>Ese que tenés en mente, esa oferta que esperabas. Compará tiendas y encontrá qué jugar después.</p>
          <Link to="/buscar" className="button button-primary">Explorar juegos <ArrowRight size={18} aria-hidden="true" /></Link>
          <span className="hero-note"><Heart size={15} aria-hidden="true" /> Guardá tus favoritos y seguí sus ofertas.</span>
        </div>
        {featuredGame ? (
          <Link to={gameSearchUrl(featuredGame)} className="featured-game">
            <GameArtwork game={featuredGame} priority />
            <div className="featured-caption">
              <div><span>Destacado entre los populares</span><h2>{featuredGame.title}</h2></div>
              <span className="featured-arrow"><ArrowRight size={23} aria-hidden="true" /></span>
            </div>
          </Link>
        ) : (
          <div className="hero-placeholder">
            <Compass size={70} strokeWidth={1} aria-hidden="true" />
            <p>Un buen juego empieza por descubrirlo.</p>
            <Link to="/buscar" className="text-primary underline">Ver el catálogo</Link>
          </div>
        )}
      </section>

      <nav className="discovery-nav" aria-label="Secciones del inicio">
        <a href="#popular"><Flame size={18} aria-hidden="true" /> Más populares</a>
        <a href="#giveaways"><Gift size={18} aria-hidden="true" /> Juegos gratis</a>
        <a href="#deals"><Compass size={18} aria-hidden="true" /> Grandes descuentos</a>
      </nav>

      <HomeSection id="popular" icon={Flame} title="En el radar de todos" description="Los más guardados en listas de deseados y colecciones de IsThereAnyDeal." loadItems={getPopularGames} onLoaded={setPopularGames} emptyMessage="No hay juegos populares disponibles en este momento.">
        {game => (
          <article key={game.id} className="game-card popular-card">
            <div className="relative">
              <GameArtwork game={game} />
              <FavoriteButton game={game} />
              {Number.isInteger(game.position) && <span className="ranking-badge" aria-label={`Puesto ${game.position} en IsThereAnyDeal`}>#{game.position}</span>}
            </div>
            <div className="game-card-body">
              <h3 className="game-card-title">{game.title}</h3>
              <Link to={gameSearchUrl(game)} className="card-link">Comparar precios <ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
          </article>
        )}
      </HomeSection>

      <HomeSection id="giveaways" icon={Gift} title="Sumá un juego gratis" description="Regalos por tiempo limitado. Revisá las condiciones antes de reclamarlos en la tienda." loadItems={getGiveaways} emptyMessage="No hay regalos disponibles en este momento. Podés explorar las ofertas del catálogo.">
        {giveaway => {
          const url = externalUrl(giveaway.url) || externalUrl(giveaway.details);
          return (
            <article key={giveaway.id} className="game-card giveaway-card">
              <div className="relative"><GameArtwork game={giveaway.games?.[0]} /><span className="discount-badge giveaway-badge">Gratis</span></div>
              <div className="game-card-body">
                <h3 className="game-card-title">{giveaway.title}</h3>
                {giveaway.shop?.name && <p className="mt-2 text-sm text-accent">{giveaway.shop.name}</p>}
                <p className="mt-2 text-xs leading-5 text-muted">{expirationLabel(giveaway.expiry)}</p>
                {url && <a href={url} target="_blank" rel="noreferrer" className="card-link">Ver regalo en la tienda <ArrowRight size={17} aria-hidden="true" /></a>}
              </div>
            </article>
          );
        }}
      </HomeSection>

      <HomeSection id="deals" icon={Compass} title="Grandes juegos, precios pequeños" description="Descuentos del 80% al 90%, ordenados de mayor a menor." loadItems={getBestDeals} emptyMessage="No hay ofertas con descuentos del 80% al 90% en este momento.">
        {game => <GameCard key={game.id} game={game} onShowPrices={setSelectedGame} />}
      </HomeSection>
      {selectedGame && <PriceModal game={selectedGame} onClose={() => setSelectedGame(null)} />}
    </main>
  );
};
