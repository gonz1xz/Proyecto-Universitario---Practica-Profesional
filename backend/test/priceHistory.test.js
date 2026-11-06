import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import { getPriceHistory as readHistory, normalizeHistory } from '../src/services/priceHistory.js';
import { getGamePrices, getPriceHistory } from '../../frontend/src/services/gamesApi.js';

const entry = (store, price, timestamp = '2026-11-01T12:00:00Z') => ({
  timestamp, shop: { id: store, name: 'Tienda ' + store }, deal: { price: { amount: price, currency: 'USD' } },
});

test('historial ITAD: orden, validación, duplicados, regalos y ofertas retiradas', () => {
  const records = normalizeHistory([
    entry(1, 10), entry(1, 10), entry(2, 0, '2026-11-02T12:00:00Z'),
    { ...entry(3, 9), deal: null }, entry(4, -1), null,
    { ...entry(5, 8), deal: { price: { amount: 8, currency: 'ARS' } } },
    entry(6, 9, 'fecha inválida'), entry(0, 8), entry(7, Infinity),
  ]);
  assert.equal(records.length, 2);
  assert.equal(records[0].price, 0);
  assert.equal(records[1].store.id, '1');
  assert.equal(records[0].recordedAt, '2026-11-02T12:00:00.000Z');
  assert.throws(() => normalizeHistory({ records: [] }), /formato inesperado/);
});

test('cliente: comparación de precios y errores de historial', async () => {
  const original = globalThis.fetch;
  const id = randomUUID();
  try {
    globalThis.fetch = async () => Response.json([{ id: randomUUID(), deals: [] }, { id, deals: [{ price: { amount: 8 } }] }]);
    assert.equal((await getGamePrices(id)).deals[0].price.amount, 8);
    globalThis.fetch = async url => {
      assert.equal(url, '/api/games/' + id + '/history?limit=50&offset=50');
      return Response.json({ records: [], hasMore: false, nextOffset: 50 });
    };
    assert.deepEqual((await getPriceHistory(id, 50)).records, []);
    globalThis.fetch = async () => Response.json({ error: 'No se pudo consultar ITAD.' }, { status: 502 });
    await assert.rejects(getPriceHistory(id), /No se pudo consultar ITAD/);
    globalThis.fetch = async () => Response.json({ records: 'incorrecto' });
    await assert.rejects(getPriceHistory(id), /formato esperado/);
  } finally { globalThis.fetch = original; }
});

test('endpoint de historial consulta ITAD sin persistir precios', async t => {
  const nativeFetch = globalThis.fetch;
  const previousKey = process.env.ITAD_API_KEY;
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/games/';
  const request = path => nativeFetch(base + path);
  try {
    process.env.ITAD_API_KEY = 'clave-solo-de-prueba';
    await t.test('valida ID, paginación y configuración antes de consultar ITAD', async () => {
      globalThis.fetch = () => { throw new Error('No debe consultar ITAD'); };
      assert.equal((await request('invalid/history')).status, 400);
      for (const query of ['limit=0', 'limit=101', 'offset=-1', 'limit=2&limit=3']) {
        assert.equal((await request(randomUUID() + '/history?' + query)).status, 400);
      }
      delete process.env.ITAD_API_KEY;
      assert.equal((await request(randomUUID() + '/history')).status, 503);
      process.env.ITAD_API_KEY = 'clave-solo-de-prueba';
    });
    await t.test('usa ID, país US y clave privada, resume y pagina con caché', async () => {
      const id = randomUUID();
      let calls = 0;
      globalThis.fetch = async (url, options) => {
        calls++;
        assert.equal(url.origin, 'https://api.isthereanydeal.com');
        assert.equal(url.pathname, '/games/history/v2');
        assert.equal(url.searchParams.get('id'), id);
        assert.equal(url.searchParams.get('country'), 'US');
        assert.ok(Math.abs(Date.parse(url.searchParams.get('since')) - (Date.now() - 30 * 24 * 60 * 60 * 1000)) < 5000);
        assert.equal(url.searchParams.has('key'), false);
        assert.equal(options.headers['ITAD-API-Key'], process.env.ITAD_API_KEY);
        return Response.json([entry(1, 8), entry(2, 5, '2026-11-02T12:00:00Z')]);
      };
      const response = await request(id.toUpperCase() + '/history?limit=1');
      assert.equal(response.status, 200);
      const page = await response.json();
      assert.equal(page.source, 'itad');
      assert.equal(page.periodMonths, 1);
      assert.equal(page.periodDays, 30);
      assert.equal(page.records[0].price, 5);
      assert.equal(page.lowestPrice, 5);
      assert.equal(page.firstRecordedAt, '2026-11-01T12:00:00.000Z');
      assert.equal(page.hasMore, true);
      assert.equal(page.nextOffset, 1);
      assert.equal(page.records.length, 1);
      assert.equal(page.chartRecords.length, 2, 'el gráfico recibe todo el período, sin depender de la página');
      const next = await (await request(id + '/history?limit=1&offset=1')).json();
      assert.equal(next.records[0].price, 8);
      assert.equal(next.hasMore, false);
      assert.equal(next.chartRecords, undefined, 'las páginas siguientes no repiten la serie completa');
      assert.equal(calls, 1);
    });
    await t.test('solo muestra el último mes y actualiza la ventana incluso con caché', async () => {
      const id = randomUUID();
      const realNow = Date.now;
      let now = Date.parse('2026-11-05T12:00:00Z');
      let calls = 0;
      Date.now = () => now;
      globalThis.fetch = async () => {
        calls++;
        return Response.json([
          entry(1, 2, '2026-10-06T12:00:00Z'), entry(2, 6),
          entry(3, 0, '2026-10-05T12:00:00Z'), entry(4, 1, '3000-01-01T00:00:00Z'),
        ]);
      };
      try {
        const monthly = await readHistory(id);
        assert.equal(monthly.periodStart, '2026-10-06T12:00:00.000Z');
        assert.equal(monthly.records.length, 2);
        assert.equal(monthly.chartRecords.length, 2);
        assert.equal(monthly.lowestPrice, 2, 'no usar mínimos anteriores al mes');
        assert.equal(monthly.firstRecordedAt, '2026-10-06T12:00:00.000Z');
        now += 5 * 60 * 1000;
        const advanced = await readHistory(id);
        assert.equal(advanced.records.length, 1);
        assert.equal(advanced.lowestPrice, 6);
        assert.equal(advanced.firstRecordedAt, '2026-11-01T12:00:00.000Z');
        assert.equal(calls, 1, 'filtrar de nuevo sin repetir la consulta externa');
      } finally { Date.now = realNow; }
    });
    await t.test('caché vence y comparte consultas simultáneas', async () => {
      const id = randomUUID();
      let calls = 0;
      const realNow = Date.now;
      globalThis.fetch = async () => {
        calls++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return Response.json([entry(1, calls)]);
      };
      await Promise.all([readHistory(id), readHistory(id)]);
      assert.equal(calls, 1);
      try {
        const later = realNow() + 16 * 60 * 1000;
        Date.now = () => later;
        assert.equal((await readHistory(id)).lowestPrice, 2);
        assert.equal(calls, 2);
      } finally { Date.now = realNow; }
    });
    await t.test('errores del proveedor no se guardan en caché y permiten reintento', async () => {
      const id = randomUUID();
      for (const status of [429, 500, 403]) {
        globalThis.fetch = async () => Response.json({}, { status });
        assert.equal((await request(id + '/history')).status, status === 429 ? 429 : 502);
      }
      globalThis.fetch = async () => { throw new Error('Error privado'); };
      const response = await request(id + '/history');
      assert.equal(response.status, 502);
      assert.doesNotMatch(JSON.stringify(await response.json()), /Error privado/);
      globalThis.fetch = async () => Response.json({ invalid: true });
      assert.equal((await request(id + '/history')).status, 502);
      globalThis.fetch = async () => new Response('no es JSON');
      assert.equal((await request(id + '/history')).status, 502);
      globalThis.fetch = async () => Response.json([]);
      const empty = await (await request(id + '/history')).json();
      assert.deepEqual(empty.records, []);
      assert.equal(empty.lowestPrice, null);
      assert.equal(empty.firstRecordedAt, null);
    });
    await t.test('comparador obtiene precios sin escribir historial', async () => {
      const id = randomUUID();
      globalThis.fetch = async () => Response.json([{ id, deals: [{ price: { amount: 8, currency: 'USD' } }] }]);
      const response = await request(id + '/prices');
      assert.equal(response.status, 200);
      assert.equal((await response.json())[0].deals[0].price.amount, 8);
    });
  } finally {
    globalThis.fetch = nativeFetch;
    if (previousKey === undefined) delete process.env.ITAD_API_KEY; else process.env.ITAD_API_KEY = previousKey;
    await new Promise(resolve => server.close(resolve));
  }
});
