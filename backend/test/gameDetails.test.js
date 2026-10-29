import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import app from '../src/app.js';
import { descriptionText } from '../src/services/gameDetails.js';
import { getGameDetails as getDetailsClient } from '../../frontend/src/services/gamesApi.js';

test('descripción como texto sin HTML ejecutable y con párrafos', () => {
  assert.equal(descriptionText('<p>A &amp; B</p><p>Otro párrafo.</p><script>alert(1)</script>'), 'A & B\nOtro párrafo.');
  assert.equal(descriptionText('<img src=x onerror=alert(1)>'), null);
  assert.equal(descriptionText(null), null);
  assert.equal(descriptionText('a'.repeat(7000)).length, 6000);
});

test('ficha de juego, capturas, caché y fallos parciales', async t => {
  const nativeFetch = globalThis.fetch;
  const originalKey = process.env.ITAD_API_KEY;
  process.env.ITAD_API_KEY = 'test-key';
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/games/`;
  const request = id => nativeFetch(base + id + '/details');
  const info = (id, appid = 42) => ({ id, title: 'Juego de prueba', appid, assets: { banner600: 'https://example.com/banner.jpg', boxart: 'javascript:alert(1)' }, developers: [{ name: 'Estudio de prueba' }] });
  const steam = (appid = 42) => ({ [appid]: { success: true, data: { steam_appid: appid, short_description: '<b>Una aventura</b> &amp; exploración.', screenshots: Array.from({ length: 8 }, (_, index) => ({ path_full: 'https://example.com/screen-' + index + '.jpg' })) } } });
  try {
    await t.test('valida ID y configuración antes de llamar al proveedor', async () => {
      globalThis.fetch = () => { throw new Error('No debe consultar el proveedor'); };
      assert.equal((await request('invalid')).status, 400);
      delete process.env.ITAD_API_KEY;
      assert.equal((await request(randomUUID())).status, 503);
      process.env.ITAD_API_KEY = 'test-key';
    });
    await t.test('combina por identificador, filtra imágenes y reutiliza caché', async () => {
      const id = randomUUID();
      let calls = 0;
      globalThis.fetch = async (url, config) => {
        calls++;
        assert.ok(config.signal instanceof AbortSignal);
        if (url.hostname === 'api.isthereanydeal.com') {
          assert.equal(url.searchParams.get('id'), id);
          assert.equal(config.headers['ITAD-API-Key'], 'test-key');
          return Response.json(info(id));
        }
        assert.equal(url.hostname, 'store.steampowered.com');
        assert.equal(url.searchParams.get('appids'), '42');
        assert.equal(url.searchParams.get('l'), 'spanish');
        assert.equal(config.headers, undefined, 'no enviar la clave de ITAD a Steam');
        const result = steam();
        result[42].data.screenshots.unshift({ path_full: 'data:text/html,invalid' });
        return Response.json(result);
      };
      const response = await request(id.toUpperCase());
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.description, 'Una aventura & exploración.');
      assert.equal(data.screenshots.length, 6);
      assert.equal(data.assets.boxart, undefined);
      assert.deepEqual(data.developers, ['Estudio de prueba']);
      assert.equal(data.mediaUnavailable, false);
      assert.equal(data.steamUrl, 'https://store.steampowered.com/app/42/');
      assert.equal((await request(id)).status, 200);
      assert.equal(calls, 2);
    });
    await t.test('juego sin Steam conserva portada sin inventar descripción', async () => {
      const id = randomUUID();
      let calls = 0;
      globalThis.fetch = async () => { calls++; return Response.json(info(id, null)); };
      const data = await (await request(id)).json();
      assert.equal(calls, 1);
      assert.equal(data.description, null);
      assert.deepEqual(data.screenshots, []);
      assert.equal(data.mediaUnavailable, false);
      assert.equal(data.steamUrl, null);
      assert.ok(data.assets.banner600);
    });
    await t.test('fallo de Steam conserva ficha y permite un reintento real', async () => {
      const id = randomUUID();
      globalThis.fetch = async url => {
        if (url.hostname === 'api.isthereanydeal.com') return Response.json(info(id));
        throw new Error('Fallo simulado de Steam');
      };
      const partial = await (await request(id)).json();
      assert.equal(partial.mediaUnavailable, true);
      assert.ok(partial.assets.banner600);
      globalThis.fetch = async url => Response.json(url.hostname === 'api.isthereanydeal.com' ? info(id) : steam());
      assert.equal((await (await request(id)).json()).mediaUnavailable, false);
    });
    await t.test('no mezcla fichas y conserva errores 404 y 429', async () => {
      for (const status of [404, 429]) {
        globalThis.fetch = async () => Response.json({}, { status });
        assert.equal((await request(randomUUID())).status, status);
      }
      globalThis.fetch = async () => Response.json(info(randomUUID()));
      assert.equal((await request(randomUUID())).status, 502);
      const id = randomUUID();
      globalThis.fetch = async url => Response.json(url.hostname === 'api.isthereanydeal.com' ? info(id) : steam(99));
      const mismatch = await (await request(id)).json();
      assert.equal(mismatch.mediaUnavailable, true);
      assert.equal(mismatch.description, null);
    });
    await t.test('cliente maneja HTTP, formato y cancelación', async () => {
      const id = randomUUID();
      globalThis.fetch = async () => Response.json({ error: 'No se encontró información.' }, { status: 404 });
      await assert.rejects(getDetailsClient(id), /No se encontró información/);
      globalThis.fetch = async () => Response.json(null);
      await assert.rejects(getDetailsClient(id), /formato esperado/);
      globalThis.fetch = async () => { const error = new Error('Cancelado'); error.name = 'AbortError'; throw error; };
      await assert.rejects(getDetailsClient(id), { name: 'AbortError' });
    });
  } finally {
    globalThis.fetch = nativeFetch;
    if (originalKey === undefined) delete process.env.ITAD_API_KEY; else process.env.ITAD_API_KEY = originalKey;
    await new Promise(resolve => server.close(resolve));
  }
});
