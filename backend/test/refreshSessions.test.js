import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/prisma.js';
import { hashRefreshToken, setRefreshCookie } from '../src/services/refreshSessions.js';

test('sesiones renovables: cookies, rotación, vencimiento y revocación en PostgreSQL', async t => {
  const email = `refresh-${randomUUID()}@example.com`;
  const password = 'prueba123';
  const user = await prisma.user.create({ data: { username: 'Refresh', email, password: await bcrypt.hash(password, 10) } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  async function post(path, body = {}, cookie, extraHeaders = {}) {
    const response = await fetch(base + path, {
      method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-Aura-Request': '1',
        ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders,
      }, body: JSON.stringify(body),
    });
    return { status: response.status, cookie: response.headers.get('set-cookie'),
      body: response.status === 204 ? null : await response.json() };
  }
  const cookiePair = response => response.cookie.split(';')[0];
  let login;
  let renewed;
  try {
    await t.test('login guarda solo el hash y entrega access token de 15 minutos', async () => {
      login = await post('/login', { email, password });
      assert.equal(login.status, 200);
      assert.match(login.cookie, /HttpOnly/i);
      assert.match(login.cookie, /Path=\/api\/auth/i);
      assert.match(login.cookie, /SameSite=Lax/i);
      assert.doesNotMatch(login.cookie, /Expires=|Max-Age=/i);
      assert.equal(login.body.refreshToken, undefined);
      const payload = jwt.verify(login.body.accessToken, process.env.ACCESS_TOKEN_SECRET);
      assert.equal(payload.exp - payload.iat, 900);
      const saved = await prisma.refreshSession.findFirst({ where: { userId: user.id } });
      const token = cookiePair(login).split('=')[1];
      assert.notEqual(saved.tokenHash, token);
      assert.equal(saved.tokenHash, hashRefreshToken(token));
      assert.ok(Math.abs(saved.expiresAt.getTime() - Date.now() - 86_400_000) < 10_000);
    });
    await t.test('sin cookie, sin encabezado o con origen ajeno no se renueva', async () => {
      assert.equal((await post('/refresh')).status, 401);
      assert.equal((await post('/refresh', {}, cookiePair(login), { 'X-Aura-Request': '' })).status, 403);
      assert.equal((await post('/refresh', {}, cookiePair(login), { Origin: 'https://other.example' })).status, 403);
      assert.equal((await post('/logout', {}, cookiePair(login), { 'X-Aura-Request': '' })).status, 403);
    });
    await t.test('renovar reemplaza el token sin ampliar el vencimiento total', async () => {
      const before = await prisma.refreshSession.findFirst({ where: { userId: user.id } });
      const expired = jwt.sign({ userId: user.id, type: 'access' }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: -1 });
      assert.equal((await fetch(base + '/me', { headers: { Authorization: `Bearer ${expired}` } })).status, 401);
      renewed = await post('/refresh', {}, cookiePair(login));
      assert.equal(renewed.status, 200);
      assert.equal(renewed.body.user.id, user.id);
      assert.notEqual(cookiePair(renewed), cookiePair(login));
      assert.equal((await post('/refresh', {}, cookiePair(login))).status, 401);
      const after = await prisma.refreshSession.findUnique({ where: { id: before.id } });
      assert.equal(after.expiresAt.getTime(), before.expiresAt.getTime());
      assert.equal((await fetch(base + '/me', { headers: { Authorization: `Bearer ${renewed.body.accessToken}` } })).status, 200);
    });
    await t.test('dos renovaciones simultáneas solo pueden consumir el token una vez', async () => {
      const responses = await Promise.all([post('/refresh', {}, cookiePair(renewed)), post('/refresh', {}, cookiePair(renewed))]);
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 401]);
      renewed = responses.find(r => r.status === 200);
    });
    await t.test('logout elimina la sesión y no permite renovar; es idempotente', async () => {
      const result = await post('/logout', {}, cookiePair(renewed));
      assert.equal(result.status, 204);
      assert.match(result.cookie, /Expires=Thu, 01 Jan 1970/i);
      assert.equal(await prisma.refreshSession.count({ where: { userId: user.id } }), 0);
      assert.equal((await post('/refresh', {}, cookiePair(renewed))).status, 401);
      assert.equal((await post('/logout', {}, cookiePair(renewed))).status, 204);
    });
    await t.test('Recordarme persiste hasta 30 días y respeta el vencimiento', async () => {
      const remembered = await post('/login', { email, password, remember: true });
      assert.equal(remembered.status, 200);
      assert.match(remembered.cookie, /Expires=/i);
      const session = await prisma.refreshSession.findFirst({ where: { userId: user.id } });
      assert.equal(session.remember, true);
      assert.ok(Math.abs(session.expiresAt.getTime() - Date.now() - 30 * 86_400_000) < 10_000);
      await prisma.refreshSession.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      assert.equal((await post('/refresh', {}, cookiePair(remembered))).status, 401);
    });
    await t.test('producción emite cookies Secure y SameSite=None para dominios separados', () => {
      const previous = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        setRefreshCookie({ cookie(name, token, options) {
          assert.equal(options.httpOnly, true);
          assert.equal(options.secure, true);
          assert.equal(options.sameSite, 'none');
          assert.equal(options.domain, undefined);
        } }, 'prueba', { remember: false });
      } finally {
        if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
      }
    });
    await t.test('eliminar el usuario invalida también la renovación', async () => {
      const finalLogin = await post('/login', { email, password });
      await prisma.user.delete({ where: { id: user.id } });
      assert.equal((await post('/refresh', {}, cookiePair(finalLogin))).status, 401);
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  }
});
