import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toBuildings } from './buildings.js';
import { layoutCity, TIERS, BLOCK_LOTS, FEATURED_LOTS } from './layout.js';
import { buildRoadGraph, signalState } from './roadGraph.js';
import {
    CHASE, GRASS, HANDLING, chaseView, collision, createCar, createTrip, districtAt, driveDistricts, driveWorld, nearBuilding,
    onRoad, stepCar, trackTrip,
} from './drive.js';
import { createRandom } from './random.js';
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
const worlds = layouts.map((layout) => driveWorld(layout, { roles: 3, graph: buildRoadGraph(layout) }));
const real = worlds.at(-1);

/** Random driving: each input held for 0.3–2 s. */
const wander = (seed) => {
    const random = createRandom(seed);
    let input = null;
    let left = 0;
    return () => {
        if (left <= 0) {
            input = { throttle: random() < 0.75 ? 1 : random() < 0.5 ? -1 : 0, steer: Math.round(random() * 2 - 1), brake: random() < 0.05 };
            left = 0.3 + random() * 1.7;
        }
        left -= DT;
        return input;
    };
};

test('drive: starts on Career Road by the entrance, facing downtown, on every tier', () => {
    for (const world of worlds) {
        for (const type of ['taxi', 'moto']) {
            const car = createCar(world, type);
            assert.ok(car, `${type} on tier ${world.layout.tier}`);
            assert.ok(onRoad(world, car));
            assert.equal(collision(world, car, car), null);
            assert.ok(car.z < world.layout.entrance.z && car.x > 0, 'right-hand lane, northbound');
        }
    }
});

test('drive: random driving never leaves the bounds or ends up inside anything, on every tier', () => {
    for (const world of worlds) {
        for (const type of ['taxi', 'moto']) {
            const car = createCar(world, type);
            const next = wander(`${type}-${world.layout.tier}`);
            let moved = 0;
            for (let i = 0; i < 90 / DT; i++) {
                const before = { x: car.x, z: car.z };
                stepCar(world, car, next(), DT);
                moved += Math.hypot(car.x - before.x, car.z - before.z);
                assert.equal(collision(world, car, car), null, `${type} tier ${world.layout.tier} step ${i} at ${car.x.toFixed(2)}, ${car.z.toFixed(2)}`);
                assert.ok(Math.abs(car.v) <= HANDLING[type].max + 1e-9);
            }
            assert.ok(moved > 20, `${type} tier ${world.layout.tier} got about (${moved.toFixed(1)})`);
        }
    }
});

test('drive: stops at a wall, slides along it, slower on the grass, backs up', () => {
    const car = createCar(real, 'taxi');
    // Straight up Career Road: the front row's pavement across the main road stops it.
    let hit = null;
    for (let i = 0; i < 20 / DT; i++) hit = stepCar(real, car, { throttle: 1 }, DT) ?? hit;
    assert.equal(hit, 'solid');
    assert.equal(car.v, 0);
    const pavement = real.layout.pavements.find((p) => Math.abs(car.x - p.x) < p.width / 2);
    assert.ok(car.z - car.length / 2 >= pavement.z + pavement.depth / 2 - 1e-6, 'its front is short of the pavement');

    // A glancing approach keeps going along the wall.
    for (let i = 0; i < 0.5 / DT; i++) stepCar(real, car, { throttle: -1 }, DT);
    car.rotationY = Math.PI - 0.5;
    const x0 = car.x;
    for (let i = 0; i < 1 / DT; i++) stepCar(real, car, { throttle: 1 }, DT);
    assert.ok(car.x > x0 + 0.3, 'slid east along the pavement');

    // Reverse.
    const z0 = car.z;
    for (let i = 0; i < 2 / DT; i++) stepCar(real, car, { throttle: -1 }, DT);
    assert.ok(car.z > z0 + 0.5 && car.v < 0);

    // Grass: east of Career Road, south of the main road, clear of everything.
    const grass = { ...createCar(real, 'taxi') };
    const career = real.layout.roads.find((r) => r.kind === 'career');
    const spot = [...Array(40).keys()].map((k) => ({ x: career.x + career.width / 2 + 1 + (k % 8) * 0.8, z: career.z + Math.floor(k / 8) * 2 - 4, rotationY: Math.PI / 2 }))
        .find((p) => !onRoad(real, p) && !collision(real, grass, p) && !collision(real, grass, { ...p, x: p.x + 3 }));
    assert.ok(spot, 'a free patch of grass');
    Object.assign(grass, spot, { v: 0 });
    let top = 0;
    for (let i = 0; i < 1.5 / DT; i++) {
        stepCar(real, grass, { throttle: 1 }, DT);
        if (!onRoad(real, grass)) top = Math.max(top, grass.v);
    }
    assert.ok(top > 0.5 && top <= HANDLING.taxi.max * GRASS + 1e-9, `grass speed ${top}`);
});

test('drive: never drives into a vehicle or a person', () => {
    const car = createCar(real, 'taxi');
    const ahead = { id: 7, foot: { x: car.x, z: car.z - 4, ax: { x: 0, z: 1 }, hl: 0.52, hw: 0.26 } };
    let hit = null;
    for (let i = 0; i < 4 / DT; i++) hit = stepCar(real, car, { throttle: 1 }, DT, { vehicles: [ahead] }) ?? hit;
    assert.deepEqual(hit, { vehicle: 7 });
    assert.ok(car.z - car.length / 2 >= ahead.foot.z + ahead.foot.hl - 1e-6);

    const walker = createCar(real, 'moto');
    const person = { x: walker.x, z: walker.z - 3 };
    for (let i = 0; i < 4 / DT; i++) hit = stepCar(real, walker, { throttle: 1 }, DT, { people: [person] }) ?? hit;
    assert.equal(hit, 'person');
    assert.ok(walker.z - walker.length / 2 > person.z);
});

test('drive: red lights. Through on green counts, entering on red clears the count', () => {
    const node = real.signals[0];
    const through = (phaseColour) => {
        const trip = createTrip();
        const car = createCar(real, 'taxi');
        // Northbound on the right-hand lane, just south of the crossing.
        Object.assign(car, { x: node.x + node.halfX / 2, z: node.z + node.halfZ + 2, rotationY: Math.PI, v: 0 });
        let t = 0;
        while (signalState(node, t).ns !== phaseColour) t += 0.1;
        let ran = false;
        for (let i = 0; i < 300; i++) {
            stepCar(real, car, { throttle: 1 }, 0.01);
            ran = trackTrip(real, trip, car, t).ranRed || ran;
        }
        assert.ok(car.z < node.z - node.halfZ, 'drove through');
        return { trip, ran };
    };
    const green = through('green');
    assert.equal(green.ran, false);
    assert.ok(green.trip.passed.has(node.id));
    const red = through('red');
    assert.equal(red.ran, true);
    assert.equal(red.trip.passed.size, 0);
    assert.equal(red.trip.ranCount, 1);

    // Every crossing passed on green completes the egg.
    const trip = createTrip();
    trip.passed = new Set(real.signals.slice(1).map((n) => n.id));
    const car = { x: node.x, z: node.z + node.halfZ + 1, rotationY: Math.PI };
    let t = 0;
    while (signalState(node, t).ns !== 'green') t += 0.1;
    trackTrip(real, trip, { ...car, z: node.z }, t);
    assert.equal(trackTrip(real, trip, { ...car, z: node.z - node.halfZ - 1 }, t).lights, true);
});

test('drive: districts and the tour', () => {
    for (const layout of layouts) {
        for (const d of layout.districts) {
            assert.equal(districtAt(layout, { x: d.x + d.width / 2 + 1, z: d.z }), d.id);
        }
        assert.equal(districtAt(layout, { x: 0, z: 0 }), 'downtown');
        assert.equal(districtAt(layout, { x: 0, z: layout.roadOut.z }), null, 'the T is out of town');
    }
    const trip = createTrip();
    const pass = (p) => trackTrip(real, trip, { ...p, rotationY: 0 }, 0);
    for (const d of real.layout.districts) assert.equal(pass({ x: d.x, z: d.z + d.depth / 2 + 1 }).tour, false);
    assert.equal(pass({ x: 0, z: 0 }).tour, true);
    assert.deepEqual([...trip.visited].sort(), driveDistricts(real.layout).sort());
});

test('drive: the chase camera stays out of buildings; the building you stop by', () => {
    const { lots } = real.layout;
    for (const lot of lots) {
        // Parked on the street just south of the building, facing away from it: the camera comes in.
        const pose = { x: lot.x, z: lot.z + lot.building.depth / 2 + 1.2, rotationY: 0 };
        const { eye } = chaseView(pose, 0, lots);
        const inside = lots.some((l) => Math.abs(eye.x - l.x) < l.building.width / 2 && Math.abs(eye.z - l.z) < l.building.depth / 2 && eye.y < l.building.height);
        assert.equal(inside, false, lot.slug);
    }
    const open = chaseView({ x: 0, z: 40, rotationY: Math.PI }, Math.PI, lots);
    assert.ok(Math.abs(open.eye.z - (40 + CHASE.back)) < 1e-9, 'nothing behind: the full distance');

    const lot = lots[0];
    const car = { x: lot.x + 3, z: lot.z, v: 0 };
    assert.equal(nearBuilding(real, car), lots.reduce((a, b) => (Math.hypot(b.x - car.x, b.z - car.z) < Math.hypot(a.x - car.x, a.z - car.z) ? b : a)).slug);
    assert.equal(nearBuilding(real, { ...car, v: 2 }), null);
    assert.equal(nearBuilding(real, { x: 0, z: 40, v: 0 }), null);
});

test('drive: deterministic', () => {
    const drive = () => {
        const car = createCar(real, 'moto');
        const next = wander('same');
        for (let i = 0; i < 30 / DT; i++) stepCar(real, car, next(), DT);
        return [car.x, car.z, car.rotationY, car.v];
    };
    assert.deepEqual(drive(), drive());
});
