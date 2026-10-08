import { ArrowRight, Heart } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { featuredOffers, popularGames } from '../data/featuredGames.js';

export const HomePage = () => {
  const [favorites, setFavorites] = useState([]);
  const toggleFavorite = (title) => {
    setFavorites((current) => current.includes(title) ? current.filter((game) => game !== title) : [...current, title]);
  };

  return (
    <main className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
      <section className="grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-2">
        <div>
          <h1 className="max-w-xl text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Encontrá un mejor precio para tu próximo juego.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted">Buscá un título y compará las ofertas de distintas tiendas.</p>
          <Link to="/buscar" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary">Explorar juegos <ArrowRight size={17} /></Link>
        </div>
        <Link to={`/buscar?juego=${encodeURIComponent(popularGames[0].title)}`} className="group relative overflow-hidden rounded-lg">
          <img src={popularGames[0].image} alt={`Portada de ${popularGames[0].title}`} className="aspect-[16/9] w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-5 text-text"><h2 className="text-xl font-semibold">{popularGames[0].title}</h2><ArrowRight size={20} className="text-accent" /></div>
        </Link>
      </section>

      <section className="border-t border-text/10 py-9">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">Juegos para explorar</h2>
          <Link to="/buscar" className="text-sm text-muted hover:text-primary">Ver todos</Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {popularGames.map((game) => <Link key={game.title} to={`/buscar?juego=${encodeURIComponent(game.title)}`} className="group overflow-hidden rounded-lg border border-text/10 bg-surface transition hover:border-text/30">
            <img src={game.image} alt={`Portada de ${game.title}`} className="aspect-[16/9] w-full object-cover" loading="lazy" />
            <div className="p-4"><h3 className="font-semibold">{game.title}</h3><p className="mt-1 text-sm text-muted">{game.genre}</p></div>
          </Link>)}
        </div>
      </section>

      <section className="border-t border-text/10 pt-9">
        <h2 className="text-2xl font-semibold tracking-tight">Selección de juegos</h2>
        <p className="mt-2 text-sm text-muted">Consultá las ofertas disponibles de cada título.</p>
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {featuredOffers.map((offer) => <article key={offer.title} className="overflow-hidden rounded-lg border border-text/10 bg-surface">
            <div className="relative">
              <img src={offer.image} alt={`Portada de ${offer.title}`} className="aspect-[16/9] w-full object-cover" loading="lazy" />
              <button type="button" className={`absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-background/80 ${favorites.includes(offer.title) ? 'text-primary' : 'text-text hover:text-primary'}`} aria-label={`${favorites.includes(offer.title) ? 'Quitar' : 'Guardar'} ${offer.title} de favoritos`} aria-pressed={favorites.includes(offer.title)} onClick={() => toggleFavorite(offer.title)}><Heart size={17} fill={favorites.includes(offer.title) ? 'currentColor' : 'none'} /></button>
            </div>
            <div className="p-4"><h3 className="font-semibold">{offer.title}</h3><p className="mt-2 text-sm leading-6 text-muted">{offer.description}</p><Link to={`/buscar?juego=${encodeURIComponent(offer.title)}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary">Comparar precios <ArrowRight size={16} /></Link></div>
          </article>)}
        </div>
      </section>
    </main>
  );
};
