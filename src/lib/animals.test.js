import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toBuildings } from './buildings.js';
import { layoutCity, TIERS, BLOCK_LOTS, FEATURED_LOTS } from './layout.js';
import { animalObstacles, animalPens, animalPose, createAnimals, HERDS, pokeAnimal, POKE, stepAnimals } from './animals.js';
import { coat, FIGURES, outfit, LOWERS, TOPS, UMBRELLAS } from './figures.js';
import { buildCity, loadProjects } from '../../server/lib/city.js';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const DT = 1 / 30;

const many = (n) => Array.from({ length: n }, (_, i) => ({ slug: `p-${String(i).padStart(3, '0')}`, flag: false }));
const tierLayouts = TIERS.map((tier, i) => layoutCity(many(i === 0 ? 10 : (TIERS[i - 1] * BLOCK_LOTS) ** 2 - FEATURED_LOTS + 1)));
const realLayout = () => {
    const stats = JSON.parse(readFileSync(new URL('./fixtures/github-stats.json', import.meta.url), 'utf8'));
    return layoutCity(toBuildings(buildCity(loadProjects(), { stats }), { now: NOW }));
};
const layouts = [...tierLayouts, realLayout()];
const distToRect = (x, z, r) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));

test('pens: every herd placed on free grass near the entrance, clear of everything', () => {
    for (const layout of layouts) {
        for (const roles of [0, 3, 5]) {
            const pens = animalPens(layout, { roles });
            assert.equal(pens.length, HERDS.length, `tier ${layout.tier}, ${roles} roles`);
            const { rects, circles } = animalObstacles(layout, { roles });
            const { bounds, entrance } = layout;
            pens.forEach((pen, i) => {
                assert.ok(pen.x - pen.radius >= bounds.minX && pen.x + pen.radius <= bounds.maxX && pen.z + pen.radius <= bounds.maxZ);
                for (const r of rects) assert.ok(distToRect(pen.x, pen.z, r) >= pen.radius, `${pen.id} on a road, block or plot`);
                for (const c of circles) assert.ok(Math.hypot(pen.x - c.x, pen.z - c.z) >= pen.radius + c.r, `${pen.id} on a prop`);
                for (const other of pens.slice(0, i)) assert.ok(Math.hypot(pen.x - other.x, pen.z - other.z) >= pen.radius + other.radius);
                assert.ok(Math.hypot(pen.x - entrance.x, pen.z - entrance.z) < 30, `${pen.id} far from the edge of town`);
            });
        }
    }
});

test('animals wander inside their pens by day; chickens roost and goats rest at night', () => {
    const layout = layouts.at(-1);
    const state = createAnimals(animalPens(layout, { roles: 3 }), { seed: 'test' });
    assert.equal(state.animals.length, HERDS.reduce((n, h) => n + h.count, 0));
    const start = state.animals.map((a) => ({ x: a.x, z: a.z }));
    for (let i = 0; i < 300 / DT; i++) {
        stepAnimals(state, DT);
        for (const a of state.animals) {
            assert.ok(Math.hypot(a.x - a.pen.x, a.z - a.pen.z) <= a.pen.radius + 1e-6, `${a.id} left its pen`);
            assert.ok(!layout.roads.some((r) => Math.abs(a.x - r.x) < r.width / 2 && Math.abs(a.z - r.z) < r.depth / 2), `${a.id} on a road`);
        }
    }
    assert.ok(state.animals.every((a, i) => Math.hypot(a.x - start[i].x, a.z - start[i].z) > 0.01), 'everyone moved');

    const before = state.animals.map((a) => ({ x: a.x, z: a.z }));
    for (let i = 0; i < 10 / DT; i++) stepAnimals(state, DT, { night: true });
    state.animals.forEach((a, i) => {
        assert.equal(a.x, before[i].x);
        const pose = animalPose(a);
        assert.equal(pose.stride, 0);
        assert.equal(pose.scale, a.kind === 'chicken' ? 0 : 1);
    });
    for (let i = 0; i < 10 / DT; i++) stepAnimals(state, DT);
    assert.ok(state.animals.every((a) => a.scale === 1), 'chickens back out by day');
});

test('figures: on the ground, people about 0.47 tall; outfits and coats are deterministic', () => {
    const top = (parts) => Math.max(...parts.map((p) => p.at[1] + (p.size ? p.size[1] : p.height) / 2));
    const bottom = (parts) => Math.min(...parts.map((p) => p.at[1] - (p.size ? p.size[1] : p.height) / 2));
    for (const [id, parts] of Object.entries(FIGURES)) {
        if (id !== 'umbrella') assert.ok(Math.abs(bottom(parts)) < 0.01, `${id} floats or sinks`);
    }
    assert.ok(top(FIGURES.person) > 0.44 && top(FIGURES.person) < 0.52);
    assert.ok(top(FIGURES.umbrella) > top(FIGURES.person));
    assert.ok(top(FIGURES.chicken) < top(FIGURES.goat) && top(FIGURES.goat) < top(FIGURES.person));
    for (let i = 0; i < 50; i++) {
        const o = outfit(`p-${i}`);
        assert.deepEqual(o, outfit(`p-${i}`));
        assert.ok(TOPS.includes(o.top) && LOWERS.includes(o.lower) && UMBRELLAS.includes(o.umbrella));
        assert.equal(coat('goat', i), coat('goat', i));
    }
});

test('poked: a goat turns to look at the camera for a while, a chicken scurries off but stays in its pen', () => {
    const state = createAnimals(animalPens(layouts.at(-1), { roles: 3 }), { seed: 'poke' });
    const goat = state.animals.find((a) => a.kind === 'goat');
    const hens = state.animals.filter((a) => a.kind === 'chicken');
    const camera = { x: goat.x + 10, z: goat.z };
    assert.equal(pokeAnimal(goat, camera), 'goat');
    const at = { x: goat.x, z: goat.z };
    for (let i = 0; i < 1.5 / DT; i++) stepAnimals(state, DT);
    assert.deepEqual({ x: goat.x, z: goat.z }, at, 'the goat stands still');
    assert.ok(Math.abs(Math.sin(goat.heading) - 1) < 0.01, 'and faces the camera (+x)');
    for (let i = 0; i < POKE.lookTime / DT; i++) stepAnimals(state, DT);
    assert.equal(goat.look, null);

    for (const hen of hens) {
        assert.equal(pokeAnimal(hen, { x: hen.x - 1, z: hen.z }), 'chicken');
        for (let i = 0; i < 1 / DT; i++) stepAnimals(state, DT);
        assert.ok(Math.hypot(hen.x - hen.pen.x, hen.z - hen.pen.z) <= hen.pen.radius, 'in its pen');
    }
    const hen = hens[0];
    const start = { x: hen.x, z: hen.z };
    pokeAnimal(hen, { x: hen.pen.x, z: hen.pen.z + 50 });
    stepAnimals(state, 0.3);
    assert.ok(hen.z < start.z, 'runs away from the click');
});
