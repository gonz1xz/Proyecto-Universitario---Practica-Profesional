import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/prisma.js';

const runProcess = promisify(execFile);

test('autenticación con PostgreSQL: registro, login y persistencia', async () => {
    // Solo se crean y eliminan cuentas identificadas por este UUID.
    const suffix = randomUUID();
    const email = `auth-test-${suffix}@example.com`;
    const concurrentEmail = `auth-race-${suffix}@example.com`;
    const password = '  <b>clave123</b>  ';
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;

    async function request(path, body, token) {
        const response = await fetch(base + path, {
            method: body === undefined ? 'GET' : 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        return { status: response.status, body: await response.json() };
    }

    try {
        assert.equal((await request('/register', { email, password })).status, 400);
        assert.equal((await request('/register', { username: ' ', email, password })).status, 400);
        assert.equal((await request('/register', { username: 'Test', email, password: 'á'.repeat(37) })).status, 400);
        assert.equal((await request('/register', { username: 'Test', email: {}, password: [] })).status, 400);

        const registered = await request('/register', {
            username: '  Test  ', email: ` ${email.toUpperCase()} `, password
        });
        assert.equal(registered.status, 201);
        assert.ok(Number.isInteger(registered.body.user.id));
        assert.equal(registered.body.user.username, 'Test');
        assert.equal(registered.body.user.email, email);
        assert.equal(registered.body.user.password, undefined);
        const saved = await prisma.user.findUnique({ where: { email } });
        assert.notEqual(saved.password, password);
        assert.equal(await bcrypt.compare(password, saved.password), true);
        assert.ok(saved.createdAt instanceof Date);

        assert.equal((await request('/register', { username: 'Test', email, password })).status, 409);
        assert.equal((await request('/login', { email, password: 'incorrecta' })).status, 401);
        assert.equal((await request('/login', { email: `unknown-${suffix}@example.com`, password })).status, 401);
        const login = await request('/login', { email, password });
        assert.equal(login.status, 200);
        assert.equal(login.body.user.password, undefined);
        assert.equal((await request('/me', undefined, login.body.accessToken)).status, 200);
        assert.equal((await request('/me')).status, 401);
        assert.equal((await request('/me', undefined, 'invalido')).status, 401);
        const oldIdToken = jwt.sign({ userId: String(saved.id), type: 'access' }, process.env.ACCESS_TOKEN_SECRET);
        const expiredToken = jwt.sign({ userId: saved.id, type: 'access' }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: -1 });
        assert.equal((await request('/me', undefined, oldIdToken)).status, 401);
        assert.equal((await request('/me', undefined, expiredToken)).status, 401);

        const results = await Promise.all([1, 2].map(() => request('/register', {
            username: 'Concurrente', email: concurrentEmail, password
        })));
        assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);

        // Otro proceso arranca una aplicación nueva y puede iniciar sesión
        // con la cuenta creada aquí: no depende de un array en memoria.
        const childCode = `
            import assert from 'node:assert/strict';
            import app from './src/app.js';
            import prisma from './src/prisma.js';
            const server = app.listen(0, '127.0.0.1');
            await new Promise(resolve => server.once('listening', resolve));
            try {
                const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/auth/login', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: process.env.AUTH_TEST_EMAIL, password: process.env.AUTH_TEST_PASSWORD })
                });
                assert.equal(response.status, 200);
                const data = await response.json();
                assert.equal(data.user.id, Number(process.env.AUTH_TEST_ID));
            } finally {
                await new Promise(resolve => server.close(resolve));
                await prisma.$disconnect();
            }
        `;
        await runProcess(process.execPath, ['--input-type=module', '-e', childCode], {
            cwd: new URL('../', import.meta.url),
            env: { ...process.env, AUTH_TEST_EMAIL: email, AUTH_TEST_PASSWORD: password, AUTH_TEST_ID: String(saved.id) }
        });

        await prisma.user.delete({ where: { id: saved.id } });
        assert.equal((await request('/me', undefined, login.body.accessToken)).status, 401);
    } finally {
        await new Promise(resolve => server.close(resolve));
        try {
            await prisma.user.deleteMany({ where: { email: { in: [email, concurrentEmail] } } });
        } finally {
            await prisma.$disconnect();
        }
    }
});
