import test from 'node:test';
import assert from 'node:assert/strict';

const accessToken = seconds => 'header.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url') + '.signature';

test('cliente: una sola renovación para consultas simultáneas y reintento con token nuevo', async () => {
  const original = globalThis.fetch;
  const client = await import('../../frontend/src/services/authSession.js?concurrent');
  const oldToken = accessToken(900);
  const newToken = accessToken(1000);
  let refreshCount = 0;
  let sent = [];
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/login')) return Response.json({ user: { id: 1 }, accessToken: oldToken });
    if (url.endsWith('/refresh')) {
      refreshCount++;
      assert.equal(options.credentials, 'include');
      assert.equal(options.headers['X-Aura-Request'], '1');
      await new Promise(resolve => setTimeout(resolve, 20));
      return Response.json({ user: { id: 1 }, accessToken: newToken });
    }
    sent.push(options.headers.Authorization);
    return Response.json({}, { status: options.headers.Authorization === 'Bearer ' + oldToken ? 401 : 200 });
  };
  try {
    await client.startSession({ email: 'test@example.com', password: 'prueba' }, true);
    const results = await Promise.all([client.authenticatedFetch('/favorites', {}, oldToken), client.authenticatedFetch('/notifications', {}, oldToken)]);
    assert.deepEqual(results.map(r => r.status), [200, 200]);
    assert.equal(refreshCount, 1);
    assert.equal(sent.filter(token => token === 'Bearer ' + newToken).length, 2);
  } finally { globalThis.fetch = original; }
});

test('cliente: caída de red conserva sesión; refresh rechazado la elimina', async () => {
  const original = globalThis.fetch;
  const client = await import('../../frontend/src/services/authSession.js?errors');
  globalThis.fetch = async () => Response.json({ user: { id: 1 }, accessToken: accessToken(900) });
  try {
    await client.startSession({}, false);
    globalThis.fetch = async () => { throw new Error('Sin conexión'); };
    await assert.rejects(client.renewSession());
    assert.equal(client.getSession().user.id, 1);
    globalThis.fetch = async () => Response.json({ message: 'Sesión vencida' }, { status: 401 });
    await assert.rejects(client.renewSession());
    assert.equal(client.getSession(), null);
  } finally { globalThis.fetch = original; }
});

test('cliente: restaura sesión por cookie y renueva antes de enviar un token cercano a vencer', async () => {
  const original = globalThis.fetch;
  const client = await import('../../frontend/src/services/authSession.js?proactive');
  const oldToken = accessToken(10);
  const newToken = accessToken(900);
  let refreshCount = 0;
  const sent = [];
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/refresh')) {
      refreshCount++;
      assert.equal(options.credentials, 'include');
      return Response.json({ user: { id: 1 }, accessToken: refreshCount === 1 ? oldToken : newToken });
    }
    sent.push(options.headers.Authorization);
    return Response.json({}, { status: 401 });
  };
  try {
    await client.renewSession();
    assert.equal(client.getSession().user.id, 1);
    const response = await client.authenticatedFetch('/favorites', {}, oldToken);
    assert.equal(response.status, 401);
    // Renovación preventiva, luego un único reintento ante el 401 definitivo.
    assert.equal(sent.length, 2);
    assert.ok(sent.every(token => token === 'Bearer ' + newToken));
    assert.equal(refreshCount, 3);
  } finally { globalThis.fetch = original; }
});

test('cliente: renovación pendiente no restaura una sesión que se está cerrando', async () => {
  const original = globalThis.fetch;
  const client = await import('../../frontend/src/services/authSession.js?logout');
  let release;
  const events = [];
  globalThis.fetch = async url => {
    if (url.endsWith('/refresh')) {
      events.push('refresh');
      await new Promise(resolve => { release = resolve; });
      return Response.json({ user: { id: 1 }, accessToken: accessToken(1000) });
    }
    if (url.endsWith('/logout')) { events.push('logout'); return new Response(null, { status: 204 }); }
    return Response.json({ user: { id: 1 }, accessToken: accessToken(900) });
  };
  try {
    await client.startSession({}, false);
    const refresh = client.renewSession();
    const logout = client.endSession();
    release();
    await Promise.all([refresh, logout]);
    assert.deepEqual(events, ['refresh', 'logout']);
    assert.equal(client.getSession(), null);
  } finally { globalThis.fetch = original; }
});
