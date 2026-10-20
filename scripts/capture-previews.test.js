import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GATE_BUTTON, captureCandidates, isBlankImage, isChallengePage } from './capture-previews.js';

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

test('age-gate and consent buttons are recognised, ordinary buttons are not', () => {
    for (const name of ['Yes, I am 21+', "I'm over 18", '18+', 'Enter site', 'Accept all cookies', 'I agree', 'Got it']) {
        assert.equal(GATE_BUTTON.test(name), true, name);
    }
    for (const name of ['No', 'Book now', 'Get a quote', 'Accept payment details', 'Shop 21 products']) {
        assert.equal(GATE_BUTTON.test(name), false, name);
    }
});

test('a single-colour screenshot counts as blank, a real page does not', () => {
    const cream = Array.from({ length: 100 }, () => [247, 243, 233, 255]).flat();
    assert.equal(isBlankImage(cream), true);
    const page = [...cream];
    page.splice(40, 4, 20, 20, 20, 255);
    assert.equal(isBlankImage(page), false);
});
