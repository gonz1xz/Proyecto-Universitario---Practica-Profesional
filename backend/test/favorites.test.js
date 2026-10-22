import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import prisma from '../src/prisma.js';
import app from '../src/app.js';

test('favoritos persistentes y aislados por usuario', async () => {
  const suffix = randomUUID();
  const gameId = randomUUID();
  const secondGameId = randomUUID();
  const emails = ['favorite-a-' + suffix + '@example.com', 'favorite-b-' + suffix + '@example.com'];
  const nativeFetch = globalThis.fetch;
  const originalKey = process.env.ITAD_API_KEY;
  process.env.ITAD_API_KEY = 'test-key';
  const users = [];
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/favorites';
  async function request(path = '', { token, method = 'GET', body } = {}) {
    const response = await nativeFetch(base + path, { method, headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json',
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  }
  try {
    for (const email of emails) users.push(await prisma.user.create({ data: { username: 'Prueba favoritos', email, password: 'no-utilizable-para-login' } }));
    const [tokenA, tokenB] = users.map(user => jwt.sign({ userId: user.id, type: 'access' }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5m' }));
    for (const method of ['GET', 'POST', 'DELETE']) assert.equal((await request(method === 'DELETE' ? '/' + gameId : '', { method })).status, 401);
    assert.equal((await request('', { token: tokenA, method: 'POST', body: { itadGameId: 'invalido' } })).status, 400);
    assert.equal((await request('/invalido', { token: tokenA, method: 'DELETE' })).status, 400);
    assert.equal((await request('?includeDetails=true&limit=25', { token: tokenA })).status, 400);
    assert.equal((await request('?includeDetails=invalid', { token: tokenA })).status, 400);
    globalThis.fetch = async url => {
      assert.equal(url.pathname, '/games/info/v2');
      const id = url.searchParams.get('id');
      return Response.json({ id, title: 'Juego de prueba', assets: { banner600: 'https://example.com/game.jpg' } });
    };
    const results = await Promise.all([1, 2, 3].map(() => request('', { token: tokenA, method: 'POST', body: { itadGameId: gameId, userId: users[1].id } })));
    assert.ok(results.every(result => result.status === 200));
    assert.equal(await prisma.favorite.count({ where: { userId: users[0].id } }), 1);
    assert.equal(await prisma.favorite.count({ where: { userId: users[1].id } }), 0);
    assert.equal((await request('', { token: tokenA })).data.favorites[0].itadGameId, gameId);
    assert.equal((await request('', { token: tokenB })).data.favorites.length, 0);
    assert.equal((await request('/' + gameId, { token: tokenB, method: 'DELETE' })).status, 204);
    assert.equal((await request('', { token: tokenA })).data.favorites.length, 1);
    // La consulta directa confirma que no se guarda en un array del servidor.
    const saved = await prisma.favorite.findFirst({ where: { userId: users[0].id }, include: { game: true } });
    assert.equal(saved.game.itadGameId, gameId);
    assert.equal((await request('', { token: tokenB, method: 'POST', body: { itadGameId: gameId } })).status, 200);
    assert.equal((await request('', { token: tokenA, method: 'POST', body: { itadGameId: secondGameId } })).status, 200);
    const detailPage = await request('?includeDetails=true&limit=1', { token: tokenA });
    assert.equal(detailPage.status, 200);
    assert.equal(detailPage.data.games.length, 1);
    assert.equal(detailPage.data.games[0].title, 'Juego de prueba');
    assert.equal(detailPage.data.total, 2);
    assert.equal(detailPage.data.hasMore, true);
    const nextPage = await request('?includeDetails=true&limit=1&offset=1', { token: tokenA });
    assert.equal(nextPage.data.hasMore, false);
    assert.notEqual(nextPage.data.games[0].id, detailPage.data.games[0].id);
    globalThis.fetch = async () => { throw new Error('ITAD no disponible'); };
    const unavailable = await request('?includeDetails=true', { token: tokenA });
    assert.equal(unavailable.status, 200);
    assert.equal(unavailable.data.games.length, 2);
    assert.ok(unavailable.data.games.every(game => game.detailsUnavailable));
    assert.equal((await request('', { token: tokenA, method: 'POST', body: { itadGameId: randomUUID() } })).status, 502);
    globalThis.fetch = async () => Response.json({}, { status: 404 });
    assert.equal((await request('', { token: tokenA, method: 'POST', body: { itadGameId: randomUUID() } })).status, 404);
    assert.equal((await request('/' + gameId, { token: tokenA, method: 'DELETE' })).status, 204);
    assert.equal((await request('/' + gameId, { token: tokenA, method: 'DELETE' })).status, 204);
    assert.equal((await request('', { token: tokenB })).data.favorites.length, 1);
    delete process.env.ITAD_API_KEY;
    assert.equal((await request('', { token: tokenA, method: 'POST', body: { itadGameId: gameId } })).status, 503);
    await prisma.favorite.deleteMany({ where: { userId: users[0].id } });
    await prisma.user.delete({ where: { id: users[0].id } });
    assert.equal((await request('', { token: tokenA })).status, 401);
  } finally {
    globalThis.fetch = nativeFetch;
    if (originalKey === undefined) delete process.env.ITAD_API_KEY; else process.env.ITAD_API_KEY = originalKey;
    await new Promise(resolve => server.close(resolve));
    try {
      await prisma.favorite.deleteMany({ where: { userId: { in: users.map(user => user.id) } } });
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
      await prisma.game.deleteMany({ where: { itadGameId: { in: [gameId, secondGameId] } } });
    } finally { await prisma.$disconnect(); }
  }
});
