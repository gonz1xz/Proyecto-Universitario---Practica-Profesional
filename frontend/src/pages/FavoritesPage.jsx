import { ArrowRight, Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useFavorites } from '../context/FavoritesContext.jsx';
import { getFavoriteGames } from '../services/favoritesApi.js';
import { GameCard } from '../components/GameCard.jsx';
import { PriceModal } from '../components/PriceModal.jsx';
import { PriceAlertModal } from '../components/PriceAlertModal.jsx';

export const FavoritesPage = () => {
  const { user, token, loading } = useAuth();
  const { ids, status: favoritesStatus, error: favoritesError, reload } = useFavorites();
  const [games, setGames] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(24);
  const [hasMore, setHasMore] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [alertGame, setAlertGame] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!user || loading || favoritesStatus !== 'success') return;
    const controller = new AbortController();
    setStatus('loading');
    setError('');
    (async () => {
      try {
        const allGames = [];
        let offset = 0;
        let more = false;
        do {
          const data = await getFavoriteGames(token, offset, controller.signal);
          allGames.push(...data.games);
          more = data.hasMore;
          if (data.nextOffset <= offset) break;
          offset = data.nextOffset;
        } while (more && allGames.length < limit);
        if (controller.signal.aborted) return;
        setGames(allGames);
        setHasMore(more);
        setStatus('success');
      } catch (error) {
        if (!controller.signal.aborted) { setError(error.message); setStatus('error'); }
      }
    })();
    return () => controller.abort();
  }, [user?.id, token, loading, favoritesStatus, ids, limit, retry]);

  if (loading) return <main className="mx-auto min-h-[calc(100vh-10rem)] max-w-7xl px-5 py-8 sm:px-8"><p role="status">Comprobando sesión...</p></main>;
  if (!user) return <Navigate to="/iniciar-sesion" replace />;
  const visibleGames = games.filter(game => ids.includes(game.id));
  return (
    <main className="mx-auto min-h-[calc(100vh-10rem)] max-w-7xl px-5 py-8 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Mis favoritos</h1>
      <p className="mt-2 text-sm text-muted">Tus juegos guardados. Tocá el corazón para quitar un favorito.</p>
      {(favoritesStatus === 'loading' || favoritesStatus === 'idle' || (favoritesStatus === 'success' && status === 'loading')) && <p className="py-10 text-sm text-muted" role="status">Cargando favoritos...</p>}
      {(favoritesStatus === 'error' || status === 'error') && <div className="mt-7 rounded-lg border border-text/10 bg-surface p-6"><p role="alert" className="text-sm text-primary">{favoritesError || error}</p><button type="button" onClick={() => { reload(); setRetry(current => current + 1); }} className="mt-3 text-sm text-primary hover:underline">Reintentar</button></div>}
      {favoritesStatus === 'success' && status === 'success' && (visibleGames.length ? <>
        {visibleGames.some(game => game.detailsUnavailable) && <p className="mt-5 text-sm text-muted" role="status">No pudimos consultar algunos títulos. Tus favoritos siguen guardados. <button type="button" onClick={() => setRetry(current => current + 1)} className="text-primary hover:underline">Reintentar</button></p>}
        <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{visibleGames.map(game => <GameCard key={game.id} game={game} onShowPrices={setSelectedGame} onSetAlert={setAlertGame} />)}</div>
        {hasMore && <button type="button" onClick={() => setLimit(current => current + 24)} className="mt-7 rounded-md border border-primary px-5 py-2.5 text-sm text-primary">Cargar más favoritos</button>}
      </> : <section className="mt-7 rounded-lg border border-text/10 bg-surface px-6 py-12 text-center"><Heart size={36} className="mx-auto text-primary" aria-hidden="true" /><h2 className="mt-4 text-lg font-semibold">Todavía no guardaste favoritos</h2><p className="mt-2 text-sm text-muted">Elegí un juego y tocá su corazón para encontrarlo aquí.</p><Link to="/buscar" className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-background">Explorar juegos <ArrowRight size={16} /></Link></section>)}
      {selectedGame && <PriceModal game={selectedGame} onClose={() => setSelectedGame(null)} />}
      {alertGame && <PriceAlertModal key={alertGame.id + ':' + token} game={alertGame} onClose={() => setAlertGame(null)} />}
    </main>
  );
};
