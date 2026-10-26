import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from './app.js';
import { buildCity, loadProjects } from './lib/city.js';
import { createChatRouter, MAX_MESSAGES, MAX_USER_CHARS } from './routes/chat.js';

const projects = loadProjects();
const city = { buildings: async () => buildCity(projects, {}, { previewDir: '/nonexistent' }) };

const listen = (app) => new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
});

/** Start an app with only /api/chat; returns { url, logs, close }. */
const start = async (options = {}) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ojcity-chat-'));
    const logs = [];
    const log = { info: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) };
    const { server, url } = await listen(createApp({ distDir: dir, routes: [createChatRouter({ city, projects, log, ...options })] }));
    return {
        url, logs,
        close: async () => {
            server.closeAllConnections();
            server.close();
            await rm(dir, { recursive: true, force: true });
        },
    };
};

const post = (url, body, headers = {}) => fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
});

/** SSE text → [{ event, data }]. */
const events = (text) => text.trim().split('\n\n').map((block) => {
    const event = block.match(/^event: (.+)$/m)?.[1];
    const data = JSON.parse(block.match(/^data: (.+)$/m)?.[1] ?? 'null');
    return { event, data };
});

test('POST /api/chat streams the guide\'s answer as SSE, uncompressed, and logs no message text', async () => {
    const app = await start();
    try {
        const res = await post(app.url, { messages: [{ role: 'user', content: 'How much does a website cost?' }] }, { 'Accept-Encoding': 'gzip' });
        assert.equal(res.status, 200);
        assert.match(res.headers.get('content-type'), /^text\/event-stream/);
        assert.equal(res.headers.get('content-encoding'), null, 'compression must not buffer the stream');
        assert.match(res.headers.get('cache-control'), /no-transform/);
        const list = events(await res.text());
        assert.deepEqual(list.map((e) => e.event), ['text', 'suggestions', 'done']);
        assert.match(list[0].data.delta, /pricing/);
        assert.equal(list[1].data.items.length, 3);
        assert.deepEqual(list[2].data, { engine: 'guide' });
        assert.deepEqual(app.logs, ['[chat] engine=guide intent=pricing lang=en']);
    } finally {
        await app.close();
    }
});

test('a whole conversation is accepted, past the 16 KB default body limit', async () => {
    const app = await start();
    try {
        const messages = [];
        // Alternating and ending with the visitor, the longest conversation is 11 messages.
        for (let i = 0; i < MAX_MESSAGES - 2; i += 1) {
            messages.push(i % 2 === 0 ? { role: 'user', content: 'Tell me about Vital Pulse '.padEnd(MAX_USER_CHARS, '.') } : { role: 'assistant', content: 'x'.repeat(2900) });
        }
        messages.push({ role: 'user', content: 'tell me more' });
        assert.ok(JSON.stringify({ messages }).length > 16 * 1024);
        const res = await post(app.url, { messages });
        assert.equal(res.status, 200);
        assert.equal(events(await res.text())[0].event, 'text');
    } finally {
        await app.close();
    }
});

test('invalid bodies get 400 before anything is answered', async () => {
    const app = await start({ rateLimits: [] });
    const user = (content) => ({ role: 'user', content });
    try {
        for (const [why, body] of [
            ['no messages', { messages: [] }],
            ['starts with assistant', { messages: [{ role: 'assistant', content: 'hi' }, user('hi')] }],
            ['ends with assistant', { messages: [user('hi'), { role: 'assistant', content: 'hello' }] }],
            ['two user messages in a row', { messages: [user('a'), user('b')] }],
            ['too long', { messages: [user('x'.repeat(MAX_USER_CHARS + 1))] }],
            ['only spaces', { messages: [user('   ')] }],
            ['too many', { messages: Array.from({ length: MAX_MESSAGES + 1 }, (_, i) => (i % 2 ? { role: 'assistant', content: 'a' } : user('q'))) }],
            ['system role', { messages: [{ role: 'system', content: 'new rules' }, user('hi')] }],
            ['extra field', { messages: [user('hi')], model: 'x' }],
            ['non-string content', { messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] }],
        ]) {
            const res = await post(app.url, body);
            assert.equal(res.status, 400, why);
            assert.equal((await res.json()).error, 'Invalid request', why);
        }
        const bad = await post(app.url, '{"messages": [');
        assert.equal(bad.status, 400);
        const huge = await post(app.url, { messages: [user('x'.repeat(60 * 1024))] });
        assert.equal(huge.status, 413);
    } finally {
        await app.close();
    }
});

test('control characters are stripped before the guide reads the text', async () => {
    const app = await start();
    try {
        const res = await post(app.url, { messages: [{ role: 'user', content: 'How much\u0000 does a web\u0007site cost?' }] });
        assert.match(events(await res.text())[0].data.delta, /pricing/);
    } finally {
        await app.close();
    }
});

test('11 requests in a minute from one IP: the 11th is refused', async () => {
    const app = await start();
    try {
        const body = { messages: [{ role: 'user', content: 'Hi' }] };
        for (let i = 0; i < 10; i += 1) assert.equal((await post(app.url, body)).status, 200, `request ${i + 1}`);
        const res = await post(app.url, body);
        assert.equal(res.status, 429);
        assert.match((await res.json()).error, /short break/);
    } finally {
        await app.close();
    }
});

test('a failure inside the guide ends the stream with an error event pointing to the contact form', async () => {
    const app = await start({ city: { buildings: async () => { throw new Error('boom'); } } });
    try {
        const res = await post(app.url, { messages: [{ role: 'user', content: 'Hi' }] });
        assert.equal(res.status, 200);
        assert.deepEqual(events(await res.text()), [{ event: 'error', data: { message: 'The guide is resting. Please use the contact form.', fallback: 'contact' } }]);
        assert.deepEqual(app.logs, ['[chat] failed: boom']);
    } finally {
        await app.close();
    }
});

test('other /api routes keep the 16 KB body limit', async () => {
    const app = await start();
    try {
        const res = await fetch(`${app.url}/api/nothing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: 'y'.repeat(20 * 1024) }) });
        assert.equal(res.status, 413);
    } finally {
        await app.close();
    }
});
