import sanitizeHtml from 'sanitize-html';

const detailsCache = new Map();

function imageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

// La descripción se devuelve como texto: el navegador nunca ejecuta HTML del proveedor.
export function descriptionText(value) {
  if (typeof value !== 'string') return null;
  const entities = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
  const paragraphs = value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, '\n');
  const text = sanitizeHtml(paragraphs, { allowedTags: [], allowedAttributes: {} })
    .replace(/&(?:amp|quot|apos|lt|gt|nbsp|#39);/g, entity => entities[entity])
    .trim().slice(0, 6000);
  return text || null;
}

export async function getGameDetails(id) {
  const cached = detailsCache.get(id);
  if (cached && Date.now() - cached.savedAt < 60 * 60 * 1000) return cached.data;

  const url = new URL('https://api.isthereanydeal.com/games/info/v2');
  url.searchParams.set('id', id);
  const response = await fetch(url, { headers: { 'ITAD-API-Key': process.env.ITAD_API_KEY }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    const error = new Error('No se pudo consultar la información del juego.');
    error.status = response.status;
    throw error;
  }
  const info = await response.json();
  if (info?.id !== id || typeof info.title !== 'string') throw new Error('La fuente devolvió información inesperada.');

  const assets = {};
  for (const key of ['banner600', 'banner300', 'banner145', 'boxart']) {
    const image = imageUrl(info.assets?.[key]);
    if (image) assets[key] = image;
  }
  const data = {
    id, title: info.title, assets, description: null, screenshots: [],
    developers: Array.isArray(info.developers) ? info.developers.map(company => company?.name).filter(name => typeof name === 'string').slice(0, 6) : [],
    steamUrl: null, mediaUnavailable: false,
  };

  if (Number.isSafeInteger(info.appid) && info.appid > 0) {
    data.steamUrl = 'https://store.steampowered.com/app/' + info.appid + '/';
    try {
      // La ficha pública de la tienda complementa los datos básicos de ITAD.
      const steamUrl = new URL('https://store.steampowered.com/api/appdetails');
      steamUrl.search = new URLSearchParams({ appids: info.appid, l: 'spanish' });
      const steamResponse = await fetch(steamUrl, { signal: AbortSignal.timeout(10000) });
      if (!steamResponse.ok) throw new Error('La ficha de Steam no está disponible.');
      const result = (await steamResponse.json())?.[info.appid];
      if (result?.success !== true || result.data?.steam_appid !== info.appid) throw new Error('La ficha de Steam no corresponde al juego.');
      data.description = descriptionText(result.data.short_description) || descriptionText(result.data.about_the_game);
      if (Array.isArray(result.data.screenshots)) {
        data.screenshots = [...new Set(result.data.screenshots.map(image => imageUrl(image?.path_full)).filter(Boolean))].slice(0, 6);
      }
    } catch {
      // Se conserva la portada aunque falle la descripción o la galería.
      data.mediaUnavailable = true;
    }
  }

  // No guardar fallos parciales permite que Reintentar vuelva a consultar la tienda.
  if (!data.mediaUnavailable) {
    if (detailsCache.size >= 100) detailsCache.delete(detailsCache.keys().next().value);
    detailsCache.set(id, { data, savedAt: Date.now() });
  }
  return data;
}
