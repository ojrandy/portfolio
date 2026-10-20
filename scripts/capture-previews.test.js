import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureCandidates, isChallengePage } from './capture-previews.js';

test('capture candidates use only safe HTTPS live URLs and keep stable slugs', () => {
    assert.deepEqual(captureCandidates([
        { slug: 'sns-glam', live: 'https://snsglamshairmakeupstudio.com/#top' },
        { slug: 'http-site', live: 'http://example.com/' },
        { slug: 'missing', live: 'TODO(content)' },
        { slug: 'bad-host', live: 'https://user:pass@example.com/' },
        { slug: 'demo-project', live: 'https://example.com/demo', demo: true },
        { slug: 'demo-live', live: 'https://example.com/demo', demoFields: ['live'] },
    ]), [
        { slug: 'sns-glam', url: 'https://snsglamshairmakeupstudio.com/' },
    ]);
});

test('challenge pages are detected and real project pages are not', () => {
    assert.equal(isChallengePage('Checking your browser before accessing. Just a moment...', 'Please wait for up to 5 seconds...'), true);
    assert.equal(isChallengePage('SnS Glams | Luxury Hair, Makeup & Photo Studio', 'Book an appointment'), false);
});
