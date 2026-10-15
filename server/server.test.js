import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { createApp } from './app.js';
import { validate } from './lib/validate.js';
import { rateLimit } from './lib/rateLimit.js';

const listen = (app) => new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
});

// fetch() keeps sockets alive; close them too or the test process never exits.
const close = ({ server }) => {
    server.closeAllConnections();
    server.close();
};

// Routes injected only for tests.
const testRoutes = () => {
    const r = Router();
    r.post('/echo', validate({ body: z.strictObject({ name: z.string().min(1).max(20) }) }), (req, res) => res.json(req.valid.body));
    r.get('/boom', () => {
        throw new Error('secret internal detail');
    });
    r.get('/limited', rateLimit({ windowMs: 60_000, limit: 2 }), (req, res) => res.json({ ok: true }));
    return [r];
};

let dist;
let prod;
let dev;
let unbuilt;

before(async () => {
    dist = await mkdtemp(path.join(tmpdir(), 'ojcity-dist-'));
    await mkdir(path.join(dist, 'assets'));
    await writeFile(path.join(dist, 'index.html'), '<!doctype html><title>OJ City</title>');
    await writeFile(path.join(dist, 'assets', 'app-abc123.js'), 'console.log(1)');
    prod = await listen(createApp({ distDir: dist, env: { NODE_ENV: 'production' }, routes: testRoutes() }));
    dev = await listen(createApp({ distDir: dist, env: { NODE_ENV: 'development' }, routes: testRoutes() }));
    unbuilt = await listen(createApp({ distDir: path.join(dist, 'nope'), env: {} }));
});

after(async () => {
    for (const s of [prod, dev, unbuilt]) close(s);
    await rm(dist, { recursive: true, force: true });
});

test('GET /api/health returns ok and nothing sensitive', async () => {
    const res = await fetch(`${prod.url}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(Object.keys(body).sort(), ['status', 'time', 'uptime']);
    assert.equal(body.status, 'ok');
    assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('security headers are set, X-Powered-By is not', async () => {
    const res = await fetch(`${prod.url}/`);
    const csp = res.headers.get('content-security-policy');
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /upgrade-insecure-requests/);
    assert.doesNotMatch(csp, /'unsafe-eval'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.match(res.headers.get('permissions-policy'), /camera=\(\)/);
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('strict-transport-security'), null, 'HSTS stays off until ENABLE_HSTS=1');
});

test('HSTS only with ENABLE_HSTS=1; no upgrade-insecure-requests in development', async () => {
    const s = await listen(createApp({ distDir: dist, env: { ENABLE_HSTS: '1' } }));
    const res = await fetch(`${s.url}/api/health`);
    close(s);
    assert.match(res.headers.get('strict-transport-security'), /max-age=31536000/);
    const devRes = await fetch(`${dev.url}/`);
    assert.doesNotMatch(devRes.headers.get('content-security-policy'), /upgrade-insecure-requests/);
});

test('unknown /api routes are JSON 404s, not the SPA', async () => {
    const res = await fetch(`${prod.url}/api/nope`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Not found' });
});

test('JSON body over 16kb → 413; malformed JSON → 400', async () => {
    const big = await fetch(`${prod.url}/api/echo`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'x'.repeat(17 * 1024) }),
    });
    assert.equal(big.status, 413);
    assert.deepEqual(await big.json(), { error: 'Request body too large' });
    const bad = await fetch(`${prod.url}/api/echo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
    assert.equal(bad.status, 400);
    assert.deepEqual(await bad.json(), { error: 'Invalid JSON' });
});

test('validate() rejects bad input and passes parsed input through', async () => {
    const post = (body) => fetch(`${prod.url}/api/echo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const bad = await post({ name: '', extra: 1 });
    assert.equal(bad.status, 400);
    const body = await bad.json();
    assert.equal(body.error, 'Invalid request');
    assert.ok(body.issues.some((i) => i.path === 'body.name'));
    const good = await post({ name: 'Ojong' });
    assert.deepEqual(await good.json(), { name: 'Ojong' });
});

test('rate limit returns JSON 429 with standard headers', async () => {
    const hit = () => fetch(`${prod.url}/api/limited`);
    assert.equal((await hit()).status, 200);
    assert.equal((await hit()).status, 200);
    const res = await hit();
    assert.equal(res.status, 429);
    assert.ok(res.headers.get('ratelimit-policy'));
    assert.match((await res.json()).error, /Too many requests/);
});

test('errors: no message or stack in production, message only in development', async () => {
    const res = await fetch(`${prod.url}/api/boom`);
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.equal(text, JSON.stringify({ error: 'Something went wrong' }));
    const devBody = await (await fetch(`${dev.url}/api/boom`)).json();
    assert.equal(devBody.detail, 'secret internal detail');
    assert.ok(!JSON.stringify(devBody).includes('at '), 'no stack trace even in development');
});

test('SPA fallback serves index.html; missing files are 404s; assets are cached', async () => {
    for (const p of ['/', '/projects/sns-glam', '/recruiter']) {
        const res = await fetch(`${prod.url}${p}`);
        assert.equal(res.status, 200, p);
        assert.match(await res.text(), /<title>OJ City<\/title>/);
        assert.equal(res.headers.get('cache-control'), 'no-cache');
    }
    assert.equal((await fetch(`${prod.url}/assets/missing.js`)).status, 404);
    const asset = await fetch(`${prod.url}/assets/app-abc123.js`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('cache-control'), /immutable/);
});

test('without a build, pages return a clear 503 and the API still works', async () => {
    const page = await fetch(`${unbuilt.url}/`);
    assert.equal(page.status, 503);
    assert.match(await page.text(), /Frontend not built/);
    assert.equal((await fetch(`${unbuilt.url}/api/health`)).status, 200);
});
