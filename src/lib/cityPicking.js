// Clicks on moving things (P3B-06): vehicles, animals and signal poles are hit-tested against simple shapes here, not
// their meshes (three works out an instanced mesh's bounds once, so clicks would miss as they drive away).
// Pure, no three.js: a ray is { origin: {x, y, z}, direction: {x, y, z} } (direction normalised).
import { VEHICLE_TYPES } from './vehicles.js';
import { vehiclePose } from './traffic.js';

// Generous: the targets are small on screen. Motos are thin, so every body is at least MIN_HALF wide.
export const PICK = { pad: 0.1, minHalf: 0.25, goat: { y: 0.2, r: 0.32 }, chicken: { y: 0.12, r: 0.24 }, pole: { half: 0.2, height: 1.8 } };

/**
 * Distance along the ray to an upright box (centre x/z on the ground, turned rotationY, half sizes hw across and hl
 * along, from y0 to y1), or null when it misses. Slab test in the box's own axes.
 */
export const rayBox = (ray, { x, z, rotationY, hw, hl, y0 = 0, y1 }) => {
    const { origin: o, direction: d } = ray;
    const along = { x: Math.sin(rotationY), z: Math.cos(rotationY) };
    const across = { x: along.z, z: -along.x };
    const rel = { x: o.x - x, z: o.z - z };
    const slabs = [
        [rel.x * across.x + rel.z * across.z, d.x * across.x + d.z * across.z, -hw, hw],
        [o.y, d.y, y0, y1],
        [rel.x * along.x + rel.z * along.z, d.x * along.x + d.z * along.z, -hl, hl],
    ];
    let near = 0;
    let far = Infinity;
    for (const [p, v, lo, hi] of slabs) {
        if (Math.abs(v) < 1e-12) {
            if (p < lo || p > hi) return null;
            continue;
        }
        const [a, b] = [(lo - p) / v, (hi - p) / v];
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
        if (near > far) return null;
    }
    return near;
};

/** Distance along the ray to a sphere, or null. */
export const raySphere = (ray, { x, y, z }, r) => {
    const { origin: o, direction: d } = ray;
    const [px, py, pz] = [o.x - x, o.y - y, o.z - z];
    const b = px * d.x + py * d.y + pz * d.z;
    const c = px * px + py * py + pz * pz - r * r;
    const disc = b * b - c;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    return t >= 0 ? t : c <= 0 ? 0 : null;
};

const nearest = (items, hit) => {
    let best = null;
    for (const item of items) {
        const distance = hit(item);
        if (distance !== null && (!best || distance < best.distance)) best = { item, distance };
    }
    return best;
};

/** The nearest vehicle the ray hits: { item: vehicle, distance } or null. Fading ones are skipped. */
export const pickVehicle = (vehicles, ray) => nearest(vehicles.filter((v) => v.scale > 0.5), (v) => {
    const pose = vehiclePose(v);
    const kit = VEHICLE_TYPES[v.type];
    return rayBox(ray, {
        x: pose.x, z: pose.z, rotationY: pose.rotationY, y1: kit.height + PICK.pad,
        hw: Math.max(PICK.minHalf, v.width / 2 + PICK.pad), hl: v.length / 2 + PICK.pad,
    });
});

/** The nearest animal the ray hits (animals.js state.animals). */
export const pickAnimal = (animals, ray) => nearest(animals.filter((a) => a.scale > 0.5), (a) => {
    const { y, r } = PICK[a.kind];
    return raySphere(ray, { x: a.x, y, z: a.z }, r);
});

/** The nearest signal pole the ray hits (roadGraph.js signalPoles). */
export const pickPole = (poles, ray) => nearest(poles, (p) => rayBox(ray, {
    x: p.x, z: p.z, rotationY: 0, hw: PICK.pole.half, hl: PICK.pole.half, y1: PICK.pole.height,
}));
