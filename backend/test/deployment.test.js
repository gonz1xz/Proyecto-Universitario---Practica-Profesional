import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { API_BASE_URL } from '../../frontend/src/services/apiBaseUrl.js';

test('salud y CORS para el frontend publicado, sin cookies ni comodines', async () => {
  const previous = process.env.CORS_ORIGIN;
  process.env.CORS_ORIGIN = 'https://auraprices.example/,https://preview.example';
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const health = await fetch(base + '/api/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    const allowed = await fetch(base + '/api/health', { headers: { Origin: 'https://auraprices.example' } });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://auraprices.example');
    assert.equal(allowed.headers.get('Access-Control-Allow-Credentials'), null);
    assert.match(allowed.headers.get('Access-Control-Expose-Headers'), /X-Price-History-Saved/);
    const preflight = await fetch(base + '/api/favorites', { method: 'OPTIONS', headers: {
      Origin: 'https://preview.example', 'Access-Control-Request-Method': 'DELETE', 'Access-Control-Request-Headers': 'authorization,content-type',
    } });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get('Access-Control-Allow-Methods'), /DELETE/);
    assert.match(preflight.headers.get('Access-Control-Allow-Headers'), /Authorization/);
    const forbidden = await fetch(base + '/api/health', { headers: { Origin: 'https://other.example' } });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.headers.get('Access-Control-Allow-Origin'), null);
    assert.match((await forbidden.json()).message, /origen/);
    const invalidJson = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(invalidJson.status, 400);
    assert.match((await invalidJson.json()).message, /JSON válido/);
    assert.equal(API_BASE_URL, '/api', 'el desarrollo y los tests conservan la URL relativa');
  } finally {
    if (previous === undefined) delete process.env.CORS_ORIGIN; else process.env.CORS_ORIGIN = previous;
    await new Promise(resolve => server.close(resolve));
  }
});

test('producción confía en un proxy y no permite dominios de vista previa arbitrarios', async () => {
  const previousMode = process.env.NODE_ENV;
  const previousOrigin = process.env.CORS_ORIGIN;
  process.env.NODE_ENV = 'production';
  delete process.env.CORS_ORIGIN;
  const { default: productionApp } = await import('../src/app.js?deployment-test');
  assert.equal(productionApp.get('trust proxy'), 1);
  const server = productionApp.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/health', { headers: { Origin: 'https://unknown.vercel.app' } });
    assert.equal(response.status, 403);
  } finally {
    if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode;
    if (previousOrigin === undefined) delete process.env.CORS_ORIGIN; else process.env.CORS_ORIGIN = previousOrigin;
    await new Promise(resolve => server.close(resolve));
  }
});
