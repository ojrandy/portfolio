import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    toBuilding, toBuildings, buildingHeight, buildingFootprint, litWindowRatio, hasCrane,
    KIT, usesKit, kitWindowCentres, kitPieces,
    FLOOR_HEIGHT, MIN_HEIGHT, MAX_HEIGHT, FOOTPRINTS, FACES, LIT_MAX, LIT_MIN, LIT_BY_STATUS, LIT_UNKNOWN, SWITCH_LAST, SWITCH_NEVER,
} from './buildings.js';
import { COLORS, LANGUAGE_COLORS, languageColor, mixHex, desaturate } from './palette.js';
import { createRandom, hashString, shuffledIndices } from './random.js';
import { parseCityResponse } from './cityData.js';
import { buildCity, loadProjects } from '../../server/lib/city.js';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const DAY = 86_400_000;
const daysAgo = (d) => new Date(NOW - d * DAY).toISOString();

const github = (over = {}) => ({ source: 'github', commits: 48, stars: 1, lastPush: daysAgo(3), languages: { TypeScript: 0.98, CSS: 0.02 }, ...over });
const owner = { source: 'owner', commits: null, stars: null, lastPush: null, languages: null };
const none = { source: 'none', commits: null, stars: null, lastPush: null, languages: null };

const project = (over = {}) => ({
    slug: 'p', name: 'P', district: 'downtown', featured: false, status: 'live', category: [], stack: ['React'],
    live: null, repo: null, primaryLanguage: null, effort: null, stats: none, preview: null, demo: false,
    ...over,
});

// --- random.js ---

test('seeded random is deterministic and seed-dependent', () => {
    const seq = (seed) => Array.from({ length: 5 }, createRandom(seed));
    assert.deepEqual(seq('sns-glam'), seq('sns-glam'));
    assert.notDeepEqual(seq('sns-glam'), seq('vital-pulse'));
    for (const v of seq('x')) assert.ok(v >= 0 && v < 1);
    assert.equal(hashString(''), 0x811c9dc5);
    const s = shuffledIndices(20, createRandom('a'));
    assert.deepEqual([...s].sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i));
});

// --- palette.js ---

test('language colours follow the design system, others are indigo', () => {
    assert.equal(languageColor('TypeScript'), '#3178C6');
    assert.equal(languageColor('Dart'), LANGUAGE_COLORS.Dart);
    assert.equal(languageColor('Rust'), COLORS.indigo);
    assert.equal(languageColor(null), COLORS.indigo);
    assert.equal(mixHex('#000000', '#FFFFFF', 0.5), '#808080');
    assert.equal(mixHex('#123456', '#ABCDEF', 0), '#123456');
    assert.equal(desaturate('#FF0000', 1), '#4C4C4C');
    assert.equal(desaturate('#FF0000', 0), '#FF0000');
});

// --- height ---

test('height: log2(commits + 1) * k, clamped and snapped to whole floors', () => {
    const h = (stats, effort = null) => buildingHeight(project({ stats, effort })).height;
    assert.equal(h(none), MIN_HEIGHT);
    assert.equal(h(github({ commits: 0 })), MIN_HEIGHT);
    assert.equal(h(github({ commits: 1_000_000 })), MAX_HEIGHT);
    // 62 commits → log2(63) * 1.6 ≈ 9.56 → 16 floors
    assert.equal(buildingHeight(project({ stats: github({ commits: 62 }) })).floors, 16);
    assert.ok(h(github({ commits: 14 })) < h(github({ commits: 62 })));
    for (const c of [0, 1, 7, 62, 500]) {
        const { floors, height } = buildingHeight(project({ stats: github({ commits: c }) }));
        assert.ok(Number.isInteger(floors));
        assert.ok(Math.abs(height - floors * FLOOR_HEIGHT) < 1e-9);
    }
});

test('height: owner effort uses the same scale (effort 10 ≈ 128 commits)', () => {
    const effort10 = buildingHeight(project({ stats: owner, effort: 10 })).height;
    const commits127 = buildingHeight(project({ stats: github({ commits: 127 }) })).height;
    assert.equal(effort10, commits127);
    assert.ok(buildingHeight(project({ stats: owner, effort: 3 })).height < effort10);
    // GitHub numbers win over effort; 'none' ignores a stray effort.
    assert.equal(buildingHeight(project({ stats: github({ commits: 0 }), effort: 10 })).height, MIN_HEIGHT);
    assert.equal(buildingHeight(project({ stats: none, effort: 10 })).height, MIN_HEIGHT);
});

// --- footprint ---

test('footprint: stack size, falling back to GitHub languages over 5 %', () => {
    const f = (over) => buildingFootprint(project(over));
    assert.equal(f({ stack: [] }), 'small');
    assert.equal(f({ stack: ['a', 'b'] }), 'small');
    assert.equal(f({ stack: ['a', 'b', 'c'] }), 'medium');
    assert.equal(f({ stack: ['a', 'b', 'c', 'd'] }), 'medium');
    assert.equal(f({ stack: ['a', 'b', 'c', 'd', 'e'] }), 'large');
    const langs = { TypeScript: 0.5, CSS: 0.2, HTML: 0.2, Shell: 0.06, Dockerfile: 0.04 };
    assert.equal(f({ stack: [], stats: github({ languages: langs }) }), 'medium');
    assert.equal(f({ stack: ['a'], stats: github({ languages: langs }) }), 'small');
});

// --- windows / crane ---

test('lit windows fade with days since last push', () => {
    const r = (stats, status = 'live') => litWindowRatio(project({ stats, status }), NOW);
    assert.equal(r(github({ lastPush: daysAgo(0) })), LIT_MAX);
    assert.ok(Math.abs(r(github({ lastPush: daysAgo(365) })) - LIT_MIN) < 1e-9);
    assert.ok(Math.abs(r(github({ lastPush: daysAgo(3000) })) - LIT_MIN) < 1e-9);
    assert.ok(r(github({ lastPush: daysAgo(3) })) > r(github({ lastPush: daysAgo(30) })));
    assert.equal(r(github({ lastPush: new Date(NOW + DAY).toISOString() })), LIT_MAX); // clock skew
    assert.equal(r(none, 'in-progress'), LIT_BY_STATUS['in-progress']);
    assert.equal(r(owner, 'archived'), LIT_BY_STATUS.archived);
    assert.equal(r(none, null), LIT_UNKNOWN);
    assert.equal(r(github({ lastPush: 'not a date' }), null), LIT_UNKNOWN);
});

test('crane only for a real push in the last 7 days', () => {
    assert.equal(hasCrane(project({ stats: github({ lastPush: daysAgo(6.9) }) }), NOW), true);
    assert.equal(hasCrane(project({ stats: github({ lastPush: daysAgo(7.1) }) }), NOW), false);
    assert.equal(hasCrane(project({ stats: owner, status: 'in-progress', effort: 9 }), NOW), false);
});

// --- toBuilding ---

test('toBuilding: accents, roof features, weathered', () => {
    const b = toBuilding(project({
        slug: 'sns-glam', featured: true, live: 'https://example.com', primaryLanguage: 'TypeScript', stats: github(),
    }), { now: NOW });
    assert.equal(b.accentColor, '#3178C6');
    assert.equal(b.beacon, true);
    assert.equal(b.flag, true);
    assert.equal(b.crane, true);
    assert.equal(b.weathered, false);
    assert.equal(b.width, FOOTPRINTS.small.size);

    const old = toBuilding(project({ status: 'archived', primaryLanguage: 'JavaScript' }), { now: NOW });
    assert.equal(old.weathered, true);
    assert.equal(old.accentColor, desaturate('#F7DF1E', 0.7));
    assert.equal(old.beacon, false);
    assert.equal(old.flag, false);
    assert.equal(old.crane, false);
});

test('toBuilding: lit window count matches the ratio, same slug ⇒ same windows', () => {
    const p = project({ slug: 'vital-pulse', stack: ['a', 'b', 'c'], stats: owner, effort: 9, status: 'in-progress' });
    const a = toBuilding(p, { now: NOW });
    const b = toBuilding(structuredClone(p), { now: NOW + 10 * DAY }); // no push date: time doesn't matter
    assert.equal(a.litWindows.length, a.floors * a.columns * FACES);
    assert.equal(a.litWindows.filter(Boolean).length, Math.round(a.litWindowRatio * a.litWindows.length));
    assert.deepEqual(a.litWindows, b.litWindows);
    const c = toBuilding({ ...p, slug: 'smart-meal' }, { now: NOW });
    assert.notDeepEqual(a.litWindows, c.litWindows);
});

test('toBuilding: more recent push lights a superset of the same windows', () => {
    const at = (d) => toBuilding(project({ slug: 's', stats: github({ lastPush: daysAgo(d) }) }), { now: NOW }).litWindows;
    const recent = at(1);
    const stale = at(200);
    stale.forEach((lit, i) => { if (lit) assert.equal(recent[i], true); });
});

// --- real data end to end ---

test('every real project becomes a valid building', () => {
    const stats = JSON.parse(readFileSync(new URL('./fixtures/github-stats.json', import.meta.url), 'utf8'));
    const response = parseCityResponse({
        generatedAt: new Date(NOW).toISOString(),
        statsUpdatedAt: null,
        projects: buildCity(loadProjects(), { stats }),
    });
    const buildings = toBuildings(response.projects, { now: NOW });
    assert.equal(buildings.length, response.projects.length);
    assert.equal(new Set(buildings.map((b) => b.slug)).size, buildings.length);
    for (const b of buildings) {
        assert.ok(b.height >= MIN_HEIGHT && b.height <= MAX_HEIGHT, b.slug);
        assert.match(b.accentColor, /^#[0-9A-F]{6}$/);
        assert.match(b.bodyColor, /^#[0-9A-F]{6}$/);
        assert.ok(b.litWindowRatio >= LIT_MIN && b.litWindowRatio <= LIT_MAX, b.slug);
    }
});

test('parseCityResponse rejects a malformed response', () => {
    assert.throws(() => parseCityResponse({ projects: 'nope' }));
    assert.throws(() => parseCityResponse({ generatedAt: 'x', statsUpdatedAt: null, projects: [{ slug: '' }] }));
});

test('windows switch on at dusk at seeded points; unlit windows never switch on', () => {
    const b = toBuilding(project({ slug: 'switch-test', stats: github({ lastPush: daysAgo(30) }) }), { now: NOW });
    assert.equal(b.windowSwitch.length, b.litWindows.length);
    b.windowSwitch.forEach((s, i) => {
        if (b.litWindows[i]) assert.ok(s >= 0 && s <= SWITCH_LAST, `window ${i}`);
        else assert.equal(s, SWITCH_NEVER);
    });
    // Spread out, not all at once, and the same for every visitor.
    const lit = b.windowSwitch.filter((s) => s !== SWITCH_NEVER);
    assert.ok(new Set(lit).size > lit.length * 0.9);
    assert.deepEqual(toBuilding(project({ slug: 'switch-test', stats: github({ lastPush: daysAgo(30) }) }), { now: NOW }).windowSwitch, b.windowSwitch);
});

// --- city kit (ART-03) ---

const medium = (over = {}) => toBuilding(project({
    slug: 'kit-test', stack: ['React', 'Node', 'MySQL'], primaryLanguage: 'TypeScript',
    stats: github({ commits: 4000 }), ...over,
}), { now: NOW });

test('kit: only the medium footprint uses it for now; paint is the accent with 35 % paper', () => {
    const b = medium();
    assert.equal(b.footprint, 'medium');
    assert.equal(usesKit(b), true);
    assert.equal(usesKit(toBuilding(project({ stack: ['React'] }), { now: NOW })), false);
    assert.equal(b.paintColor, mixHex('#3178C6', COLORS.paper, 0.35));
    const old = medium({ status: 'archived' });
    assert.equal(old.paintColor, mixHex(desaturate('#3178C6', 0.7), COLORS.paper, 0.35));
});

test('kit: window centres match the Blender pieces (corner 0.25, windows 0.42, evenly spaced)', () => {
    const xs = kitWindowCentres(FOOTPRINTS.medium.size, FOOTPRINTS.medium.columns);
    [-0.64, 0, 0.64].forEach((x, i) => assert.ok(Math.abs(xs[i] - x) < 1e-9, `${xs[i]} vs ${x}`));
    const edge = FOOTPRINTS.medium.size / 2 - KIT.corner - KIT.windowWidth / 2;
    assert.ok(Math.abs(xs.at(-1) - edge) < 1e-9);
});

test('kit: one ground floor, a middle floor per storey, a roof on top; deterministic', () => {
    const b = medium();
    const pieces = kitPieces(b);
    assert.equal(pieces.length, b.floors + 1);
    assert.equal(pieces[0].piece, 'floor_ground_w3');
    assert.equal(pieces.at(-1).piece, 'roof_flat_w3');
    assert.equal(pieces.at(-1).y, b.height);
    assert.equal(pieces.at(-1).rotationY, 0);
    pieces.slice(1, -1).forEach((p, i) => {
        assert.match(p.piece, /^floor_mid_(plain|balcony)_w3$/);
        assert.ok(Math.abs(p.y - (i + 1) * FLOOR_HEIGHT) < 1e-9);
    });
    assert.deepEqual(kitPieces(b), pieces);
});

test('kit: middle floors come in runs of 2–4 of the same kind (the top run may be cut short)', () => {
    for (const slug of ['a', 'b', 'vital-pulse', 'pickup-app', 'learn-contri-talk']) {
        const kinds = kitPieces(medium({ slug })).slice(1, -1).map((p) => p.piece);
        const runs = [];
        kinds.forEach((k, i) => (i && k === kinds[i - 1] ? runs[runs.length - 1]++ : runs.push(1)));
        runs.slice(0, -1).forEach((n) => assert.ok(n >= 2 && n <= 4, `${slug}: ${kinds.join(',')}`));
        assert.ok(runs.at(-1) <= 4);
    }
});

test('kit: the door avoids shop faces, balconies face a street', () => {
    const b = medium();
    const shops = new Set([0, 1]);
    const pieces = kitPieces(b, shops);
    const face = (p) => Math.round(p.rotationY / (Math.PI / 2));
    assert.equal(shops.has(face(pieces[0])), false);
    pieces.filter((p) => p.piece.includes('balcony')).forEach((p) => assert.ok(shops.has(face(p))));
    assert.equal(face(kitPieces(b)[0]), 0);
});
