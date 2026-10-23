// Road and lane graph (P3B-01, design_system.md → "Interactive city"): layout roads → junctions, lanes, turns,
// crosswalks and traffic lights for the traffic (P3B-03) and pedestrians (P3B-04).
// Pure and deterministic. Junctions are found from the road rectangles, so new roads (market, road out) just work.
// Axes as in layout.js: north is −z. Traffic drives on the right (Cameroon).
import { hashString } from './random.js';

export const CROSSWALK = 0.8; // depth of a crosswalk, just outside the junction
const EPS = 1e-6;
const CURVE_STEPS = 6;

// Traffic lights at crossings: north–south, then east–west, with amber and an all-red gap between them.
export const SIGNAL = { green: 8, amber: 2, allRed: 1 };
export const SIGNAL_CYCLE = 2 * (SIGNAL.green + SIGNAL.amber + SIGNAL.allRed);
// The crossing button (P3B-06): a green at least this old ends now (amber, then the usual all-red); once per cycle.
export const BUTTON = { minGreen: 2, cooldown: SIGNAL_CYCLE };
// Signal poles: on the pavement at the right of each arm's traffic, just behind the crosswalk.
export const POLE = { back: 0.15, side: 0.15 };

const ARMS = {
    n: { x: 0, z: -1, axis: 'z' },
    s: { x: 0, z: 1, axis: 'z' },
    e: { x: 1, z: 0, axis: 'x' },
    w: { x: -1, z: 0, axis: 'x' },
};
const OPPOSITE = { n: 's', s: 'n', e: 'w', w: 'e' };

// Snap away float noise (and −0) so roads meeting at the same point share one node.
const snap = (v) => Math.round(v * 1e6) / 1e6 + 0;
const key = (x, z) => `${snap(x)},${snap(z)}`;
const touches = (a0, a1, b0, b1) => a0 <= b1 + EPS && b0 <= a1 + EPS;
// Right-hand side of a heading on the ground (y up, north −z): north → +x, east → +z.
const rightOf = (d) => ({ x: -d.z, z: d.x });

/** Road rectangle → a centre line along its long axis. */
const toLine = (road, index) => {
    const x0 = road.x - road.width / 2;
    const x1 = road.x + road.width / 2;
    const z0 = road.z - road.depth / 2;
    const z1 = road.z + road.depth / 2;
    return road.depth > road.width
        ? { index, kind: road.kind, axis: 'z', at: snap(road.x), from: z0, to: z1, width: road.width, x0, x1, z0, z1 }
        : { index, kind: road.kind, axis: 'x', at: snap(road.z), from: x0, to: x1, width: road.depth, x0, x1, z0, z1 };
};

/**
 * Join pieces of one road laid end to end (same axis, centre line and width: a road and its road out) into one line,
 * so there is no junction between them. The joined line keeps the town piece's kind (its speed).
 */
const joinLines = (lines) => {
    const out = [];
    const sorted = [...lines].sort((a, b) => (a.axis < b.axis ? -1 : a.axis > b.axis ? 1 : 0) || a.at - b.at || a.from - b.from);
    for (const line of sorted) {
        const last = out.at(-1);
        if (last && last.axis === line.axis && last.at === line.at && Math.abs(last.width - line.width) < EPS && Math.abs(last.to - line.from) < EPS) {
            Object.assign(last, {
                to: line.to,
                x0: Math.min(last.x0, line.x0), x1: Math.max(last.x1, line.x1),
                z0: Math.min(last.z0, line.z0), z1: Math.max(last.z1, line.z1),
                kind: last.kind === 'out' ? line.kind : last.kind,
                index: Math.min(last.index, line.index),
            });
        } else out.push({ ...line });
    }
    return out.sort((a, b) => a.index - b.index);
};

/** Light colours at a crossing at time `t` (seconds): { ns, ew } as 'green' | 'amber' | 'red'. */
export const signalState = (node, t) => {
    const p = (((t + node.signal.offset) % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
    const half = SIGNAL_CYCLE / 2;
    const light = (q) => (q < SIGNAL.green ? 'green' : q < SIGNAL.green + SIGNAL.amber ? 'amber' : 'red');
    return p < half ? { ns: light(p), ew: 'red' } : { ns: 'red', ew: light(p - half) };
};

/**
 * Someone pressed the crossing button at time `t`: the green showing now ends (amber, then all red, as usual), so
 * the other way, and the walkers across this road, get their turn sooner. Shifts the node's cycle in place.
 * @returns {'changing' | 'busy' | 'wait'} changing = the green ends now; busy = already amber, red or a fresh green;
 *   wait = pressed less than a cycle ago
 */
export const pressSignal = (node, t) => {
    if (!node?.signal) return 'busy';
    const since = t - (node.signal.pressedAt ?? -Infinity);
    if (since >= 0 && since < BUTTON.cooldown) return 'wait'; // (a restarted clock forgets older presses)
    const half = SIGNAL_CYCLE / 2;
    const p = (((t + node.signal.offset) % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
    const q = p % half; // time into this way's green
    if (q < BUTTON.minGreen || q >= SIGNAL.green) return 'busy';
    node.signal.offset += SIGNAL.green - q;
    node.signal.pressedAt = t;
    return 'changing';
};

const turnOf = (din, dout) => {
    const cross = din.x * dout.z - din.z * dout.x;
    return cross > EPS ? 'right' : cross < -EPS ? 'left' : 'straight';
};

const curve = (p0, din, p1, dout) => {
    if (din === dout) return [p0, p1];
    // Quadratic Bézier through the point where the two lane lines meet.
    const c = din.axis === 'z' ? { x: p0.x, z: p1.z } : { x: p1.x, z: p0.z };
    return Array.from({ length: CURVE_STEPS + 1 }, (_, i) => {
        const t = i / CURVE_STEPS;
        const a = (1 - t) ** 2;
        const b = 2 * (1 - t) * t;
        const d = t ** 2;
        return { x: a * p0.x + b * c.x + d * p1.x, z: a * p0.z + b * c.z + d * p1.z };
    });
};

const pathLength = (points) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.z - points[i].z), 0);

/**
 * @param {{ roads: { kind, x, z, width, depth }[] }} layout  output of layoutCity
 * @returns {{ nodes, lanes, links, crosswalks, entries: string[], exits: string[] }}
 */
export const buildRoadGraph = (layout) => {
    const lines = joinLines(layout.roads.map(toLine));
    const vertical = lines.filter((l) => l.axis === 'z');
    const horizontal = lines.filter((l) => l.axis === 'x');

    // Junctions: a vertical and a horizontal road that touch or overlap meet at their centre lines.
    const stops = new Map(lines.map((l) => [l.index, []])); // per road: positions along its axis
    for (const v of vertical) {
        for (const h of horizontal) {
            if (!touches(v.from, v.to, h.z0, h.z1) || !touches(h.from, h.to, v.x0, v.x1)) continue;
            stops.get(v.index).push({ at: h.at, cross: h });
            stops.get(h.index).push({ at: v.at, cross: v });
        }
    }

    // Each road runs from stop to stop; a road end not inside a crossing road is an edge of the map.
    const segments = [];
    for (const line of lines) {
        const list = stops.get(line.index);
        const absorbed = (end) => list.some(({ cross }) => (line.axis === 'z'
            ? end >= cross.z0 - EPS && end <= cross.z1 + EPS
            : end >= cross.x0 - EPS && end <= cross.x1 + EPS));
        const at = [...new Set([
            ...list.map((s) => s.at),
            ...[line.from, line.to].filter((end) => !absorbed(end)),
        ].map(snap))].sort((a, b) => a - b);
        for (let i = 0; i + 1 < at.length; i++) {
            const a = line.axis === 'z' ? { x: line.at, z: at[i] } : { x: at[i], z: line.at };
            const b = line.axis === 'z' ? { x: line.at, z: at[i + 1] } : { x: at[i + 1], z: line.at };
            segments.push({ line, a, b });
        }
    }

    // Nodes: junctions and edges, with the road on each arm.
    const nodeMap = new Map();
    const nodeAt = (p) => {
        const k = key(p.x, p.z);
        if (!nodeMap.has(k)) nodeMap.set(k, { x: p.x, z: p.z, arms: {} });
        return nodeMap.get(k);
    };
    for (const seg of segments) {
        const [from, to] = [nodeAt(seg.a), nodeAt(seg.b)];
        const [ahead, back] = seg.line.axis === 'z' ? ['s', 'n'] : ['e', 'w'];
        from.arms[ahead] = seg.line;
        to.arms[back] = seg.line;
    }
    const nodes = [...nodeMap.values()].sort((a, b) => a.z - b.z || a.x - b.x);
    nodes.forEach((node, i) => {
        node.id = `n${i}`;
        const arms = Object.keys(node.arms);
        const has = (a) => arms.includes(a);
        const ns = has('n') && has('s');
        const ew = has('e') && has('w');
        node.kind = arms.length === 1 ? 'edge' : arms.length === 4 ? 'cross' : arms.length === 3 ? 'tee' : ns || ew ? 'bend' : 'corner';
        // Half-size of the junction box: half the width of the roads crossing it.
        const widths = (axis) => Object.values(node.arms).filter((l) => l.axis === axis).map((l) => l.width / 2);
        node.halfX = node.kind === 'edge' ? 0 : Math.max(0, ...widths('z'));
        node.halfZ = node.kind === 'edge' ? 0 : Math.max(0, ...widths('x'));
        node.control = node.kind === 'cross' ? 'signal' : node.kind === 'tee' ? 'priority' : 'none';
        if (node.kind === 'tee') node.through = ns ? 'ns' : 'ew'; // the main road (or through road) goes first
        if (node.kind === 'cross') node.signal = { offset: hashString(node.id + key(node.x, node.z)) % SIGNAL_CYCLE };
        node.crosswalks = node.kind === 'cross' || node.kind === 'tee';
    });

    const byPoint = (p) => nodeMap.get(key(p.x, p.z));
    // Distance from a node's centre to the stop line on an arm.
    const setback = (node, arm) => (ARMS[arm].axis === 'x' ? node.halfX : node.halfZ) + (node.crosswalks ? CROSSWALK : 0);

    const lanes = [];
    for (const seg of segments) {
        const [a, b] = [byPoint(seg.a), byPoint(seg.b)];
        const [ahead, back] = seg.line.axis === 'z' ? ['s', 'n'] : ['e', 'w'];
        for (const [from, to, dir, arriveArm] of [[a, b, ahead, back], [b, a, back, ahead]]) {
            const d = ARMS[dir];
            const r = rightOf(d);
            const off = seg.line.width / 4;
            const s0 = setback(from, dir);
            const s1 = setback(to, arriveArm);
            const start = { x: from.x + d.x * s0 + r.x * off, z: from.z + d.z * s0 + r.z * off };
            const end = { x: to.x - d.x * s1 + r.x * off, z: to.z - d.z * s1 + r.z * off };
            lanes.push({
                id: `${from.id}>${to.id}`,
                from: from.id,
                to: to.id,
                kind: seg.line.kind,
                road: seg.line.index,
                width: seg.line.width / 2,
                heading: dir,
                points: [start, end],
                length: Math.hypot(end.x - start.x, end.z - start.z),
                // How the lane's end is controlled: wait for the light, give way, have priority, or leave the map.
                control: to.kind === 'edge' ? 'exit'
                    : to.control === 'signal' ? 'signal'
                        : to.control === 'priority' ? (to.through === (d.axis === 'z' ? 'ns' : 'ew') ? 'priority' : 'yield')
                            : 'none',
                ...(to.control === 'signal' && { phase: d.axis === 'z' ? 'ns' : 'ew' }),
            });
        }
    }
    lanes.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));

    // Turns through each junction: every arm except straight back.
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const outOf = new Map();
    for (const lane of lanes) outOf.set(lane.from, [...(outOf.get(lane.from) ?? []), lane]);
    const links = [];
    for (const lane of lanes) {
        const node = nodeById.get(lane.to);
        if (node.kind === 'edge') continue;
        const din = ARMS[lane.heading];
        for (const out of outOf.get(node.id) ?? []) {
            if (out.heading === OPPOSITE[lane.heading]) continue;
            const points = curve(lane.points[1], din, out.points[0], ARMS[out.heading]);
            links.push({
                id: `${lane.id}|${out.id}`,
                node: node.id,
                from: lane.id,
                to: out.id,
                turn: turnOf(din, ARMS[out.heading]),
                points,
                length: pathLength(points),
            });
        }
    }

    // Crosswalks across each arm, just outside the junction box.
    const crosswalks = [];
    for (const node of nodes.filter((n) => n.crosswalks)) {
        for (const [arm, line] of Object.entries(node.arms).sort()) {
            const d = ARMS[arm];
            const along = (d.axis === 'x' ? node.halfX : node.halfZ) + CROSSWALK / 2;
            crosswalks.push({
                id: `${node.id}${arm}`,
                node: node.id,
                arm,
                // The light that stops the traffic crossing it (an n/s arm lies across a north–south road).
                phase: d.axis === 'z' ? 'ns' : 'ew',
                x: node.x + d.x * along,
                z: node.z + d.z * along,
                width: d.axis === 'x' ? CROSSWALK : line.width,
                depth: d.axis === 'x' ? line.width : CROSSWALK,
            });
        }
    }

    const edges = new Set(nodes.filter((n) => n.kind === 'edge').map((n) => n.id));
    return {
        nodes: nodes.map(({ arms, ...node }) => ({ ...node, arms: Object.keys(arms).sort() })),
        lanes,
        links,
        crosswalks,
        entries: lanes.filter((l) => edges.has(l.from)).map((l) => l.id),
        exits: lanes.filter((l) => edges.has(l.to)).map((l) => l.id),
    };
};

/** Where the signal poles stand: one per arm of every crossing, facing the traffic that arrives on it. */
export const signalPoles = (graph) => graph.nodes.filter((n) => n.control === 'signal').flatMap((node) => node.arms.map((arm) => {
    const d = ARMS[arm];
    const along = (d.axis === 'x' ? node.halfX : node.halfZ) + CROSSWALK + POLE.back;
    // The arm's own road (a crossing can join a wide road and a narrow street).
    const arriving = graph.lanes.find((l) => l.to === node.id && l.heading === OPPOSITE[arm]);
    const side = (arriving ? arriving.width : d.axis === 'x' ? node.halfZ : node.halfX) + POLE.side;
    // Arriving traffic heads −d; its right-hand side is (d.z, −d.x).
    return {
        node: node.id, arm, phase: d.axis === 'z' ? 'ns' : 'ew',
        x: node.x + d.x * along + d.z * side, z: node.z + d.z * along - d.x * side, rotationY: Math.atan2(d.x, d.z),
    };
}));

// One graph per layout, shared by the traffic, the pedestrians and the signal poles, so a button press reaches all.
const cache = new WeakMap();
export const roadGraphFor = (layout) => {
    if (!cache.has(layout)) cache.set(layout, buildRoadGraph(layout));
    return cache.get(layout);
};
