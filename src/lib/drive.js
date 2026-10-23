// Drive mode (P3B-09, design_system.md → "Interactive city"): you drive a taxi or a bendskin yourself. Pure and
// deterministic, no three.js; src/city/Drive.jsx steps it every frame, Traffic.jsx draws your vehicle and CameraRig
// follows it. Arcade handling (not a physics model), collisions against simple shapes on the ground, and the trackers
// for the two drive eggs (every district, every set of lights without a red).
// Owner (2026-10-23): roads and grass are drivable; pavements, buildings, plots, props and houses are solid.
// Vehicle frame as in vehicles.js: facing +z; rotationY turns it, and a positive turn is to the left.
import { footprintsOverlap } from './traffic.js';
import { VEHICLE_TYPES } from './vehicles.js';
import { streetProps } from './streetProps.js';
import { lampSpots } from './lamps.js';
import { careerSigns, SIGN } from './careerRoad.js';
import { ABOUT_HOUSE, aboutHouseSpot } from './aboutContent.js';
import { animalPens } from './animals.js';
import { outskirts, SIGN_POST } from './outskirts.js';
import { signalPoles, signalState } from './roadGraph.js';
import { toWorld } from './passenger.js';
import { STREET } from './layout.js';

export const DRIVABLE = ['taxi', 'moto'];
// Units/s and per second. Traffic cruises at 2–3.2; you may go a little faster. `turn` = rad/s at full lock.
export const HANDLING = {
    taxi: { max: 4, reverse: 1.2, accel: 2.4, brake: 6, coast: 1, turn: 2, steerRate: 4 },
    moto: { max: 4.4, reverse: 0.8, accel: 3, brake: 6.5, coast: 1, turn: 2.6, steerRate: 5 },
    // The police car after you (P3B-11, chase.js): faster than the taxi, slower than the bendskin, and it turns wider.
    police: { max: 4.2, reverse: 1.2, accel: 2.6, brake: 6, coast: 1, turn: 1.8, steerRate: 4 },
};
export const GRASS = 0.6; // share of the top speed off the road
const SCRAPE = 3; // deceleration while sliding along something (times the share of the move lost)
const SUBSTEP = 0.12; // never move further than this in one go, so thin things (lamps, posts) can't be skipped
const GRID = 4;
// Collision shapes (smaller than the props' placement clearances, which keep room around them).
const R = { lamp: 0.1, pole: 0.1, post: 0.1, tree: 0.22, palm: 0.16, kiosk: 0.5, person: 0.14, pen: 0.2 };
export const VISIT = 3; // a district counts once you are this close to its plot
export const NEAR = { distance: 4, speed: 0.5 }; // "Enter: open <project>" when stopped this close to a building
// Chase view: behind you, up a little, looking a little ahead; it comes in closer when a building is behind you.
export const CHASE = { back: 3.2, height: 1.4, ahead: 1.6, lookY: 0.35, minBack: 0.8, fov: 60, near: 0.05, follow: 4 };
// Your eyes in the driver's seat (left-hand side), sat a little further back than the passenger, so the wheel
// (TaxiCabin DRIVE_WHEEL) sits low in the view instead of filling the windscreen.
export const DRIVER_EYE = { x: 0.1, y: 0.39, z: -0.11 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const toward = (v, target, rate) => (v < target ? Math.min(target, v + rate) : Math.max(target, v - rate));

// Shapes are footprints as in traffic.js ({ x, z, ax, hl, hw }: a rectangle along ax) or circles ({ x, z, r }).
const aabb = (r) => ({ x: r.x, z: r.z, ax: { x: 0, z: 1 }, hl: r.depth / 2, hw: r.width / 2 });
const oriented = (x, z, rotationY, width, depth) => ({ x, z, ax: { x: Math.sin(rotationY), z: Math.cos(rotationY) }, hl: depth / 2, hw: width / 2 });
const local = (pose, x, z) => toWorld(pose, { x, z });
const reachOf = (s) => (s.r ?? Math.hypot(s.hl, s.hw));

/** Rectangle vs circle. */
const touchesCircle = (f, c) => {
    const dx = c.x - f.x;
    const dz = c.z - f.z;
    const along = clamp(dx * f.ax.x + dz * f.ax.z, -f.hl, f.hl);
    const side = clamp(-dx * f.ax.z + dz * f.ax.x, -f.hw, f.hw);
    const px = f.x + f.ax.x * along - f.ax.z * side;
    const pz = f.z + f.ax.z * along + f.ax.x * side;
    return Math.hypot(c.x - px, c.z - pz) < c.r;
};
/** Does footprint f touch solid shape s (a footprint or a circle)? */
export const touches = (f, s) => (s.r !== undefined ? touchesCircle(f, s) : footprintsOverlap(f, s));

/**
 * Everything solid for a car in this city, in a grid, plus the roads (drivable at full speed), the drive bounds and
 * the signalled crossings. Built once per layout.
 * @param {object} layout  layoutCity() output
 * @param {{ roles?: number, graph?: object }} options  roles = Career Road signs; graph = roadGraphFor(layout)
 */
export const driveWorld = (layout, { roles = 0, graph = null } = {}) => {
    const shapes = [];
    const add = (shape) => shapes.push(shape);
    for (const r of [...layout.pavements, ...layout.districts]) add(aabb(r));

    const props = streetProps(layout, { roles });
    if (props.fuel) {
        // You can drive under the canopy, between the pumps; the pumps, the canopy posts, the shop and the sign are solid.
        const f = props.fuel;
        const at = (x, z, w, d) => { const p = local(f, x, z); add(oriented(p.x, p.z, f.rotationY, w, d)); };
        for (const x of [-1, 1]) at(x, 1, 0.5, 1.6);
        for (const [x, z] of [[-2, -0.2], [2, -0.2], [-2, 1.8], [2, 1.8]]) at(x, z, 0.2, 0.2);
        at(-1.6, -1.8, 3.2, 2);
        at(3.4, 2.6, 0.2, 0.2);
    }
    for (const b of props.billboards) for (const x of [-1.2, 1.2]) add({ ...local(b, x, -0.12), r: R.post });
    for (const s of props.stops) {
        const c = local(s, 0, 0);
        add(oriented(c.x, c.z, s.rotationY, 1.95, 0.95));
        add({ ...local(s, 1.3, 0.45), r: R.post });
    }
    for (const k of props.kiosks) add(oriented(k.x, k.z, k.rotationY, 1, 0.7));
    for (const b of props.benches) add(oriented(b.x, b.z, b.rotationY, 1, 0.4));
    for (const t of props.trees) add({ x: t.x, z: t.z, r: R.tree });
    for (const p of props.palms) add({ x: p.x, z: p.z, r: R.palm });
    for (const l of lampSpots(layout)) add({ x: l.x, z: l.z, r: R.lamp });

    const career = layout.roads.find((r) => r.kind === 'career');
    if (career) {
        for (const sign of careerSigns(roles, career)) {
            for (const x of [-1, 1]) add({ ...local(sign, x * (SIGN.width / 2 - SIGN.postInset), 0), r: R.post });
        }
        const about = aboutHouseSpot(career);
        add(oriented(about.x, about.z, ABOUT_HOUSE.facing, 4.4, 3.6));
    }
    for (const pen of animalPens(layout, { roles })) add({ x: pen.x, z: pen.z, r: pen.radius + R.pen });

    const { houses, sign } = outskirts(layout);
    for (const h of houses) {
        const c = local(h, 0, h.front / 2);
        add(oriented(c.x, c.z, h.rotationY, h.width + (h.fence ? 0.7 : 0), h.depth + h.front));
    }
    for (const x of [-1, 1]) add({ ...local(sign, x * (SIGN_POST.width / 2 - 0.2), 0), r: R.post });
    if (graph) for (const p of signalPoles(graph)) add({ x: p.x, z: p.z, r: R.pole });

    const grid = new Map();
    for (const s of shapes) {
        const r = reachOf(s);
        for (let i = Math.floor((s.x - r) / GRID); i <= Math.floor((s.x + r) / GRID); i++) {
            for (let j = Math.floor((s.z - r) / GRID); j <= Math.floor((s.z + r) / GRID); j++) {
                const key = `${i},${j}`;
                if (!grid.has(key)) grid.set(key, []);
                grid.get(key).push(s);
            }
        }
    }
    const signals = graph ? graph.nodes.filter((n) => n.control === 'signal') : [];
    return {
        layout, grid, shapes, roads: layout.roads, bounds: layout.outskirts, signals,
        start: startSpot(layout),
    };
};

const near = (world, x, z, r) => {
    const out = new Set();
    for (let i = Math.floor((x - r) / GRID); i <= Math.floor((x + r) / GRID); i++) {
        for (let j = Math.floor((z - r) / GRID); j <= Math.floor((z + r) / GRID); j++) {
            for (const s of world.grid.get(`${i},${j}`) ?? []) out.add(s);
        }
    }
    return out;
};

/** Is ({ x, z }) on a road (full speed) rather than grass? */
export const onRoad = (world, { x, z }) => world.roads.some((r) => Math.abs(x - r.x) <= r.width / 2 && Math.abs(z - r.z) <= r.depth / 2);

/** Your vehicle's body on the ground at `pose`. */
export const carFootprint = (car, pose = car) => oriented(pose.x, pose.z, pose.rotationY, car.width, car.length);

/**
 * What a car at `pose` would touch: 'edge' (the end of OJ City), a { vehicle } from `others`, 'person', 'solid', or
 * null. `others` = { vehicles: { id, foot }[], people: { x, z }[] } (the live traffic and pedestrians).
 */
export const collision = (world, car, pose, others = {}) => {
    const f = carFootprint(car, pose);
    const reach = Math.hypot(f.hl, f.hw);
    const { minX, maxX, minZ, maxZ } = world.bounds;
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
            const x = f.x + f.ax.x * f.hl * sz - f.ax.z * f.hw * sx;
            const z = f.z + f.ax.z * f.hl * sz + f.ax.x * f.hw * sx;
            if (x < minX || x > maxX || z < minZ || z > maxZ) return 'edge';
        }
    }
    for (const v of others.vehicles ?? []) if (footprintsOverlap(f, v.foot)) return { vehicle: v.id };
    for (const p of others.people ?? []) if (touchesCircle(f, { x: p.x, z: p.z, r: R.person })) return 'person';
    for (const s of near(world, f.x, f.z, reach)) if (touches(f, s)) return 'solid';
    return null;
};

// Where you start: Career Road's northbound lane (drive on the right: east of the centre line) by the entrance.
const startSpot = (layout) => {
    const career = layout.roads.find((r) => r.kind === 'career');
    return { x: career.x + career.width / 4, z: layout.entrance.z - 3, rotationY: Math.PI };
};

/**
 * A new car of `type` ('taxi' | 'moto') on Career Road by the entrance, facing downtown; further up the road if
 * someone is in the way (null if the whole road is busy).
 */
export const createCar = (world, type, others = {}) => {
    const kit = VEHICLE_TYPES[type];
    const car = { type, length: kit.length, width: kit.width, v: 0, steer: 0, braking: false, ...world.start };
    const career = world.layout.roads.find((r) => r.kind === 'career');
    for (let back = 0; back < career.depth - 4; back += 0.5) {
        const pose = { ...world.start, z: world.start.z - back };
        if (!collision(world, car, pose, others)) return Object.assign(car, pose);
    }
    return null;
};

/**
 * Drive for `dt` s. `input` = { throttle: −1…1 (back…forward), steer: −1…1 (right…left), brake: boolean }.
 * The car never moves into anything: it slides along walls when it can, else stops. Returns what it touched
 * (see collision), or null.
 */
export const stepCar = (world, car, input, dt, others = {}) => {
    if (!(dt > 0)) return null;
    const h = HANDLING[car.type];
    const throttle = clamp(input.throttle ?? 0, -1, 1);
    const steerIn = clamp(input.steer ?? 0, -1, 1);
    car.steer = toward(car.steer, steerIn, h.steerRate * dt);
    const top = h.max * (onRoad(world, car) ? 1 : GRASS);
    let v = car.v;
    if (input.brake) v = toward(v, 0, h.brake * dt);
    else if (throttle > 0) v = v < 0 ? toward(v, 0, h.brake * throttle * dt) : Math.min(top, v + h.accel * throttle * dt);
    else if (throttle < 0) v = v > 0 ? toward(v, 0, h.brake * -throttle * dt) : Math.max(-h.reverse, v + h.accel * 0.6 * throttle * dt);
    else v = toward(v, 0, h.coast * dt);
    if (v > top) v = toward(v, top, h.brake * 0.5 * dt); // off the road onto the grass: slow down
    car.braking = Boolean(input.brake) || Math.abs(v) < Math.abs(car.v) - 0.01 || Math.abs(v) < 0.05;
    car.v = v;

    // Turning needs speed, and tightens as you slow down; backwards it turns the other way, as a car does.
    const grip = clamp(Math.abs(v) / 1.2, 0, 1) * (1 - 0.3 * Math.abs(v) / h.max);
    const yaw = car.steer * h.turn * grip * Math.sign(v);
    const steps = Math.max(1, Math.ceil((Math.abs(v) * dt) / SUBSTEP));
    let hit = null;
    let lost = 0;
    for (let i = 0; i < steps; i++) {
        const d = (v * dt) / steps;
        const r = car.rotationY + (yaw * dt) / steps;
        const dx = Math.sin(r) * d;
        const dz = Math.cos(r) * d;
        const tries = [
            { x: car.x + dx, z: car.z + dz, rotationY: r },
            { x: car.x + dx, z: car.z, rotationY: r },
            { x: car.x, z: car.z + dz, rotationY: r },
            { x: car.x + dx, z: car.z, rotationY: car.rotationY },
            { x: car.x, z: car.z + dz, rotationY: car.rotationY },
        ];
        const first = collision(world, car, tries[0], others);
        if (!first) {
            Object.assign(car, tries[0]);
            continue;
        }
        hit = first;
        // Slide along whatever it was; head-on (hardly any sideways part) it just stops.
        const slide = tries.slice(1).find((p) => Math.hypot(p.x - car.x, p.z - car.z) > Math.abs(d) * 0.2 && !collision(world, car, p, others));
        if (slide) {
            lost = Math.max(lost, 1 - Math.min(1, Math.hypot(slide.x - car.x, slide.z - car.z) / Math.max(1e-9, Math.abs(d))));
            Object.assign(car, slide);
        } else {
            car.v = 0;
            return hit;
        }
    }
    if (lost > 0) car.v = toward(car.v, 0, lost * SCRAPE * dt);
    return hit;
};

/** Where to put the chase camera for a car at `pose`, with the camera's own (smoothed) `heading`. */
export const chaseView = (pose, heading, lots = []) => {
    const dir = { x: Math.sin(heading), z: Math.cos(heading) };
    const inside = ({ x, y, z }) => lots.some((lot) => Math.abs(x - lot.x) < lot.building.width / 2 + 0.25
        && Math.abs(z - lot.z) < lot.building.depth / 2 + 0.25 && y < lot.building.height + 0.3);
    let eye = null;
    for (let back = CHASE.back; back >= CHASE.minBack - 1e-9; back -= 0.2) {
        const height = CHASE.height * Math.max(0.5, back / CHASE.back);
        eye = { x: pose.x - dir.x * back, y: height, z: pose.z - dir.z * back };
        // The camera and the line from it to the car must be clear of buildings.
        const clear = [0.25, 0.5, 0.75, 1].every((t) => !inside({ x: pose.x + (eye.x - pose.x) * t, y: CHASE.lookY + (eye.y - CHASE.lookY) * t, z: pose.z + (eye.z - pose.z) * t }));
        if (clear) break;
    }
    return { eye, target: { x: pose.x + dir.x * CHASE.ahead, y: CHASE.lookY, z: pose.z + dir.z * CHASE.ahead } };
};

/** The project building you are stopped next to (its slug), or null. */
export const nearBuilding = (world, car) => {
    if (Math.abs(car.v) > NEAR.speed) return null;
    let best = null;
    for (const lot of world.layout.lots) {
        const d = Math.hypot(lot.x - car.x, lot.z - car.z);
        if (d <= NEAR.distance && (!best || d < best.d)) best = { slug: lot.slug, d };
    }
    return best?.slug ?? null;
};

/** The districts a drive can visit: downtown and every plot (Cinema, School, Arcade, Pitch, Market). */
export const driveDistricts = (layout) => ['downtown', ...layout.districts.map((d) => d.id)];

/** Which district ({ x, z }) is in, if any: within VISIT of a plot, or on downtown's streets. */
export const districtAt = (layout, { x, z }) => {
    for (const d of layout.districts) {
        const dx = Math.max(0, Math.abs(x - d.x) - d.width / 2);
        const dz = Math.max(0, Math.abs(z - d.z) - d.depth / 2);
        if (Math.hypot(dx, dz) <= VISIT) return d.id;
    }
    const { downtown } = layout;
    const half = downtown.size / 2 + STREET;
    return Math.abs(x - downtown.x) <= half && Math.abs(z - downtown.z) <= half ? 'downtown' : null;
};

/** One drive's progress towards the eggs. */
export const createTrip = () => ({ visited: new Set(), passed: new Set(), inside: null, ranCount: 0 });

const boxOf = (node) => ({ hx: node.halfX, hz: node.halfZ });
const inBox = (node, p) => { const { hx, hz } = boxOf(node); return Math.abs(p.x - node.x) < hx && Math.abs(p.z - node.z) < hz; };

/**
 * After each step: note the district you're in and the crossings you go through. Entering a crossing's box while
 * your way's light is red counts as running it (amber is fine) and clears the crossings passed so far.
 * `t` = the traffic clock (the lights run on it).
 * @returns {{ ranRed: boolean, district: string | null, tour: boolean, lights: boolean }} tour / lights = that egg
 *   is complete now
 */
export const trackTrip = (world, trip, car, t) => {
    const district = districtAt(world.layout, car);
    if (district) trip.visited.add(district);
    let ranRed = false;
    const was = trip.inside;
    const node = world.signals.find((n) => inBox(n, car)) ?? null;
    if (node && node.id !== was?.id) {
        const phase = Math.abs(Math.sin(car.rotationY)) > Math.abs(Math.cos(car.rotationY)) ? 'ew' : 'ns';
        ranRed = signalState(node, t)[phase] === 'red';
        trip.inside = { id: node.id, ok: !ranRed };
        if (ranRed) {
            trip.passed.clear();
            trip.ranCount++;
        }
    } else if (!node && was) {
        if (was.ok) trip.passed.add(was.id);
        trip.inside = null;
    }
    const all = driveDistricts(world.layout);
    return {
        ranRed,
        district,
        tour: all.every((id) => trip.visited.has(id)),
        lights: world.signals.length > 0 && world.signals.every((n) => trip.passed.has(n.id)),
    };
};
