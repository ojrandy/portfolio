import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toBuildings } from './buildings.js';
import { layoutCity, TIERS, BLOCK_LOTS, FEATURED_LOTS } from './layout.js';
import { lampSpots } from './lamps.js';
import { careerSigns, SIGN } from './careerRoad.js';
import { ABOUT_HOUSE, aboutHouseSpot } from './aboutContent.js';
import { streetProps, PROP_RADIUS, FUEL, BILLBOARDS } from './streetProps.js';
import { buildCity, loadProjects } from '../../server/lib/city.js';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const EPS = 1e-6;
const many = (n) => Array.from({ length: n }, (_, i) => ({ slug: `p-${String(i).padStart(3, '0')}`, flag: false }));
const tierLayouts = TIERS.map((tier, i) => layoutCity(many(i === 0 ? 10 : (TIERS[i - 1] * BLOCK_LOTS) ** 2 - FEATURED_LOTS + 1)));
const realLayout = () => {
    const stats = JSON.parse(readFileSync(new URL('./fixtures/github-stats.json', import.meta.url), 'utf8'));
    return layoutCity(toBuildings(buildCity(loadProjects(), { stats }), { now: NOW }));
};
const layouts = [...tierLayouts, realLayout()];
const ROLES = [0, 3, 5];

const rectOf = (r) => ({ x0: r.x - r.width / 2, x1: r.x + r.width / 2, z0: r.z - r.depth / 2, z1: r.z + r.depth / 2 });
const distToRect = (x, z, r) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
const items = (props) => [
    ...props.billboards.map((p) => ({ ...p, kind: 'billboard' })),
    ...props.stops.map((p) => ({ ...p, kind: 'stop' })),
    ...props.kiosks.map((p) => ({ ...p, kind: 'kiosk' })),
    ...props.palms.map((p) => ({ ...p, kind: 'palm' })),
    ...props.benches.map((p) => ({ ...p, kind: 'bench' })),
    ...props.trees.map((p) => ({ ...p, kind: 'tree' })),
].map((p) => ({ ...p, r: PROP_RADIUS[p.kind] }));

test('every city has the fuel station, three billboards, two stops and call boxes', () => {
    for (const layout of layouts) {
        for (const roles of ROLES) {
            const props = streetProps(layout, { roles });
            assert.ok(props.fuel, `tier ${layout.tier}: no fuel station`);
            assert.deepEqual(props.billboards.map((b) => b.id), BILLBOARDS);
            assert.equal(props.stops.length, 2);
            assert.ok(props.kiosks.length >= 2);
            assert.ok(props.palms.length >= 6 && props.benches.length >= layout.parks.length);
            assert.equal(props.trees.length >= layout.parks.length * 2, true);
        }
    }
});

test('props keep clear of roads, blocks, plots, lamps, career signs, the About house and each other', () => {
    for (const layout of layouts) {
        const career = layout.roads.find((r) => r.kind === 'career');
        const blocked = [...layout.roads, ...layout.pavements, ...layout.districts].map(rectOf);
        const lamps = lampSpots(layout);
        const house = aboutHouseSpot(career);
        for (const roles of ROLES) {
            const props = streetProps(layout, { roles });
            const signs = careerSigns(roles, career);
            const fuel = rectOf({ ...props.fuel, width: FUEL.width, depth: FUEL.depth });
            for (const rect of blocked) {
                assert.ok(fuel.x1 <= rect.x0 + EPS || rect.x1 <= fuel.x0 + EPS || fuel.z1 <= rect.z0 + EPS || rect.z1 <= fuel.z0 + EPS, 'fuel station on a road or block');
            }
            const all = items(props);
            for (const p of all) {
                const park = layout.parks.find((k) => Math.abs(p.x - k.x) <= k.size / 2 && Math.abs(p.z - k.z) <= k.size / 2);
                const where = `tier ${layout.tier}, ${roles} roles: ${p.kind} at ${p.x.toFixed(2)},${p.z.toFixed(2)}`;
                if (park) {
                    assert.ok(p.kind === 'tree' || p.kind === 'bench', `${where} in a park`);
                } else {
                    for (const rect of blocked) assert.ok(distToRect(p.x, p.z, rect) >= p.r - EPS, `${where} on a road/block/plot`);
                    for (const lamp of lamps) assert.ok(Math.hypot(p.x - lamp.x, p.z - lamp.z) >= p.r + 0.3 - EPS, `${where} on a lamp`);
                    for (const sign of signs) assert.ok(Math.hypot(p.x - sign.x, p.z - sign.z) >= p.r + SIGN.width / 2 - EPS, `${where} on a sign`);
                    assert.ok(Math.hypot(p.x - house.x, p.z - house.z) >= p.r + ABOUT_HOUSE.radius - EPS, `${where} on the About house`);
                    assert.ok(distToRect(p.x, p.z, fuel) >= p.r - EPS, `${where} in the fuel station`);
                }
                const b = layout.bounds;
                assert.ok(p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ, `${where} out of the city`);
            }
            for (let i = 0; i < all.length; i++) {
                for (let j = i + 1; j < all.length; j++) {
                    const [a, c] = [all[i], all[j]];
                    if (Math.hypot(a.x - c.x, a.z - c.z) < a.r + c.r - EPS) assert.fail(`${a.kind} and ${c.kind} overlap at ${a.x.toFixed(2)},${a.z.toFixed(2)}`);
                }
            }
        }
    }
});

test('billboards face the start view; the fuel station faces the main road', () => {
    for (const layout of layouts) {
        const props = streetProps(layout, { roles: 3 });
        const main = layout.roads.find((r) => r.kind === 'main');
        // Front (+z rotated) points south, at most ~20° off.
        for (const board of props.billboards) assert.ok(Math.cos(board.rotationY) > 0.9, board.id);
        assert.ok(props.fuel.z > main.z && Math.cos(props.fuel.rotationY) < -0.99);
    }
});

test('deterministic', () => {
    const layout = layouts.at(-1);
    assert.deepEqual(streetProps(layout, { roles: 3 }), streetProps(layout, { roles: 3 }));
});
