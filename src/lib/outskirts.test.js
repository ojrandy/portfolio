import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toBuildings } from './buildings.js';
import { layoutCity, TIERS, BLOCK_LOTS, FEATURED_LOTS } from './layout.js';
import { outskirts, HOUSE, SIGN_POST } from './outskirts.js';
import { shopfronts, shopFaces } from './shopfronts.js';
import { buildCity, loadProjects } from '../../server/lib/city.js';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const SIZES = [1.6, 2.2, 3.0];
const many = (n) => Array.from({ length: n }, (_, i) => {
    const size = SIZES[i % 3];
    return { slug: `p-${String(i).padStart(3, '0')}`, flag: false, width: size, depth: size };
});
const tierLayouts = TIERS.map((tier, i) => layoutCity(many(i === 0 ? 10 : (TIERS[i - 1] * BLOCK_LOTS) ** 2 - FEATURED_LOTS + 1)));
const realLayout = () => {
    const stats = JSON.parse(readFileSync(new URL('./fixtures/github-stats.json', import.meta.url), 'utf8'));
    return layoutCity(toBuildings(buildCity(loadProjects(), { stats }), { now: NOW }));
};
const layouts = [...tierLayouts, realLayout()];

const distToRect = (x, z, r) => Math.hypot(Math.max(r.x - r.width / 2 - x, 0, x - r.x - r.width / 2), Math.max(r.z - r.depth / 2 - z, 0, z - r.z - r.depth / 2));
const inside = (p, r) => Math.abs(p.x - r.x) <= r.width / 2 && Math.abs(p.z - r.z) <= r.depth / 2;

test('outskirts: houses stay outside the town, off the roads, apart, and clear of the sign and the start view', () => {
    for (const layout of layouts) {
        const { houses, sign } = outskirts(layout);
        const { bounds, outskirts: area, entrance } = layout;
        const town = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2, width: bounds.maxX - bounds.minX, depth: bounds.maxZ - bounds.minZ };
        assert.ok(houses.length > 100 && houses.length < 400, `tier ${layout.tier}: ${houses.length} houses`);
        for (const h of houses) {
            const at = `tier ${layout.tier}: house at ${h.x.toFixed(1)}, ${h.z.toFixed(1)}`;
            assert.ok(h.x - h.radius >= area.minX && h.x + h.radius <= area.maxX && h.z - h.radius >= area.minZ && h.z + h.radius <= area.maxZ, `${at} outside the area`);
            assert.ok(distToRect(h.x, h.z, town) >= h.radius + HOUSE.townClear - 1e-9, `${at} in the town`);
            for (const road of layout.roads) assert.ok(distToRect(h.x, h.z, road) >= h.radius, `${at} on a road`);
            assert.ok(Math.hypot(h.x - sign.x, h.z - sign.z) >= h.radius + SIGN_POST.width / 2, `${at} on the sign`);
            assert.ok(Math.hypot(h.x - entrance.x, h.z - entrance.z - 4) >= HOUSE.entranceClear, `${at} in front of the start view`);
        }
        for (let a = 0; a < houses.length; a++) {
            for (let b = a + 1; b < houses.length; b++) {
                const [p, q] = [houses[a], houses[b]];
                assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= p.radius + q.radius, `tier ${layout.tier}: houses ${a} and ${b} overlap`);
            }
        }
        // Both sides of the road out are lived on, and some houses stand between the town and Fako.
        assert.ok(houses.some((h) => h.z > entrance.z && h.x < 0) && houses.some((h) => h.z > entrance.z && h.x > 0));
        assert.ok(houses.some((h) => h.z < bounds.minZ));
    }
});

test('outskirts: the sign stands across the T from the road out, facing it; the same city gives the same houses', () => {
    for (const layout of layouts) {
        const { sign } = outskirts(layout);
        const { roadOut } = layout;
        assert.equal(sign.x, roadOut.x);
        assert.ok(sign.z > roadOut.z + roadOut.width / 2, 'south of the Limbe–Douala road');
        assert.ok(!layout.roads.some((r) => inside(sign, r)), 'not on a road');
        assert.equal(sign.rotationY, Math.PI); // front (+z) turned to face north, up the road out
    }
    assert.deepEqual(outskirts(layouts[0]), outskirts(layoutCity(many(10))));
});

test('shopfronts: two per building, each on a face that looks onto a road, the ground-floor windows left to it', () => {
    for (const layout of layouts) {
        const shops = shopfronts(layout);
        assert.equal(shops.length, layout.lots.length * 2);
        for (const shop of shops) {
            const lot = layout.lots.find((l) => l.slug === shop.slug);
            const n = { x: Math.sin(shop.rotationY), z: Math.cos(shop.rotationY) };
            const { width: w, depth: d } = lot.building;
            // On the building's face, as wide as it.
            assert.ok(Math.abs((shop.x - lot.x) * n.x + (shop.z - lot.z) * n.z - (shop.face % 2 ? w : d) / 2) < 1e-9);
            assert.equal(shop.width, shop.face % 2 ? d : w);
            // Out across the pavement (at most 1.4 from the narrowest building) is a road, not another lot.
            const out = { x: shop.x + n.x * 1.6, z: shop.z + n.z * 1.6 };
            assert.ok(layout.roads.some((r) => inside(out, r)), `tier ${layout.tier}: ${shop.slug} face ${shop.face} faces no road`);
        }
        const faces = shopFaces(shops);
        assert.equal(faces.size, layout.lots.length);
        for (const set of faces.values()) assert.equal(set.size, 2);
    }
});
