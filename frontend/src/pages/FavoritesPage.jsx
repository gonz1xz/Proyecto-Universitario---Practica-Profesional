import { ArrowRight, Heart, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useFavorites } from '../context/FavoritesContext.jsx';
import { getFavoriteGames } from '../services/favoritesApi.js';
import { GameCard } from '../components/GameCard.jsx';
import { PriceModal } from '../components/PriceModal.jsx';
import { PriceAlertModal } from '../components/PriceAlertModal.jsx';

export function FavoritesPage() {
  const { user, token, loading } = useAuth();
  if (loading) return <main id="main-content" className="page-container inner-page"><p role="status">Comprobando sesión...</p></main>;
  if (!user) return <Navigate to="/iniciar-sesion" replace />;
  // Una nueva sesión empieza con su propia lista y selección.
  return <FavoritesList key={user.id + ':' + token} token={token} />;
}

function FavoritesList({ token }) {
  const { ids, status: favoritesStatus, error: favoritesError, reload, removeFavorites } = useFavorites();
  const [games, setGames] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ hasMore: false, nextOffset: 0 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [removing, setRemoving] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedGame, setSelectedGame] = useState(null);
  const [alertGame, setAlertGame] = useState(null);
  const [retry, setRetry] = useState(0);
  const requestRef = useRef(null);

  useEffect(() => {
    if (favoritesStatus !== 'success') return;
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus('loading');
    setLoadingMore(false);
    setError('');
    getFavoriteGames(token, 0, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return;
        setGames(data.games);
        setPagination({ hasMore: data.hasMore, nextOffset: data.nextOffset });
        setStatus('success');
      })
      .catch(error => {
        if (!controller.signal.aborted) { setError(error.message); setStatus('error'); }
      });
    return () => controller.abort();
    // Los cambios de ids se reflejan localmente sin volver a pedir las portadas.
  }, [token, favoritesStatus, retry]);

  async function loadMore() {
    if (loadingMore || removing) return;
    const controller = requestRef.current;
    setLoadingMore(true);
    setError('');
    try {
      const data = await getFavoriteGames(token, pagination.nextOffset, controller.signal);
      if (controller.signal.aborted) return;
      setGames(current => [...new Map([...current, ...data.games].map(game => [game.id, game])).values()]);
      setPagination({ hasMore: data.hasMore, nextOffset: data.nextOffset });
    } catch (error) { if (!controller.signal.aborted) setError(error.message); }
    finally { if (!controller.signal.aborted) setLoadingMore(false); }
  }

  const visibleGames = games.filter(game => ids.includes(game.id));
  const selected = selectedIds.filter(id => visibleGames.some(game => game.id === id));

  function toggleSelection(id) {
    setMessage('');
    setSelectionError('');
    if (!selectedIds.includes(id) && selected.length >= 100) {
      setSelectionError('Podés quitar hasta 100 juegos por selección.');
      return;
    }
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  async function confirmRemoval() {
    if (removing || loadingMore || !selected.length) return;
    setRemoving(true);
    setSelectionError('');
    try {
      const result = await removeFavorites(selected);
      setGames(current => current.filter(game => !result.removedIds.includes(game.id)));
      setPagination(current => ({ ...current, nextOffset: Math.max(0, current.nextOffset - result.removedCount) }));
      setSelectedIds([]);
      setMessage(`Se quitaron ${result.removedCount} ${result.removedCount === 1 ? 'juego' : 'juegos'} de tus favoritos.`);
    } catch (error) { setSelectionError(error.message); }
    finally { setRemoving(false); }
  }

  return (
    <main id="main-content" className={`page-container inner-page ${selected.length ? 'favorites-selecting' : ''}`}>
      <div className="page-heading">
        <h1>Tu lista para jugar después</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Tocá los corazones para seleccionar juegos y quitarlos juntos. Permanecen guardados hasta que pulses Eliminar de favoritos.</p>
      </div>
      {message && <p role="status" className="mb-5 text-sm text-accent">{message}</p>}
      {(favoritesStatus === 'loading' || favoritesStatus === 'idle' || status === 'loading') && favoritesStatus !== 'error' && <p className="py-10 text-sm text-muted" role="status">Cargando favoritos...</p>}
      {(favoritesStatus === 'error' || error) && <div className="my-5 rounded-lg border border-text/10 bg-surface p-6"><p role="alert" className="text-sm text-primary">{favoritesError || error}</p><button type="button" onClick={() => { if (favoritesStatus === 'error') reload(); else if (status === 'success') loadMore(); else setRetry(current => current + 1); }} className="mt-3 text-sm text-primary underline">Reintentar</button></div>}
      {favoritesStatus === 'success' && status === 'success' && <>
        {visibleGames.some(game => game.detailsUnavailable) && <p className="mt-5 text-sm text-muted" role="status">No pudimos consultar algunos títulos. Tus favoritos siguen guardados. <button type="button" onClick={() => setRetry(current => current + 1)} className="text-primary underline">Reintentar portadas</button></p>}
        {visibleGames.length ? (
          <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visibleGames.map(game => <GameCard key={game.id} game={game} onShowPrices={setSelectedGame} onSetAlert={setAlertGame} favoriteSelected={!selectedIds.includes(game.id)} onToggleFavorite={toggleSelection} favoriteDisabled={removing} />)}
          </div>
        ) : pagination.hasMore ? <p className="status-panel">No quedan juegos en esta página. Podés cargar los siguientes favoritos.</p> : (
          <section className="mt-7 rounded-lg border border-text/10 bg-surface px-6 py-12 text-center">
            <Heart size={36} className="mx-auto text-primary" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">Tu lista de favoritos está vacía</h2>
            <p className="mt-2 text-sm text-muted">Elegí un juego y tocá su corazón para encontrarlo aquí.</p>
            <Link to="/buscar" className="button button-primary mt-6">Explorar juegos <ArrowRight size={16} aria-hidden="true" /></Link>
          </section>
        )}
        {pagination.hasMore && <button type="button" disabled={loadingMore || removing} onClick={loadMore} className="mt-7 rounded-md border border-primary px-5 py-2.5 text-sm text-primary disabled:opacity-60">{loadingMore ? 'Cargando...' : 'Cargar más favoritos'}</button>}
      </>}
      {selected.length > 0 && (
        <section className="favorite-selection-bar" aria-label="Selección de favoritos">
          <div className="selection-bar-actions">
            <p role="status"><strong>{selected.length}</strong> {selected.length === 1 ? 'juego seleccionado' : 'juegos seleccionados'}</p>
            <button type="button" disabled={removing} onClick={() => { setSelectedIds([]); setSelectionError(''); }} className="selection-cancel">Cancelar</button>
            <button type="button" disabled={removing || loadingMore} onClick={confirmRemoval} className="button button-primary"><Trash2 size={17} aria-hidden="true" />{removing ? 'Eliminando...' : 'Eliminar de favoritos'}</button>
          </div>
          {selectionError && <p role="alert" className="mt-3 text-sm text-primary">{selectionError}</p>}
        </section>
      )}
      {selectedGame && <PriceModal game={selectedGame} onClose={() => setSelectedGame(null)} />}
      {alertGame && <PriceAlertModal key={alertGame.id} game={alertGame} onClose={() => setAlertGame(null)} />}
    </main>
  );
}
