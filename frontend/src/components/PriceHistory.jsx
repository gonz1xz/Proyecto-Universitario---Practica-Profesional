import { useEffect, useState } from 'react';
import { getPriceHistory } from '../services/gamesApi.js';
import { formatDisplayPrice } from '../services/priceFormatter.js';
import { PriceHistoryChart } from './PriceHistoryChart.jsx';

const formatHistoryPrice = amount => formatDisplayPrice({ amount, currency: 'USD' });
const formatDate = value => new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

export function PriceHistory({ gameId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getPriceHistory(gameId, 0, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [gameId, retry]);

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const result = await getPriceHistory(gameId, data.nextOffset);
      setData(current => ({ ...current, ...result, records: [...new Map([...current.records, ...result.records].map(record => [record.id, record])).values()] }));
    } catch (error) { setError(error.message); }
    finally { setLoadingMore(false); }
  }

  return (
    <section aria-labelledby="history-title" aria-busy={loading || loadingMore}>
      <h3 id="history-title" className="text-lg font-semibold">Historial de precios</h3>
      <p className="mt-2 text-sm leading-6 text-muted">Cambios de precio del último mes (30 días). Fuente: <a href="https://isthereanydeal.com/" target="_blank" rel="noreferrer" className="text-primary underline">IsThereAnyDeal</a>.</p>
      <p className="mt-2 text-xs leading-5 text-muted">Valores originales en USD, región US, sin conversión a ARS. Las fechas se muestran en tu hora local. Una tienda ausente no se registra como precio cero.</p>

      {loading ? <p className="py-8 text-sm text-muted" role="status">Cargando historial...</p> : data?.records.length ? <>
        <PriceHistoryChart records={data.chartRecords || data.records} periodStart={data.periodStart} periodEnd={data.periodEnd} />
        <div className="history-summary">
          <span>Menor precio del período consultado</span>
          <strong>{formatHistoryPrice(data.lowestPrice)}</strong>
          <small>Primer cambio del período: {formatDate(data.firstRecordedAt)}. No representa necesariamente el mínimo histórico de la tienda.</small>
        </div>
        <div className="history-table-container">
          <table className="history-table">
            <caption className="sr-only">Cambios observados, del más reciente al más antiguo. Todos los precios están en USD.</caption>
            <thead><tr><th scope="col">Fecha</th><th scope="col">Tienda</th><th scope="col">Precio USD</th></tr></thead>
            <tbody>{data.records.map(record => (
              <tr key={record.id}>
                <td><time dateTime={record.recordedAt}>{formatDate(record.recordedAt)}</time></td>
                <td>{record.store.name}</td>
                <td>{formatHistoryPrice(record.price)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {data.hasMore && <button type="button" onClick={loadMore} disabled={loadingMore} className="button mt-4 border border-text/20 text-primary">{loadingMore ? 'Cargando...' : 'Ver registros anteriores'}</button>}
      </> : !error && <p className="status-panel mt-5">ITAD no devolvió cambios de precio en USD para este juego durante el último mes.</p>}

      {error && <div className="mt-5"><p role="alert" className="text-sm text-error">{error}</p><button type="button" onClick={() => setRetry(current => current + 1)} className="mt-3 text-sm text-primary underline">Reintentar historial</button></div>}
    </section>
  );
}
