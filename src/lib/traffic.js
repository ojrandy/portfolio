// Traffic (P3B-03, design_system.md → "Interactive city"): vehicles driving the lane graph from roadGraph.js.
// Pure and deterministic (seeded), no three.js; src/city/Traffic.jsx steps it and draws it every frame.
// Drivers keep a gap, stop for red (and amber when they can), give way, and only enter a junction when it is clear
// and there is room beyond it. A lane too short to wait on (the 0.9 main-road stretch) is booked straight through.
import { signalState } from './roadGraph.js';
import { BUEA_UTC_OFFSET_MINUTES } from './dayNight.js';
import { VEHICLE_TYPES } from './vehicles.js';
import { createRandom } from './random.js';

export const MAX_VEHICLES = 30; // desktop at the busiest hour; phones get half
export const SPEED = { main: 3.2, career: 2.4, street: 2.0 }; // cruise speed by road kind, units/s
export const RAIN_SLOW = 0.3; // full rain takes this much off every speed
const TURN_SPEED = 1.3;
const ACCEL = 2.2;
const BRAKE = 3.2; // the deceleration drivers plan with
const LOOK = 9; // how far ahead a driver looks
const STOP_MARGIN = 0.05; // stop this far short of a stop line
const BOOK_AHEAD = 0.6; // book a junction this far before the point where it could still stop
const YIELD_LOOK = 3.5; // give way to priority traffic this close to the junction
const CLEARANCE = 0.8; // two turns closer than this conflict
const SPAWN_EVERY = 0.9;
const FADE = 0.6; // seconds to appear at an edge; units to disappear at one
const MOVING = 0.3;
const EXIT_WEIGHT = 0.3;
const PATIENCE = 6; // seconds; then a give-way driver pulls out in front of anyone who can still stop comfortably

// Buea mix: yellow taxis and bendskins first, a few buses and trucks, police and ambulances rare.
export const MIX = {
    taxi: 30, moto: 22, sedan: 14, minibus: 8, suv: 7, pickup: 6, bus: 3, timberTruck: 2, bananaTruck: 2, police: 1.5, ambulance: 1,
};
const RAIN_MOTOS = 0.5; // full rain halves the share of motos
const SPEED_FACTOR = { moto: 1.1, bus: 0.85, timberTruck: 0.8, bananaTruck: 0.8 };
const GAP = { moto: 0.25 };
const DEFAULT_GAP = 0.4;

// Share of MAX_VEHICLES by Buea time (minutes after midnight): rush 07:00–09:00 and 16:00–19:00, quiet 01:00–05:00.
const DENSITY = [
    [0, 0.14], [60, 0.12], [300, 0.12], [360, 0.35], [420, 0.9], [480, 1], [540, 0.9], [600, 0.45], [720, 0.4],
    [900, 0.45], [960, 0.9], [1050, 1], [1140, 0.9], [1200, 0.55], [1320, 0.3], [1440, 0.14],
];

/** Minutes after midnight in Buea (WAT) at epoch `ms`. */
export const bueaMinutes = (ms) => (((ms / 60000 + BUEA_UTC_OFFSET_MINUTES) % 1440) + 1440) % 1440;

/** 0..1 share of the busiest traffic at `minutes` after midnight, Buea time. */
export const trafficDensity = (minutes) => {
    const m = ((minutes % 1440) + 1440) % 1440;
    const i = DENSITY.findIndex(([at]) => at > m);
    const [a, va] = DENSITY[i - 1];
    const [b, vb] = DENSITY[i];
    return va + ((vb - va) * (m - a)) / (b - a);
};

/** How many vehicles should be on the roads at `minutes`, out of `max`. */
export const targetCount = (minutes, max = MAX_VEHICLES) => Math.max(1, Math.round(max * trafficDensity(minutes)));

/** A vehicle type from the mix; rain (0..1) thins out the motos. */
export const pickType = (random, rain = 0) => {
    const weights = Object.entries(MIX).map(([id, w]) => [id, id === 'moto' ? w * (1 - RAIN_MOTOS * rain) : w]);
    let r = random() * weights.reduce((sum, [, w]) => sum + w, 0);
    for (const [id, w] of weights) {
        r -= w;
        if (r < 0) return id;
    }
    return weights[0][0];
};

const cumulative = (points) => points.reduce((out, p, i) => {
    out.push(i === 0 ? 0 : out[i - 1] + Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z));
    return out;
}, []);

const pointAt = (seg, s) => {
    const { points, cum } = seg;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const a = points[i - 1];
    const b = points[i];
    const t = cum[i] > cum[i - 1] ? Math.min(1, Math.max(0, (s - cum[i - 1]) / (cum[i] - cum[i - 1]))) : 0;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dx: b.x - a.x, dz: b.z - a.z };
};

const resample = (seg, step = 0.15) => {
    const n = Math.max(1, Math.ceil(seg.length / step));
    return Array.from({ length: n + 1 }, (_, i) => pointAt(seg, (seg.length * i) / n));
};

// Two turns through a junction conflict when they merge into one lane or pass closer than CLEARANCE;
// turns out of the same lane never do (the drivers simply follow each other).
const conflicts = (a, b) => {
    if (a.fromLane === b.fromLane) return false;
    if (a.toLane === b.toLane) return true;
    return a.samples.some((p) => b.samples.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < CLEARANCE));
};

const indexGraph = (graph) => {
    const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
    const segs = new Map();
    const incoming = new Map(graph.nodes.map((n) => [n.id, []]));
    for (const lane of graph.lanes) {
        const seg = { ...lane, type: 'lane', node: nodes.get(lane.to), out: [], limit: SPEED[lane.kind] ?? SPEED.street, cum: cumulative(lane.points) };
        segs.set(lane.id, seg);
        incoming.get(lane.to).push(seg);
    }
    const byNode = new Map();
    for (const link of graph.links) {
        const fromLane = segs.get(link.from);
        const toLane = segs.get(link.to);
        const seg = {
            ...link, type: 'link', node: nodes.get(link.node), fromLane, toLane, cum: cumulative(link.points),
            limit: link.turn === 'straight' ? Math.min(fromLane.limit, toLane.limit) : TURN_SPEED, conflicts: new Set(),
        };
        seg.samples = resample(seg);
        fromLane.out.push(seg);
        segs.set(link.id, seg);
        byNode.set(link.node, [...(byNode.get(link.node) ?? []), seg]);
    }
    for (const links of byNode.values()) {
        for (const a of links) for (const b of links) if (a !== b && conflicts(a, b)) a.conflicts.add(b);
    }
    return { segs, incoming, entries: graph.entries.map((id) => segs.get(id)) };
};

const stopDistance = (v) => (v * v) / (2 * BRAKE);
const lightOf = (state, lane) => signalState(lane.node, state.t)[lane.phase];
const rankOf = (lane, link) => (lane.control === 'yield' ? 0 : link.turn === 'left' ? 1 : 2);
const onSeg = (state, seg) => state.on.get(seg) ?? [];

/** The turn a driver will take at the end of `lane` (chosen once, on the driver's own seed); null at an exit. */
const chooseLink = (me, lane) => {
    if (lane.out.length === 0) return null;
    if (!me.choices.has(lane.id)) {
        // Mostly straight on; leaving the map is rarer, so drivers circulate downtown.
        const weights = lane.out.map((l) => (l.turn === 'straight' ? 2.5 : 1) * (l.toLane.control === 'exit' ? EXIT_WEIGHT : 1));
        let r = me.random() * weights.reduce((a, b) => a + b, 0);
        me.choices.set(lane.id, lane.out.find((_, i) => (r -= weights[i]) < 0) ?? lane.out[0]);
    }
    return me.choices.get(lane.id);
};

// Free length at the start of `lane` once everyone already booked into it has arrived.
const roomOn = (state, lane, me) => {
    let back = lane.control === 'exit' ? lane.length + 10 : lane.length;
    for (const v of onSeg(state, lane)) if (v !== me) back = Math.min(back, v.s - v.length / 2);
    for (const v of state.vehicles) {
        if (v !== me && v.seg !== lane && v.reserved.some((l) => l.toLane === lane)) back -= v.length + v.gap;
    }
    return back;
};

// `state.booked`: how many drivers hold each turn (a driver never holds a turn that conflicts with its own next one).
const junctionClear = (state, link) => {
    for (const l of link.conflicts) if (state.booked.get(l)) return false;
    return true;
};
const book = (state, me, chain) => {
    me.reserved.push(...chain);
    for (const l of chain) state.booked.set(l, (state.booked.get(l) ?? 0) + 1);
};

// A driver who has waited past PATIENCE claims its turn; drivers who waited less leave the junction to it.
const outranks = (v, me) => v.waited > me.waited || (v.waited === me.waited && v.id < me.id);
const claimedByOther = (state, link, me) => state.vehicles.some((v) => v !== me && v.claim.length && outranks(v, me)
    && v.claim.some((l) => l === link || link.conflicts.has(l)) && !v.claim.includes(me.seg));

// The turns `me` will need from `link` on: more than one through a lane too short to stop on.
const plannedChain = (me, link) => {
    const chain = [link];
    for (let l = link; l && l.toLane.control !== 'exit' && l.toLane.length < me.length + me.gap + 0.2;) {
        l = chooseLink(me, l.toLane);
        if (l) chain.push(l);
    }
    return chain;
};

// A driver with a higher rank (priority road over a give-way street, straight / right over left) is about to arrive.
const priorityComing = (state, link, me) => {
    const mine = rankOf(link.fromLane, link);
    for (const lane of state.index.incoming.get(link.node.id)) {
        if (lane === link.fromLane) continue;
        const first = onSeg(state, lane).reduce((best, v) => (!best || v.s > best.s ? v : best), null);
        if (!first || first === me || first.v < MOVING || first.reserved.length) continue;
        const d = lane.length - (first.s + first.length / 2);
        if (d > (me.waited > PATIENCE ? stopDistance(first.v) + BOOK_AHEAD : YIELD_LOOK)) continue;
        if (lane.control === 'signal' && lightOf(state, lane) === 'red') continue;
        const theirs = chooseLink(first, lane);
        if (theirs && link.conflicts.has(theirs) && rankOf(lane, theirs) > mine) return true;
    }
    return false;
};

/** Can `me` take `link` now? Collects the turns to book in `chain` (more than one through a lane too short to stop on). */
const canBook = (state, me, link, chain) => {
    if (!junctionClear(state, link) || claimedByOther(state, link, me) || priorityComing(state, link, me)) return false;
    chain.push(link);
    const next = link.toLane;
    if (next.control !== 'exit' && next.length < me.length + me.gap + 0.2) {
        if (onSeg(state, next).some((v) => v.reserved.length === 0)) return false;
        if (next.control === 'signal' && lightOf(state, next) !== 'green') return false;
        const after = chooseLink(me, next);
        return Boolean(after) && canBook(state, me, after, chain);
    }
    return roomOn(state, next, me) >= me.length + me.gap;
};

const lightAllows = (state, me, lane, d) => {
    if (lane.control !== 'signal') return true;
    const light = lightOf(state, lane);
    return light === 'green' || (light === 'amber' && d <= stopDistance(me.v));
};

// May `me` pass the end of `lane` (its front `d` from the stop line)? On its own lane, close enough, it books the turn.
const gateOpen = (state, me, lane, d, own) => {
    const link = chooseLink(me, lane);
    if (!link || me.reserved.includes(link)) return true;
    if (!lightAllows(state, me, lane, d)) {
        if (own) me.claim = [];
        return false;
    }
    const chain = [];
    if (!canBook(state, me, link, chain)) {
        if (own && me.waited > PATIENCE) me.claim = plannedChain(me, link);
        return false;
    }
    if (own && me.reserved.length === 0 && d <= stopDistance(me.v) + BOOK_AHEAD) {
        book(state, me, chain);
        me.claim = [];
    }
    return true;
};

// Where the front of `me` must stop (distance along its path) and the fastest it may go now.
const lookAhead = (state, me, slow) => {
    let seg = me.seg;
    let offset = -(me.s + me.length / 2); // from my front to the start of `seg`
    let vmax = seg.limit * slow;
    let stopAt = Infinity;
    const ahead = (v, base) => { stopAt = Math.min(stopAt, base + v.s - v.length / 2 - me.gap); };
    for (let i = 0; i < 8 && offset < LOOK; i++) {
        for (const v of onSeg(state, seg)) if (v !== me && (seg !== me.seg || v.s > me.s)) ahead(v, offset);
        let next = null;
        if (seg.type === 'lane') {
            const end = offset + seg.length;
            next = chooseLink(me, seg);
            // Drivers who just turned out of this lane another way are still ahead, near its end.
            for (const link of seg.out) if (link !== next) for (const v of onSeg(state, link)) ahead(v, end);
            // Only the front driver deals with the junction (anyone else stops behind someone first).
            if (next && stopAt > end - STOP_MARGIN && !gateOpen(state, me, seg, end, seg === me.seg)) stopAt = end - STOP_MARGIN;
        } else {
            next = seg.toLane;
            // On a turn: whoever took another turn out of the same lane stays ahead until the paths part.
            if (seg === me.seg) {
                for (const other of seg.fromLane.out) if (other !== seg) for (const v of onSeg(state, other)) if (v.s > me.s) ahead(v, offset);
            }
        }
        if (stopAt < Infinity || !next) break;
        offset += seg.length;
        seg = next;
        vmax = Math.min(vmax, Math.sqrt((seg.limit * slow) ** 2 + 2 * BRAKE * Math.max(0, offset)));
    }
    return { stopAt, vmax };
};

const addVehicle = (state, type, seg, s, v, age) => {
    const id = state.nextId++;
    const kit = VEHICLE_TYPES[type];
    const vehicle = {
        id, type, seed: `traffic-${id}`, length: kit.length, width: kit.width, gap: GAP[type] ?? DEFAULT_GAP, speedFactor: SPEED_FACTOR[type] ?? 1,
        seg, s, v, age, waited: 0, scale: 1, braking: false, reserved: [], claim: [], choices: new Map(), random: createRandom(`${state.seed}:vehicle:${id}`),
    };
    state.vehicles.push(vehicle);
    return vehicle;
};

const fits = (state, lane, from, to) => onSeg(state, lane).every((v) => v.s + v.length / 2 < from || v.s - v.length / 2 > to);

const rebuildBuckets = (state) => {
    state.on = new Map();
    state.booked = new Map();
    for (const v of state.vehicles) {
        for (const l of v.reserved) state.booked.set(l, (state.booked.get(l) ?? 0) + 1);
        const list = state.on.get(v.seg);
        if (list) list.push(v);
        else state.on.set(v.seg, [v]);
    }
};

const spawn = (state, rain) => {
    const type = pickType(state.random, rain);
    const { length } = VEHICLE_TYPES[type];
    const lanes = state.index.entries.filter((lane) => fits(state, lane, -1, length + 1));
    if (lanes.length === 0) return;
    // Fewer from the entrance, which is near the start view (until P3B-08's road out takes over).
    const weights = lanes.map((lane) => (lane.kind === 'career' ? 0.5 : 1));
    let r = state.random() * weights.reduce((a, b) => a + b, 0);
    const lane = lanes.find((_, i) => (r -= weights[i]) < 0) ?? lanes[0];
    addVehicle(state, type, lane, length / 2, lane.limit * 0.6, 0);
    rebuildBuckets(state);
};

/**
 * @param {{ nodes, lanes, links, entries }} graph  buildRoadGraph() output
 * @param {{ seed?: string, count?: number, rain?: number }} options  count = vehicles already on the roads at the start
 */
export const createTraffic = (graph, { seed = 'oj-city', count = 0, rain = 0 } = {}) => {
    const index = indexGraph(graph);
    const state = { seed, index, vehicles: [], on: new Map(), booked: new Map(), t: 0, nextId: 0, random: createRandom(`${seed}:traffic`), spawnClock: 0, exited: 0 };
    const lanes = [...index.segs.values()].filter((s) => s.type === 'lane' && s.length >= 3);
    for (let tries = 0; state.vehicles.length < count && tries < count * 30; tries++) {
        const lane = lanes[Math.floor(state.random() * lanes.length)];
        const type = pickType(state.random, rain);
        const { length } = VEHICLE_TYPES[type];
        const s = length / 2 + state.random() * (lane.length - length - 0.5);
        if (s < length / 2 || !fits(state, lane, s - length / 2 - 1, s + length / 2 + 1)) continue;
        addVehicle(state, type, lane, s, 0, FADE);
        rebuildBuckets(state);
    }
    return state;
};

/**
 * Advance the traffic by `dt` seconds. `target` = how many vehicles should be on the roads (see targetCount);
 * new ones enter at the map edges while there are fewer. `rain` 0..1 slows everyone and thins out the motos.
 */
export const stepTraffic = (state, dt, { target = 0, rain = 0 } = {}) => {
    if (!(dt > 0)) return state;
    state.t += dt;
    rebuildBuckets(state);
    const slow = 1 - RAIN_SLOW * rain;

    // Plan everyone against the same positions, then move.
    const moves = state.vehicles.map((me) => {
        const { stopAt, vmax } = lookAhead(state, me, slow * me.speedFactor);
        const desired = Math.min(vmax, Math.sqrt(2 * BRAKE * Math.max(0, stopAt)));
        const v = Math.max(0, Math.min(me.v + ACCEL * dt, desired));
        return { v, ds: Math.min(v * dt, Math.max(0, stopAt)) };
    });

    // Last word, whatever the plan said: nobody moves its body into a vehicle in front of it (full size, any road).
    // Checked in order against everyone's already decided positions, so two moves can't meet half-way.
    const feet = state.vehicles.map((v) => footprint(v));
    state.vehicles.forEach((me, i) => {
        const move = moves[i];
        if (move.ds <= 0) return;
        const here = feet[i];
        const there = footprint(me, move.ds);
        const blocked = feet.some((o, j) => j !== i && (o.x - here.x) * here.ax.x + (o.z - here.z) * here.ax.z > 0 && footprintsOverlap(there, o));
        if (blocked) Object.assign(move, { v: 0, ds: 0 });
        else feet[i] = there;
    });

    const gone = new Set();
    state.vehicles.forEach((me, i) => {
        const { v, ds } = moves[i];
        me.braking = v < me.v - 0.01 || v < 0.05;
        me.v = v;
        me.waited = v < 0.05 ? me.waited + dt : 0;
        if (me.waited === 0) me.claim = [];
        const from = { seg: me.seg, s: me.s };
        me.s += ds;
        me.age += dt;
        while (me.s > me.seg.length) {
            const seg = me.seg;
            if (seg.type === 'lane') {
                if (seg.control === 'exit') { gone.add(me); break; }
                const link = chooseLink(me, seg);
                if (me.reserved[0] !== link) {
                    // Got here without booking (a long frame): book now or wait at the line.
                    const chain = [];
                    if (!lightAllows(state, me, seg, 0) || !canBook(state, me, link, chain)) { me.s = seg === from.seg ? from.s : seg.length; me.v = 0; break; }
                    book(state, me, chain);
                }
                me.choices.delete(seg.id);
                me.s -= seg.length;
                me.seg = link;
            } else {
                me.reserved.shift();
                me.s -= seg.length;
                me.seg = seg.toLane;
            }
        }
        const leaving = me.seg.control === 'exit' ? (me.seg.length - me.s) / FADE : 1;
        me.scale = Math.max(0, Math.min(1, me.age / FADE, leaving));
    });
    if (gone.size) {
        state.vehicles = state.vehicles.filter((v) => !gone.has(v));
        state.exited += gone.size;
    }

    state.spawnClock += dt;
    if (state.vehicles.length < target && state.spawnClock >= SPAWN_EVERY) {
        state.spawnClock = 0;
        rebuildBuckets(state);
        spawn(state, rain);
    }
    return state;
};

/** A vehicle's body on the ground (oriented rectangle), `ahead` units further along its heading. */
export const footprint = (v, ahead = 0) => {
    const { x, z, rotationY } = vehiclePose(v);
    const ax = { x: Math.sin(rotationY), z: Math.cos(rotationY) };
    return { x: x + ax.x * ahead, z: z + ax.z * ahead, ax, hl: v.length / 2, hw: v.width / 2 };
};

/** Do two footprints overlap? (separating axis test) */
export const footprintsOverlap = (a, b) => {
    if (Math.hypot(a.x - b.x, a.z - b.z) > a.hl + b.hl + a.hw + b.hw) return false;
    const axes = [a.ax, { x: -a.ax.z, z: a.ax.x }, b.ax, { x: -b.ax.z, z: b.ax.x }];
    const radius = (f, n) => f.hl * Math.abs(f.ax.x * n.x + f.ax.z * n.z) + f.hw * Math.abs(-f.ax.z * n.x + f.ax.x * n.z);
    return axes.every((n) => Math.abs((a.x - b.x) * n.x + (a.z - b.z) * n.z) < radius(a, n) + radius(b, n));
};

/** Where a vehicle is: centre on the ground and heading (rotationY; 0 faces +z). */
export const vehiclePose = (vehicle) => {
    const p = pointAt(vehicle.seg, vehicle.s);
    return { x: p.x, z: p.z, rotationY: Math.atan2(p.dx, p.dz) };
};
