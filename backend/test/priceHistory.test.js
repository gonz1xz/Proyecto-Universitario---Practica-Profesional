import test from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import app from '../src/app.js';
import prisma from '../src/prisma.js';
import { recordPriceHistory, selectHistoryDeals } from '../src/services/priceHistory.js';
import { checkPriceNotifications } from '../src/services/priceNotifications.js';
import { getGamePrices, getPriceHistory } from '../../frontend/src/services/gamesApi.js';

const deal = (storeId, amount, currency = 'USD') => ({
  shop: { id: storeId, name: 'Tienda de prueba ' + storeId }, price: { amount, currency }, cut: 0,
});

test('cliente de precios relaciona por ID y comunica errores de historial', async () => {
  const nativeFetch = globalThis.fetch;
  const id = randomUUID();
  try {
    globalThis.fetch = async () => Response.json([
      { id: randomUUID(), deals: [deal(2, 99)] }, { id, deals: [deal(1, 8)] },
    ], { headers: { 'X-Price-History-Saved': 'false' } });
    const current = await getGamePrices(id);
    assert.equal(current.deals[0].price.amount, 8);
    assert.equal(current.historySaved, false);
    globalThis.fetch = async url => {
      assert.equal(url, '/api/games/' + id + '/history?limit=50&offset=50');
      return Response.json({ records: [], hasMore: false, nextOffset: 50, lowestPrice: null, firstRecordedAt: null });
    };
    assert.deepEqual((await getPriceHistory(id, 50)).records, []);
    globalThis.fetch = async () => Response.json({ error: 'No se pudo consultar el historial.' }, { status: 500 });
    await assert.rejects(getPriceHistory(id), /No se pudo consultar el historial/);
    globalThis.fetch = async () => Response.json({ records: 'incorrecto' });
    await assert.rejects(getPriceHistory(id), /formato esperado/);
  } finally { globalThis.fetch = nativeFetch; }
});

test('historial selecciona el menor precio USD por tienda y descarta datos inválidos', () => {
  const selected = selectHistoryDeals([
    deal(1, 12), deal(1, 8), deal(2, 0), deal(3, -1), deal(4, NaN),
    deal(5, 2, 'ARS'), deal(6, Infinity), deal(0, 1), deal(7, 10000000000),
    { ...deal(8, 1), shop: { id: 8, name: ' ' } }, null,
  ]);
  assert.deepEqual(selected.map(item => [item.storeId, item.price]), [['1', 8], ['2', 0]]);
  assert.deepEqual(selectHistoryDeals(null), []);
});

test('historial persistente, cambios, concurrencia, paginación y revisión automática', async () => {
  const nativeFetch = globalThis.fetch;
  const originalKey = process.env.ITAD_API_KEY;
  const id = randomUUID();
  const secondId = randomUUID();
  const storeId = randomInt(1000000000, 1900000000);
  const secondStoreId = storeId + 1;
  const email = 'history-' + id + '@example.com';
  let user;
  let amount = 12;
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/games/';
  const request = path => nativeFetch(base + path);
  const history = async (query = '') => (await request(id + '/history' + query)).json();
  const count = () => prisma.priceRecord.count({ where: { game: { itadGameId: id } } });
  const mockPrices = () => {
    globalThis.fetch = async () => Response.json([{ id, deals: [deal(storeId, amount), deal(secondStoreId, 20)] }]);
  };

  try {
    process.env.ITAD_API_KEY = 'test-key';
    mockPrices();
    assert.equal((await request('invalid/prices')).status, 400);
    assert.equal((await request('invalid/history')).status, 400);
    for (const query of ['limit=0', 'limit=101', 'offset=-1', 'offset=1.5', 'limit=2&limit=3']) {
      assert.equal((await request(id + '/history?' + query)).status, 400);
    }
    const empty = await history();
    assert.deepEqual(empty.records, []);
    assert.equal(empty.lowestPrice, null);
    assert.equal(empty.firstRecordedAt, null);

    const first = await request(id + '/prices');
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('X-Price-History-Saved'), 'true');
    assert.equal((await first.json())[0].deals.length, 2);
    assert.equal(await count(), 2);
    await Promise.all([request(id + '/prices'), request(id + '/prices')]);
    assert.equal(await count(), 2, 'consultas simultáneas no duplican el mismo precio');

    amount = 8;
    await request(id + '/prices');
    assert.equal(await count(), 3);
    const page = await history('?limit=1');
    assert.equal(page.records[0].price, 8);
    assert.equal(page.records[0].store.id, String(storeId));
    assert.equal(page.records[0].currency, 'USD');
    assert.equal(page.lowestPrice, 8);
    assert.equal(page.hasMore, true);
    assert.equal(page.nextOffset, 1);
    assert.equal((await history('?limit=1&offset=1')).records.length, 1);
    assert.equal((await history('?offset=3')).hasMore, false);

    amount = 12;
    await request(id + '/prices');
    amount = 0;
    await request(id + '/prices');
    assert.equal(await count(), 5, 'registra una subida y un regalo');
    assert.equal((await history()).lowestPrice, 0);
    assert.equal((await request(id.toUpperCase() + '/history')).status, 200);
    await recordPriceHistory(secondId, [deal(storeId, 1)]);
    assert.equal((await history()).records.length, 5, 'no mezcla juegos');

    globalThis.fetch = async () => Response.json([{ id, deals: [deal(storeId, 2, 'ARS'), deal(secondStoreId, -1)] }]);
    await request(id + '/prices');
    assert.equal(await count(), 5, 'datos inválidos no generan precios');
    globalThis.fetch = async () => Response.json({}, { status: 429 });
    assert.equal((await request(id + '/prices')).status, 429);
    globalThis.fetch = async () => Response.json([{ id: secondId, deals: [] }]);
    assert.equal((await request(id + '/prices')).status, 502);
    assert.equal(await count(), 5);

    user = await prisma.user.create({ data: { email, username: 'Prueba historial', password: 'no-utilizable' } });
    const game = await prisma.game.findUnique({ where: { itadGameId: id } });
    await prisma.favorite.create({ data: { userId: user.id, gameId: game.id } });
    globalThis.fetch = async () => Response.json([{ id, deals: [deal(storeId, 4)] }]);
    await checkPriceNotifications();
    await checkPriceNotifications();
    assert.equal(await count(), 6, 'la revisión guarda un cambio una sola vez');
    const latest = (await history()).records;
    assert.equal(latest[0].price, 4);
    assert.equal(latest.filter(record => record.store.id === String(secondStoreId)).length, 1, 'una tienda ausente no se guarda como cero');
    await prisma.favorite.deleteMany({ where: { userId: user.id } });
    await checkPriceNotifications();
    assert.equal((await history()).records.length, 6, 'quitar el favorito conserva el historial');

    mockPrices();
    const originalTransaction = prisma.$transaction;
    prisma.$transaction = async () => { throw new Error('Fallo simulado de guardado'); };
    try {
      const available = await request(id + '/prices');
      assert.equal(available.status, 200, 'el historial no bloquea la comparación');
      assert.equal(available.headers.get('X-Price-History-Saved'), 'false');
    } finally { prisma.$transaction = originalTransaction; }
  } finally {
    globalThis.fetch = nativeFetch;
    if (originalKey === undefined) delete process.env.ITAD_API_KEY; else process.env.ITAD_API_KEY = originalKey;
    await new Promise(resolve => server.close(resolve));
    try {
      if (user) {
        await prisma.favorite.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
      await prisma.priceRecord.deleteMany({ where: { game: { itadGameId: { in: [id, secondId] } } } });
      await prisma.game.deleteMany({ where: { itadGameId: { in: [id, secondId] } } });
      await prisma.store.deleteMany({ where: { itadStoreId: { in: [String(storeId), String(secondStoreId)] }, priceRecords: { none: {} } } });
    } finally { await prisma.$disconnect(); }
  }
});
