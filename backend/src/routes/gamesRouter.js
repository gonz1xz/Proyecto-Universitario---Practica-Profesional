import { Router } from 'express';


const router = Router();


// Busqueda del juego por nombre
router.get('/', async (req, res) => {
  const gameName = req.query.search;

  if (!gameName) {
    return res.status(400).json({ error: 'Falta el nombre del juego para realizar la búsqueda' });
  }

  const url = new URL(`https://api.isthereanydeal.com/games/search/v1`);
  url.searchParams.append('title', gameName);
  url.searchParams.append('results', 10);

  const config = {
    headers: {
      'ITAD-API-Key': process.env.ITAD_API_KEY,
      'content-type': 'application/json',
    },
  }

  try {
    const response = await fetch(url, config);
    if (!response.ok) { return res.status(response.status).json({ error: 'No se pudieron obtener los datos de los juegos' }) }

    const games = await response.json();

    if (req.query.includePrices === 'true' && Array.isArray(games) && games.length) {
      const pricesUrl = new URL('https://api.isthereanydeal.com/games/prices/v3');
      pricesUrl.searchParams.set('country', 'US');
      const pricesResponse = await fetch(pricesUrl, { ...config, method: 'POST', body: JSON.stringify(games.map((game) => game.id)), signal: AbortSignal.timeout(15000) });
      if (!pricesResponse.ok) return res.status(pricesResponse.status).json({ error: 'No se pudieron cargar los precios de los resultados.' });
      const prices = await pricesResponse.json();
      if (!Array.isArray(prices)) return res.status(502).json({ error: 'La fuente devolvió precios inesperados.' });
      return res.json(games.map((game) => ({ ...game, deals: prices.find((item) => item.id === game.id)?.deals || [] })));
    }
    res.json(games);

  } catch (error) {

    console.error('Error al obtener los datos de los juegos:', error);
    res.status(500).json({ error: 'No se pudieron obtener los datos de los juegos' });

  }

});

// Catálogo paginado con precios y filtros de la fuente externa.
router.get('/catalog', async (req, res) => {
  const offset = Number(req.query.offset ?? 0);
  const sort = req.query.sort ?? '-cut';
  const minDiscount = Number(req.query.minDiscount ?? 0);
  const maxPrice = req.query.maxPrice === undefined || req.query.maxPrice === '' ? null : Number(req.query.maxPrice);
  const shop = req.query.shop ? Number(req.query.shop) : null;
  if (!Number.isInteger(offset) || offset < 0 || !['price', '-price', '-cut'].includes(sort) ||
      !Number.isFinite(minDiscount) || minDiscount < 0 || minDiscount > 100 ||
      (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice < 0)) ||
      (shop !== null && ![61, 35, 16].includes(shop))) {
    return res.status(400).json({ error: 'Los filtros del catálogo no son válidos.' });
  }
  const filter = {};
  if (maxPrice !== null) filter.price = { min: 0, max: maxPrice };
  if (minDiscount > 0) filter.cut = { min: minDiscount, max: 100 };
  const url = new URL('https://api.isthereanydeal.com/deals/v2');
  url.search = new URLSearchParams({ country: 'US', offset, limit: 24, sort, nondeals: minDiscount === 0 });
  if (shop !== null) url.searchParams.set('shops', shop);
  if (Object.keys(filter).length) url.searchParams.set('filter', JSON.stringify(filter));
  try {
    const response = await fetch(url, { headers: { 'ITAD-API-Key': process.env.ITAD_API_KEY }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return res.status(response.status).json({ error: 'No se pudo cargar el catálogo de juegos.' });
    const data = await response.json();
    if (!Array.isArray(data.list) || typeof data.hasMore !== 'boolean' || !Number.isInteger(data.nextOffset)) {
      return res.status(502).json({ error: 'La fuente de juegos devolvió un catálogo inesperado.' });
    }
    res.json({ games: data.list, hasMore: data.hasMore, nextOffset: data.nextOffset });
  } catch (error) {
    console.error('Error al cargar el catálogo:', error);
    res.status(502).json({ error: 'No se pudo conectar con el catálogo de juegos. Intentá nuevamente.' });
  }
});

// Las estadísticas no incluyen portadas. Se consultan por ID y se reutilizan durante una hora.
const popularAssetsCache = new Map();
async function addPopularAssets(games) {
  return Promise.all(games.map(async game => {
    const cached = popularAssetsCache.get(game.id);
    if (cached && Date.now() - cached.savedAt < 60 * 60 * 1000) return { ...game, assets: cached.assets };
    try {
      const url = new URL('https://api.isthereanydeal.com/games/info/v2');
      url.searchParams.set('id', game.id);
      const response = await fetch(url, {
        headers: { 'ITAD-API-Key': process.env.ITAD_API_KEY },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return { ...game, assets: null };
      const info = await response.json();
      if (info.id !== game.id || !info.assets || typeof info.assets !== 'object') return { ...game, assets: null };
      if (popularAssetsCache.size >= 100) popularAssetsCache.delete(popularAssetsCache.keys().next().value);
      popularAssetsCache.set(game.id, { assets: info.assets, savedAt: Date.now() });
      return { ...game, assets: info.assets };
    } catch {
      // Un fallo de portada no debe impedir mostrar el ranking.
      return { ...game, assets: null };
    }
  }));
}

// Estas listas comparten paginación y manejo de errores, pero cada una usa su endpoint de ITAD.
async function loadGameList(req, res, endpoint, responseKey, extraParams = {}, maxLimit = 50) {
  const offsetValue = req.query.offset ?? '0';
  const limitValue = req.query.limit ?? '20';
  const offset = Number(offsetValue);
  const limit = Number(limitValue);
  if (typeof offsetValue !== 'string' || !/^\d+$/.test(offsetValue) || !Number.isSafeInteger(offset) ||
      typeof limitValue !== 'string' || !/^\d+$/.test(limitValue) || !Number.isSafeInteger(limit) ||
      limit < 1 || limit > maxLimit) {
    return res.status(400).json({ error: 'La paginación no es válida. offset debe ser un entero mayor o igual a 0 y limit debe estar entre 1 y ' + maxLimit + '.' });
  }
  if (responseKey === 'games' && req.query.includeAssets !== undefined &&
      !['true', 'false'].includes(req.query.includeAssets)) {
    return res.status(400).json({ error: 'includeAssets debe ser true o false.' });
  }
  if (responseKey === 'games' && req.query.includeAssets === 'true' && limit > 24) {
    return res.status(400).json({ error: 'Las consultas de populares con portadas permiten hasta 24 juegos.' });
  }
  if (!process.env.ITAD_API_KEY) {
    return res.status(503).json({ error: 'Falta configurar la conexión con IsThereAnyDeal.' });
  }
  const url = new URL('https://api.isthereanydeal.com' + endpoint);
  url.search = new URLSearchParams({ offset, limit, ...extraParams });
  try {
    const response = await fetch(url, {
      headers: { 'ITAD-API-Key': process.env.ITAD_API_KEY },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: 'No se pudo obtener la lista de IsThereAnyDeal.' });
    }
    const data = await response.json();
    const items = responseKey === 'deals' ? data?.list : data;
    if (!Array.isArray(items) || !items.every(item => item &&
        (typeof item.id === 'string' || Number.isInteger(item.id)) && typeof item.title === 'string')) {
      return res.status(502).json({ error: 'IsThereAnyDeal devolvió una lista con un formato inesperado.' });
    }
    if (responseKey === 'deals' && (typeof data.hasMore !== 'boolean' || !Number.isSafeInteger(data.nextOffset) || data.nextOffset < 0 ||
        !items.every(game => game.deal?.price?.currency === 'USD' &&
          Number.isFinite(game.deal.price.amount) && game.deal.price.amount >= 0 &&
          Number.isFinite(game.deal.cut) && game.deal.cut >= 80 && game.deal.cut <= 90 &&
          typeof game.deal.shop?.name === 'string'))) {
      return res.status(502).json({ error: 'IsThereAnyDeal devolvió ofertas con un formato o precio inesperado.' });
    }
    const result = responseKey === 'games' && req.query.includeAssets === 'true'
      ? await addPopularAssets(items) : items;
    const pagination = responseKey === 'deals' ? { hasMore: data.hasMore, nextOffset: data.nextOffset } : {};
    res.json({ [responseKey]: result, offset, limit, ...pagination });
  } catch {
    res.status(502).json({ error: 'No se pudo conectar con IsThereAnyDeal. Intentá nuevamente.' });
  }
}

// La popularidad de ITAD suma las listas de deseados y las colecciones de sus usuarios.
router.get('/popular', (req, res) => loadGameList(req, res, '/stats/most-popular/v1', 'games', {}, 500));

// Regalos por tiempo limitado; no es un catálogo de juegos free-to-play.
router.get('/giveaways', (req, res) => loadGameList(req, res, '/giveaways/v1', 'giveaways', {
  expired: false, sort: '-publish',
}));

// Mejores ofertas: descuentos entre 80% y 90%, del mayor al menor, en USD.
router.get('/deals', (req, res) => loadGameList(req, res, '/deals/v2', 'deals', {
  country: 'US', sort: '-cut', nondeals: false,
  filter: JSON.stringify({ cut: { min: 80, max: 90 } }),
}, 200));

// Informacion sobre el precio del juego por id
router.get('/:id/prices', async (req, res) => {
  const gameId = req.params.id;

  const url = new URL(`https://api.isthereanydeal.com/games/prices/v3`);

  url.searchParams.append('country', 'US');

  const config = {
    headers: {
      'ITAD-API-Key': process.env.ITAD_API_KEY,
      'content-type': 'application/json',
    },
  }

  const payload = [gameId];


  try {
    const response = await fetch(url, {
      ...config,
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!response.ok) { return res.status(response.status).json({ error: 'No se pudieron obtener los precios del juego' }) }
    const game = await response.json();
    res.json(game);
  } catch (error) {
    console.error('Error al obtener los precios del juego:', error);
    res.status(500).json({ error: 'No se pudieron obtener los precios del juego' });
  }

})





export default router;
