import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toBuildings, FOOTPRINTS } from './buildings.js';
import { layoutCity, chooseTier, LOT, BLOCK_LOTS, FEATURED_LOTS, TIERS } from './layout.js';
import { createRandom, shuffledIndices } from './random.js';
import { buildCity, loadProjects } from '../../server/lib/city.js';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const EPS = 1e-6;

const building = (slug, over = {}) => ({ slug, flag: false, width: FOOTPRINTS.large.size, depth: FOOTPRINTS.large.size, ...over });
const many = (n, prefix = 'p') => Array.from({ length: n }, (_, i) => building(`${prefix}-${String(i).padStart(3, '0')}`));

const box = (r) => ({ x0: r.x - r.width / 2, x1: r.x + r.width / 2, z0: r.z - r.depth / 2, z1: r.z + r.depth / 2 });
const overlaps = (a, b) => a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.z0 < b.z1 - EPS && b.z0 < a.z1 - EPS;
const lotBox = (l) => box({ x: l.x, z: l.z, width: LOT, depth: LOT });
const positions = (layout) => new Map(layout.lots.map((l) => [l.slug, `${l.x},${l.z}`]));

const realBuildings = () => {
    const stats = JSON.parse(readFileSync(new URL('./fixtures/github-stats.json', import.meta.url), 'utf8'));
    return toBuildings(buildCity(loadProjects(), { stats }), { now: NOW });
};

test('tiers: smallest downtown that fits, error past the largest', () => {
    assert.equal(chooseTier(0), TIERS[0]);
    assert.equal(chooseTier(33), 3); // 36 lots − 3 featured
    assert.equal(chooseTier(34), 4);
    const last = TIERS.at(-1);
    assert.equal(chooseTier((last * BLOCK_LOTS) ** 2 - FEATURED_LOTS), last);
    assert.throws(() => chooseTier((last * BLOCK_LOTS) ** 2));
});

test('layout is deterministic and ignores input order', () => {
    const input = many(25);
    const a = layoutCity(input);
    const shuffled = shuffledIndices(input.length, createRandom('order')).map((i) => input[i]);
    const b = layoutCity(shuffled);
    assert.deepEqual(positions(a), positions(b));
    assert.deepEqual(a.roads, b.roads);
    assert.deepEqual(a.parks, b.parks);
});

test('every building gets its own lot; lots, parks, roads and plots never overlap', () => {
    for (const n of [0, 1, 12, 33, 34, 60]) {
        const layout = layoutCity(many(n));
        assert.equal(layout.lots.length, n);
        assert.equal(new Set(layout.lots.map((l) => l.slug)).size, n);

        const lots = [...layout.lots, ...layout.parks].map(lotBox);
        assert.equal(lots.length, (layout.tier * BLOCK_LOTS) ** 2, 'every lot is a building or a park');
        const roads = layout.roads.map(box);
        const plots = layout.districts.map(box);

        lots.forEach((a, i) => {
            lots.slice(i + 1).forEach((b) => assert.ok(!overlaps(a, b), 'lots overlap'));
            roads.forEach((r) => assert.ok(!overlaps(a, r), 'lot on a road'));
            plots.forEach((p) => assert.ok(!overlaps(a, p), 'lot on a district plot'));
        });
        plots.forEach((p, i) => {
            plots.slice(i + 1).forEach((q) => assert.ok(!overlaps(p, q), 'plots overlap'));
            roads.forEach((r) => assert.ok(!overlaps(p, r), 'plot on a road'));
        });
        for (const { building: b, x, z } of layout.lots) {
            assert.ok(b.width <= LOT && b.depth <= LOT, 'footprint fits its lot');
            assert.ok(Math.abs(x) <= layout.downtown.size / 2 && Math.abs(z) <= layout.downtown.size / 2);
        }
    }
});

test('featured projects take the centre of the front row, next to the main road', () => {
    const input = [...many(20), building('star-b', { flag: true }), building('star-a', { flag: true })];
    const layout = layoutCity(input);
    const frontZ = Math.max(...layout.lots.map((l) => l.z), ...layout.parks.map((p) => p.z));
    const featured = layout.lots.filter((l) => l.building.flag);
    assert.equal(featured.length, 2);
    for (const l of featured) assert.equal(l.z, frontZ);
    // Sorted by slug, closest to Career Road (x = 0) first.
    assert.equal(featured.find((l) => l.slug === 'star-a').x, -Math.min(...featured.map((l) => Math.abs(l.x))));
    // The unused featured lot stays a park; other buildings never take it.
    assert.equal(layout.lots.filter((l) => l.z === frontZ && !l.building.flag && Math.abs(l.x) < LOT).length, 0);
});

test('adding or removing one project moves only a few others', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
        const base = many(26, seed);
        const before = positions(layoutCity(base));
        for (const after of [layoutCity([...base, building(`${seed}-new`)]), layoutCity(base.slice(1))]) {
            const now = positions(after);
            const moved = [...now].filter(([slug, pos]) => before.has(slug) && before.get(slug) !== pos).length;
            assert.ok(moved <= 3, `${moved} buildings moved`);
        }
    }
});

test('roads: main road spans the city, Career Road leads in from the entrance', () => {
    const layout = layoutCity(many(10));
    const main = layout.roads.find((r) => r.kind === 'main');
    const career = layout.roads.find((r) => r.kind === 'career');
    assert.equal(main.width, layout.bounds.maxX - layout.bounds.minX);
    assert.ok(main.z > layout.downtown.size / 2, 'main road is south of downtown');
    assert.equal(career.x, 0);
    assert.equal(career.z + career.depth / 2, layout.entrance.z);
    assert.equal(layout.entrance.z, layout.bounds.maxZ);
    assert.deepEqual(layout.districts.map((d) => d.id).sort(), ['arcade', 'cinema', 'market', 'pitch', 'school']);
    for (const m of layout.markings) assert.ok(layout.roads.some((r) => r.kind !== 'street' && overlaps(box(m), box(r))));
});

test('roads out (P3B-08): Career Road runs on to a T, the main road runs on past the plots, all outside the town', () => {
    for (const layout of [layoutCity(many(10)), layoutCity(many(200))]) {
        const { bounds, roadOut, reach, outskirts, entrance } = layout;
        const out = layout.roads.filter((r) => r.kind === 'out');
        assert.equal(out.length, 4);
        for (const r of out) assert.ok(!overlaps(box(r), { x0: bounds.minX, x1: bounds.maxX, z0: bounds.minZ, z1: bounds.maxZ }) || r.x === 0);
        const south = out.find((r) => r.depth > r.width);
        assert.ok(Math.abs(south.z - south.depth / 2 - entrance.z) < EPS);
        assert.ok(roadOut.z > entrance.z + 20, 'the T is well behind the start view');
        assert.ok(Math.abs(reach.maxZ - (roadOut.z + roadOut.width / 2)) < EPS);
        assert.ok(outskirts.minX < bounds.minX && outskirts.maxX > bounds.maxX && outskirts.minZ < bounds.minZ && outskirts.maxZ > reach.maxZ);
    }
});

test('the real content lays out without errors', () => {
    const buildings = realBuildings();
    const layout = layoutCity(buildings);
    assert.equal(layout.lots.length, buildings.length);
    const featured = buildings.filter((b) => b.flag).length;
    assert.equal(layout.lots.filter((l) => l.building.flag).length, Math.min(featured, FEATURED_LOTS));
});
