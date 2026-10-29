import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, LoaderCircle, Store, X } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { getGamePrices } from '../services/gamesApi.js';
import { PriceHistory } from './PriceHistory.jsx';

export const PriceModal = ({ game, onClose }) => {
  const { formatPrice, currency } = useCurrency();
  const dialogRef = useRef(null);
  const [deals, setDeals] = useState([]);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [view, setView] = useState('current');
  const [historySaved, setHistorySaved] = useState(true);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setErrorMessage('');
    setView('current');
    setHistorySaved(true);

    const loadPrices = async () => {
      try {
        const foundDeals = await getGamePrices(game.id, controller.signal);
        if (controller.signal.aborted) return;
        setDeals(foundDeals.deals);
        setHistorySaved(foundDeals.historySaved);
        setStatus(foundDeals.deals.length > 0 ? 'success' : 'empty');
      } catch (error) {
        if (error.name !== 'AbortError') {
          setErrorMessage(error.message);
          setStatus('error');
        }
      }
    };

    loadPrices();
    return () => controller.abort();
  }, [game.id]);

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="price-modal rounded-lg m-auto max-h-[calc(100vh-2rem)] w-[min(44rem,calc(100%-1.5rem))] overflow-hidden border border-text/15 bg-surface p-0 text-text shadow-2xl shadow-black/60"
      onCancel={onClose}
      onClick={handleBackdropClick}
      aria-labelledby="price-modal-title"
    >
      <div className="flex max-h-[calc(100vh-2rem)] flex-col">
        <header className="flex items-start justify-between gap-5 border-b border-text/[0.07] px-5 py-5 sm:px-7 sm:py-6">
          <div>
            <p className="mb-2 text-sm font-medium text-accent">Compará las tiendas</p>
            <h2 className="text-xl font-semibold leading-7 text-text" id="price-modal-title">{game.title}</h2>
          </div>
          <button
            className="grid size-11 shrink-0 place-items-center rounded-full border border-text/20 text-muted transition hover:border-accent hover:bg-accent hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            type="button"
            onClick={onClose}
            aria-label="Cerrar precios"
            autoFocus
          >
            <X size={19} />
          </button>
        </header>

        <div className="price-view-switch" aria-label="Vista de precios">
          <button type="button" aria-pressed={view === 'current'} onClick={() => setView('current')}>Precios actuales</button>
          <button type="button" aria-pressed={view === 'history'} disabled={status === 'loading'} onClick={() => setView('history')}>Historial</button>
        </div>
        <div className="overflow-y-auto px-4 py-4 sm:px-7 sm:py-5" aria-live="polite">
          {!historySaved && <p className="mb-4 text-sm text-primary" role="status">Los precios actuales están disponibles, pero no pudimos guardarlos en el historial esta vez.</p>}
          {view === 'history' ? <PriceHistory key={game.id} gameId={game.id} /> : <>
          {status === 'loading' && (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-sm text-muted">
              <LoaderCircle size={24} className="animate-spin text-primary" />
              Consultando tiendas...
            </div>
          )}

          {status === 'empty' && <p className="py-16 text-center text-sm text-muted">No hay precios disponibles para este juego.</p>}
          {status === 'error' && <p className="py-16 text-center text-sm text-primary">{errorMessage}</p>}

          {status === 'success' && (
            <ul className="grid gap-2.5">
              {deals.map((deal) => (
                <li key={`${deal.shop.id}-${deal.url}`} className="flex flex-col gap-4 rounded-xl border border-text/10 bg-background/40 p-4 sm:flex-row sm:items-center">
                  <span className="grid size-10 shrink-0 place-items-center border border-text/10 bg-text/[0.06] text-muted">
                    <Store size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="truncate text-sm font-medium text-text">{deal.shop.name}</strong>
                      {deal.cut > 0 && <span className="rounded-md bg-accent px-2 py-1 text-xs font-bold text-background">−{deal.cut}%</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted">Oferta disponible</p>
                  </div>
                  <div className="flex items-center justify-between gap-5 sm:justify-end">
                    <div className="flex flex-col items-end">
                      <strong className="text-xl font-bold text-accent">{formatPrice(deal.price)}</strong>
                      {deal.cut > 0 && <s className="text-xs text-muted" aria-label="Precio regular">{formatPrice(deal.regular)}</s>}
                    </div>
                    <a
                      className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-background transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      href={deal.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Abrir ${game.title} en ${deal.shop.name}`}
                    >
                      <ArrowUpRight size={18} />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
          </>}
        </div>

        <p className="border-t border-text/[0.07] px-5 py-4 text-center text-xs text-muted">
          {view === 'current' && currency === 'ARS' ? 'Conversión aproximada a ARS, sin impuestos ni cargos. Precios originales de la región US en USD.' : 'Precios de la región US en USD.'}
        </p>
      </div>
    </dialog>
  );
};
