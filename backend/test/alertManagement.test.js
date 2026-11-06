import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/prisma.js';

test('gestión de alertas: listado paginado, títulos, aislamiento y eliminación', async () => {
  const nativeFetch = globalThis.fetch;
  const users = [];
  const ids = Array.from({ length: 25 }, () => randomUUID());
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/notifications/alerts`;
  async function request(path, token, method = 'GET') {
    const response = await nativeFetch(base + path, { method, headers: { Authorization: 'Bearer ' + token } });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  }
  try {
    for (let index = 0; index < 2; index++) users.push(await prisma.user.create({ data: {
      email: `alerts-${randomUUID()}@example.com`, username: 'Prueba alertas', password: 'no-utilizable',
    } }));
    const tokens = users.map(user => jwt.sign({ userId: user.id, type: 'access' }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5m' }));
    await prisma.game.createMany({ data: ids.map(itadGameId => ({ itadGameId })) });
    const games = await prisma.game.findMany({ where: { itadGameId: { in: ids } } });
    await prisma.favorite.createMany({ data: games.map(game => ({ userId: users[0].id, gameId: game.id })) });
    await prisma.priceAlert.createMany({ data: games.map(game => ({ userId: users[0].id, gameId: game.id, targetPrice: 10, currency: 'USD' })) });
    const shared = games[0];
    await prisma.favorite.create({ data: { userId: users[1].id, gameId: shared.id } });
    await prisma.priceAlert.create({ data: { userId: users[1].id, gameId: shared.id, targetPrice: 15, currency: 'USD' } });
    globalThis.fetch = async url => Response.json({ id: url.searchParams.get('id'), title: 'Título de prueba' });
    assert.equal((await request('', '')).status, 401);
    assert.equal((await request('/' + shared.itadGameId, '', 'DELETE')).status, 401);
    for (const query of ['?offset=-1', '?offset=1.5', '?offset=1&offset=2']) assert.equal((await request(query, tokens[0])).status, 400);
    const first = (await request('', tokens[0])).data;
    assert.equal(first.total, 25);
    assert.equal(first.alerts.length, 24);
    assert.equal(first.hasMore, true);
    assert.equal(first.nextOffset, 24);
    assert.equal(first.alerts[0].game.title, 'Título de prueba');
    assert.equal(first.alerts[0].userId, undefined);
    const last = (await request('?offset=24', tokens[0])).data;
    assert.equal(last.alerts.length, 1);
    assert.equal(last.hasMore, false);
    assert.ok(!first.alerts.some(alert => alert.id === last.alerts[0].id));
    assert.equal((await request('', tokens[1])).data.alerts.length, 1);
    globalThis.fetch = async () => { throw new Error('ITAD no disponible'); };
    const fallback = await request('', tokens[0]);
    assert.equal(fallback.status, 200);
    assert.equal(fallback.data.alerts.length, 24);
    assert.ok(fallback.data.alerts.every(alert => alert.game.detailsUnavailable && alert.game.id));
    const notifications = [];
    for (const user of users) notifications.push(await prisma.notification.create({ data: {
      userId: user.id, itadGameId: shared.itadGameId, gameTitle: 'Título de prueba', type: 'target',
      price: 8, currency: 'USD', storeName: 'Tienda de prueba', emailStatus: 'pending',
    } }));
    assert.equal((await request('/invalid', tokens[0], 'DELETE')).status, 400);
    assert.equal((await request('/' + shared.itadGameId.toUpperCase(), tokens[0], 'DELETE')).status, 204);
    assert.equal(await prisma.priceAlert.count({ where: { userId: users[0].id, gameId: shared.id } }), 0);
    assert.equal(await prisma.priceAlert.count({ where: { userId: users[1].id, gameId: shared.id } }), 1);
    assert.equal(await prisma.favorite.count({ where: { gameId: shared.id } }), 2, 'eliminar una alerta conserva los favoritos');
    assert.equal((await prisma.notification.findUnique({ where: { id: notifications[0].id } })).emailStatus, 'cancelled');
    assert.equal((await prisma.notification.findUnique({ where: { id: notifications[1].id } })).emailStatus, 'pending');
    assert.equal((await request('/' + shared.itadGameId, tokens[0], 'DELETE')).status, 204, 'eliminar otra vez es seguro');
  } finally {
    globalThis.fetch = nativeFetch;
    await new Promise(resolve => server.close(resolve));
    const userIds = users.map(user => user.id);
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.priceAlert.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.favorite.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.game.deleteMany({ where: { itadGameId: { in: ids } } });
    await prisma.$disconnect();
  }
});
