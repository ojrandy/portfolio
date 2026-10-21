import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toBuildings } from './buildings.js';
import { layoutCity, TIERS, BLOCK_LOTS, FEATURED_LOTS } from './layout.js';
import { buildRoadGraph, signalState, SIGNAL_CYCLE, CROSSWALK } from './roadGraph.js';
import { createRandom, shuffledIndices } from './random.js';
import { buildCity, loadProjects } from '../../server/lib/city.js';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const EPS = 1e-6;

const many = (n) => Array.from({ length: n }, (_, i) => ({ slug: `p-${String(i).padStart(3, '0')}`, flag: false }));
// Enough buildings to need each tier.
const tierLayouts = TIERS.map((tier, i) => {
    const count = i === 0 ? 10 : (TIERS[i - 1] * BLOCK_LOTS) ** 2 - FEATURED_LOTS + 1;
    const layout = layoutCity(many(count));
    assert.equal(layout.tier, tier);
    return layout;
});
const realLayout = () => {
    const stats = JSON.parse(readFileSync(new URL('./fixtures/github-stats.json', import.meta.url), 'utf8'));
    return layoutCity(toBuildings(buildCity(loadProjects(), { stats }), { now: NOW }));
};
const layouts = [...tierLayouts, realLayout()];

const inRect = (p, r, pad = 0) => Math.abs(p.x - r.x) <= r.width / 2 + pad + EPS && Math.abs(p.z - r.z) <= r.depth / 2 + pad + EPS;
const onSomeRoad = (p, roads) => roads.some((r) => inRect(p, r));
const HEADINGS = { n: { x: 0, z: -1 }, s: { x: 0, z: 1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } };

const reachable = (starts, next) => {
    const seen = new Set(starts);
    const queue = [...starts];
    while (queue.length) for (const id of next(queue.shift()) ?? []) if (!seen.has(id)) { seen.add(id); queue.push(id); }
    return seen;
};

test('every lane and turn stays on the road, lanes on the right-hand half', () => {
    for (const layout of layouts) {
        const graph = buildRoadGraph(layout);
        for (const lane of graph.lanes) {
            const road = layout.roads[lane.road];
            const d = HEADINGS[lane.heading];
            for (const p of lane.points) {
                assert.ok(inRect(p, road), `${lane.id} leaves its road`);
                // Right of the heading (north → +x, east → +z), inside the road's half.
                const side = (p.x - road.x) * -d.z + (p.z - road.z) * d.x;
                assert.ok(side > EPS && side < lane.width + EPS, `${lane.id} is not on the right`);
            }
            assert.ok(lane.length > 0, `${lane.id} has no length`);
        }
        for (const link of graph.links) for (const p of link.points) assert.ok(onSomeRoad(p, layout.roads), `${link.id} leaves the road`);
    }
});

test('every lane leads to an exit and can be reached from an entry (no car gets stuck)', () => {
    for (const layout of layouts) {
        const graph = buildRoadGraph(layout);
        const next = new Map();
        const prev = new Map();
        for (const link of graph.links) {
            next.set(link.from, [...(next.get(link.from) ?? []), link.to]);
            prev.set(link.to, [...(prev.get(link.to) ?? []), link.from]);
        }
        assert.ok(graph.entries.length > 0 && graph.exits.length > 0);
        const fromEntries = reachable(graph.entries, (id) => next.get(id));
        const toExits = reachable(graph.exits, (id) => prev.get(id));
        for (const lane of graph.lanes) {
            assert.ok(fromEntries.has(lane.id), `${lane.id} can't be reached`);
            assert.ok(toExits.has(lane.id), `${lane.id} is a dead end`);
        }
        // Lanes that aren't exits always have a way on, and never straight back.
        for (const lane of graph.lanes.filter((l) => l.control !== 'exit')) assert.ok(next.get(lane.id)?.length, lane.id);
        for (const link of graph.links) assert.notEqual(link.from.split('>').reverse().join('>'), link.to);
    }
});

test('traffic lights are never green or amber both ways', () => {
    for (const layout of layouts) {
        const crossings = buildRoadGraph(layout).nodes.filter((n) => n.control === 'signal');
        for (const node of crossings) {
            let saw = { ns: false, ew: false };
            for (let t = -SIGNAL_CYCLE; t < 2 * SIGNAL_CYCLE; t += 0.25) {
                const s = signalState(node, t);
                assert.ok(s.ns === 'red' || s.ew === 'red', `${node.id} at ${t}`);
                saw = { ns: saw.ns || s.ns === 'green', ew: saw.ew || s.ew === 'green' };
            }
            assert.deepEqual(saw, { ns: true, ew: true });
        }
    }
});

test('crossings have lights, T-junctions give way to the through road, the main road has priority', () => {
    for (const layout of layouts) {
        const graph = buildRoadGraph(layout);
        const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
        for (const node of graph.nodes) {
            assert.equal(node.control, node.kind === 'cross' ? 'signal' : node.kind === 'tee' ? 'priority' : 'none', node.id);
        }
        for (const lane of graph.lanes) {
            const to = nodes.get(lane.to);
            if (to.kind === 'cross') assert.equal(lane.control, 'signal');
            if (to.kind === 'tee') {
                const axis = lane.heading === 'n' || lane.heading === 's' ? 'ns' : 'ew';
                assert.equal(lane.control, axis === to.through ? 'priority' : 'yield', lane.id);
            }
            if (lane.kind === 'main' && to.kind === 'tee') assert.equal(lane.control, 'priority', lane.id);
        }
    }
});

test('Career Road meets the main road at a T on odd tiers and a crossing on even tiers', () => {
    for (const layout of tierLayouts) {
        const graph = buildRoadGraph(layout);
        const main = layout.roads.find((r) => r.kind === 'main');
        const node = graph.nodes.find((n) => Math.abs(n.x) < EPS && Math.abs(n.z - main.z) < EPS);
        assert.equal(node.kind, layout.tier % 2 ? 'tee' : 'cross', `tier ${layout.tier}`);
        // Entries/exits: both ends of the main road and the entrance.
        const edges = graph.nodes.filter((n) => n.kind === 'edge');
        assert.equal(edges.length, 3);
        assert.ok(edges.some((n) => Math.abs(n.z - layout.entrance.z) < EPS && Math.abs(n.x) < EPS));
    }
});

test('crosswalks sit on the road just outside the junction', () => {
    for (const layout of layouts) {
        const graph = buildRoadGraph(layout);
        const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
        for (const cw of graph.crosswalks) {
            const node = nodes.get(cw.node);
            assert.ok(node.kind === 'cross' || node.kind === 'tee');
            assert.ok(onSomeRoad({ x: cw.x, z: cw.z }, layout.roads));
            const box = { x: node.x, z: node.z, width: 2 * node.halfX, depth: 2 * node.halfZ };
            const gapX = Math.abs(cw.x - box.x) - (cw.width + box.width) / 2;
            const gapZ = Math.abs(cw.z - box.z) - (cw.depth + box.depth) / 2;
            assert.ok(Math.max(gapX, gapZ) > -EPS, `${node.id} ${cw.arm} overlaps the junction`);
            assert.ok(Math.min(cw.width, cw.depth) === CROSSWALK);
        }
    }
});

test('the same city always gives the same graph', () => {
    const input = many(25);
    const shuffled = shuffledIndices(input.length, createRandom('roads')).map((i) => input[i]);
    assert.deepEqual(buildRoadGraph(layoutCity(input)), buildRoadGraph(layoutCity(shuffled)));
    assert.deepEqual(buildRoadGraph(realLayout()), buildRoadGraph(realLayout()));
});
