import test from 'node:test';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/prisma.js';

test('eliminación múltiple de favoritos: usuario, alertas e historial', async () => {
  const suffix = randomUUID();
  const emails = [0, 1].map(index => `selection-${index}-${suffix}@example.com`);
  const gameIds = [randomUUID(), randomUUID(), randomUUID()];
  const users = [];
  const games = [];
  let store;
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/favorites`;
  async function remove(token, body) {
    const response = await fetch(base, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }
  try {
    for (const email of emails) users.push(await prisma.user.create({ data: { email, username: 'Prueba selección', password: 'no-utilizable' } }));
    for (const itadGameId of gameIds) games.push(await prisma.game.create({ data: { itadGameId } }));
    for (const [userId, gameId] of [[users[0].id, games[0].id], [users[0].id, games[1].id], [users[1].id, games[0].id], [users[1].id, games[2].id]]) {
      await prisma.favorite.create({ data: { userId, gameId } });
      await prisma.priceAlert.create({ data: { userId, gameId, targetPrice: 10, currency: 'USD' } });
    }
    store = await prisma.store.create({ data: { itadStoreId: String(randomInt(1000000000, 1900000000)), name: 'Prueba selección' } });
    await prisma.priceRecord.create({ data: { gameId: games[0].id, storeId: store.id, price: 8, currency: 'USD' } });
    const token = jwt.sign({ userId: users[0].id, type: 'access' }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5m' });
    assert.equal((await remove('', { itadGameIds: gameIds })).status, 401);
    for (const itadGameIds of [[], 'invalid', ['invalid'], [null], Array(101).fill(gameIds[0])]) {
      assert.equal((await remove(token, { itadGameIds })).status, 400);
    }
    assert.equal(await prisma.favorite.count({ where: { userId: users[0].id } }), 2, 'validación no elimina datos');
    const removed = await remove(token, { itadGameIds: [gameIds[0].toUpperCase(), ...gameIds], userId: users[1].id });
    assert.equal(removed.status, 200);
    assert.equal(removed.data.removedCount, 2);
    assert.deepEqual(removed.data.removedIds, gameIds);
    assert.equal(await prisma.favorite.count({ where: { userId: users[0].id } }), 0);
    assert.equal(await prisma.priceAlert.count({ where: { userId: users[0].id } }), 0);
    assert.equal(await prisma.favorite.count({ where: { userId: users[1].id } }), 2);
    assert.equal(await prisma.priceAlert.count({ where: { userId: users[1].id } }), 2);
    assert.equal(await prisma.priceRecord.count({ where: { gameId: games[0].id } }), 1);
    assert.equal((await remove(token, { itadGameIds: gameIds })).data.removedCount, 0, 'repetir es seguro');
  } finally {
    await new Promise(resolve => server.close(resolve));
    try {
      const userIds = users.map(user => user.id);
      await prisma.priceAlert.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.favorite.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
      await prisma.priceRecord.deleteMany({ where: { game: { itadGameId: { in: gameIds } } } });
      await prisma.game.deleteMany({ where: { itadGameId: { in: gameIds } } });
      if (store) await prisma.store.deleteMany({ where: { id: store.id, priceRecords: { none: {} } } });
    } finally { await prisma.$disconnect(); }
  }
});
