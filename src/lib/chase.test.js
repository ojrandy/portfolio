import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toBuildings } from './buildings.js';
import { layoutCity, TIERS, BLOCK_LOTS, FEATURED_LOTS } from './layout.js';
import { buildRoadGraph } from './roadGraph.js';
import { carFootprint, collision, createCar, driveWorld, HANDLING } from './drive.js';
import { CHASE_RULES, createChase, findPath, navGrid, stepChase } from './chase.js';
import { footprintsOverlap } from './traffic.js';
import { buildCity, loadProjects } from '../../server/lib/city.js';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const DT = 1 / 30;

const many = (n) => Array.from({ length: n }, (_, i) => ({ slug: `p-${String(i).padStart(3, '0')}`, flag: false }));
const tierLayouts = TIERS.map((tier, i) => layoutCity(many(i === 0 ? 10 : (TIERS[i - 1] * BLOCK_LOTS) ** 2 - FEATURED_LOTS + 1)));
const realLayout = () => {
    const stats = JSON.parse(readFileSync(new URL('./fixtures/github-stats.json', import.meta.url), 'utf8'));
    return layoutCity(toBuildings(buildCity(loadProjects(), { stats }), { now: NOW }));
};
const worlds = [...tierLayouts, realLayout()].map((layout) => driveWorld(layout, { roles: 3, graph: buildRoadGraph(layout) }));
const real = worlds.at(-1);

const you = (car) => ({ x: car.x, z: car.z, rotationY: car.rotationY, v: car.v, foot: carFootprint(car) });

// Places to be caught at: the start on Career Road, downtown's middle street, and out on the Limbe–Douala road.
const spots = (world) => {
    const { layout } = world;
    const out = layout.roads.filter((r) => r.kind === 'out').sort((a, b) => b.z - a.z)[0];
    return [
        world.start,
        { x: layout.downtown.x + 0.5, z: layout.downtown.z, rotationY: 0 },
        { x: out.x, z: out.z + 0.5, rotationY: Math.PI / 2 },
    ];
};

test('chase: a police car appears on a road behind you, finds you and stops behind you when you wait, on every tier', () => {
    for (const world of worlds) {
        for (const spot of spots(world)) {
            const car = { ...createCar(world, 'taxi'), ...spot, v: 0 };
            if (collision(world, car, car)) continue; // downtown's middle may be a pavement on the smallest tier
            const me = you(car);
            const chase = createChase(world, me);
            const at = `tier ${world.layout.tier} at ${spot.x.toFixed(1)}, ${spot.z.toFixed(1)}`;
            assert.ok(chase, at);
            const d0 = Math.hypot(chase.car.x - me.x, chase.car.z - me.z);
            assert.ok(d0 >= CHASE_RULES.spawn.min - 1e-9 && d0 <= CHASE_RULES.spawn.max + 1e-9, `${at}: ${d0}`);
            assert.equal(collision(world, chase.car, chase.car), null, at);
            let caught = null;
            for (let i = 0; i < 45 / DT && !caught; i++) {
                if (stepChase(world, chase, me, DT) === 'caught') caught = chase.t;
                assert.equal(collision(world, chase.car, chase.car), null, `${at}: inside something at t=${chase.t.toFixed(2)}`);
                assert.ok(!footprintsOverlap(carFootprint(chase.car), me.foot), `${at}: drove into you`);
                assert.ok(chase.car.v <= HANDLING.police.max + 1e-9);
            }
            assert.ok(caught, `${at}: never got to you (ended ${Math.hypot(chase.car.x - me.x, chase.car.z - me.z).toFixed(1)} away)`);
            assert.ok(caught >= CHASE_RULES.pullOver.seconds);
        }
    }
});

test('chase: pulled over, it waits, then drives off and is gone; still moving close by is not pulling over', () => {
    const car = { ...createCar(real, 'taxi'), v: 0 };
    const me = you(car);
    const chase = createChase(real, me, { police: { x: me.x, z: me.z + 6, rotationY: Math.PI, v: 0 } });
    // Rolling at 0.5: it follows, but no pull-over.
    for (let i = 0; i < 10 / DT; i++) assert.notEqual(stepChase(real, chase, { ...me, v: 0.5 }, DT), 'caught');
    assert.equal(chase.phase, 'chasing');
    const events = [];
    for (let i = 0; i < 20 / DT; i++) {
        const e = stepChase(real, chase, me, DT);
        if (e) events.push([e, chase.t]);
    }
    assert.deepEqual(events.map(([e]) => e), ['caught', 'gone']);
    const [[, caughtAt], [, goneAt]] = events;
    assert.ok(goneAt - caughtAt >= CHASE_RULES.stopped + CHASE_RULES.leave - 0.1);
    assert.equal(chase.car.scale, 0);
});

test('chase: get far enough away for long enough and you lose it', () => {
    const car = { ...createCar(real, 'moto'), v: 0 };
    const chase = createChase(real, you(car), { police: { x: car.x, z: car.z + 10, rotationY: Math.PI, v: 0 } });
    // You race up Career Road (faster than it can go) and keep going.
    let lost = null;
    const me = you(car);
    for (let i = 0; i < 12 / DT && !lost; i++) {
        me.z -= 6 * DT;
        me.foot = { ...me.foot, z: me.z };
        if (stepChase(real, chase, me, DT) === 'lost') lost = chase.t;
    }
    assert.ok(lost, 'never lost it');
    assert.equal(chase.phase, 'leaving');
    // Lost = more than lose.distance for lose.seconds: never sooner than that.
    assert.ok(lost >= CHASE_RULES.lose.seconds);
    // Stopping driving ends a chase too.
    const other = createChase(real, you(car));
    stepChase(real, other, null, DT);
    assert.equal(other.phase, 'leaving');
});

test('chase: paths keep to open cells and go round the town; the same chase twice is the same', () => {
    const nav = navGrid(real);
    // The grid is built shape by shape; it must say exactly what drive.js collision says, cell by cell.
    for (let k = 0; k < nav.cost.length; k++) {
        const p = { x: nav.minX + (k % nav.cols) + 0.5, z: nav.minZ + Math.floor(k / nav.cols) + 0.5, rotationY: 0 };
        assert.equal(nav.cost[k] === 0, Boolean(collision(real, { width: 0.8, length: 0.8 }, p)), `cell ${p.x}, ${p.z}`);
    }
    const { layout } = real;
    const from = real.start;
    const to = { x: layout.downtown.x, z: layout.downtown.z - layout.downtown.size / 2 - 1 }; // the main road north of downtown
    const path = findPath(nav, from, to);
    assert.ok(path && path.length > 10);
    for (const p of path) assert.equal(collision(real, { width: 0.8, length: 0.8 }, { ...p, rotationY: 0 }), null);

    const run = () => {
        const car = { ...createCar(real, 'taxi'), v: 0 };
        const chase = createChase(real, you(car));
        for (let i = 0; i < 10 / DT; i++) stepChase(real, chase, you(car), DT);
        return [chase.car.x, chase.car.z, chase.car.rotationY];
    };
    assert.deepEqual(run(), run());
});
