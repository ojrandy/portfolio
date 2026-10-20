import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cinemaReel } from './cinemaReel.js';

const profile = JSON.parse(readFileSync(new URL('../../content/profile.json', import.meta.url), 'utf8'));
const channel = 'https://www.youtube.com/@someone';

test('cinema: a non-demo local reel wins over the channel link', () => {
    assert.deepEqual(cinemaReel({
        video: [
            { title: 'Demo', demo: true, file: 'public/videos/demo.mp4' },
            { title: 'Showreel', file: 'public/videos/showreel.webm' },
        ],
        links: { youtube: channel },
    }), { kind: 'file', title: 'Showreel', src: '/videos/showreel.webm' });
});

test('cinema: without a reel, the owner\'s channel; never a demo, unsafe or non-HTTPS one', () => {
    assert.deepEqual(cinemaReel({ video: [], links: { youtube: channel } }), { kind: 'link', title: 'Video work on YouTube', href: channel });
    assert.equal(cinemaReel({ links: { youtube: channel }, demoFields: ['links.youtube'] }), null);
    assert.equal(cinemaReel({ links: { youtube: 'http://www.youtube.com/@someone' } }), null);
    assert.equal(cinemaReel({ links: { youtube: 'javascript:alert(1)' } }), null);
    assert.equal(cinemaReel({ video: [
        { title: 'Traversal', file: 'public/videos/../private.mp4' },
        { title: 'Unsupported', file: 'public/videos/reel.avi' },
    ] }), null);
    assert.equal(cinemaReel(), null);
});

test('cinema: the real profile resolves to a non-demo reel or the owner\'s own channel', () => {
    const reel = cinemaReel(profile);
    if (reel?.kind === 'file') assert.ok(profile.video.some((v) => !v.demo && `/${v.file?.slice('public/'.length)}` === reel.src));
    else if (reel) assert.equal(reel.href, new URL(profile.links.youtube).href);
});
