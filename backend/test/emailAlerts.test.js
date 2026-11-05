import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/prisma.js';
import { emailConfiguration, emailIdempotencyKey, priceEmail, sendEmail } from '../src/services/email.js';
import { hashEmailToken } from '../src/services/emailVerification.js';
import { deliverPendingEmails } from '../src/services/emailDeliveries.js';
import { checkPriceNotifications } from '../src/services/priceNotifications.js';

test('mail: confirmación, consentimiento, cola persistente y reintentos', async t => {
  const names = ['BREVO_API_KEY', 'EMAIL_FROM', 'FRONTEND_URL', 'ITAD_API_KEY', 'NODE_ENV'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const nativeFetch = globalThis.fetch;
  const id = randomUUID();
  const user = await prisma.user.create({ data: { email: `mail-${id}@example.com`, username: 'Mail de prueba', password: 'no-utilizable' } });
  const game = await prisma.game.create({ data: { itadGameId: id } });
  await prisma.favorite.create({ data: { userId: user.id, gameId: game.id } });
  const token = jwt.sign({ userId: user.id, type: 'access' }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5m' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, method = 'GET', body, authenticated = true) {
    const response = await nativeFetch(base + path, {
      method, headers: { 'Content-Type': 'application/json', 'X-Aura-Request': '1', ...(authenticated ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  }
  const findMany = prisma.notification.findMany;
  const updateMany = prisma.notification.updateMany;
  // Limitar el procesador a los datos propios de esta prueba.
  prisma.notification.findMany = args => findMany.call(prisma.notification, { ...args, where: { ...args.where, userId: user.id } });
  prisma.notification.updateMany = args => updateMany.call(prisma.notification, { ...args, where: { ...args.where, userId: user.id } });
  const notificationData = { userId: user.id, itadGameId: id, gameTitle: 'Juego de prueba', type: 'target', price: 8, currency: 'USD', storeName: 'Tienda de prueba' };
  const enable = emailEnabled => request('/notifications/alerts/' + id, 'PUT', { targetPrice: 10, isActive: true, emailEnabled });
  try {
    delete process.env.BREVO_API_KEY;
    delete process.env.EMAIL_FROM;
    process.env.NODE_ENV = 'development';
    process.env.FRONTEND_URL = 'http://localhost:5173';
    await t.test('sin configurar no hay envíos y el buzón sigue disponible', async () => {
      globalThis.fetch = () => { throw new Error('No debe contactar un proveedor'); };
      assert.equal(emailConfiguration(), null);
      await deliverPendingEmails();
      await assert.rejects(sendEmail({}, 'test'), /no está configurado/);
      assert.equal((await request('/notifications/email/status')).data.configured, false);
      assert.equal((await request('/notifications/email/verification', 'POST', {})).status, 503);
      assert.equal((await enable(true)).status, 400, 'no habilitar envíos a un correo sin verificar');
      assert.equal((await enable(false)).status, 200);
      assert.equal((await request('/notifications/email/status', 'GET', undefined, false)).status, 401);
    });
    process.env.BREVO_API_KEY = 'clave-ficticia-de-prueba';
    process.env.EMAIL_FROM = 'AuraPrices <avisos@example.com>';
    await t.test('remitente y origen se validan sin revelar secretos', () => {
      assert.ok(emailConfiguration());
      process.env.NODE_ENV = 'production';
      assert.equal(emailConfiguration(), null, 'producción requiere HTTPS');
      process.env.NODE_ENV = 'development';
      const from = process.env.EMAIL_FROM;
      process.env.EMAIL_FROM = 'remitente@example.com\r\nOtro: encabezado';
      assert.equal(emailConfiguration(), null);
      process.env.EMAIL_FROM = from;
    });
    await t.test('el endpoint informa el remitente no habilitado sin filtrar el error privado', async () => {
      const originalError = console.error;
      const logs = [];
      console.error = (...parts) => logs.push(parts.join(' '));
      globalThis.fetch = async () => Response.json({
        code: 'invalid_parameter', message: 'Sender privado@example.com is not valid.',
      }, { status: 403 });
      try {
        const response = await request('/notifications/email/verification', 'POST', {});
        assert.equal(response.status, 502);
        assert.match(response.data.message, /remitente/);
        assert.doesNotMatch(response.data.message, /privado@example.com/);
        assert.match(logs.join(' '), /EMAIL_SENDER_UNVERIFIED/);
        assert.doesNotMatch(logs.join(' '), /privado@example.com/);
        assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).emailVerificationHash, null);
      } finally { console.error = originalError; }
    });
    await t.test('verificación envía solo al titular y guarda hash, no token original', async () => {
      let body;
      globalThis.fetch = async (url, options) => {
        assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
        assert.equal(options.headers['api-key'], process.env.BREVO_API_KEY);
        assert.ok(JSON.parse(options.body).headers.idempotencyKey);
        body = JSON.parse(options.body);
        return Response.json({ messageId: 'verification-provider-id' });
      };
      const response = await request('/notifications/email/verification', 'POST', { email: 'otra-persona@example.com' });
      assert.equal(response.status, 200);
      assert.deepEqual(body.to, [{ email: user.email }], 'ignorar destinatarios enviados por el cliente');
      const verificationToken = body.textContent.match(/#token=([a-f0-9]{64})/)[1];
      const saved = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(saved.emailVerificationHash, hashEmailToken(verificationToken));
      assert.notEqual(saved.emailVerificationHash, verificationToken);
      assert.equal((await request('/auth/verify-email', 'POST', { token: verificationToken }, false)).status, 200);
      assert.equal((await request('/auth/verify-email', 'POST', { token: verificationToken }, false)).status, 400);
      assert.equal((await request('/notifications/email/status')).data.verified, true);
      const expiredToken = 'a'.repeat(64);
      await prisma.user.update({ where: { id: user.id }, data: { emailVerificationHash: hashEmailToken(expiredToken), emailVerificationExpiresAt: new Date(Date.now() - 1000) } });
      assert.equal((await request('/auth/verify-email', 'POST', { token: expiredToken }, false)).status, 400);
    });
    let target;
    await t.test('solo los nuevos avisos de objetivo con consentimiento quedan pendientes', async () => {
      assert.equal((await enable(true)).status, 200);
      process.env.ITAD_API_KEY = 'clave-itad-ficticia';
      globalThis.fetch = async url => url.pathname === '/games/prices/v3'
        ? Response.json([{ id, deals: [{ price: { amount: 8, currency: 'USD' }, cut: 20, shop: { name: 'Tienda de prueba' } }] }])
        : Response.json({ id, title: 'Juego de prueba' });
      await checkPriceNotifications();
      await checkPriceNotifications();
      const notifications = await findMany.call(prisma.notification, { where: { userId: user.id } });
      assert.equal(notifications.length, 2);
      assert.equal(notifications.find(item => item.type === 'sale').emailStatus, 'none');
      target = notifications.find(item => item.type === 'target');
      assert.equal(target.emailStatus, 'pending');
      const inbox = (await request('/notifications')).data.notifications;
      assert.equal(inbox[0].emailPayload, undefined, 'no devolver contenido privado de la cola');
    });
    await t.test('reintenta con el mismo contenido y clave sin duplicar avisos internos', async () => {
      const sent = [];
      globalThis.fetch = async (url, options) => {
        sent.push({ body: JSON.parse(options.body), raw: options.body, key: JSON.parse(options.body).headers.idempotencyKey });
        return sent.length === 1 ? Response.json({}, { status: 500 }) : Response.json({ messageId: 'price-provider-id' });
      };
      await deliverPendingEmails();
      let saved = await prisma.notification.findUnique({ where: { id: target.id } });
      assert.equal(saved.emailStatus, 'pending');
      assert.equal(saved.emailAttempts, 1);
      assert.ok(saved.emailPayload);
      await deliverPendingEmails();
      assert.equal(sent.length, 1, 'respetar la espera entre reintentos');
      await prisma.notification.update({ where: { id: target.id }, data: { emailNextAttemptAt: new Date(Date.now() - 1) } });
      await Promise.all([deliverPendingEmails(), deliverPendingEmails()]);
      saved = await prisma.notification.findUnique({ where: { id: target.id } });
      assert.equal(saved.emailStatus, 'sent');
      assert.equal(saved.emailProviderId, 'price-provider-id');
      assert.deepEqual(sent[0], sent[1], 'mismo contenido e idempotencia');
      assert.deepEqual(sent[1].body.to, [{ email: user.email }]);
      assert.match(sent[1].body.textContent, /USD 8.00/);
      assert.match(sent[1].body.textContent, /desactivá el mail/);
      await deliverPendingEmails();
      assert.equal(sent.length, 2);
      assert.equal(await prisma.notification.count({ where: { userId: user.id } }), 2);
    });
    await t.test('recupera un envío reclamado por un proceso que se detuvo', async () => {
      const recovered = await prisma.notification.create({ data: {
        ...notificationData, emailStatus: 'sending', emailAttempts: 1,
        emailClaimedAt: new Date(Date.now() - 3 * 60 * 1000),
        emailPayload: { ...priceEmail({ ...notificationData, createdAt: new Date() }, user.email), deliveryStartedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString() },
      } });
      let calls = 0;
      globalThis.fetch = async (url, options) => {
        calls++;
        assert.equal(JSON.parse(options.body).headers.idempotencyKey, emailIdempotencyKey(`price-alert/${recovered.id}`));
        return Response.json({ messageId: 'recovered-provider-id' });
      };
      await deliverPendingEmails();
      const result = await prisma.notification.findUnique({ where: { id: recovered.id } });
      assert.equal(result.emailStatus, 'sent');
      assert.equal(result.emailAttempts, 2);
      assert.equal(calls, 1);
    });
    await t.test('no reenvía trabajos antiguos ni reintenta fuera de la ventana de Brevo', async () => {
      const expired = await prisma.notification.create({ data: {
        ...notificationData, emailStatus: 'pending', emailAttempts: 1,
        emailPayload: { ...priceEmail({ ...notificationData, createdAt: new Date() }, user.email), deliveryStartedAt: new Date(Date.now() - 26 * 60 * 1000).toISOString() },
      } });
      const legacy = await prisma.notification.create({ data: {
        ...notificationData, emailStatus: 'pending', emailAttempts: 1,
        emailPayload: { from: 'anterior@example.com', to: [user.email], subject: 'Anterior', text: 'Anterior' },
      } });
      globalThis.fetch = () => { throw new Error('No debe reenviar fuera de la protección contra duplicados'); };
      await deliverPendingEmails();
      for (const item of [expired, legacy]) {
        const saved = await prisma.notification.findUnique({ where: { id: item.id } });
        assert.equal(saved.emailStatus, 'failed');
        assert.equal(saved.emailAttempts, 1);
      }
    });
    await t.test('desactivar mail o quitar favorito cancela pendientes', async () => {
      globalThis.fetch = () => { throw new Error('No debe enviar correos cancelados'); };
      const pending = await prisma.notification.create({ data: { ...notificationData, emailStatus: 'pending' } });
      await enable(false);
      assert.equal((await prisma.notification.findUnique({ where: { id: pending.id } })).emailStatus, 'cancelled');
      await enable(true);
      const removed = await prisma.notification.create({ data: { ...notificationData, emailStatus: 'pending' } });
      await request('/favorites/' + id, 'DELETE');
      await deliverPendingEmails();
      assert.equal((await prisma.notification.findUnique({ where: { id: removed.id } })).emailStatus, 'cancelled');
    });
    await t.test('se limita la antigüedad y el número de intentos', async () => {
      const old = await prisma.notification.create({ data: { ...notificationData, emailStatus: 'pending', createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } });
      const exhausted = await prisma.notification.create({ data: { ...notificationData, emailStatus: 'pending', emailAttempts: 5 } });
      await deliverPendingEmails();
      assert.equal((await prisma.notification.findUnique({ where: { id: old.id } })).emailStatus, 'failed');
      assert.equal((await prisma.notification.findUnique({ where: { id: exhausted.id } })).emailStatus, 'failed');
      const payload = priceEmail({ ...notificationData, createdAt: new Date(), gameTitle: 'Juego\r\nOtra línea' }, user.email);
      assert.doesNotMatch(payload.subject, /[\r\n]/);
    });
  } finally {
    prisma.notification.findMany = findMany;
    prisma.notification.updateMany = updateMany;
    globalThis.fetch = nativeFetch;
    for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
    await new Promise(resolve => server.close(resolve));
    await prisma.priceAlert.deleteMany({ where: { userId: user.id } });
    await prisma.favorite.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.game.delete({ where: { id: game.id } });
    await prisma.$disconnect();
  }
});
