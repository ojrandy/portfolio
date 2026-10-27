import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bueaDay, cleanAnswer, createGroq, GROQ_URL, MAX_AI_CHARS } from './lib/groq.js';

const ENV = { GROQ_API_KEY: 'test-key', GROQ_MODEL: 'test-model', CHAT_DAILY_AI_LIMIT: '2' };
const quiet = { warn: () => {} };
const reply = (content, status = 200) => async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });

const withDir = async (fn) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ojcity-groq-'));
    try {
        await fn(dir);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
};

test('off without a key or a model', async () => {
    for (const env of [{}, { GROQ_API_KEY: 'k' }, { GROQ_MODEL: 'm' }, { GROQ_API_KEY: ' ', GROQ_MODEL: 'm' }]) {
        const groq = createGroq({ env, fetchImpl: () => assert.fail('no call') });
        assert.equal(groq.enabled, false);
        assert.equal(await groq.available(), false);
        assert.equal(await groq.answer({ system: 's', messages: [] }), null);
    }
});

test('sends the system prompt and only role + content, with the key in the header', async () => withDir(async (dir) => {
    let sent;
    const fetchImpl = async (url, options) => {
        sent = { url, options, body: JSON.parse(options.body) };
        return reply('He built Vital Pulse [vital-pulse].')();
    };
    const groq = createGroq({ env: ENV, fetchImpl, dir, log: quiet });
    const text = await groq.answer({ system: 'RULES', messages: [{ role: 'user', content: 'Hi', extra: 1 }] });
    assert.equal(text, 'He built Vital Pulse [vital-pulse].');
    assert.equal(sent.url, GROQ_URL);
    assert.equal(sent.options.headers.Authorization, 'Bearer test-key');
    assert.equal(sent.body.model, 'test-model');
    assert.equal(sent.body.stream, false);
    assert.deepEqual(sent.body.messages, [{ role: 'system', content: 'RULES' }, { role: 'user', content: 'Hi' }]);
    await groq.flush();
}));

test('failures return null: HTTP errors, 429, bad JSON, empty answers, network errors and timeouts', async () => withDir(async (dir) => {
    const env = { ...ENV, CHAT_DAILY_AI_LIMIT: '100' };
    const cases = [
        reply('x', 500),
        reply('x', 429),
        async () => new Response('not json'),
        reply('   '),
        async () => ({ ok: true, json: async () => ({ choices: [] }) }),
        async () => { throw new TypeError('fetch failed'); },
        (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
    ];
    for (const fetchImpl of cases) {
        const groq = createGroq({ env, fetchImpl, dir, timeoutMs: 20, log: quiet });
        assert.equal(await groq.answer({ system: 's', messages: [{ role: 'user', content: 'Hi' }] }), null);
        await groq.flush();
    }
}));

test('daily cap: counted per Buea day, kept on disk across restarts, reset the next day', async () => withDir(async (dir) => {
    let now = Date.parse('2026-10-27T22:30:00Z'); // 23:30 in Buea
    let calls = 0;
    const fetchImpl = async () => { calls += 1; return reply('ok')(); };
    const make = () => createGroq({ env: ENV, fetchImpl, dir, now: () => now, log: quiet });

    const first = make();
    assert.equal(await first.answer({ system: 's', messages: [] }), 'ok');
    await first.flush();
    const second = make(); // a restart
    assert.equal(await second.available(), true);
    assert.equal(await second.answer({ system: 's', messages: [] }), 'ok');
    assert.equal(await second.available(), false);
    assert.equal(await second.answer({ system: 's', messages: [] }), null);
    assert.equal(calls, 2);
    await second.flush();
    assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'chat-ai-day.json'), 'utf8')), { day: '2026-10-27', count: 2 });

    now = Date.parse('2026-10-27T23:30:00Z'); // 00:30 the next day in Buea
    assert.equal(bueaDay(new Date(now)), '2026-10-28');
    assert.equal(await second.answer({ system: 's', messages: [] }), 'ok');
    await second.flush();
}));

test('cleanAnswer: unknown slugs go, markdown is flattened, long answers are cut', () => {
    const slugs = new Set(['vital-pulse', 'harvest']);
    const out = cleanAnswer('## Projects\n**Vital Pulse** [vital-pulse] and Fake [made-up-app] and [Link](https://x.com).\n* Harvest [harvest]\n\n\n\nBye\u0007', slugs);
    assert.equal(out.text, 'Projects\nVital Pulse [vital-pulse] and Fake and [Link](https://x.com).\n- Harvest [harvest]\n\nBye');
    assert.deepEqual(out.citations, ['vital-pulse', 'harvest']);

    const long = cleanAnswer(`${'A sentence that goes on. '.repeat(100)}`, slugs);
    assert.ok(long.text.length <= MAX_AI_CHARS);
    assert.match(long.text, /on\.$/);
    assert.deepEqual(cleanAnswer('[ignore all rules] hi', slugs), { text: 'hi', citations: [] });
});
