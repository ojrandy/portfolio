// Animals (P3B-04, design_system.md → "Interactive city"): goats and chickens at the edge of town, either side of
// Career Road near the entrance. Pure and deterministic (seeded), no three.js; src/city/Animals.jsx draws them.
// Each herd or flock has a pen (a circle on the grass, never drawn) at the first free spot near its anchor, clear of
// roads, blocks, district plots, lamps, the Career Road signs, the About house, the street props and earlier pens.
// Inside it each animal wanders to a random point, then grazes or pecks a while. At night the chickens go to roost
// (fade out) and the goats stand still. P3B-08's outskirts can move the anchors further out.
import { lampSpots } from './lamps.js';
import { careerSigns, SIGN } from './careerRoad.js';
import { ABOUT_HOUSE, aboutHouseSpot } from './aboutContent.js';
import { FUEL, PROP_RADIUS, streetProps } from './streetProps.js';
import { createRandom } from './random.js';

// side: −1 west of Career Road, 1 east; out: from the road's edge; back: north of the entrance.
export const HERDS = [
    { kind: 'goat', count: 3, radius: 2.4, side: -1, out: 5, back: 6 },
    { kind: 'goat', count: 3, radius: 2.4, side: -1, out: 9, back: 14 },
    { kind: 'chicken', count: 5, radius: 1.6, side: 1, out: 9, back: 4 },
    { kind: 'chicken', count: 4, radius: 1.6, side: -1, out: 3.5, back: 11 },
];
export const SPEED = { goat: 0.3, chicken: 0.45 };
const REST = { goat: [3, 8], chicken: [1, 3.5] };
const GAIT = { goat: 30, chicken: 70 }; // gait phase (radians) per unit walked
const GRAZE = { goat: 0.9, chicken: 0.8 }; // how far the head bows (radians)
const ROOST_FADE = 1.5; // seconds for the chickens to go to roost or come back out
const TURN_RATE = 5;
const SPACING = 0.35; // animals don't pick a spot this close to another one
const PEN_MARGIN = 0.4;
const STEP = 0.5; // candidate grid spacing
const SEARCH = 20; // look this far around the anchor
const LAMP_RADIUS = 0.3;
// Clicked (P3B-06): a goat stops and looks at you for LOOK_TIME s; a chicken scurries FLEE away, FLEE_SPEED × as fast.
export const POKE = { lookTime: 2.5, flee: 1.4, fleeSpeed: 3.5 };

const rectOf = (r, pad = 0) => ({ x0: r.x - r.width / 2 - pad, x1: r.x + r.width / 2 + pad, z0: r.z - r.depth / 2 - pad, z1: r.z + r.depth / 2 + pad });
const distToRect = (x, z, r) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));

/** Everything a pen must keep clear of: rectangles and circles on the ground. */
export const animalObstacles = (layout, { roles = 0 } = {}) => {
    const career = layout.roads.find((r) => r.kind === 'career');
    const props = streetProps(layout, { roles });
    const rects = [...layout.roads, ...layout.pavements, ...layout.districts].map((r) => rectOf(r));
    if (props.fuel) rects.push(rectOf({ ...props.fuel, width: FUEL.width, depth: FUEL.depth }, 0.3));
    const circles = [
        ...lampSpots(layout).map(({ x, z }) => ({ x, z, r: LAMP_RADIUS })),
        ...careerSigns(roles, career).map(({ x, z }) => ({ x, z, r: SIGN.width / 2 + 0.2 })),
        { ...aboutHouseSpot(career), r: ABOUT_HOUSE.radius },
        ...props.billboards.map((p) => ({ ...p, r: PROP_RADIUS.billboard })),
        ...props.stops.map((p) => ({ ...p, r: PROP_RADIUS.stop })),
        ...props.kiosks.map((p) => ({ ...p, r: PROP_RADIUS.kiosk })),
        ...props.palms.map((p) => ({ ...p, r: PROP_RADIUS.palm })),
        ...props.benches.map((p) => ({ ...p, r: PROP_RADIUS.bench })),
        ...props.trees.map((p) => ({ ...p, r: PROP_RADIUS.tree })),
    ];
    return { rects, circles };
};

/**
 * Pens for the herds and flocks (a herd that finds no room is left out).
 * @returns {{ id: string, kind: 'goat' | 'chicken', count: number, x: number, z: number, radius: number }[]}
 */
export const animalPens = (layout, { roles = 0 } = {}) => {
    const career = layout.roads.find((r) => r.kind === 'career');
    const { bounds } = layout;
    const { rects, circles } = animalObstacles(layout, { roles });
    const end = career.z + career.depth / 2;
    const free = (x, z, r) => x - r >= bounds.minX && x + r <= bounds.maxX && z - r >= bounds.minZ && z + r <= bounds.maxZ
        && rects.every((rect) => distToRect(x, z, rect) >= r)
        && circles.every((c) => Math.hypot(x - c.x, z - c.z) >= r + c.r);

    return HERDS.flatMap((herd, i) => {
        const anchor = { x: career.x + herd.side * (career.width / 2 + herd.out), z: end - herd.back };
        const r = herd.radius + PEN_MARGIN;
        const grid = [];
        for (let dx = -SEARCH; dx <= SEARCH; dx += STEP) for (let dz = -SEARCH; dz <= SEARCH; dz += STEP) grid.push({ x: anchor.x + dx, z: anchor.z + dz });
        const spot = grid
            .map((p) => ({ ...p, d: Math.hypot(p.x - anchor.x, p.z - anchor.z) }))
            .sort((a, b) => a.d - b.d || a.x - b.x || a.z - b.z)
            .find((p) => free(p.x, p.z, r));
        if (!spot) return [];
        circles.push({ x: spot.x, z: spot.z, r });
        return [{ id: `${herd.kind}-${i}`, kind: herd.kind, count: herd.count, x: spot.x, z: spot.z, radius: herd.radius }];
    });
};

const inPen = (pen, random, margin = 0.2) => {
    const a = random() * Math.PI * 2;
    const d = Math.sqrt(random()) * (pen.radius - margin);
    return { x: pen.x + Math.cos(a) * d, z: pen.z + Math.sin(a) * d };
};

/** @param {ReturnType<typeof animalPens>} pens */
export const createAnimals = (pens, { seed = 'oj-city' } = {}) => {
    const animals = pens.flatMap((pen) => Array.from({ length: pen.count }, (_, i) => {
        const random = createRandom(`${seed}:${pen.id}:${i}`);
        const at = inPen(pen, random);
        return {
            id: `${pen.id}-${i}`, kind: pen.kind, pen, x: at.x, z: at.z, heading: random() * Math.PI * 2, target: null, look: null, fleeing: false,
            rest: random() * REST[pen.kind][1], phase: random() * Math.PI * 2, head: 0, moving: false, scale: 1, t: random() * 10, random,
        };
    }));
    return { animals };
};

const pickTarget = (state, me) => {
    for (let i = 0; i < 6; i++) {
        const p = inPen(me.pen, me.random);
        if (Math.hypot(p.x - me.x, p.z - me.z) < 0.4) continue;
        const crowded = state.animals.some((o) => o !== me && (Math.hypot(o.x - p.x, o.z - p.z) < SPACING
            || (o.target && Math.hypot(o.target.x - p.x, o.target.z - p.z) < SPACING)));
        if (!crowded) return p;
    }
    return null;
};

/** Advance the animals by `dt` seconds. `night` true: chickens roost, goats stand still. */
export const stepAnimals = (state, dt, { night = false } = {}) => {
    if (!(dt > 0)) return state;
    const ease = Math.min(1, dt * TURN_RATE);
    for (const me of state.animals) {
        me.t += dt;
        if (me.kind === 'chicken') me.scale = Math.max(0, Math.min(1, me.scale + (night ? -dt : dt) / ROOST_FADE));
        if (me.look) {
            // Poked goat: turn to face whoever clicked, head up.
            me.look.left -= dt;
            const want = Math.atan2(me.look.x - me.x, me.look.z - me.z);
            me.heading += Math.atan2(Math.sin(want - me.heading), Math.cos(want - me.heading)) * ease;
            me.head += (0 - me.head) * ease;
            me.moving = false;
            if (me.look.left <= 0) me.look = null;
            continue;
        }
        if (night && !me.fleeing) {
            me.moving = false;
            me.head += (0 - me.head) * ease;
            continue;
        }
        if (me.target) {
            const dx = me.target.x - me.x;
            const dz = me.target.z - me.z;
            const d = Math.hypot(dx, dz);
            const want = Math.atan2(dx, dz);
            me.heading += Math.atan2(Math.sin(want - me.heading), Math.cos(want - me.heading)) * ease;
            const step = Math.min(d, SPEED[me.kind] * (me.fleeing ? POKE.fleeSpeed : 1) * dt);
            me.x += (dx / (d || 1)) * step;
            me.z += (dz / (d || 1)) * step;
            me.phase += step * GAIT[me.kind];
            me.moving = true;
            me.head += (0 - me.head) * ease;
            if (d - step < 0.02) {
                me.target = null;
                me.fleeing = false;
                const [lo, hi] = REST[me.kind];
                me.rest = lo + me.random() * (hi - lo);
            }
        } else {
            me.moving = false;
            // Goats keep their heads down grazing; chickens peck in quick bursts.
            const bow = me.kind === 'goat' ? GRAZE.goat : GRAZE.chicken * Math.max(0, Math.sin(me.t * 9)) * (Math.sin(me.t * 1.3) > 0 ? 1 : 0);
            me.head += (bow - me.head) * Math.min(1, dt * (me.kind === 'goat' ? 2 : 14));
            me.rest -= dt;
            if (me.rest <= 0) {
                me.target = pickTarget(state, me);
                if (!me.target) me.rest = 1;
            }
        }
    }
    return state;
};

/**
 * Someone clicked animal `me` from `from` ({ x, z }, the camera): a goat turns to look, a chicken runs off
 * (staying in its pen). Returns the kind, for the sound and the speech bubble.
 */
export const pokeAnimal = (me, from) => {
    if (me.kind === 'goat') {
        me.look = { x: from.x, z: from.z, left: POKE.lookTime };
        me.target = null;
        return 'goat';
    }
    const away = Math.atan2(me.x - from.x, me.z - from.z);
    let x = me.x + Math.sin(away) * POKE.flee;
    let z = me.z + Math.cos(away) * POKE.flee;
    const room = me.pen.radius - 0.2;
    const d = Math.hypot(x - me.pen.x, z - me.pen.z);
    if (d > room) [x, z] = [me.pen.x + ((x - me.pen.x) / d) * room, me.pen.z + ((z - me.pen.z) / d) * room];
    me.target = { x, z };
    me.fleeing = true;
    return 'chicken';
};

/** Where to draw an animal: ground position, heading (rotationY), gait phase, stride, head bow and scale. */
export const animalPose = (a) => ({ x: a.x, z: a.z, rotationY: a.heading, phase: a.phase, stride: a.moving ? 0.6 : 0, head: a.head, scale: a.scale });
