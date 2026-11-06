import test from 'node:test';
import assert from 'node:assert/strict';
import { EmailError, sendEmail } from '../src/services/email.js';

test('correo Brevo: errores seguros, formato de envío e idempotencia', async () => {
  const nativeFetch = globalThis.fetch;
  const names = ['BREVO_API_KEY', 'EMAIL_FROM', 'FRONTEND_URL', 'NODE_ENV'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.BREVO_API_KEY = ' re_clave_ficticia ';
  process.env.EMAIL_FROM = 'AuraPrices <avisos@example.com>';
  process.env.FRONTEND_URL = 'http://localhost:5173';
  process.env.NODE_ENV = 'development';
  const payload = { from: process.env.EMAIL_FROM, to: ['destinatario@example.com'], subject: 'Prueba', text: 'Prueba' };
  const cases = [
    [401, { code: 'unauthorized', message: 'We have detected an unrecognised IP address 203.0.113.1' }, 'EMAIL_IP_BLOCKED', 503],
    [400, { code: 'invalid_parameter', message: 'Sender privado@example.com is not valid.' }, 'EMAIL_SENDER_UNVERIFIED', 502],
    [400, { code: 'invalid_parameter', message: 'Sender privado.example is not verified.' }, 'EMAIL_SENDER_UNVERIFIED', 502],
    [401, { name: 'validation_error', message: 'API key is invalid: secreto-de-prueba' }, 'EMAIL_AUTH', 503],
    [403, { name: 'restricted_api_key' }, 'EMAIL_AUTH', 503],
    [429, { name: 'rate_limit_exceeded' }, 'EMAIL_LIMIT', 429],
    [402, { code: 'not_enough_credits' }, 'EMAIL_LIMIT', 429],
    [500, { message: 'Error privado: secreto-de-prueba' }, 'EMAIL_PROVIDER', 502],
  ];
  try {
    for (const [status, data, code, expectedStatus] of cases) {
      globalThis.fetch = async (url, options) => {
        assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
        assert.equal(options.headers['api-key'], 're_clave_ficticia');
        return Response.json(data, { status });
      };
      await assert.rejects(sendEmail(payload, 'test'), error => {
        assert.ok(error instanceof EmailError);
        assert.equal(error.code, code);
        assert.equal(error.status, expectedStatus);
        assert.equal(error.providerStatus, status);
        assert.doesNotMatch(error.message, /privado@example|privado.example|secreto-de-prueba|re_clave_ficticia|203\.0\.113\./);
        return true;
      });
    }
    globalThis.fetch = async () => { throw new Error('Detalle privado de conexión'); };
    await assert.rejects(sendEmail(payload, 'test'), { code: 'EMAIL_CONNECTION' });
    globalThis.fetch = async () => new Response('No es JSON', { status: 500 });
    await assert.rejects(sendEmail(payload, 'test'), { code: 'EMAIL_PROVIDER' });
    globalThis.fetch = async () => Response.json(null);
    await assert.rejects(sendEmail(payload, 'test'), { code: 'EMAIL_RESPONSE' });
    let firstBody;
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      assert.deepEqual(body.sender, { name: 'AuraPrices', email: 'avisos@example.com' });
      assert.deepEqual(body.to, [{ email: 'destinatario@example.com' }]);
      assert.equal(body.textContent, 'Prueba');
      assert.match(body.headers.idempotencyKey, /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
      if (!firstBody) firstBody = options.body; else assert.equal(options.body, firstBody);
      return Response.json({ messageId: 'brevo-id' }, { status: 201 });
    };
    assert.equal(await sendEmail(payload, 'test'), 'brevo-id');
    assert.equal(await sendEmail(payload, 'test'), 'brevo-id');
    globalThis.fetch = async () => Response.json({ code: 'duplicate_parameter', message: 'idempotencyKey already used' }, { status: 400 });
    assert.equal(await sendEmail(payload, 'test'), null);
    globalThis.fetch = async () => Response.json({ code: 'duplicate_parameter', message: 'Another parameter is duplicated' }, { status: 400 });
    await assert.rejects(sendEmail(payload, 'test'), { code: 'EMAIL_PROVIDER' });
  } finally {
    globalThis.fetch = nativeFetch;
    for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
  }
});
