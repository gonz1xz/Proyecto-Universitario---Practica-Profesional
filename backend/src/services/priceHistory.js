const cache = new Map();
const pending = new Map();
const CACHE_DURATION = 15 * 60 * 1000;
const MAX_CACHED_GAMES = 100;
const HISTORY_DURATION = 30 * 24 * 60 * 60 * 1000;

function historyError(message, status = 502) {
  return Object.assign(new Error(message), { status });
}

export function normalizeHistory(data) {
  if (!Array.isArray(data)) throw historyError('ITAD devolvió un historial con un formato inesperado.');
  const records = [];
  const seen = new Set();
  for (const entry of data) {
    // ITAD también informa ofertas retiradas con deal=null; no son precio cero.
    if (entry?.deal === null) continue;
    const amount = entry?.deal?.price?.amount;
    const timestamp = typeof entry?.timestamp === 'string' ? Date.parse(entry.timestamp) : NaN;
    if (entry?.deal?.price?.currency !== 'USD' || !Number.isFinite(amount) || amount < 0 ||
        !Number.isSafeInteger(entry.shop?.id) || entry.shop.id < 1 ||
        typeof entry.shop.name !== 'string' || !entry.shop.name.trim() || !Number.isFinite(timestamp)) continue;
    const recordedAt = new Date(timestamp).toISOString();
    const id = `${entry.shop.id}:${recordedAt}:${amount}`;
    if (seen.has(id)) continue;
    seen.add(id);
    records.push({ id, price: amount, currency: 'USD', recordedAt,
      store: { id: String(entry.shop.id), name: entry.shop.name.trim() } });
  }
  return records.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || a.id.localeCompare(b.id));
}

async function loadHistory(gameId) {
  const url = new URL('https://api.isthereanydeal.com/games/history/v2');
  url.searchParams.set('id', gameId);
  url.searchParams.set('country', 'US');
  url.searchParams.set('since', new Date(Date.now() - HISTORY_DURATION).toISOString());
  let response;
  try {
    response = await fetch(url, {
      headers: { 'ITAD-API-Key': process.env.ITAD_API_KEY },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw historyError('No pudimos conectarnos con el historial de ITAD. Intentá nuevamente.');
  }
  if (!response.ok) {
    if (response.status === 429) throw historyError('ITAD recibió demasiadas consultas. Intentá nuevamente más tarde.', 429);
    throw historyError('No se pudo consultar el historial de ITAD. Intentá nuevamente.');
  }
  let data;
  try { data = await response.json(); }
  catch { throw historyError('ITAD devolvió un historial con un formato inesperado.'); }
  const records = normalizeHistory(data);
  const summary = { records };
  if (cache.size >= MAX_CACHED_GAMES) cache.delete(cache.keys().next().value);
  cache.set(gameId, { ...summary, expiresAt: Date.now() + CACHE_DURATION });
  return summary;
}

export async function getPriceHistory(gameId, limit = 50, offset = 0) {
  if (!process.env.ITAD_API_KEY) throw historyError('Falta configurar la consulta del historial de ITAD.', 503);
  let history = cache.get(gameId);
  if (!history || history.expiresAt <= Date.now()) {
    if (!pending.has(gameId)) {
      pending.set(gameId, loadHistory(gameId).finally(() => pending.delete(gameId)));
    }
    history = await pending.get(gameId);
  }
  const now = Date.now();
  const periodStart = new Date(now - HISTORY_DURATION).toISOString();
  const periodEnd = new Date(now).toISOString();
  // Filtrar también la caché: la ventana avanza aunque aún no hayan pasado sus 15 minutos.
  const monthlyRecords = history.records.filter(record => record.recordedAt >= periodStart && record.recordedAt <= periodEnd);
  const records = monthlyRecords.slice(offset, offset + limit);
  return {
    records, hasMore: offset + records.length < monthlyRecords.length,
    nextOffset: offset + records.length,
    lowestPrice: monthlyRecords.length ? monthlyRecords.reduce((lowest, record) => Math.min(lowest, record.price), Infinity) : null,
    firstRecordedAt: monthlyRecords.length ? monthlyRecords.at(-1).recordedAt : null,
    source: 'itad', periodMonths: 1, periodDays: 30, periodStart, periodEnd,
    ...(offset === 0 ? { chartRecords: monthlyRecords } : {}),
  };
}
