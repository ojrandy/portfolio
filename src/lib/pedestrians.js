// Pedestrians (P3B-04, design_system.md → "Interactive city"): people walking downtown's pavements and crossing the
// streets. Pure and deterministic (seeded), no three.js; src/city/Pedestrians.jsx steps them and draws them.
// The walk network: a loop round each city block, WALK_INSET inside its edge, joined across the streets by every
// crosswalk whose two ends land on block corners. People cross at lights while the road they cross has red and there
// is time to get over; elsewhere when traffic.js (crosswalkClear) says no driver is about to use the crosswalk.
// Drivers in turn never book a turn through a crosswalk someone is on (stepTraffic's `crossing`).
import { SIGNAL, SIGNAL_CYCLE } from './roadGraph.js';
import { createRandom } from './random.js';

export const MAX_PEOPLE = 40; // desktop in the busy hours; phones get half
export const WALK_INSET = 0.5; // the walking line inside a block's edge (lamps stand at 0.2, buildings start at 0.7)
export const RAIN_FEWER = 0.5; // full rain keeps half the people indoors
export const UMBRELLA_RAIN = 0.15; // above this much rain everyone out walking carries an umbrella
export const STRIDE = 22; // gait phase (radians) per unit walked
const SPEED = [0.45, 0.65];
const GAP = 0.32; // keep this far behind whoever walks ahead
const KEEP_RIGHT = 0.1; // people walk this far right of the line, so those coming the other way pass
const FADE = 0.8; // seconds to step out of (or back into) a doorway
const CROSS_MARGIN = 1; // seconds of red to spare after crossing
const WALK_WINDOW = 4; // at lights, start crossing only this soon after the red begins (turning drivers get the rest)
const HURRY = 1.3; // people walk this much faster on a crosswalk
const LOOK = 4; // no lights: wait while a driver who will cross is this close to the stop line
const PATIENCE = 8; // seconds; then step out in front of drivers who haven't committed to the crosswalk yet
const CHANGE_EVERY = 0.7; // seconds between people arriving or leaving
const TURN_RATE = 8; // how fast heading and keep-right offset ease (1/s)
const ARMS = { n: { x: 0, z: -1 }, s: { x: 0, z: 1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } };

// Share of MAX_PEOPLE by Buea time (minutes after midnight): busy through the day, a few late at night.
const DENSITY = [
    [0, 0.06], [300, 0.05], [360, 0.35], [420, 0.85], [480, 1], [720, 0.9], [1020, 1], [1140, 0.85], [1260, 0.45],
    [1380, 0.15], [1440, 0.06],
];

/** 0..1 share of the busiest pavements at `minutes` after midnight, Buea time. */
export const peopleDensity = (minutes) => {
    const m = ((minutes % 1440) + 1440) % 1440;
    const i = DENSITY.findIndex(([at]) => at > m);
    const [a, va] = DENSITY[i - 1];
    const [b, vb] = DENSITY[i];
    return va + ((vb - va) * (m - a)) / (b - a);
};

/** How many people should be out at `minutes`, out of `max`; rain (0..1) keeps some indoors. */
export const peopleTarget = (minutes, max = MAX_PEOPLE, rain = 0) => Math.max(1, Math.round(max * peopleDensity(minutes) * (1 - RAIN_FEWER * rain)));

const RED = SIGNAL_CYCLE - SIGNAL.green - SIGNAL.amber; // how long a light stays red

/** Seconds of red left for `phase` ('ns' | 'ew') at a crossing at time `t` (0 when it isn't red); see signalState. */
export const redLeft = (node, phase, t) => {
    const p = (((t + node.signal.offset) % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
    const start = (phase === 'ns' ? 0 : SIGNAL_CYCLE / 2) + SIGNAL.green + SIGNAL.amber;
    const q = (((p - start) % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
    return q < RED ? RED - q : 0;
};

const snap = (v) => Math.round(v * 1e6) / 1e6 + 0;
const key = (x, z) => `${snap(x)},${snap(z)}`;

/**
 * @param {{ pavements: { x, z, width, depth }[] }} layout  output of layoutCity
 * @param {{ nodes, crosswalks }} roads  output of buildRoadGraph
 * @returns {{ points: { id, x, z, edges }[], edges: { id, a, b, length, crosswalk }[] }}
 */
export const buildWalkGraph = (layout, roads) => {
    const points = [];
    const byKey = new Map();
    const point = (x, z, create = true) => {
        const k = key(x, z);
        if (!byKey.has(k) && create) {
            const p = { id: points.length, x: snap(x), z: snap(z), edges: [] };
            points.push(p);
            byKey.set(k, p);
        }
        return byKey.get(k) ?? null;
    };
    const edges = [];
    const edge = (a, b, crosswalk = null) => {
        const e = { id: edges.length, a, b, length: Math.hypot(b.x - a.x, b.z - a.z), crosswalk };
        edges.push(e);
        a.edges.push(e);
        b.edges.push(e);
    };

    for (const p of layout.pavements) {
        const [x0, x1] = [p.x - p.width / 2 + WALK_INSET, p.x + p.width / 2 - WALK_INSET];
        const [z0, z1] = [p.z - p.depth / 2 + WALK_INSET, p.z + p.depth / 2 - WALK_INSET];
        const corners = [point(x0, z0), point(x1, z0), point(x1, z1), point(x0, z1)];
        corners.forEach((c, i) => edge(c, corners[(i + 1) % 4]));
    }

    // A crosswalk joins the block corners on either side of the road it crosses, along the walking line.
    const nodes = new Map(roads.nodes.map((n) => [n.id, n]));
    for (const cw of roads.crosswalks) {
        const node = nodes.get(cw.node);
        const d = ARMS[cw.arm];
        const out = (d.x ? node.halfX : node.halfZ) + WALK_INSET;
        const [x, z] = [node.x + d.x * out, node.z + d.z * out];
        const across = (d.x ? cw.depth : cw.width) / 2 + WALK_INSET;
        const ends = d.x ? [point(x, z - across, false), point(x, z + across, false)] : [point(x - across, z, false), point(x + across, z, false)];
        if (!ends[0] || !ends[1]) continue;
        edge(ends[0], ends[1], { id: cw.id, phase: cw.phase, node: node.control === 'signal' ? node : null });
    }
    return { points, edges };
};

const sideEdges = (walk) => walk.edges.filter((e) => !e.crosswalk);
const startOf = (p) => (p.forward ? p.edge.a : p.edge.b);
const endOf = (p) => (p.forward ? p.edge.b : p.edge.a);
const headingOf = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const turnTowards = (from, to, k) => {
    const d = Math.atan2(Math.sin(to - from), Math.cos(to - from));
    return from + d * k;
};

const addPerson = (state, edge, s, { forward, age }) => {
    const id = state.nextId++;
    const random = createRandom(`${state.seed}:person:${id}`);
    const person = {
        id, seed: `person-${id}`, edge, forward, s, age, scale: age >= FADE ? 1 : 0, leaving: false, waited: 0, next: null,
        speed: SPEED[0] + random() * (SPEED[1] - SPEED[0]), moving: false, phase: random() * Math.PI * 2, random,
    };
    const [a, b] = [startOf(person), endOf(person)];
    person.heading = headingOf(a, b);
    person.offset = { x: -Math.cos(person.heading) * KEEP_RIGHT, z: Math.sin(person.heading) * KEEP_RIGHT };
    state.people.push(person);
    return person;
};

// Somewhere on a pavement side with nobody close (people step out of the buildings there).
const freeSpot = (state, sides, tries = 8) => {
    for (let i = 0; i < tries; i++) {
        const edge = sides[Math.floor(state.random() * sides.length)];
        const s = 0.3 + state.random() * (edge.length - 0.6);
        if (state.people.every((p) => p.edge !== edge || Math.abs((p.forward ? p.s : edge.length - p.s) - s) > GAP * 2)) return { edge, s };
    }
    return null;
};

/**
 * @param {ReturnType<typeof buildWalkGraph>} walk
 * @param {{ seed?: string, count?: number }} options  count = people already out at the start
 */
export const createPedestrians = (walk, { seed = 'oj-city', count = 0 } = {}) => {
    const state = { seed, walk, people: [], crossing: new Set(), t: 0, nextId: 0, random: createRandom(`${seed}:people`), clock: 0, sides: sideEdges(walk) };
    for (let i = 0; i < count && state.sides.length; i++) {
        const spot = freeSpot(state, state.sides);
        if (!spot) continue;
        const forward = state.random() < 0.5;
        addPerson(state, spot.edge, forward ? spot.s : spot.edge.length - spot.s, { forward, age: FADE });
    }
    return state;
};

// The next edge from the corner a person is walking to: anything but straight back (unless it's a dead end), and
// never a crosswalk straight after one (waiting for it would hold the first crosswalk up).
const chooseNext = (p) => {
    const corner = endOf(p);
    const options = corner.edges.filter((e) => e !== p.edge && !(p.edge.crosswalk && e.crosswalk));
    if (options.length === 0) return p.edge;
    return options[Math.floor(p.random() * options.length)];
};

const mayCross = (state, p, edge, { clock, clear }) => {
    const { crosswalk } = edge;
    if (!crosswalk) return true;
    if (crosswalk.node) {
        const left = redLeft(crosswalk.node, crosswalk.phase, clock);
        // Someone who already missed a whole cycle (turning drivers on the crosswalk) may start later in the red.
        const late = left < RED - WALK_WINDOW && p.waited < SIGNAL_CYCLE;
        if (late || left < edge.length / (p.speed * HURRY) + CROSS_MARGIN) return false;
    }
    // Without lights, give way to drivers close to the line, but only for so long (those not yet committed can stop).
    return clear ? clear(crosswalk.id, crosswalk.node || p.waited > PATIENCE ? 0 : LOOK) : true;
};

/**
 * Advance everyone by `dt` seconds. `target` = how many people should be out (peopleTarget); `clock` = the traffic's
 * time (the lights run on it); `clear(id, look)` = crosswalkClear for the live traffic (omit when there is none).
 * Afterwards `state.crossing` holds the ids of the crosswalks someone is on.
 */
export const stepPedestrians = (state, dt, { target = 0, clock = state.t, clear = null } = {}) => {
    if (!(dt > 0)) return state;
    state.t += dt;
    const ease = Math.min(1, dt * TURN_RATE);

    // Everyone plans against the same positions: the nearest person ahead on the same edge, going the same way.
    const plans = state.people.map((me) => {
        let room = Infinity;
        for (const o of state.people) {
            if (o !== me && o.edge === me.edge && o.forward === me.forward && (o.s > me.s || (o.s === me.s && o.id < me.id))) {
                room = Math.min(room, o.s - me.s - GAP);
            }
        }
        return Math.max(0, Math.min(me.speed * (me.edge.crosswalk ? HURRY : 1) * dt, room));
    });

    const gone = new Set();
    state.people.forEach((me, i) => {
        let ds = plans[i];
        me.age += dt;
        me.scale = me.leaving ? Math.max(0, me.scale - dt / FADE) : Math.min(1, me.age / FADE);
        if (me.leaving && me.scale <= 0) gone.add(me);
        me.next ??= chooseNext(me);
        let waiting = false;
        while (me.s + ds >= me.edge.length) {
            const next = me.next;
            if (next.crosswalk && !mayCross(state, me, next, { clock, clear })) {
                ds = Math.max(0, me.edge.length - me.s);
                waiting = true;
                break;
            }
            const corner = endOf(me);
            ds -= me.edge.length - me.s;
            me.edge = next;
            me.forward = next.a === corner;
            me.s = 0;
            me.next = chooseNext(me);
        }
        me.s += ds;
        me.moving = ds > 1e-4;
        me.waited = waiting ? me.waited + dt : 0;
        me.phase = me.moving ? me.phase + ds * STRIDE : me.phase;

        // Face the way of walking (or the crosswalk while waiting at it); keep right, eased round the corners.
        const toward = waiting ? me.next : null;
        const heading = toward
            ? headingOf(endOf(me), toward.a === endOf(me) ? toward.b : toward.a)
            : headingOf(startOf(me), endOf(me));
        me.heading = turnTowards(me.heading, heading, ease);
        const walkHeading = headingOf(startOf(me), endOf(me));
        me.offset.x += (-Math.cos(walkHeading) * KEEP_RIGHT - me.offset.x) * ease;
        me.offset.z += (Math.sin(walkHeading) * KEEP_RIGHT - me.offset.z) * ease;
    });
    if (gone.size) state.people = state.people.filter((p) => !gone.has(p));

    state.crossing = new Set(state.people.filter((p) => p.edge.crosswalk).map((p) => p.edge.crosswalk.id));

    // Ease the head count to the target: one person steps out or heads indoors at a time (never mid-crossing).
    state.clock += dt;
    if (state.clock >= CHANGE_EVERY) {
        const out = state.people.filter((p) => !p.leaving);
        if (out.length < target && state.sides.length) {
            const spot = freeSpot(state, state.sides);
            if (spot) {
                const forward = state.random() < 0.5;
                addPerson(state, spot.edge, forward ? spot.s : spot.edge.length - spot.s, { forward, age: 0 });
            }
            state.clock = 0;
        } else if (out.length > target) {
            const candidates = out.filter((p) => !p.edge.crosswalk);
            if (candidates.length) candidates[Math.floor(state.random() * candidates.length)].leaving = true;
            state.clock = 0;
        }
    }
    return state;
};

/** Where a person walks the line (no keep-right offset): used by the tests and by personPose. */
export const personOnLine = (p) => {
    const [a, b] = [startOf(p), endOf(p)];
    const t = p.edge.length > 0 ? Math.min(1, p.s / p.edge.length) : 0;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
};

/** Where to draw a person: ground position, heading (rotationY; 0 faces +z), gait phase and stride (0 standing). */
export const personPose = (p) => {
    const { x, z } = personOnLine(p);
    return { x: x + p.offset.x, z: z + p.offset.z, rotationY: p.heading, phase: p.phase, stride: p.moving ? 0.5 : 0, scale: p.scale };
};

/** People waiting at the taxi/bus stops (streetProps().stops): two in front of each shelter, facing the road. */
export const stopWaiters = (stops) => stops.flatMap((stop, i) => [-0.35, 0.3].map((along, k) => {
    const [c, s] = [Math.cos(stop.rotationY), Math.sin(stop.rotationY)];
    const front = 0.75 + k * 0.12;
    // Local (along, front) turned by rotationY: local +x → (cos, −sin), local +z → (sin, cos).
    return { id: `stop-${i}-${k}`, x: stop.x + along * c + front * s, z: stop.z - along * s + front * c, rotationY: stop.rotationY + (k ? 0.4 : -0.2) };
}));
