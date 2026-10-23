import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toBuildings } from './buildings.js';
import { layoutCity, TIERS, BLOCK_LOTS, FEATURED_LOTS } from './layout.js';
import { buildRoadGraph, signalState, SIGNAL_CYCLE } from './roadGraph.js';
import { createTraffic, stepTraffic, crosswalkClear, footprint, footprintsOverlap, MAX_VEHICLES } from './traffic.js';
import {
    buildWalkGraph, createPedestrians, stepPedestrians, peopleDensity, peopleTarget, redLeft, personOnLine, personPose, stopWaiters,
    MAX_PEOPLE, WALK_INSET,
} from './pedestrians.js';
import { streetProps } from './streetProps.js';
import { buildCity, loadProjects } from '../../server/lib/city.js';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const DT = 1 / 30;
const EPS = 1e-6;

const many = (n) => Array.from({ length: n }, (_, i) => ({ slug: `p-${String(i).padStart(3, '0')}`, flag: false }));
const tierLayouts = TIERS.map((tier, i) => layoutCity(many(i === 0 ? 10 : (TIERS[i - 1] * BLOCK_LOTS) ** 2 - FEATURED_LOTS + 1)));
const realLayout = () => {
    const stats = JSON.parse(readFileSync(new URL('./fixtures/github-stats.json', import.meta.url), 'utf8'));
    return layoutCity(toBuildings(buildCity(loadProjects(), { stats }), { now: NOW }));
};
const cities = [...tierLayouts, realLayout()].map((layout) => {
    const roads = buildRoadGraph(layout);
    return { layout, roads, walk: buildWalkGraph(layout, roads) };
});

const inside = (p, r, pad = 0) => Math.abs(p.x - r.x) <= r.width / 2 + pad + EPS && Math.abs(p.z - r.z) <= r.depth / 2 + pad + EPS;
const onPavement = (layout, p) => layout.pavements.some((r) => inside(p, r));
const onCrosswalk = (roads, p) => roads.crosswalks.some((r) => inside(p, r));

/** People (and the live traffic unless `traffic` is false) for `seconds`, calling `check` every step. */
const run = ({ roads, walk }, { seconds, people = MAX_PEOPLE, vehicles = MAX_VEHICLES, traffic = true, dt = DT, seed = 'test', check }) => {
    const cars = traffic ? createTraffic(roads, { seed, count: vehicles }) : null;
    const state = createPedestrians(walk, { seed, count: people });
    for (let i = 0; i < seconds / dt; i++) {
        const before = new Map(state.people.map((p) => [p, p.edge]));
        const clock = cars ? cars.t : state.t;
        stepPedestrians(state, dt, { target: people, clock, clear: cars && ((id, look) => crosswalkClear(cars, id, { look })) });
        if (cars) stepTraffic(cars, dt, { target: vehicles, crossing: state.crossing });
        check?.(state, cars, before, clock);
    }
    return { state, cars };
};

test('density: busy by day, a few people late at night; rain keeps some indoors', () => {
    const at = (h) => peopleDensity(h * 60);
    for (const h of [8, 10, 12, 15, 17]) assert.ok(at(h) >= 0.85, `${h}h`);
    for (const h of [1, 2, 3, 4]) assert.ok(at(h) <= 0.1, `${h}h`);
    for (let m = 0; m < 1440; m += 7) assert.ok(at(m / 60) >= 0 && at(m / 60) <= 1);
    assert.equal(peopleDensity(0), peopleDensity(1440));
    assert.equal(peopleTarget(8 * 60), MAX_PEOPLE);
    assert.ok(peopleTarget(3 * 60) <= 3);
    assert.equal(peopleTarget(8 * 60, MAX_PEOPLE, 1), MAX_PEOPLE / 2);
    assert.equal(peopleTarget(8 * 60, MAX_PEOPLE / 2), MAX_PEOPLE / 2);
});

test('redLeft agrees with the traffic lights', () => {
    const node = cities.at(-1).roads.nodes.find((n) => n.control === 'signal');
    for (let t = 0; t < SIGNAL_CYCLE * 2; t += 0.05) {
        const lights = signalState(node, t);
        for (const phase of ['ns', 'ew']) assert.equal(redLeft(node, phase, t) > 0, lights[phase] === 'red', `${phase} at ${t}`);
    }
});

test('walk network: pavement loops joined by crosswalks, all on pavement or crosswalk, all connected', () => {
    for (const { layout, roads, walk } of cities) {
        assert.equal(walk.edges.filter((e) => !e.crosswalk).length, layout.pavements.length * 4);
        assert.ok(walk.edges.some((e) => e.crosswalk?.node), 'some crosswalks have lights');
        for (const e of walk.edges) {
            for (let k = 0; k <= 20; k++) {
                const p = { x: e.a.x + ((e.b.x - e.a.x) * k) / 20, z: e.a.z + ((e.b.z - e.a.z) * k) / 20 };
                assert.ok(onPavement(layout, p) || (e.crosswalk && onCrosswalk(roads, p)), `edge ${e.id} leaves the pavement`);
            }
        }
        for (const p of walk.points) {
            for (const r of layout.pavements) {
                if (inside(p, r)) assert.ok(Math.abs(Math.abs(p.x - r.x) - (r.width / 2 - WALK_INSET)) < EPS);
            }
        }
        const seen = new Set([walk.points[0]]);
        for (const queue = [walk.points[0]]; queue.length;) {
            for (const e of queue.pop().edges) for (const q of [e.a, e.b]) if (!seen.has(q)) { seen.add(q); queue.push(q); }
        }
        assert.equal(seen.size, walk.points.length, 'every block reachable on foot');
    }
});

test('people stay on pavements and crosswalks, and only start crossing at lights on red', () => {
    for (const city of cities.slice(0, 2).concat(cities.at(-1))) {
        let crossed = 0;
        run(city, {
            seconds: 120,
            check: (state, cars, before, clock) => {
                for (const p of state.people) {
                    const line = personOnLine(p);
                    assert.ok(onPavement(city.layout, line) || (p.edge.crosswalk && onCrosswalk(city.roads, line)), 'off the walk network');
                    const pose = personPose(p);
                    const onRoad = city.layout.roads.some((r) => inside(pose, r, -0.05));
                    assert.ok(!onRoad || onCrosswalk(city.roads, pose), 'walking on the road');
                    const cw = p.edge.crosswalk;
                    if (cw && before.get(p) !== p.edge) {
                        crossed++;
                        if (cw.node) assert.equal(signalState(cw.node, clock)[cw.phase], 'red', 'crossed against the lights');
                    }
                }
            },
        });
        assert.ok(crossed > 10, `only ${crossed} crossings`);
    }
});

test('with traffic: no vehicle touches anyone on a crosswalk, and everyone keeps moving', () => {
    for (const [i, city] of cities.entries()) {
        const longest = { people: 0, vehicles: 0 };
        const { cars, state } = run(city, {
            seconds: i === cities.length - 1 ? 300 : 150,
            dt: i % 2 ? 1 / 10 : DT,
            seed: `joint-${i}`,
            check: (people, traffic) => {
                for (const p of people.people) {
                    longest.people = Math.max(longest.people, p.waited);
                    if (!p.edge.crosswalk) continue;
                    const pose = personPose(p);
                    const body = { x: pose.x, z: pose.z, ax: { x: 0, z: 1 }, hl: 0.08, hw: 0.08 };
                    for (const v of traffic.vehicles) assert.ok(!footprintsOverlap(footprint(v), body), `vehicle ${v.id} hit someone`);
                }
                for (const v of traffic.vehicles) longest.vehicles = Math.max(longest.vehicles, v.waited);
            },
        });
        assert.ok(longest.people < 30, `tier ${city.layout.tier}: someone waited ${longest.people.toFixed(1)} s to cross`);
        assert.ok(longest.vehicles < 50, `tier ${city.layout.tier}: a driver waited ${longest.vehicles.toFixed(1)} s`);
        assert.ok(cars.exited > 0, `tier ${city.layout.tier}: ${cars.exited} vehicles left`);
        assert.ok(state.people.length > MAX_PEOPLE * 0.8, `tier ${city.layout.tier}: ${state.people.length} people`);
    }
});

test('head count eases to the target; people fade in and out', () => {
    const city = cities.at(-1);
    const state = createPedestrians(city.walk, { seed: 'count', count: 30 });
    for (let i = 0; i < 60 / DT; i++) stepPedestrians(state, DT, { target: 5 });
    assert.equal(state.people.length, 5);
    for (let i = 0; i < 60 / DT; i++) stepPedestrians(state, DT, { target: 20 });
    assert.equal(state.people.length, 20);
    assert.ok(state.people.every((p) => p.scale === 1));
});

test('stop waiters stand in front of each shelter, off the road', () => {
    for (const { layout } of cities) {
        const { stops } = streetProps(layout, { roles: 3 });
        const waiters = stopWaiters(stops);
        assert.equal(waiters.length, stops.length * 2);
        for (const w of waiters) {
            assert.ok(!layout.roads.some((r) => inside(w, r)), 'waiting on the road');
            assert.ok(stops.some((s) => Math.hypot(s.x - w.x, s.z - w.z) < 1.1));
        }
    }
});

test('deterministic: the same seed gives the same people', () => {
    const positions = () => {
        const { state } = run(cities.at(-1), { seconds: 20, seed: 'same' });
        return state.people.map((p) => personPose(p));
    };
    assert.deepEqual(positions(), positions());
});
