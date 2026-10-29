import { API_BASE_URL } from './apiBaseUrl.js';

const GAMES_ENDPOINT = API_BASE_URL + '/games';

export async function getGameDetails(gameId, signal) {
  let response;
  try {
    response = await fetch(`${GAMES_ENDPOINT}/${encodeURIComponent(gameId)}/details`, { signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('No se pudo conectar para consultar la información del juego.');
  }
  let data;
  try { data = await response.json(); }
  catch { throw new Error('El servidor devolvió información inesperada.'); }
  if (!response.ok) throw new Error(data.error || 'No se pudo cargar la información del juego.');
  if (data?.id !== gameId.toLowerCase() || typeof data.title !== 'string' ||
      !Array.isArray(data.developers) || !Array.isArray(data.screenshots) ||
      (data.description !== null && typeof data.description !== 'string')) {
    throw new Error('La información recibida no tiene el formato esperado.');
  }
  return data;
}

export const searchGames = async (query, signal) => {
  const params = new URLSearchParams({ search: query, includePrices: true });

  let response;

  try {
    response = await fetch(`${GAMES_ENDPOINT}?${params}`, { signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(
      'No pudimos conectarnos con el backend. Revisá que esté iniciado y que la dirección configurada sea correcta.',
    );
  }

  let data;

  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(
        'No pudimos conectarnos con el backend. Revisá que esté iniciado y que la dirección configurada sea correcta.',
      );
    }

    throw new Error('El backend respondió con un formato que no es JSON.');
  }

  if (!response.ok) {
    throw new Error(data.error || 'El backend no pudo completar la búsqueda.');
  }

  if (!Array.isArray(data)) {
    throw new Error('La respuesta del backend no tiene el formato esperado.');
  }

  return data;
};

export const getGamePrices = async (gameId, signal) => {
  let response;

  try {
    response = await fetch(`${GAMES_ENDPOINT}/${gameId}/prices`, { signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;

    throw new Error(
      'No pudimos conectarnos con el backend para consultar los precios.',
    );
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error('El backend respondió con un formato inesperado.');
  }

  if (!response.ok) {
    throw new Error(
      'No se pudieron obtener los precios. Intentá nuevamente en unos minutos.',
    );
  }

  const game = Array.isArray(data) ? data.find(item => item?.id === gameId.toLowerCase()) : null;
  if (!Array.isArray(game?.deals)) {
    throw new Error('La respuesta de precios no tiene el formato esperado.');
  }

  return { deals: game.deals, historySaved: response.headers.get('X-Price-History-Saved') !== 'false' };
};

export async function getPriceHistory(gameId, offset = 0, signal) {
  let response;
  try {
    response = await fetch(`${GAMES_ENDPOINT}/${encodeURIComponent(gameId)}/history?limit=50&offset=${offset}`, { signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('No se pudo conectar con el historial. Intentá nuevamente.');
  }
  let data;
  try { data = await response.json(); }
  catch { throw new Error('El servidor devolvió un historial inesperado.'); }
  if (!response.ok) throw new Error(data.error || 'No se pudo consultar el historial.');
  if (!Array.isArray(data.records) || typeof data.hasMore !== 'boolean' || !Number.isSafeInteger(data.nextOffset)) {
    throw new Error('El historial recibido no tiene el formato esperado.');
  }
  return data;
}

export const getCatalog = async (filters, offset = 0, signal) => {
  const params = new URLSearchParams({ ...filters, offset });
  let response;
  try {
    response = await fetch(`${GAMES_ENDPOINT}/catalog?${params}`, { signal });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('No pudimos conectarnos con el catálogo. Revisá que el backend esté iniciado.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo cargar el catálogo.');
  if (!Array.isArray(data.games)) throw new Error('El catálogo no tiene el formato esperado.');
  return data;
};


// Las secciones del inicio cargan por separado para que un error no bloquee las demás.
async function getHomeList(path, key, signal, extraParams = {}) {
  const params = new URLSearchParams({ limit: 6, ...extraParams });
  let response;
  try {
    response = await fetch(GAMES_ENDPOINT + '/' + path + '?' + params, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('No pudimos conectarnos con el servidor. Intentá nuevamente.');
  }
  let data;
  try { data = await response.json(); }
  catch { throw new Error('El servidor devolvió una respuesta inesperada.'); }
  if (!response.ok) throw new Error(data?.error || 'No se pudo cargar esta sección.');
  if (!Array.isArray(data?.[key])) throw new Error('La lista recibida no tiene el formato esperado.');
  return data[key];
}

export const getPopularGames = signal => getHomeList('popular', 'games', signal, { includeAssets: true });
export const getGiveaways = signal => getHomeList('giveaways', 'giveaways', signal);
export const getBestDeals = signal => getHomeList('deals', 'deals', signal);
