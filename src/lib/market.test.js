import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toBuildings } from './buildings.js';
import { layoutCity, TIERS, BLOCK_LOTS, FEATURED_LOTS } from './layout.js';
import { lampSpots } from './lamps.js';
import { careerSigns, SIGN } from './careerRoad.js';
import { ABOUT_HOUSE, aboutHouseSpot } from './aboutContent.js';
import { streetProps } from './streetProps.js';
import { cityPlaces } from './places.js';
import { createShoppers, marketDensity, marketOpen, marketSign, marketStalls, maxShoppers, pickMarket, pokeShopper, shopperPose, STALL, stepShoppers } from './market.js';
import { marketContent, MAX_STALLS } from './marketContent.js';
import { buildCity, loadProjects } from '../../server/lib/city.js';
import profile from '../../content/profile.json' with { type: 'json' };

const NOW = Date.parse('2026-10-15T12:00:00Z');
const EPS = 1e-6;
const many = (n) => Array.from({ length: n }, (_, i) => ({ slug: `p-${String(i).padStart(3, '0')}`, flag: false }));
const tierLayouts = TIERS.map((tier, i) => layoutCity(many(i === 0 ? 10 : (TIERS[i - 1] * BLOCK_LOTS) ** 2 - FEATURED_LOTS + 1)));
const realProjects = () => {
    const stats = JSON.parse(readFileSync(new URL('./fixtures/github-stats.json', import.meta.url), 'utf8'));
    return buildCity(loadProjects(), { stats });
};
const layouts = [...tierLayouts, layoutCity(toBuildings(realProjects(), { now: NOW }))];
const plotOf = (layout) => layout.districts.find((d) => d.id === 'market');
const rectOf = (r, pad = 0) => ({ x0: r.x - r.width / 2 - pad, x1: r.x + r.width / 2 + pad, z0: r.z - r.depth / 2 - pad, z1: r.z + r.depth / 2 + pad });
const distToRect = (x, z, r) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
const inside = (x, z, r) => x >= r.x0 - EPS && x <= r.x1 + EPS && z >= r.z0 - EPS && z <= r.z1 + EPS;
const stallRect = (s) => rectOf({ x: s.x, z: s.z, width: STALL.width, depth: STALL.depth });

test('market content: owner services only, demo and unknown examples left out, no prices', () => {
    const projects = [{ slug: 'real', name: 'Real' }, { slug: 'fake', name: 'Fake', demo: true }];
    const market = marketContent({
        services: [
            { name: 'Web apps', delivered: 'A site.', examples: ['real', 'fake', 'gone'], demo: false, demoFields: [] },
            { name: 'Logos', delivered: 'Draft line', examples: [], demo: false, demoFields: ['delivered'] },
            { name: 'Placeholder', delivered: null, examples: [], demo: true, demoFields: [] },
        ],
        marketCalls: ['I wan buy', 'TODO(content)', ' '],
    }, projects);
    assert.deepEqual(market, {
        stalls: [
            { index: 0, name: 'Web apps', delivered: 'A site.', examples: [{ slug: 'real', name: 'Real' }] },
            { index: 1, name: 'Logos', delivered: null, examples: [] },
        ],
        calls: ['I wan buy'],
    });
    assert.equal(marketContent({ services: [] }), null);
    assert.equal(marketContent({}), null);

    // The real content: every service has a stall and every example opens a building in the city.
    const real = marketContent(profile, realProjects());
    const services = profile.services.filter((s) => !s.demo);
    assert.equal(real.stalls.length, Math.min(services.length, MAX_STALLS));
    const slugs = new Set(realProjects().map((p) => p.slug));
    for (const stall of real.stalls) for (const e of stall.examples) assert.ok(slugs.has(e.slug), e.slug);
    assert.ok(real.calls.length > 0);
});

test('the Market plot keeps clear of Career Road, its signs, lamps, the About house and the street props', () => {
    for (const layout of layouts) {
        const plot = rectOf(plotOf(layout));
        const career = layout.roads.find((r) => r.kind === 'career');
        assert.ok(plot.x1 < career.x - career.width / 2, `tier ${layout.tier}: west of Career Road`);
        assert.ok(plot.z1 <= layout.bounds.maxZ && plot.x0 >= layout.bounds.minX, 'inside the city');
        for (const roles of [0, 3, 5, 8]) {
            for (const s of careerSigns(roles, career)) assert.ok(distToRect(s.x, s.z, plot) >= SIGN.width / 2 + 0.2, `tier ${layout.tier}: a sign in the market`);
            const props = streetProps(layout, { roles });
            const spots = [...props.stops, ...props.kiosks, ...props.palms, ...props.benches, ...props.billboards, ...props.trees];
            for (const p of spots) assert.ok(!inside(p.x, p.z, plot), `tier ${layout.tier}: a prop in the market`);
            assert.ok(props.stops.some((s) => distToRect(s.x, s.z, plot) < 6), 'a taxi/bus stop beside the market');
        }
        for (const l of lampSpots(layout)) assert.ok(!inside(l.x, l.z, plot), 'a lamp in the market');
        const house = aboutHouseSpot(career);
        assert.ok(distToRect(house.x, house.z, plot) >= ABOUT_HOUSE.radius);
        assert.ok(cityPlaces(layout).some((p) => p.id === 'market' && p.name === 'Market'), 'taxis go to the market');
    }
});

test('stalls: in the plot, never overlapping, rows facing south, the first service at the front by Career Road', () => {
    const plot = plotOf(layouts.at(-1));
    const area = rectOf(plot);
    for (let n = 1; n <= MAX_STALLS; n++) {
        const stalls = marketStalls(plot, n);
        assert.equal(stalls.length, n);
        stalls.forEach((s, i) => {
            const r = stallRect(s);
            assert.ok(inside(r.x0, r.z0, area) && inside(r.x1, r.z1, area), `${n} stalls: stall ${i} off the plot`);
            assert.ok(inside(s.x, s.front + 0.7, area), 'its aisle is on the plot');
            stalls.slice(i + 1).forEach((t) => {
                const q = stallRect(t);
                assert.ok(r.x1 <= q.x0 + EPS || q.x1 <= r.x0 + EPS || r.z1 <= q.z0 + EPS || q.z1 <= r.z0 + EPS, 'stalls overlap');
            });
        });
        // Aisles stay clear: no stall stands in front of another one's aisle line.
        for (const s of stalls) for (const t of stalls) assert.ok(!inside(s.x, s.front, stallRect(t)));
        const sign = marketSign(plot);
        assert.ok(inside(sign.x, sign.z, area), 'the sign is on the plot');
        for (const s of stalls) assert.ok(distToRect(sign.x, sign.z, stallRect(s)) >= 0.75, 'the sign is clear of the stalls');
        assert.equal(stalls[0].z, Math.max(...stalls.map((s) => s.z)), 'first stall in the front row');
        assert.equal(stalls[0].x, Math.max(...stalls.filter((s) => s.z === stalls[0].z).map((s) => s.x)), 'nearest Career Road');
    }
    assert.equal(marketStalls(plot, 40).length, STALL.rows * STALL.perRow);
    assert.deepEqual(marketStalls(plot, 0), []);
});

test('market hours: closed at night, busy in the day', () => {
    assert.equal(marketDensity(2 * 60), 0);
    assert.equal(marketOpen(22 * 60), false);
    assert.equal(marketDensity(12 * 60), 1);
    assert.ok(marketOpen(7 * 60) && marketDensity(7 * 60) < 1);
});

test('shoppers walk the aisles, never into a stall, come and go with the target, and are deterministic', () => {
    const plot = plotOf(layouts.at(-1));
    const stalls = marketStalls(plot, 15);
    const area = rectOf(plot);
    const run = () => {
        const state = createShoppers(stalls);
        const trace = [];
        for (let i = 0; i < 30 * 120; i++) {
            stepShoppers(state, 1 / 30, { target: i < 30 * 90 ? state.shoppers.length : 2 });
            for (const s of state.shoppers) {
                assert.ok(inside(s.x, s.z, area), 'shopper off the plot');
                for (const st of stalls) assert.ok(!inside(s.x, s.z, stallRect(st)), 'shopper inside a stall');
            }
            if (i % 300 === 0) trace.push(state.shoppers.map((s) => `${s.x.toFixed(3)},${s.z.toFixed(3)}`).join(' '));
        }
        return { state, trace };
    };
    const a = run();
    assert.deepEqual(a.trace, run().trace);
    assert.equal(a.state.shoppers.length, maxShoppers(stalls));
    assert.equal(a.state.shoppers.filter((s) => s.scale > 0).length, 2, 'the rest went home');
    // Everyone moved between stalls at some point.
    assert.ok(new Set(a.trace.map((t) => t)).size > 3);
});

test('clicks: a ray from above hits the stall under it; a shopper in front wins over the stall behind', () => {
    const plot = plotOf(layouts.at(-1));
    const stalls = marketStalls(plot, 6);
    const state = createShoppers(stalls, { count: 1 });
    state.shoppers[0].scale = 1;
    const down = (x, z) => ({ origin: { x, y: 20, z }, direction: { x: 0, y: -1, z: 0 } });
    assert.equal(pickMarket(state, down(stalls[2].x, stalls[2].z)).item, stalls[2]);
    assert.equal(pickMarket(state, down(plot.x, plot.z - plot.depth / 2 - 5)), null);
    const s = state.shoppers[0];
    Object.assign(s, { x: stalls[1].x, z: stalls[1].front });
    // From the south, low: the shopper stands between the camera and the stall.
    const dir = { x: 0, y: -0.2, z: -1 };
    const len = Math.hypot(dir.y, dir.z);
    const ray = { origin: { x: s.x, y: 1.25, z: s.z + 5 }, direction: { x: 0, y: dir.y / len, z: dir.z / len } };
    assert.equal(pickMarket(state, ray)?.kind, 'shopper');
    pokeShopper(s);
    assert.equal(shopperPose(s).rotationY % (Math.PI * 2), 0, 'turns to face the camera');
});
