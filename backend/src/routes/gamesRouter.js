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
