import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toBuildings, SWITCH_LAST } from './buildings.js';
import { layoutCity } from './layout.js';
import { lampSpots, CAREER_SPACING } from './lamps.js';
import { buildCity, loadProjects } from '../../server/lib/city.js';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const EPS = 1e-6;

const realLayout = () => {
    const stats = JSON.parse(readFileSync(new URL('./fixtures/github-stats.json', import.meta.url), 'utf8'));
    return layoutCity(toBuildings(buildCity(loadProjects(), { stats }), { now: NOW }));
};
const fakeLayout = (n) => layoutCity(Array.from({ length: n }, (_, i) => ({ slug: `p-${i}`, flag: false })));
const inside = (p, r, margin = 0) => Math.abs(p.x - r.x) < r.width / 2 + margin - EPS && Math.abs(p.z - r.z) < r.depth / 2 + margin - EPS;

for (const [name, make] of [['real city', realLayout], ['tier 5', () => fakeLayout(90)]]) {
    test(`lamps (${name}): 8 per block, both sides of Career Road, never on a road, lot or plot`, () => {
        const layout = make();
        const lamps = lampSpots(layout);
        const blockLamps = lamps.filter((l) => layout.pavements.some((p) => inside(l, p)));
        assert.equal(blockLamps.length, layout.pavements.length * 8);

        const career = layout.roads.find((r) => r.kind === 'career');
        const careerSide = lamps.filter((l) => l.z > career.z - career.depth / 2 && Math.abs(Math.abs(l.x) - (career.width / 2 + 0.3)) < EPS);
        assert.equal(careerSide.length, 2 * Math.round(career.depth / CAREER_SPACING));

        for (const l of lamps) {
            for (const r of layout.roads) assert.ok(!inside(l, r), `lamp ${l.x},${l.z} on a ${r.kind} road`);
            // Largest footprint is 3.0, so a lamp must be at least 1.5 from any lot centre on both axes.
            for (const lot of layout.lots) assert.ok(!inside(l, { x: lot.x, z: lot.z, width: 3, depth: 3 }), `lamp in ${lot.slug}`);
            for (const d of layout.districts) assert.ok(!inside(l, d), `lamp in the ${d.id} plot`);
        }
    });
}

test('lamps: no two in the same spot, seeded switch-on points in [0, SWITCH_LAST], stable', () => {
    const layout = realLayout();
    const lamps = lampSpots(layout);
    const keys = new Set(lamps.map((l) => `${l.x.toFixed(2)},${l.z.toFixed(2)}`));
    assert.equal(keys.size, lamps.length);
    for (const l of lamps) assert.ok(l.switchAt >= 0 && l.switchAt <= SWITCH_LAST);
    assert.deepEqual(lampSpots(layout), lamps);
    // Not all at once: the switch-on points are spread out.
    const early = lamps.filter((l) => l.switchAt < SWITCH_LAST / 2).length;
    assert.ok(early > lamps.length * 0.3 && early < lamps.length * 0.7);
});
