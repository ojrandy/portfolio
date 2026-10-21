import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { careerRoles, careerSigns, signParts, SIGN } from './careerRoad.js';
import { layoutCity } from './layout.js';
import { lampSpots } from './lamps.js';

const profile = JSON.parse(readFileSync(new URL('../../content/profile.json', import.meta.url), 'utf8'));
const role = (extra) => ({ role: 'Dev', company: 'Co', dates: { start: '2020-01', end: '2021-01' }, location: 'Remote', did: [], proudest: 'x', demo: false, demoFields: [], ...extra });
const career = (layout) => layout.roads.find((r) => r.kind === 'career');
const building = (slug) => ({ slug, flag: false, width: 2, depth: 2, height: 4 });

test('career: newest first, no demo roles, demo fields or TODO text; dates read as labels', () => {
    const roles = careerRoles({
        experience: [
            role({ company: 'Old', dates: { start: '2019-03', end: '2020-09' } }),
            role({ company: 'Placeholder', demo: true }),
            role({ company: 'Now', role: 'Invented', dates: { start: '2026-06', end: 'present' }, demoFields: ['role'], did: ['Built things', 'TODO(content)'] }),
            role({ company: 'TODO(content)', dates: { start: '2024-11', end: '2025' }, proudest: 'TODO(content)' }),
        ],
    });
    assert.deepEqual(roles.map((r) => r.company), ['Now', null, 'Old']);
    assert.deepEqual(roles[0], { role: null, company: 'Now', location: 'Remote', years: '2026 → Present', dates: 'Jun 2026 – Present', did: ['Built things'], proudest: 'x' });
    assert.equal(roles[1].years, '2024 → 2025');
    assert.equal(roles[1].dates, 'Nov 2024 – 2025');
    assert.equal(roles[1].proudest, null);
    assert.equal(roles[2].dates, 'Mar 2019 – Sep 2020');
});

test('career: a role with neither title nor company is dropped; one-year roles show the year once', () => {
    const roles = careerRoles({ experience: [role({ role: 'TODO(content)', company: ' ' }), role({ dates: { start: '2023-02', end: '2023-08' } })] });
    assert.equal(roles.length, 1);
    assert.equal(roles[0].years, '2023');
    assert.deepEqual(careerRoles({}), []);
});

test('career: the real content gives three roles, newest (Web Spectron) first', () => {
    const roles = careerRoles(profile);
    assert.ok(roles.length >= 3);
    assert.equal(roles[0].company, 'Web Spectron Ltd');
    assert.ok(roles.every((r) => !JSON.stringify(r).includes('TODO') && !JSON.stringify(r).includes('[DEMO]')));
});

test('signs: newest by downtown, oldest towards the entrance, alternating sides, between the lamps', () => {
    const layout = layoutCity(['a', 'b', 'c'].map(building));
    const road = career(layout);
    const signs = careerSigns(3, road);
    assert.ok(signs[0].z < signs[1].z && signs[1].z < signs[2].z, 'newest nearest downtown (north)');
    assert.deepEqual(signs.map((s) => s.side), [-1, 1, -1]);
    const lamps = lampSpots(layout).filter((l) => Math.abs(l.x - road.x) < 3);
    for (const sign of signs) {
        assert.ok(lamps.every((l) => Math.abs(l.z - sign.z) >= 2), 'a sign never stands at a lamp');
        // The board's inner end stays off the road.
        assert.ok(Math.abs(sign.x - road.x) - SIGN.width / 2 > road.width / 2);
        assert.ok(sign.z > road.z - road.depth / 2 && sign.z < road.z + road.depth / 2);
        // Faces south (towards the visitor) and turned towards the road.
        assert.ok(Math.cos(sign.rotationY) > 0.9);
        assert.ok(Math.sign(Math.sin(sign.rotationY)) === -sign.side);
    }
});

test('signs: more roles than lamp gaps are spread evenly along the road', () => {
    const road = career(layoutCity(['a'].map(building)));
    const signs = careerSigns(8, road);
    assert.equal(signs.length, 8);
    const gaps = signs.slice(1).map((s, i) => s.z - signs[i].z);
    assert.ok(gaps.every((g) => Math.abs(g - gaps[0]) < 1e-9 && g > 0));
    assert.ok(signs.every((s) => Math.abs(s.z - road.z) < road.depth / 2));
});

test('sign parts: two posts and a board per sign, posts behind the board', () => {
    const [sign] = careerSigns(1, career(layoutCity(['a'].map(building))));
    const parts = signParts([sign]);
    assert.equal(parts.length, 3);
    const [left, right, board] = parts;
    assert.ok(Math.abs(Math.hypot(left.position[0] - right.position[0], left.position[2] - right.position[2]) - (SIGN.width - 2 * SIGN.postInset)) < 1e-9);
    assert.ok(Math.abs(board.position[1] - SIGN.height / 2 - SIGN.bottom) < 1e-9);
    // Behind = further along the board's back normal (−z local) than the board.
    const back = [-Math.sin(sign.rotationY), -Math.cos(sign.rotationY)];
    const depth = (p) => (p.position[0] - board.position[0]) * back[0] + (p.position[2] - board.position[2]) * back[1];
    assert.ok(depth(left) > 0 && depth(right) > 0);
});
