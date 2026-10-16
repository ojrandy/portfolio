// Fako (Mount Cameroon), sky and fog as plain data (P1-04). Rendered by src/city/Backdrop.jsx.
// Fako is north (−z) of the city; the camera looks at it up Career Road, as Buea looks up at the mountain.
import { COLORS, mixHex } from './palette.js';
import { createRandom } from './random.js';
import { LAYOUT_COLORS } from './layout.js';

export const FAKO = {
    length: 230, // semi-axis along the SW–NE ridge
    width: 110, // semi-axis across it
    height: 72,
    angle: 0.3, // ridge tilt from east–west (rad); the east end recedes north
    offsetX: -25, // summit a little west of Career Road
    margin: 45, // gap between the city's north edge and the foot
    rings: 24,
    segments: 64,
    cones: 7, // cinder cones along the ridge
    seed: 'fako',
};

// Normalised height (0 foot → 1 summit) at elliptical distance d (0 centre → 1 rim); flat-topped.
const PEAK = 1.12;
const SLOPE = 1.6;
const profile = (d) => Math.min(1, PEAK * (1 - d) ** SLOPE);
const distanceAt = (t) => 1 - (t / PEAK) ** (1 / SLOPE);

const RIM_Y = -2; // the rim sits below the ground so no edge floats
const JITTER = 0.025; // per-vertex height noise (× height) for the low-poly look

export const FAKO_COLORS = {
    forest: mixHex(COLORS.fakoGreen, COLORS.basalt, 0.35),
    grass: mixHex(COLORS.ash, COLORS.fakoGreen, 0.3),
    rock: mixHex(COLORS.basalt, COLORS.ash, 0.5),
};

// The night sky; src/lib/dayNight.js blends it with the other times of day.
export const SKY_NIGHT = {
    zenith: mixHex(COLORS.basalt, COLORS.indigo, 0.3),
    horizon: mixHex(mixHex(COLORS.basalt, COLORS.indigo, 0.6), COLORS.mist, 0.18),
    mist: mixHex(COLORS.mist, COLORS.indigo, 0.25),
};

export const SKY_RADIUS = 900; // the dome follows the camera
export const GROUND_SIZE = 2000;
export const GROUND_Y = -0.05; // just under the roads, so the far camera plane can't make them flicker
export const FOG = { near: 60, far: 600 }; // linear; the ground meets the sky horizon colour by `far`

// Mist band: normalised heights it covers on the slope, and how far it stands off the surface.
export const MIST = { from: 0.28, to: 0.5, offset: 1.08, opacity: 0.4 };

const toRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const smooth = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
};

// The foot fades in from the ground colour so the mountain has no hard edge.
const slopeColor = (t) => {
    const ground = toRgb(LAYOUT_COLORS.ground);
    const forest = toRgb(FAKO_COLORS.forest);
    const grass = toRgb(FAKO_COLORS.grass);
    const rock = toRgb(FAKO_COLORS.rock);
    const lower = lerp(ground, forest, smooth(0, 0.15, t));
    return lerp(lerp(lower, grass, smooth(0.3, 0.5, t)), rock, smooth(0.55, 0.8, t));
};

/**
 * Low-poly mountain in local space (ridge along +x, centre at the origin), sRGB vertex colours.
 * Ring order goes x → −z so triangles face up.
 */
export const fakoMesh = ({ length, width, height, rings, segments, cones, seed } = FAKO) => {
    const random = createRandom(seed);
    const bumps = Array.from({ length: cones }, () => ({
        u: (random() * 2 - 1) * 0.75,
        v: (random() * 2 - 1) * 0.25,
        r: 0.05 + random() * 0.05,
        h: 0.03 + random() * 0.04,
    }));

    const count = 1 + rings * segments;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const put = (i, u, v, d) => {
        let y;
        if (d >= 1) {
            y = RIM_Y;
        } else {
            let t = profile(d);
            for (const b of bumps) t += b.h * Math.exp(-((u - b.u) ** 2 + (v - b.v) ** 2) / b.r ** 2);
            t += (random() * 2 - 1) * JITTER * (1 - d);
            y = Math.max(RIM_Y, t * height);
        }
        positions.set([u * length, y, -v * width], i * 3);
        const shade = 0.96 + random() * 0.08;
        colors.set(slopeColor(Math.max(0, y) / height).map((c) => Math.min(1, c * shade)), i * 3);
    };

    put(0, 0, 0, 0);
    for (let ring = 1; ring <= rings; ring++) {
        const d = ring / rings;
        for (let s = 0; s < segments; s++) {
            // Small angle jitter breaks the regular grid (not on the rim, which stays a clean ellipse).
            const phi = ((s + (ring < rings ? (random() - 0.5) * 0.4 : 0)) / segments) * Math.PI * 2;
            put(1 + (ring - 1) * segments + s, d * Math.cos(phi), d * Math.sin(phi), d);
        }
    }

    const indices = [];
    const at = (ring, s) => 1 + (ring - 1) * segments + (s % segments);
    for (let s = 0; s < segments; s++) indices.push(0, at(1, s), at(1, s + 1));
    for (let ring = 1; ring < rings; ring++) {
        for (let s = 0; s < segments; s++) {
            const a = at(ring, s);
            const b = at(ring, s + 1);
            const c = at(ring + 1, s);
            const d = at(ring + 1, s + 1);
            indices.push(a, c, d, a, d, b);
        }
    }

    return { positions, colors, indices: new Uint16Array(indices) };
};

/** World position of the mountain: centred behind the city's north edge, whatever the downtown size. */
export const fakoPlacement = (bounds, { length, width, angle, offsetX, margin } = FAKO) => {
    const extentZ = Math.hypot(length * Math.sin(angle), width * Math.cos(angle));
    return { x: offsetX, z: bounds.minZ - margin - extentZ, rotationY: angle };
};

/** Local → world for a vertex of fakoMesh (matches a three.js group at `placement`). */
export const toWorld = ([x, y, z], { x: px, z: pz, rotationY }) => {
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    return [px + x * cos + z * sin, y, pz - x * sin + z * cos];
};

/** Open frustum hugging the slope between MIST.from and MIST.to; unit radii, scaled by the ridge axes. */
export const mistBand = ({ length, width, height } = FAKO, { from, to, offset } = MIST) => ({
    radiusBottom: distanceAt(from) * offset,
    radiusTop: distanceAt(to) * offset,
    y: ((from + to) / 2) * height,
    bandHeight: (to - from) * height,
    scale: [length, 1, width],
});
