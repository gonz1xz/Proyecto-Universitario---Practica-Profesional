import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CatalogSidebar } from '../components/CatalogSidebar.jsx';
import { GameCard } from '../components/GameCard.jsx';
import { PriceModal } from '../components/PriceModal.jsx';
import { getCatalog, searchGames } from '../services/gamesApi.js';
import { defaultFilters, filterSearchGames } from '../services/catalogFilters.js';

export const SearchPage = () => {
  const [params] = useSearchParams();
  const query = params.get('juego') || '';
  const [games, setGames] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [draftFilters, setDraftFilters] = useState(defaultFilters);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedGame, setSelectedGame] = useState(null);
  const [pagination, setPagination] = useState({ hasMore: false, nextOffset: 0 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const requestRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus('loading');
    setErrorMessage('');
    setSelectedGame(null);
    setLoadingMore(false);
    const loadGames = async () => {
      try {
        if (query) {
          const results = await searchGames(query, controller.signal);
          if (controller.signal.aborted) return;
          setGames(results);
          setPagination({ hasMore: false, nextOffset: 0 });
        } else {
          const data = await getCatalog(filters, 0, controller.signal);
          if (controller.signal.aborted) return;
          setGames(data.games);
          setPagination({ hasMore: data.hasMore, nextOffset: data.nextOffset });
        }
        setStatus('success');
      } catch (error) {
        if (controller.signal.aborted) return;
        setErrorMessage(error.message);
        setStatus('error');
      }
    };
    loadGames();
    return () => controller.abort();
  }, [query, filters, retry]);

  const loadMore = async () => {
    if (loadingMore) return;
    const controller = requestRef.current;
    setLoadingMore(true);
    setErrorMessage('');
    try {
      const data = await getCatalog(filters, pagination.nextOffset, controller.signal);
      if (controller.signal.aborted) return;
      setGames((current) => [...new Map([...current, ...data.games].map((game) => [game.id, game])).values()]);
      setPagination({ hasMore: data.hasMore, nextOffset: data.nextOffset });
    } catch (error) {
      if (!controller.signal.aborted) setErrorMessage(error.message);
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  };
  const visibleGames = query ? filterSearchGames(games, filters) : games;
  const resetFilters = () => { setDraftFilters(defaultFilters); setFilters(defaultFilters); };

  return (
    <main id="main-content" className="page-container inner-page">
      <div className="page-heading">
        <h1>{query ? `Resultados para “${query}”` : 'Encontrá tu próximo juego'}</h1>
        <p className="mt-2 text-sm text-muted">{query ? 'Filtrá los resultados o buscá otro título desde la barra superior.' : 'Compará precios y encontrá juegos según tu presupuesto.'}</p>
        {query && <Link to="/buscar" className="mt-3 inline-block text-sm text-primary hover:underline">Ver catálogo completo</Link>}
      </div>
      <div className="catalog-layout">
        <CatalogSidebar filters={draftFilters} onChange={(key, value) => setDraftFilters((current) => ({ ...current, [key]: value }))} onApply={() => setFilters({ ...draftFilters })} onReset={resetFilters} />
        <section aria-label="Juegos" aria-live="polite" aria-busy={status === 'loading' || loadingMore}>
          {status === 'loading' && <p className="py-12 text-center text-sm text-muted">Cargando juegos y precios...</p>}
          {status === 'error' && <div className="rounded-lg border border-text/10 bg-surface p-6"><p className="text-sm text-primary" role="alert">{errorMessage}</p><button type="button" onClick={() => setRetry((current) => current + 1)} className="mt-4 text-sm font-semibold text-primary hover:underline">Reintentar</button></div>}
          {status === 'success' && <>
            <p className="mb-4 text-sm text-muted">{visibleGames.length} juegos{query ? ' en los resultados de búsqueda' : ' cargados'}</p>
            {visibleGames.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{visibleGames.map((game) => <GameCard key={game.id} game={game} onShowPrices={setSelectedGame} />)}</div> : <div className="rounded-lg border border-text/10 bg-surface p-8 text-center"><p className="text-sm text-muted">No hay juegos que coincidan con estos filtros{query ? ' y esta búsqueda' : ''}.</p><button type="button" onClick={resetFilters} className="mt-4 text-sm font-medium text-primary hover:underline">Limpiar filtros</button></div>}
            {errorMessage && <p className="mt-5 text-sm text-primary" role="alert">{errorMessage}</p>}
            {!query && pagination.hasMore && <div className="mt-8 text-center"><button type="button" disabled={loadingMore} onClick={loadMore} className="rounded-md border border-primary px-6 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-60">{loadingMore ? 'Cargando...' : 'Cargar más juegos'}</button></div>}
          </>}
        </section>
      </div>
      {selectedGame && <PriceModal game={selectedGame} onClose={() => setSelectedGame(null)} />}
    </main>
  );
};
