// Vehicle kit (P3B-02, docs/design_system.md → "Interactive city"): each type is a list of simple parts
// (boxes, cylinders, low-poly blobs) in the flat city style. Pure data, no three.js; vehicleGeometry.js builds the meshes.
// Local frame: the vehicle faces +z, x is across, y up, the ground at y = 0. Sizes are in city units
// (a street lane is 1.2 wide, a main-road lane 2.0). No brand names, logos or protected emblems.
import { COLORS, mixHex } from './palette.js';
import { createRandom } from './random.js';

// Part colour 'body' takes the instance colour (the variant); any hex stays fixed.
export const BODY = 'body';

export const TAXI_YELLOW = '#F2C21B';
export const POLICE_BLUE = '#1C2A5E';

const GLASS = mixHex(COLORS.basalt, COLORS.sky, 0.35);
const TYRE = mixHex(COLORS.basalt, COLORS.ash, 0.3);
const TRIM = COLORS.ash;
const HEAD = COLORS.paper;
const TAIL = COLORS.ember;
const WOOD = '#7A5434';
const BARK = '#5E4128';
const LOG_END = '#C9A47A';
const BANANA = ['#5F8F2E', '#76A23A'];
export const SIREN_RED = '#D8342B';

const CAR_COLORS = [
    COLORS.paper,
    COLORS.mist,
    mixHex(COLORS.ash, COLORS.mist, 0.35), // silver
    mixHex(COLORS.basalt, COLORS.ash, 0.5), // black
    COLORS.indigo,
    mixHex(COLORS.ember, COLORS.basalt, 0.3), // red
    mixHex(COLORS.sky, COLORS.indigo, 0.45), // blue
];

const box = (size, at, color, extra) => ({ shape: 'box', size, at, color, ...extra });
// Cylinder of `radius` and `length` along `axis` ('x' | 'y' | 'z'); `ends` colours the caps.
const cylinder = (radius, length, axis, at, color, extra) => ({ shape: 'cylinder', radius, length, axis, at, color, segments: 7, ...extra });
const blob = (size, at, color) => ({ shape: 'blob', size, at, color });

// Four (or more) wheels with their axle across x, touching the ground.
const wheels = (halfWidth, radius, width, zs, segments = 8) => zs.flatMap((z) => [-1, 1].map((side) => cylinder(
    radius, width, 'x', [side * (halfWidth - width / 2 + 0.01), radius, z], TYRE, { role: 'wheel', segments },
)));

// A pair of head lamps at the front and tail lamps at the back; their centres are the glow points for P3B-03.
const lamps = (x, y, front, back, size = [0.09, 0.05, 0.02]) => [-1, 1].flatMap((side) => [
    box(size, [side * x, y, front + size[2] / 2], HEAD, { role: 'head' }),
    box(size, [side * x, y, back - size[2] / 2], TAIL, { role: 'tail' }),
]);

// Lower body, glass band and roof: the shared saloon shape.
const saloon = ({ width = 0.5, length = 1.0, roofColor = BODY, bodyColor = BODY } = {}) => [
    box([width, 0.18, length], [0, 0.17, 0], bodyColor),
    box([width - 0.08, 0.14, 0.48], [0, 0.33, -0.05], GLASS),
    box([width - 0.06, 0.03, 0.42], [0, 0.415, -0.06], roofColor),
    box([width + 0.005, 0.03, length + 0.005], [0, 0.095, 0], TRIM), // bumpers + sill
    ...lamps(width / 2 - 0.09, 0.2, length / 2, -length / 2),
    ...wheels(width / 2, 0.1, 0.07, [0.32, -0.32]),
];

// Cab + chassis + bed floor shared by both trucks (the load sits on top of y = 0.27, from z = -0.95 to 0.41).
const truckBase = () => [
    box([0.66, 0.42, 0.42], [0, 0.35, 0.72], BODY), // cab
    box([0.6, 0.14, 0.02], [0, 0.46, 0.935], GLASS), // windscreen
    box([0.67, 0.13, 0.22], [0, 0.46, 0.78], GLASS), // side windows
    box([0.67, 0.04, 0.43], [0, 0.155, 0.72], TRIM),
    box([0.46, 0.1, 1.9], [0, 0.17, 0], TRIM), // chassis
    box([0.66, 0.05, 1.36], [0, 0.245, -0.27], WOOD), // bed floor
    ...lamps(0.24, 0.24, 0.93, -0.95, [0.1, 0.06, 0.02]),
    ...wheels(0.33, 0.13, 0.09, [0.68, -0.52, -0.8], 6), // six wheels, so fewer sides each
];

const TYPES = {
    sedan: {
        label: 'Sedan',
        variants: CAR_COLORS,
        parts: saloon(),
    },
    taxi: {
        // Cameroon taxis are plain yellow saloons.
        label: 'Taxi',
        variants: [TAXI_YELLOW],
        parts: saloon(),
    },
    police: {
        // Dark blue with one white stripe reading "POLICE" on both sides (the `decal` faces carry the lettering).
        label: 'Police car',
        variants: [POLICE_BLUE],
        parts: [
            ...saloon(),
            box([0.506, 0.09, 0.84], [0, 0.19, -0.02], COLORS.paper, { decal: 'police' }),
            box([0.15, 0.04, 0.07], [-0.075, 0.45, 0], COLORS.sky),
            box([0.15, 0.04, 0.07], [0.075, 0.45, 0], SIREN_RED),
        ],
    },
    suv: {
        label: 'SUV',
        variants: CAR_COLORS,
        parts: [
            box([0.55, 0.22, 1.1], [0, 0.21, 0], BODY),
            box([0.51, 0.17, 0.74], [0, 0.405, -0.08], GLASS),
            box([0.53, 0.035, 0.72], [0, 0.505, -0.08], BODY),
            box([0.555, 0.035, 1.105], [0, 0.115, 0], TRIM),
            cylinder(0.1, 0.06, 'z', [0, 0.3, -0.58], TYRE), // spare wheel
            ...lamps(0.18, 0.26, 0.55, -0.55),
            ...wheels(0.275, 0.12, 0.08, [0.36, -0.36]),
        ],
    },
    pickup: {
        label: 'Pickup',
        variants: CAR_COLORS,
        parts: [
            box([0.55, 0.18, 1.15], [0, 0.19, 0], BODY),
            box([0.51, 0.15, 0.32], [0, 0.355, 0.12], GLASS),
            box([0.53, 0.03, 0.3], [0, 0.445, 0.11], BODY),
            box([0.04, 0.1, 0.5], [-0.255, 0.33, -0.31], BODY), // bed sides + tailgate
            box([0.04, 0.1, 0.5], [0.255, 0.33, -0.31], BODY),
            box([0.55, 0.1, 0.04], [0, 0.33, -0.555], BODY),
            box([0.555, 0.03, 1.155], [0, 0.11, 0], TRIM),
            ...lamps(0.18, 0.22, 0.575, -0.575),
            ...wheels(0.275, 0.11, 0.08, [0.36, -0.36]),
        ],
    },
    moto: {
        // Bendskin moto-taxi: the rider's jacket is the variant colour; helmet on.
        label: 'Bendskin moto-taxi',
        variants: [COLORS.ember, COLORS.indigo, mixHex(COLORS.fakoGreen, COLORS.mist, 0.2), COLORS.window, COLORS.mist],
        parts: [
            box([0.07, 0.09, 0.3], [0, 0.17, 0], mixHex(COLORS.ember, COLORS.basalt, 0.35)), // frame + tank
            box([0.1, 0.04, 0.2], [0, 0.235, -0.05], COLORS.basalt), // seat
            box([0.26, 0.02, 0.02], [0, 0.33, 0.16], TRIM), // handlebar
            box([0.02, 0.12, 0.02], [0, 0.27, 0.17], TRIM), // fork
            box([0.12, 0.08, 0.17], [0, 0.29, -0.03], TRIM), // legs
            box([0.14, 0.16, 0.1], [0, 0.4, -0.04], BODY), // jacket
            box([0.17, 0.035, 0.15], [0, 0.42, 0.06], BODY), // arms to the bars
            box([0.1, 0.09, 0.1], [0, 0.525, -0.03], COLORS.mist), // helmet
            box([0.05, 0.04, 0.02], [0, 0.26, 0.22], HEAD, { role: 'head' }),
            box([0.04, 0.03, 0.02], [0, 0.22, -0.21], TAIL, { role: 'tail' }),
            cylinder(0.08, 0.04, 'x', [0, 0.08, 0.17], TYRE, { role: 'wheel', segments: 8 }),
            cylinder(0.08, 0.04, 'x', [0, 0.08, -0.15], TYRE, { role: 'wheel', segments: 8 }),
        ],
    },
    minibus: {
        // Intercity / clando minibus with a roof rack of luggage.
        label: 'Minibus',
        variants: [COLORS.paper, COLORS.mist, mixHex(COLORS.paper, COLORS.sky, 0.25)],
        parts: [
            box([0.6, 0.42, 1.4], [0, 0.31, 0], BODY),
            box([0.61, 0.12, 1.41], [0, 0.44, 0], GLASS), // window band all round
            box([0.61, 0.04, 1.41], [0, 0.27, 0], COLORS.indigo), // stripe
            box([0.605, 0.04, 1.405], [0, 0.12, 0], TRIM),
            box([0.5, 0.025, 0.9], [0, 0.535, -0.1], TRIM), // rack
            box([0.38, 0.08, 0.32], [0.02, 0.585, -0.3], WOOD), // luggage
            box([0.3, 0.06, 0.22], [-0.04, 0.575, 0.06], mixHex(COLORS.indigo, COLORS.basalt, 0.3)),
            ...lamps(0.2, 0.2, 0.7, -0.7),
            ...wheels(0.3, 0.11, 0.08, [0.48, -0.48]),
        ],
    },
    bus: {
        label: 'Bus',
        variants: [mixHex(COLORS.sky, COLORS.indigo, 0.3), mixHex(COLORS.fakoGreen, COLORS.mist, 0.15), COLORS.paper],
        parts: [
            box([0.7, 0.6, 2.2], [0, 0.42, 0], BODY),
            box([0.71, 0.18, 2.21], [0, 0.56, 0], GLASS),
            box([0.71, 0.05, 2.21], [0, 0.32, 0], COLORS.paper),
            box([0.705, 0.05, 2.205], [0, 0.145, 0], TRIM),
            box([0.4, 0.05, 0.5], [0, 0.745, -0.2], COLORS.mist), // roof unit
            ...lamps(0.25, 0.24, 1.1, -1.1, [0.1, 0.06, 0.02]),
            ...wheels(0.35, 0.13, 0.09, [0.72, -0.62]),
        ],
    },
    timberTruck: {
        // Flatbed with stakes and a load of logs.
        label: 'Timber truck',
        variants: [mixHex(COLORS.ember, COLORS.basalt, 0.2), COLORS.indigo, mixHex(COLORS.fakoGreen, COLORS.ash, 0.3)],
        parts: [
            ...truckBase(),
            ...[-0.88, -0.27, 0.34].flatMap((z) => [-1, 1].map((side) => box([0.04, 0.34, 0.04], [side * 0.31, 0.44, z], WOOD))),
            ...[-0.2, 0, 0.2].map((x) => cylinder(0.1, 1.4, 'z', [x, 0.37, -0.27], BARK, { ends: LOG_END })),
            ...[-0.1, 0.1].map((x) => cylinder(0.1, 1.36, 'z', [x, 0.54, -0.29], BARK, { ends: LOG_END })),
        ],
    },
    bananaTruck: {
        // Low side boards and bunches standing in the bed.
        label: 'Banana truck',
        variants: [COLORS.paper, mixHex(COLORS.sky, COLORS.indigo, 0.4), mixHex(COLORS.ember, COLORS.basalt, 0.2)],
        parts: [
            ...truckBase(),
            box([0.04, 0.14, 1.36], [-0.31, 0.34, -0.27], WOOD),
            box([0.04, 0.14, 1.36], [0.31, 0.34, -0.27], WOOD),
            box([0.66, 0.14, 0.04], [0, 0.34, -0.93], WOOD),
            ...[-0.74, -0.28, 0.18].flatMap((z, row) => [-0.18, 0, 0.18].map((x, i) => blob(
                [0.19, 0.26, 0.22], [x, 0.4, z + (i === 1 ? 0.05 : 0)], BANANA[(row + i) % 2],
            ))),
            ...[-0.52, -0.04].flatMap((z, row) => [-0.09, 0.09].map((x, i) => blob(
                [0.18, 0.24, 0.21], [x, 0.6, z], BANANA[(row + i + 1) % 2],
            ))),
        ],
    },
    ambulance: {
        // White van, red stripe and light bar. No red cross (a protected emblem).
        label: 'Ambulance',
        variants: [COLORS.paper],
        parts: [
            box([0.56, 0.5, 1.1], [0, 0.35, -0.1], BODY), // box body
            box([0.56, 0.22, 0.2], [0, 0.21, 0.55], BODY), // nose
            box([0.5, 0.14, 0.02], [0, 0.46, 0.455], GLASS),
            box([0.565, 0.13, 0.2], [0, 0.46, 0.33], GLASS),
            box([0.565, 0.06, 1.105], [0, 0.3, -0.1], SIREN_RED),
            box([0.565, 0.03, 1.31], [0, 0.115, 0], TRIM),
            box([0.15, 0.04, 0.07], [-0.075, 0.62, 0.36], SIREN_RED),
            box([0.15, 0.04, 0.07], [0.075, 0.62, 0.36], COLORS.sky),
            ...lamps(0.19, 0.22, 0.65, -0.65),
            ...wheels(0.28, 0.11, 0.08, [0.42, -0.4]),
        ],
    },
};

/** Axis-aligned extent of one part: [min, max] per axis. */
export const partBounds = (part) => {
    let half;
    if (part.shape === 'cylinder') {
        const { radius: r, length: l, axis } = part;
        half = axis === 'x' ? [l / 2, r, r] : axis === 'y' ? [r, l / 2, r] : [r, r, l / 2];
    } else {
        half = part.size.map((s) => s / 2);
    }
    return { min: part.at.map((v, i) => v - half[i]), max: part.at.map((v, i) => v + half[i]) };
};

const boundsOf = (parts) => {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const part of parts) {
        const b = partBounds(part);
        for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], b.min[i]); max[i] = Math.max(max[i], b.max[i]); }
    }
    return { min, max };
};

const centreOf = (parts, role) => parts.filter((p) => p.role === role).map((p) => [...p.at]);

/**
 * Every type with its overall size (width across x, height, length along z) and the head / tail light points
 * (local, for the night glow in P3B-03).
 * @type {Record<string, { id: string, label: string, variants: string[], parts: object[], width: number, height: number,
 *   length: number, front: number, back: number, lights: { head: number[][], tail: number[][] } }>}
 */
export const VEHICLE_TYPES = Object.fromEntries(Object.entries(TYPES).map(([id, type]) => {
    const { min, max } = boundsOf(type.parts);
    return [id, {
        id,
        ...type,
        width: max[0] - min[0],
        height: max[1],
        length: max[2] - min[2],
        front: max[2],
        back: min[2],
        lights: { head: centreOf(type.parts, 'head'), tail: centreOf(type.parts, 'tail') },
    }];
}));

export const VEHICLE_IDS = Object.keys(VEHICLE_TYPES);

/** The colour of one vehicle: the same type + seed always gives the same variant. */
export const pickVariant = (typeId, seed) => {
    const { variants } = VEHICLE_TYPES[typeId];
    return variants[Math.floor(createRandom(`vehicle:${typeId}:${seed}`)() * variants.length)];
};

/** What a vehicle says when it honks (speech bubble). */
export const honkText = (type) => ({ moto: 'Pip pip!', bus: 'Paaarp!', timberTruck: 'Paaarp!', bananaTruck: 'Paaarp!' })[type] ?? 'Beep beep!';
