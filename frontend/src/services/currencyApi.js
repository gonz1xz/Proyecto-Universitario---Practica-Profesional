const CACHE_KEY = 'auraprices_usd_ars_rate';
const CACHE_DURATION = 24 * 60 * 60 * 1000;
let pendingRequest;

export async function getUsdArsRate() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (Number.isFinite(cached?.rate) && cached.rate > 0 &&
        Number.isFinite(cached.savedAt) && Date.now() >= cached.savedAt &&
        Date.now() - cached.savedAt < CACHE_DURATION) return cached;
  } catch {
    // La conversión sigue funcionando si el navegador bloquea el almacenamiento.
  }
  if (pendingRequest) return pendingRequest;
  pendingRequest = (async () => {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('No se pudo obtener la cotización.');
    const data = await response.json();
    if (data.result !== 'success' || data.base_code !== 'USD' ||
        !Number.isFinite(data.rates?.ARS) || data.rates.ARS <= 0 ||
        !Number.isFinite(data.time_last_update_unix)) {
      throw new Error('La cotización recibida no es válida.');
    }
    const rate = { rate: data.rates.ARS, updatedAt: data.time_last_update_unix * 1000, savedAt: Date.now() };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(rate)); } catch { /* Almacenamiento opcional. */ }
    return rate;
  })();
  try { return await pendingRequest; } finally { pendingRequest = null; }
}
