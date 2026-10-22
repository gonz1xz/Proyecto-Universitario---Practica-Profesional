const ENDPOINT = '/api/favorites';

async function request(path, token, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(ENDPOINT + path, { method, signal, headers: {
      Authorization: 'Bearer ' + token,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('No pudimos conectarnos para actualizar tus favoritos.');
  }
  if (response.status === 204) return;
  let data;
  try { data = await response.json(); }
  catch { throw new Error('El servidor devolvió una respuesta inesperada.'); }
  if (!response.ok) { const error = new Error(data.message || 'No se pudo completar la solicitud de favoritos.'); error.status = response.status; throw error; }
  return data;
}
export async function getFavorites(token, signal) {
  const data = await request('', token, { signal });
  if (!Array.isArray(data.favorites)) throw new Error('La lista de favoritos no tiene el formato esperado.');
  return data.favorites;
}
export async function getFavoriteGames(token, offset, signal) {
  const data = await request('?includeDetails=true&limit=24&offset=' + offset, token, { signal });
  if (!Array.isArray(data.games)) throw new Error('La lista de juegos no tiene el formato esperado.');
  return data;
}
export const addFavorite = (id, token) => request('', token, { method: 'POST', body: { itadGameId: id } });
export const removeFavorite = (id, token) => request('/' + encodeURIComponent(id), token, { method: 'DELETE' });
