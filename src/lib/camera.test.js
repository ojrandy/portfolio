import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toBuildings, FOOTPRINTS } from './buildings.js';
import { layoutCity, chooseTier, TIERS, BLOCK_LOTS, FEATURED_LOTS } from './layout.js';
import { FAKO, fakoPlacement } from './backdrop.js';
import { hashString } from './random.js';
import {
    CAMERA, BUILDING_VIEW, FLIGHT, homeView, buildingView, isBlocked, tabOrder, stepFocus, flightSmoothTime, targetBounds,
} from './camera.js';
import { buildCity, loadProjects } from '../../server/lib/city.js';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const PORTRAIT = 9 / 16;

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => a.map((v) => v / Math.hypot(...a));

/** Normalised device coords of `point` for a camera at `view` (|x|, |y| < 1 ⇒ in frame). */
const project = (view, point, aspect) => {
    const f = norm(sub(view.target, view.position));
    const r = norm(cross(f, [0, 1, 0]));
    const u = cross(r, f);
    const v = sub(point, view.position);
    const depth = dot(v, f);
    const t = Math.tan((CAMERA.fov * Math.PI) / 360);
    return { x: dot(v, r) / depth / (t * aspect), y: dot(v, u) / depth / t, depth };
};

const polar = (view) => {
    const v = sub(view.position, view.target);
    return Math.acos(v[1] / Math.hypot(...v));
};

const assertWithinLimits = (view, layout, label) => {
    const { min, max } = targetBounds(layout.bounds);
    view.target.forEach((v, k) => assert.ok(v >= min[k] - 1e-9 && v <= max[k] + 1e-9, `${label}: target outside the boundary`));
    const distance = Math.hypot(...sub(view.position, view.target));
    assert.ok(distance >= CAMERA.minDistance && distance <= CAMERA.maxDistance, `${label}: distance ${distance}`);
    const p = polar(view);
    assert.ok(p >= CAMERA.minPolar - 1e-9 && p <= CAMERA.maxPolar + 1e-9, `${label}: polar ${p}`);
};

// Buildings with varied, slug-seeded heights (1.8–12) and footprints, like the real generator's range.
const SIZES = Object.values(FOOTPRINTS).map((f) => f.size);
const city = (n) => Array.from({ length: n }, (_, i) => {
    const slug = `p-${String(i).padStart(3, '0')}`;
    const h = hashString(slug);
    const size = SIZES[h % SIZES.length];
    return { slug, flag: i < 2, width: size, depth: size, height: 0.6 * (3 + (h % 18)) };
});
const tierSizes = TIERS.map((tier) => (tier * BLOCK_LOTS) ** 2 - FEATURED_LOTS);

test('home view: inside the limits, downtown ahead and Fako in frame at every downtown size and screen shape', () => {
    for (const n of [0, ...tierSizes]) {
        const layout = layoutCity(city(n));
        const { downtown, entrance } = layout;
        const fako = fakoPlacement(layout.bounds);
        for (const aspect of [16 / 9, 4 / 3, PORTRAIT]) {
            const view = homeView(layout, { aspect });
            const label = `tier ${chooseTier(n)}, aspect ${aspect.toFixed(2)}`;
            assertWithinLimits(view, layout, label);
            assert.equal(view.position[0], entrance.x, `${label}: on Career Road`);
            assert.ok(view.position[2] >= entrance.z, `${label}: at or behind the entrance`);
            // Today's 3 × 3 downtown fits from the entrance itself on desktop screens.
            if (chooseTier(n) === 3 && aspect >= 4 / 3) assert.equal(view.position[2], entrance.z, `${label}: starts at the entrance`);

            const summit = project(view, [fako.x, FAKO.height, fako.z], aspect);
            assert.ok(summit.depth > 0 && Math.abs(summit.x) < 1 && summit.y > 0 && summit.y < 0.9, `${label}: Fako out of frame`);
            const front = downtown.z + downtown.size / 2;
            for (const x of [-downtown.size / 2, downtown.size / 2]) {
                const corner = project(view, [x, 0, front], aspect);
                // Full width on every screen for today's 3 × 3 downtown; bigger ones hit the zoom limit in portrait.
                if (chooseTier(n) === 3 || (chooseTier(n) === 4 && aspect >= 4 / 3)) assert.ok(Math.abs(corner.x) < 1, `${label}: front row cut off`);
                assert.ok(Math.abs(corner.y) < 1, `${label}: front row below the frame`);
            }
            const centre = project(view, [0, 0, downtown.z], aspect);
            assert.ok(Math.abs(centre.x) < 1 && Math.abs(centre.y) < 1, `${label}: downtown out of frame`);
        }
    }
});

test('building views: inside the limits, above the roofs and never blocked, for every lot at every size', () => {
    for (const n of tierSizes) {
        const layout = layoutCity(city(n));
        for (const lot of layout.lots) {
            const view = buildingView(lot, layout.lots);
            assertWithinLimits(view, layout, lot.slug);
            assert.ok(!isBlocked(view.position, view.target, layout.lots, lot.slug), `${lot.slug}: view blocked`);
            assert.ok(view.position[1] > lot.building.height, `${lot.slug}: camera below the roof`);
        }
    }
});

test('building view rises over a taller building in front, and keeps the default angle otherwise', () => {
    const short = { slug: 'short', x: 0, z: 0, building: { width: 2.2, depth: 2.2, height: 1.8 } };
    const tall = { slug: 'tall', x: -3.6, z: 3.6, building: { width: 3, depth: 3, height: 12 } }; // south-west of it
    const alone = buildingView(short, [short]);
    const behind = buildingView(short, [short, tall]);
    assert.ok(isBlocked(alone.position, alone.target, [short, tall], 'short'), 'the setup must block the default view');
    assert.ok(behind.position[1] > alone.position[1], 'camera rises');
    assert.ok(!isBlocked(behind.position, behind.target, [short, tall], 'short'));
    assert.equal(polar(alone).toFixed(6), (Math.PI / 2 - BUILDING_VIEW.elevation).toFixed(6));
});

test('real content: every building has a clear view', () => {
    const stats = JSON.parse(readFileSync(new URL('./fixtures/github-stats.json', import.meta.url), 'utf8'));
    const layout = layoutCity(toBuildings(buildCity(loadProjects(), stats), { now: NOW }));
    for (const lot of layout.lots) {
        const view = buildingView(lot, layout.lots);
        assertWithinLimits(view, layout, lot.slug);
        assert.ok(!isBlocked(view.position, view.target, layout.lots, lot.slug), `${lot.slug}: view blocked`);
    }
});

test('tab order: deterministic, every building once, front row first and west to east', () => {
    const layout = layoutCity(city(40));
    const order = tabOrder(layout.lots);
    assert.deepEqual(order, tabOrder([...layout.lots].reverse()));
    assert.equal(new Set(order).size, layout.lots.length);
    const bySlug = new Map(layout.lots.map((l) => [l.slug, l]));
    const lots = order.map((s) => bySlug.get(s));
    assert.equal(lots[0].z, Math.max(...layout.lots.map((l) => l.z)));
    lots.slice(1).forEach((l, i) => {
        const prev = lots[i];
        assert.ok(l.z < prev.z || (l.z === prev.z && l.x > prev.x), 'order goes back row by row, west to east');
    });
});

test('stepFocus: enters at either end, releases focus past the ends (no keyboard trap)', () => {
    const order = ['a', 'b', 'c'];
    assert.equal(stepFocus(order, null, 1), 'a');
    assert.equal(stepFocus(order, null, -1), 'c');
    assert.equal(stepFocus(order, 'a', 1), 'b');
    assert.equal(stepFocus(order, 'b', -1), 'a');
    assert.equal(stepFocus(order, 'c', 1), undefined);
    assert.equal(stepFocus(order, 'a', -1), undefined);
    assert.equal(stepFocus(order, 'gone', 1), 'a');
    assert.equal(stepFocus([], null, 1), undefined);
});

test('flights settle in 1.2–1.8 s (≈ 3.3 × smoothTime), longer for longer trips', () => {
    const settle = (d) => 3.3 * flightSmoothTime(d);
    for (const d of [0, 10, 50, 100, 500]) {
        assert.ok(settle(d) >= 1.18 && settle(d) <= 1.82, `distance ${d}: ${settle(d)} s`);
    }
    assert.ok(flightSmoothTime(80) > flightSmoothTime(10));
    assert.equal(flightSmoothTime(FLIGHT.farDistance * 3), FLIGHT.maxSmoothTime);
});
