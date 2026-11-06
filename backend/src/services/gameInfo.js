// Datos básicos de ITAD compartidos por favoritos y la lista de alertas.
export async function getGameInfo(id) {
  const url = new URL('https://api.isthereanydeal.com/games/info/v2');
  url.searchParams.set('id', id);
  const response = await fetch(url, { headers: { 'ITAD-API-Key': process.env.ITAD_API_KEY }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) { const error = new Error('No se pudo consultar el juego.'); error.status = response.status === 404 ? 404 : 502; throw error; }
  const info = await response.json();
  if (info.id !== id || typeof info.title !== 'string') throw new Error('El juego recibido no es válido.');
  return info;
}
