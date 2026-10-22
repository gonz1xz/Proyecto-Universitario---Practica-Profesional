import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import gamesRouter from '../src/routes/gamesRouter.js';

test('listas de populares, regalos y mejores ofertas', async (t) => {
  const app = express();
  app.use('/api/games', gamesRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/games';
  const nativeFetch = globalThis.fetch;
  const originalKey = process.env.ITAD_API_KEY;
  process.env.ITAD_API_KEY = 'test-key';
  t.after(async () => {
    globalThis.fetch = nativeFetch;
    if (originalKey === undefined) delete process.env.ITAD_API_KEY;
    else process.env.ITAD_API_KEY = originalKey;
    await new Promise(resolve => server.close(resolve));
  });
  const request = path => nativeFetch(base + path);
  const offer = { id: 'offer', title: 'Oferta', deal: { price: { amount: 5, currency: 'USD' }, cut: 85, shop: { name: 'Tienda' } } };

  for (const [path, endpoint, key, item] of [
    ['/popular', '/stats/most-popular/v1', 'games', { id: 'a', title: 'Juego', position: 1, count: 100 }],
    ['/giveaways', '/giveaways/v1', 'giveaways', { id: 1, title: 'Regalo', expiry: '2026-12-01T00:00:00Z', games: [] }],
    ['/deals', '/deals/v2', 'deals', offer],
  ]) {
    await t.test(path + ' consulta su fuente y conserva los datos', async () => {
      globalThis.fetch = async (url, config) => {
        assert.equal(url.pathname, endpoint);
        assert.equal(url.searchParams.get('offset'), '20');
        assert.equal(url.searchParams.get('limit'), '5');
        assert.equal(config.headers['ITAD-API-Key'], 'test-key');
        assert.ok(config.signal instanceof AbortSignal);
        if (path === '/giveaways') {
          assert.equal(url.searchParams.get('expired'), 'false');
          assert.equal(url.searchParams.get('sort'), '-publish');
        }
        assert.equal(url.searchParams.get('country'), path === '/deals' ? 'US' : null);
        if (path === '/deals') {
          assert.equal(url.searchParams.get('sort'), '-cut');
          assert.equal(url.searchParams.get('nondeals'), 'false');
          assert.deepEqual(JSON.parse(url.searchParams.get('filter')), { cut: { min: 80, max: 90 } });
          return Response.json({ list: [item], hasMore: true, nextOffset: 25 });
        }
        return Response.json([item]);
      };
      const response = await request(path + '?offset=20&limit=5&country=AR');
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { [key]: [item], offset: 20, limit: 5, ...(path === '/deals' ? { hasMore: true, nextOffset: 25 } : {}) });
    });
  }
  await t.test('rechaza paginación inválida antes de consultar ITAD', async () => {
    globalThis.fetch = () => { throw new Error('No debe consultar la fuente'); };
    for (const path of ['/popular', '/giveaways', '/deals']) {
      for (const query of ['offset=-1', 'offset=1.5', 'offset=', 'limit=0', 'limit=abc', 'limit=1&limit=2', 'offset=9007199254740992']) {
        assert.equal((await request(path + '?' + query)).status, 400);
      }
    }
    assert.equal((await request('/popular?limit=501')).status, 400);
    assert.equal((await request('/giveaways?limit=51')).status, 400);
    assert.equal((await request('/deals?limit=201')).status, 400);
  });
  await t.test('lista vacía y paginación predeterminada', async () => {
    globalThis.fetch = async () => Response.json([]);
    const response = await request('/giveaways');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { giveaways: [], offset: 0, limit: 20 });
  });
  await t.test('mantiene errores HTTP de la fuente', async () => {
    globalThis.fetch = async () => Response.json({}, { status: 429 });
    for (const path of ['/popular', '/giveaways', '/deals']) assert.equal((await request(path)).status, 429);
  });
  await t.test('rechaza formato inesperado, JSON inválido y fallo de red', async () => {
    for (const fetchMock of [
      async () => Response.json({ list: [] }),
      async () => Response.json([null]),
      async () => new Response('no es JSON'),
      async () => { throw new Error('Fallo de red'); },
    ]) {
      globalThis.fetch = fetchMock;
      for (const path of ['/popular', '/giveaways', '/deals']) assert.equal((await request(path)).status, 502);
    }
  });
  await t.test('ofertas rechaza moneda distinta, falta de descuento y paginación inválida', async () => {
    for (const data of [
      { list: [{ ...offer, deal: { ...offer.deal, price: { amount: 10, currency: 'ARS' } } }], hasMore: false, nextOffset: 1 },
      { list: [{ ...offer, deal: { ...offer.deal, cut: 0 } }], hasMore: false, nextOffset: 1 },
      { list: [offer], hasMore: false, nextOffset: -1 },
      { list: [offer] },
    ]) {
      globalThis.fetch = async () => Response.json(data);
      assert.equal((await request('/deals')).status, 502);
    }
  });
  await t.test('ofertas acepta los límites 80 y 90 y listas vacías', async () => {
    for (const cut of [80, 90]) {
      const boundaryOffer = { ...offer, deal: { ...offer.deal, cut } };
      globalThis.fetch = async () => Response.json({ list: [boundaryOffer], hasMore: false, nextOffset: 1 });
      const response = await request('/deals?limit=6');
      assert.equal(response.status, 200);
      assert.equal((await response.json()).deals[0].deal.cut, cut);
    }
    globalThis.fetch = async () => Response.json({ list: [], hasMore: false, nextOffset: 0 });
    const empty = await request('/deals');
    assert.equal(empty.status, 200);
    assert.deepEqual((await empty.json()).deals, []);
  });
  await t.test('ofertas rechaza descuentos fuera del rango, incluidos regalos de 100%', async () => {
    for (const cut of [79, 91, 100]) {
      globalThis.fetch = async () => Response.json({ list: [{ ...offer, deal: { ...offer.deal, cut } }], hasMore: false, nextOffset: 1 });
      assert.equal((await request('/deals')).status, 502);
    }
  });
  await t.test('ruta anterior de bundles eliminada', async () => {
    globalThis.fetch = () => { throw new Error('No debe consultar la fuente'); };
    assert.equal((await request('/bundles')).status, 404);
  });
  await t.test('populares agrega portadas por ID, preserva orden y reutiliza caché', async () => {
    let infoCalls = 0;
    globalThis.fetch = async url => {
      if (url.pathname.includes('most-popular')) return Response.json([
        { id: 'image-test-a', title: 'A', position: 1 }, { id: 'image-test-b', title: 'B', position: 2 },
      ]);
      assert.equal(url.pathname, '/games/info/v2');
      infoCalls++;
      const id = url.searchParams.get('id');
      return Response.json({ id, assets: { banner600: 'https://example.com/' + id + '.jpg' } });
    };
    const response = await request('/popular?limit=6&includeAssets=true');
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.games.map(game => game.id), ['image-test-a', 'image-test-b']);
    assert.equal(data.games[0].assets.banner600, 'https://example.com/image-test-a.jpg');
    assert.equal(data.games[0].position, 1);
    await request('/popular?limit=6&includeAssets=true');
    assert.equal(infoCalls, 2);
  });
  await t.test('fallo de portada conserva el popular y un ID incorrecto no se mezcla', async () => {
    globalThis.fetch = async url => {
      if (url.pathname.includes('most-popular')) return Response.json([
        { id: 'failed-image', title: 'Fallo' }, { id: 'wrong-image', title: 'Otro' },
      ]);
      if (url.searchParams.get('id') === 'failed-image') throw new Error('Fallo de red');
      return Response.json({ id: 'unrelated', assets: { banner600: 'https://example.com/wrong.jpg' } });
    };
    const response = await request('/popular?limit=6&includeAssets=true');
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.games.length, 2);
    assert.equal(data.games[0].assets, null);
    assert.equal(data.games[1].assets, null);
  });
  await t.test('valida includeAssets y limita consultas de portadas', async () => {
    globalThis.fetch = () => { throw new Error('No debe consultar la fuente'); };
    for (const query of ['includeAssets=invalid', 'includeAssets=true&includeAssets=false', 'includeAssets=true&limit=25']) {
      assert.equal((await request('/popular?' + query)).status, 400);
    }
  });
  await t.test('falta de clave devuelve 503 sin consultar ITAD', async () => {
    delete process.env.ITAD_API_KEY;
    globalThis.fetch = () => { throw new Error('No debe consultar la fuente'); };
    for (const path of ['/popular', '/giveaways', '/deals']) assert.equal((await request(path)).status, 503);
  });
});
