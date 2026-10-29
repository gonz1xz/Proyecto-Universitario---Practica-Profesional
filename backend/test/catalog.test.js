import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import gamesRouter from '../src/routes/gamesRouter.js';
import { filterSearchGames } from '../../frontend/src/services/catalogFilters.js';

test('catálogo, filtros y precios de búsqueda', async (t) => {
  const app = express();
  app.use('/api/games', gamesRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const nativeFetch = globalThis.fetch;
  const originalKey = process.env.ITAD_API_KEY;
  process.env.ITAD_API_KEY = 'test-key';
  t.after(() => {
    globalThis.fetch = nativeFetch;
    if (originalKey === undefined) delete process.env.ITAD_API_KEY; else process.env.ITAD_API_KEY = originalKey;
    server.close();
  });
  const deal = (amount, cut, shop = 61) => ({ price: { amount, currency: 'USD' }, cut, shop: { id: shop, name: 'Tienda' } });
  await t.test('reenvía filtros, orden y paginación a ITAD', async () => {
    globalThis.fetch = async (url) => {
      assert.equal(url.pathname, '/deals/v2');
      assert.equal(url.searchParams.get('offset'), '24');
      assert.equal(url.searchParams.get('sort'), '-price');
      assert.equal(url.searchParams.get('shops'), '61');
      assert.equal(url.searchParams.get('nondeals'), 'false');
      assert.deepEqual(JSON.parse(url.searchParams.get('filter')), { price: { min: 0, max: 10 }, cut: { min: 50, max: 100 } });
      return Response.json({ list: [{ id: 'a', deal: deal(5, 60) }], hasMore: true, nextOffset: 48 });
    };
    const response = await nativeFetch(base + '/api/games/catalog?offset=24&sort=-price&shop=61&maxPrice=10&minDiscount=50');
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.games[0].deal.price.amount, 5);
    assert.equal(data.nextOffset, 48);
  });
  await t.test('rechaza filtros inválidos sin consultar la fuente', async () => {
    globalThis.fetch = () => { throw new Error('No debería consultar ITAD'); };
    for (const query of ['offset=-1', 'maxPrice=-5', 'minDiscount=101', 'shop=999', 'sort=incorrecto']) {
      assert.equal((await nativeFetch(base + '/api/games/catalog?' + query)).status, 400);
    }
  });
  await t.test('conserva el error HTTP de la fuente', async () => {
    globalThis.fetch = async () => Response.json({}, { status: 429 });
    assert.equal((await nativeFetch(base + '/api/games/catalog')).status, 429);
  });
  await t.test('relaciona precios por ID, no por posición', async () => {
    globalThis.fetch = async (url, config) => url.pathname.includes('search')
      ? Response.json([{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }])
      : (assert.deepEqual(JSON.parse(config.body), ['a', 'b']), Response.json([{ id: 'b', deals: [deal(0, 100)] }, { id: 'a', deals: [deal(10, 50)] }]));
    const data = await (await nativeFetch(base + '/api/games?search=Juego&includePrices=true')).json();
    assert.equal(data[0].deals[0].price.amount, 10);
    assert.equal(data[1].deals[0].price.amount, 0);
  });
  await t.test('filtros seleccionan la oferta válida y ordenan gratis y sin precio', () => {
    const games = [{ id: 'a', title: 'A', deals: [deal(2, 0, 35), deal(5, 50)] }, { id: 'b', title: 'B', deals: [deal(0, 100)] }, { id: 'c', title: 'C', deals: [] }];
    const filters = { sort: 'price', shop: '', maxPrice: '', minDiscount: '0' };
    assert.deepEqual(filterSearchGames(games, filters).map(g => g.id), ['b', 'a', 'c']);
    assert.equal(filterSearchGames(games, { ...filters, shop: '61', minDiscount: '50' })[1].deal.price.amount, 5);
    assert.deepEqual(filterSearchGames(games, { ...filters, maxPrice: '0' }).map(g => g.id), ['b']);
    assert.deepEqual(filterSearchGames(games, { ...filters, sort: '-price' }).map(g => g.id), ['a', 'b', 'c']);
  });

  await t.test('rankings consultan sus fuentes y relacionan precios y portadas por ID', async () => {
    for (const [sort, endpoint] of [['popular', 'most-popular'], ['waitlisted', 'most-waitlisted'], ['collected', 'most-collected']]) {
      globalThis.fetch = async (url, config) => {
        if (url.pathname.startsWith('/stats/')) {
          assert.equal(url.pathname, '/stats/' + endpoint + '/v1');
          assert.equal(url.searchParams.get('offset'), '24');
          assert.equal(url.searchParams.get('limit'), '24');
          return Response.json([{ id: 'rank-a', title: 'A', position: 25 }, { id: 'rank-b', title: 'B', position: 26 }]);
        }
        if (url.pathname === '/games/prices/v3') {
          assert.equal(url.searchParams.get('country'), 'US');
          assert.deepEqual(JSON.parse(config.body), ['rank-a', 'rank-b']);
          return Response.json([{ id: 'rank-b', deals: [deal(0, 100)] }, { id: 'rank-a', deals: [deal(10, 0)] }]);
        }
        assert.equal(url.pathname, '/games/info/v2');
        return Response.json({ id: url.searchParams.get('id'), assets: { banner600: 'https://example.com/game.jpg' } });
      };
      const response = await nativeFetch(base + '/api/games/catalog?sort=' + sort + '&offset=24');
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.games[0].position, 25);
      assert.equal(data.games[0].deals[0].price.amount, 10);
      assert.equal(data.games[1].deals[0].price.amount, 0);
      assert.ok(data.games[0].assets.banner600);
      assert.equal(data.nextOffset, 26);
      assert.equal(data.hasMore, false);
      assert.deepEqual(filterSearchGames(data.games, { sort, shop: '', maxPrice: '', minDiscount: '0' }).map(game => game.id), ['rank-a', 'rank-b']);
      assert.deepEqual(filterSearchGames(data.games, { sort, shop: '61', maxPrice: '0', minDiscount: '50' }).map(game => game.id), ['rank-b']);
    }
  });
  await t.test('ranking conserva paginación y maneja vacío, errores y datos inválidos', async () => {
    const request = () => nativeFetch(base + '/api/games/catalog?sort=popular');
    globalThis.fetch = async url => {
      if (url.pathname.startsWith('/stats/')) return Response.json(Array.from({ length: 24 }, (_, index) => ({ id: 'rank-full-' + index, title: 'Juego ' + index, position: index + 1 })));
      if (url.pathname === '/games/prices/v3') return Response.json([]);
      return Response.json({}, { status: 404 });
    };
    const full = await (await request()).json();
    assert.equal(full.hasMore, true);
    assert.equal(full.nextOffset, 24);
    globalThis.fetch = async () => Response.json([]);
    assert.deepEqual(await (await request()).json(), { games: [], hasMore: false, nextOffset: 0 });
    globalThis.fetch = async () => Response.json({}, { status: 429 });
    assert.equal((await request()).status, 429);
    globalThis.fetch = async () => Response.json([{ id: 'a', title: 'A' }]);
    assert.equal((await request()).status, 502);
    globalThis.fetch = async url => url.pathname.startsWith('/stats/') ? Response.json([{ id: 'a', title: 'A', position: 1 }]) : Response.json({}, { status: 429 });
    assert.equal((await request()).status, 429);
    delete process.env.ITAD_API_KEY;
    assert.equal((await request()).status, 503);
    process.env.ITAD_API_KEY = 'test-key';
  });
});
