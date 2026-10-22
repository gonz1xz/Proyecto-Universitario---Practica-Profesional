import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/prisma.js';
import { checkPriceNotifications, selectDeals } from '../src/services/priceNotifications.js';

test('selección de ofertas USD, regalos y datos inválidos', () => {
  const deal = (amount, cut, currency = 'USD') => ({ price: { amount, currency }, cut, shop: { name: 'Tienda' } });
  const selected = selectDeals([deal(-1, 90), deal(1, 90, 'ARS'), deal(5, 0), deal(9, 50), deal(0, 100), deal(NaN, 50)]);
  assert.equal(selected.cheapest.price.amount, 0);
  assert.equal(selected.sale.price.amount, 0);
  assert.equal(selectDeals([deal(5, 0)]).sale, null);
});

test('alertas, notificaciones persistentes, lectura y aislamiento', async () => {
  const nativeFetch = globalThis.fetch;
  const originalKey = process.env.ITAD_API_KEY;
  const id = randomUUID();
  const emails = [0, 1].map(index => `notifications-${index}-${id}@example.com`);
  const users = [];
  let game;
  let amount = 8;
  let cut = 20;
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/notifications`;
  async function request(path, token, method = 'GET', body) {
    const response = await nativeFetch(base + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  }
  try {
    for (const email of emails) users.push(await prisma.user.create({ data: { username: 'Prueba avisos', email, password: 'no-utilizable' } }));
    const tokens = users.map(user => jwt.sign({ userId: user.id, type: 'access' }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5m' }));
    game = await prisma.game.create({ data: { itadGameId: id } });
    await prisma.favorite.create({ data: { userId: users[0].id, gameId: game.id } });
    assert.equal((await request('', '')).status, 401);
    assert.equal((await request('/alerts/' + id, tokens[1], 'PUT', { targetPrice: 10, isActive: true })).status, 404);
    for (const targetPrice of [-1, '10', 1.234, null]) assert.equal((await request('/alerts/' + id, tokens[0], 'PUT', { targetPrice, isActive: true })).status, 400);
    assert.equal((await request('/alerts/' + id, tokens[0], 'PUT', { targetPrice: 10, isActive: true })).status, 200);
    assert.equal(Number((await request('/alerts/' + id, tokens[0])).data.alert.targetPrice), 10);
    process.env.ITAD_API_KEY = 'test-key';
    // Solo devolver precios del juego de prueba: no modificar favoritos reales.
    globalThis.fetch = async url => url.pathname === '/games/prices/v3'
      ? Response.json([{ id, deals: [{ price: { amount, currency: 'USD' }, cut, shop: { name: 'Tienda de prueba' } }] }])
      : Response.json({ id, title: 'Juego de prueba' });
    await checkPriceNotifications();
    await checkPriceNotifications();
    let inbox = (await request('', tokens[0])).data;
    assert.equal(inbox.notifications.length, 2);
    assert.equal(inbox.unreadCount, 2);
    await request('/alerts/' + id, tokens[0], 'PUT', { targetPrice: 10, isActive: true });
    await checkPriceNotifications();
    assert.equal((await request('', tokens[0])).data.notifications.length, 2);
    globalThis.fetch = async () => { throw new Error('Fallo simulado'); };
    await assert.rejects(checkPriceNotifications());
    assert.equal((await request('', tokens[0])).data.notifications.length, 2);
    globalThis.fetch = async url => url.pathname === '/games/prices/v3'
      ? Response.json([{ id, deals: [{ price: { amount, currency: 'USD' }, cut, shop: { name: 'Tienda de prueba' } }] }])
      : Response.json({ id, title: 'Juego de prueba' });
    assert.equal((await request('', tokens[1])).data.notifications.length, 0);
    await request('/read', tokens[1], 'PATCH');
    assert.equal((await request('', tokens[0])).data.unreadCount, 2);
    await request('/read', tokens[0], 'PATCH');
    assert.equal((await request('', tokens[0])).data.unreadCount, 0);
    amount = 20; cut = 0;
    await checkPriceNotifications();
    amount = 0; cut = 100;
    await checkPriceNotifications();
    assert.equal((await request('', tokens[0])).data.notifications.length, 4);
    await request('/alerts/' + id, tokens[0], 'PUT', { targetPrice: 0, isActive: false });
    const response = await nativeFetch(`http://127.0.0.1:${server.address().port}/api/favorites/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tokens[0] } });
    assert.equal(response.status, 204);
    assert.equal(await prisma.priceAlert.count({ where: { gameId: game.id } }), 0);
    await checkPriceNotifications();
    assert.equal((await request('', tokens[0])).data.notifications.length, 4);
    await prisma.notification.createMany({ data: Array.from({ length: 51 }, (_, index) => ({ userId: users[0].id, gameTitle: 'Aviso de prueba ' + index, type: 'sale', price: 1, currency: 'USD', storeName: 'Tienda de prueba', itadGameId: id })) });
    assert.equal((await request('', tokens[0])).data.notifications.length, 50);
    const history = (await request('?all=true', tokens[0])).data;
    assert.equal(history.notifications.length, 55);
    assert.equal(history.unreadCount, 53);
    assert.equal((await request('?all=true', tokens[1])).data.notifications.length, 0);
  } finally {
    globalThis.fetch = nativeFetch;
    if (originalKey === undefined) delete process.env.ITAD_API_KEY; else process.env.ITAD_API_KEY = originalKey;
    await new Promise(resolve => server.close(resolve));
    await prisma.notification.deleteMany({ where: { userId: { in: users.map(user => user.id) } } });
    if (game) {
      await prisma.priceAlert.deleteMany({ where: { gameId: game.id } });
      await prisma.favorite.deleteMany({ where: { gameId: game.id } });
      await prisma.game.delete({ where: { id: game.id } });
    }
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  }
});

