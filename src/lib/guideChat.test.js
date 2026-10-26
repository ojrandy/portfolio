import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerLines, askGuide, createSSEReader, GuideError, mentionsContact, MAX_TURNS, trimHistory } from './guideChat.js';

test('SSE reader: events split across chunks, CRLF, several events per chunk', () => {
    const got = [];
    const reader = createSSEReader((name, data) => got.push([name, data]));
    reader.push('event: text\ndata: {"del');
    reader.push('ta":"Hi"}\n');
    reader.push('\nevent: done\r\ndata: {"engine":"guide"}\r\n\r\nevent: bad\ndata: {oops\n\n');
    reader.push('event: suggestions\ndata: {"items":["a"]}');
    reader.end();
    assert.deepEqual(got, [['text', { delta: 'Hi' }], ['done', { engine: 'guide' }], ['suggestions', { items: ['a'] }]]);
});

test('trimHistory keeps the last turns, starts with the visitor and caps lengths', () => {
    const long = Array.from({ length: 15 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
    const kept = trimHistory(long);
    assert.ok(kept.length <= MAX_TURNS);
    assert.equal(kept[0].role, 'user');
    assert.equal(kept.at(-1).content, 'm14');
    assert.deepEqual(trimHistory([{ role: 'user', content: 'x'.repeat(700) }])[0].content.length, 600);
    assert.deepEqual(trimHistory([{ role: 'user', content: 'hi', error: true, citations: [] }]), [{ role: 'user', content: 'hi' }]);
    assert.deepEqual(trimHistory([{ role: 'system', content: 'x' }, { role: 'user', content: '  ' }, { role: 'user', content: 'ok' }]), [{ role: 'user', content: 'ok' }]);
});

test('answerLines: lists, https links only, and "Name [slug]" chips for cited slugs', () => {
    const names = new Map([['vital-pulse', 'Vital Pulse'], ['quiz-app', 'Quiz App']]);
    const lines = answerLines('Yes. Ojong has used Flutter in Vital Pulse [vital-pulse] and [quiz-app].\n- Live site: https://vitalpulse237.com/.\n- Old: http://insecure.example\n[unknown-slug] stays text', names);
    assert.equal(lines.length, 4);
    assert.deepEqual(lines[0], { list: false, parts: [
        { type: 'text', text: 'Yes. Ojong has used Flutter in ' },
        { type: 'cite', slug: 'vital-pulse', label: 'Vital Pulse' },
        { type: 'text', text: ' and ' },
        { type: 'cite', slug: 'quiz-app', label: 'Quiz App' },
        { type: 'text', text: '.' },
    ] });
    assert.deepEqual(lines[1], { list: true, parts: [{ type: 'text', text: 'Live site: ' }, { type: 'link', href: 'https://vitalpulse237.com/', text: 'vitalpulse237.com' }, { type: 'text', text: '.' }] });
    assert.deepEqual(lines[2].parts, [{ type: 'text', text: 'Old: http://insecure.example' }], 'http is never a link');
    assert.deepEqual(lines[3].parts, [{ type: 'text', text: '[unknown-slug] stays text' }]);
    assert.deepEqual(answerLines('<img src=x onerror=alert(1)>')[0].parts, [{ type: 'text', text: '<img src=x onerror=alert(1)>' }], 'HTML stays text');
    assert.deepEqual(answerLines('javascript:alert(1) https://ok.example/a"b')[0].parts.map((p) => p.type), ['text', 'link', 'text']);
});

test('mentionsContact in English and French', () => {
    assert.ok(mentionsContact('ask him through the contact form.'));
    assert.ok(mentionsContact('via le formulaire de contact'));
    assert.ok(!mentionsContact('Yes, he knows React.'));
});

const sseResponse = (body, init = {}) => new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' }, ...init });

test('askGuide sends the trimmed conversation and reads the stream', async () => {
    let sent;
    const fetchImpl = async (url, options) => {
        sent = { url, body: JSON.parse(options.body) };
        return sseResponse('event: text\ndata: {"delta":"Hello "}\n\nevent: text\ndata: {"delta":"there"}\n\nevent: citations\ndata: {"items":[{"slug":"a","name":"A"}]}\n\nevent: suggestions\ndata: {"items":["Next?"]}\n\nevent: done\ndata: {"engine":"guide"}\n\n');
    };
    const reply = await askGuide([{ role: 'user', content: 'Hi', extra: 1 }], { fetchImpl });
    assert.equal(sent.url, '/api/chat');
    assert.deepEqual(sent.body, { messages: [{ role: 'user', content: 'Hi' }] });
    assert.deepEqual(reply, { text: 'Hello there', suggestions: ['Next?'], citations: [{ slug: 'a', name: 'A' }], engine: 'guide' });
});

test('askGuide errors: busy (429 message), unavailable (network, 5xx, error event, empty)', async () => {
    const busy = await askGuide([{ role: 'user', content: 'Hi' }], { fetchImpl: async () => new Response(JSON.stringify({ error: 'The guide needs a short break.' }), { status: 429 }) }).catch((e) => e);
    assert.ok(busy instanceof GuideError);
    assert.equal(busy.kind, 'busy');
    assert.equal(busy.message, 'The guide needs a short break.');
    for (const fetchImpl of [
        async () => { throw new TypeError('offline'); },
        async () => new Response('oops', { status: 502 }),
        async () => sseResponse('event: error\ndata: {"message":"The guide is resting.","fallback":"contact"}\n\n'),
        async () => sseResponse(''),
    ]) {
        const err = await askGuide([{ role: 'user', content: 'Hi' }], { fetchImpl }).catch((e) => e);
        assert.ok(err instanceof GuideError);
        assert.equal(err.kind, 'unavailable');
    }
    const aborted = await askGuide([{ role: 'user', content: 'Hi' }], { fetchImpl: async () => { throw new DOMException('stop', 'AbortError'); } }).catch((e) => e);
    assert.equal(aborted.name, 'AbortError', 'an abort is not reported as an error');
});
