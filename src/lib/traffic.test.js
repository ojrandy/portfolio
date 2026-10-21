import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toBuildings } from './buildings.js';
import { layoutCity, TIERS, BLOCK_LOTS, FEATURED_LOTS } from './layout.js';
import { buildRoadGraph, signalState, SIGNAL } from './roadGraph.js';
import {
    createTraffic, stepTraffic, trafficDensity, targetCount, pickType, bueaMinutes, vehiclePose, MAX_VEHICLES,
} from './traffic.js';
import { VEHICLE_TYPES } from './vehicles.js';
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
const graphs = [...tierLayouts, realLayout()].map(buildRoadGraph);

// Oriented footprint of a vehicle (a little smaller than the body, so touching bumpers don't count).
const footprint = (v) => {
    const { x, z, rotationY } = vehiclePose(v);
    const kit = VEHICLE_TYPES[v.type];
    return { x, z, ax: { x: Math.sin(rotationY), z: Math.cos(rotationY) }, hl: kit.length * 0.45, hw: kit.width * 0.45 };
};
const overlap = (a, b) => {
    if (Math.hypot(a.x - b.x, a.z - b.z) > a.hl + b.hl + a.hw + b.hw) return false;
    const axes = [a.ax, { x: -a.ax.z, z: a.ax.x }, b.ax, { x: -b.ax.z, z: b.ax.x }];
    const radius = (f, n) => f.hl * Math.abs(f.ax.x * n.x + f.ax.z * n.z) + f.hw * Math.abs(-f.ax.z * n.x + f.ax.x * n.z);
    return axes.every((n) => Math.abs((a.x - b.x) * n.x + (a.z - b.z) * n.z) < radius(a, n) + radius(b, n));
};

/** Run the traffic for `seconds`, calling `check(state, before)` every step. */
const run = (graph, { seconds, target = MAX_VEHICLES, rain = 0, seed = 'test', check }) => {
    const state = createTraffic(graph, { seed, count: target, rain });
    for (let i = 0; i < seconds / DT; i++) {
        const before = new Map(state.vehicles.map((v) => [v, { seg: v.seg, s: v.s }]));
        stepTraffic(state, DT, { target, rain });
        check?.(state, before);
    }
    return state;
};

test('density: busiest in the rush hours, lightest late at night', () => {
    const at = (h) => trafficDensity(h * 60);
    for (const h of [7.5, 8, 8.5, 16.5, 17.5, 18.5]) assert.ok(at(h) >= 0.9, `${h}h`);
    for (const h of [1, 2, 3, 4, 5]) assert.ok(at(h) <= 0.15, `${h}h`);
    assert.ok(at(12) > at(3) && at(12) < at(8));
    for (let m = 0; m < 1440; m += 7) assert.ok(at(m / 60) >= 0 && at(m / 60) <= 1);
    assert.equal(trafficDensity(0), trafficDensity(1440));
    assert.equal(targetCount(8 * 60), MAX_VEHICLES);
    assert.ok(targetCount(3 * 60) <= 5 && targetCount(12 * 60) >= 10 && targetCount(12 * 60) <= 15);
    // 07:30 WAT is 06:30 UTC.
    assert.equal(bueaMinutes(Date.parse('2026-10-15T06:30:00Z')), 450);
});

test('mix: taxis and motos most common, rain halves the motos', () => {
    const count = (rain) => {
        const random = createRandom('mix');
        const out = {};
        for (let i = 0; i < 20000; i++) { const t = pickType(random, rain); out[t] = (out[t] ?? 0) + 1; }
        return out;
    };
    const dry = count(0);
    const wet = count(1);
    assert.ok(dry.taxi > dry.sedan && dry.moto > dry.sedan && dry.sedan > dry.bus);
    assert.ok(dry.ambulance > 0 && dry.police > 0);
    const share = (c) => c.moto / Object.values(c).reduce((a, b) => a + b, 0);
    assert.ok(share(wet) < share(dry) * 0.6);
    for (const t of Object.keys(dry)) assert.ok(VEHICLE_TYPES[t], t);
});

test('no two vehicles ever overlap, on every tier and the real city', () => {
    for (const graph of graphs) {
        run(graph, {
            seconds: 90,
            check: (state) => {
                const feet = state.vehicles.map(footprint);
                for (let i = 0; i < feet.length; i++) {
                    for (let j = i + 1; j < feet.length; j++) {
                        const [a, b] = [state.vehicles[i], state.vehicles[j]];
                        if (overlap(feet[i], feet[j])) assert.fail(`t=${state.t.toFixed(2)} ${a.type}@${a.seg.id} vs ${b.type}@${b.seg.id}`);
                    }
                }
            },
        });
    }
});

test('nobody enters a crossing on red (only in the all-red gap), and nobody stops inside a junction', () => {
    for (const graph of graphs) {
        let entries = 0;
        const stopped = new Map();
        run(graph, {
            seconds: 120,
            check: (state, before) => {
                for (const v of state.vehicles) {
                    const was = before.get(v);
                    const lane = was?.seg;
                    const front = (x) => x + v.length / 2;
                    const crossed = lane?.type === 'lane' && lane.control === 'signal' && front(was.s) < lane.length - 0.01
                        && (v.seg !== lane || front(v.s) >= lane.length - 0.01);
                    if (crossed) {
                        entries++;
                        // Red now and already red a second ago: past the all-red gap.
                        const late = [state.t, state.t - SIGNAL.allRed].every((t) => signalState(lane.node, t)[lane.phase] === 'red');
                        if (late) assert.fail(`${v.type} ran the red at ${lane.node.id}, t=${state.t.toFixed(2)}`);
                    }
                    const inside = v.seg.type === 'link' && v.v < 0.01;
                    stopped.set(v, inside ? (stopped.get(v) ?? 0) + DT : 0);
                    if (stopped.get(v) >= 1) assert.fail(`${v.type} stuck in junction ${v.seg.node.id}, t=${state.t.toFixed(2)}`);
                }
            },
        });
        assert.ok(entries > 20, `only ${entries} crossings`);
    }
});

test('traffic keeps flowing: no gridlock, vehicles leave, nobody waits for ever', () => {
    for (const graph of graphs) {
        const waiting = new Map();
        let longest = 0;
        const state = run(graph, {
            seconds: 400,
            check: (s) => {
                for (const v of s.vehicles) {
                    waiting.set(v, v.v < 0.05 ? (waiting.get(v) ?? 0) + DT : 0);
                    longest = Math.max(longest, waiting.get(v));
                }
            },
        });
        assert.ok(state.exited > 10, `only ${state.exited} left`);
        // One full light cycle is 22 s; a queue behind it adds a little.
        assert.ok(longest < 35, `someone waited ${longest.toFixed(1)} s`);
        assert.ok(state.vehicles.length >= MAX_VEHICLES * 0.7, `only ${state.vehicles.length} on the roads`);
    }
});

test('density follows the target; rain slows traffic', () => {
    const graph = graphs.at(-1);
    const quiet = run(graph, { seconds: 300, target: 4 });
    assert.ok(quiet.vehicles.length <= 6, `${quiet.vehicles.length} at night`);
    const speed = (rain) => {
        let sum = 0;
        let n = 0;
        run(graph, { seconds: 120, rain, target: 8, check: (s) => { for (const v of s.vehicles) { sum += v.v; n++; } } });
        return sum / n;
    };
    assert.ok(speed(1) < speed(0) * 0.85);
});

test('deterministic: the same seed gives the same traffic', () => {
    const snapshot = (s) => s.vehicles.map((v) => `${v.type}:${v.seg.id}:${v.s.toFixed(4)}`).join('|');
    const a = run(graphs.at(-1), { seconds: 60 });
    const b = run(graphs.at(-1), { seconds: 60 });
    assert.equal(snapshot(a), snapshot(b));
    assert.notEqual(snapshot(a), snapshot(run(graphs.at(-1), { seconds: 60, seed: 'other' })));
});
