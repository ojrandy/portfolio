// Figure kit (P3B-04, docs/design_system.md → "Interactive city"): a walker, an umbrella, a goat and a chicken as lists of
// simple parts in the flat city style. Pure data, no three.js; src/city/figureGeometry.js builds the meshes.
// Parts are written in metres and scaled down to city units. Local frame: facing +z, x across, y up, ground at y = 0.
// `tint` 'top' / 'lower' take the instance's clothes colours (animals use 'top' for their coat). `swing` parts turn
// about the x axis at `pivot` [y, z] with the gait (sign = which way); `head` parts turn down to graze or peck.
// Plain clothes colours only: no cultural motifs (ADR-009).
import { COLORS, mixHex } from './palette.js';
import { createRandom } from './random.js';

export const PERSON_SCALE = 0.27; // a 1.75 m person is about 0.47 units (cars are 0.43 tall, lamps 1.3)
export const ANIMAL_SCALE = 0.32; // animals a little larger than true, so they read from the street

const SKIN = '#6B4430';
const HAIR = '#1E1A18';
const SHOE = '#24221F';
const HORN = '#8A7D68';
const COMB = '#C8392B';
const BEAK = '#E0A03A';

export const TOPS = [
    COLORS.paper, COLORS.sky, COLORS.ember, COLORS.window, COLORS.indigo,
    mixHex(COLORS.fakoGreen, COLORS.mist, 0.25), mixHex(COLORS.ember, COLORS.window, 0.5), '#B8476B', '#5C8FB0',
];
export const LOWERS = [mixHex(COLORS.basalt, COLORS.ash, 0.6), '#34466B', '#8C7A5B', COLORS.ash, '#4A3A2E'];
export const UMBRELLAS = [COLORS.basalt, COLORS.indigo, COLORS.ember, '#2E6F5E', COLORS.window];
export const GOAT_COATS = ['#EDE6D8', '#7A5A3C', '#2B2522', '#B08A5E'];
export const HEN_COATS = ['#F1ECE2', '#9A5B2E', '#3A2E27', '#C98A4B'];

const box = (size, at, color, extra) => ({ shape: 'box', size, at, color, ...extra });
const cone = (radius, height, at, color, extra) => ({ shape: 'cone', radius, height, at, color, segments: 8, ...extra });
const rod = (radius, height, at, color) => ({ shape: 'cylinder', radius, height, at, color, segments: 5 });
const blob = (size, at, color, extra) => ({ shape: 'blob', size, at, color, ...extra });

const person = () => [
    // Legs swing at the hip, arms the opposite way at the shoulder.
    ...[-1, 1].flatMap((side) => [
        box([0.16, 0.86, 0.18], [side * 0.1, 0.43 + 0.04, 0], 'lower', { tint: 'lower', swing: side, pivot: [0.9, 0] }),
        box([0.17, 0.08, 0.28], [side * 0.1, 0.04, 0.04], SHOE, { swing: side, pivot: [0.9, 0] }),
        box([0.11, 0.6, 0.13], [side * 0.3, 1.18, 0], 'top', { tint: 'top', swing: -side * 0.7, pivot: [1.45, 0] }),
        box([0.1, 0.1, 0.11], [side * 0.3, 0.83, 0], SKIN, { swing: -side * 0.7, pivot: [1.45, 0] }),
    ]),
    box([0.46, 0.62, 0.26], [0, 1.2, 0], 'top', { tint: 'top' }),
    box([0.12, 0.08, 0.12], [0, 1.54, 0], SKIN),
    box([0.24, 0.26, 0.24], [0, 1.66, 0.01], SKIN),
    box([0.26, 0.07, 0.26], [0, 1.8, -0.005], HAIR),
];

// Held a little to the right of the head; the canopy is the instance colour.
const umbrella = () => [
    rod(0.02, 0.75, [0.18, 1.62, 0], SHOE),
    cone(0.62, 0.22, [0.18, 2.06, 0], 'top', { tint: 'top' }),
];

const goat = () => [
    box([0.36, 0.34, 0.72], [0, 0.6, 0], 'top', { tint: 'top' }),
    ...[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([x, z]) => box(
        [0.08, 0.46, 0.08], [x * 0.12, 0.23, z * 0.26], 'top', { tint: 'top', swing: x * z, pivot: [0.46, z * 0.26] },
    )),
    // Neck and head bow to graze.
    box([0.16, 0.3, 0.16], [0, 0.82, 0.36], 'top', { tint: 'top', head: 1, pivot: [0.7, 0.3] }),
    box([0.18, 0.18, 0.3], [0, 0.94, 0.5], 'top', { tint: 'top', head: 1, pivot: [0.7, 0.3] }),
    ...[-1, 1].map((x) => box([0.04, 0.16, 0.05], [x * 0.06, 1.1, 0.42], HORN, { head: 1, pivot: [0.7, 0.3] })),
    box([0.06, 0.14, 0.06], [0, 0.8, -0.38], 'top', { tint: 'top' }),
];

const chicken = () => [
    blob([0.26, 0.24, 0.34], [0, 0.3, 0], 'top', { tint: 'top' }),
    blob([0.12, 0.2, 0.12], [0, 0.4, -0.18], 'top', { tint: 'top' }),
    ...[-1, 1].map((x) => box([0.03, 0.18, 0.03], [x * 0.06, 0.09, 0], BEAK, { swing: x, pivot: [0.18, 0] })),
    // Head pecks from the neck.
    blob([0.12, 0.14, 0.12], [0, 0.48, 0.13], 'top', { tint: 'top', head: 1, pivot: [0.36, 0.1] }),
    box([0.025, 0.06, 0.08], [0, 0.57, 0.13], COMB, { head: 1, pivot: [0.36, 0.1] }),
    box([0.04, 0.03, 0.06], [0, 0.47, 0.21], BEAK, { head: 1, pivot: [0.36, 0.1] }),
];

const scaled = (parts, s) => parts.map((p) => ({
    ...p,
    at: p.at.map((v) => v * s),
    ...(p.size && { size: p.size.map((v) => v * s) }),
    ...(p.radius && { radius: p.radius * s }),
    ...(p.height && { height: p.height * s }),
    ...(p.pivot && { pivot: p.pivot.map((v) => v * s) }),
}));

export const FIGURES = {
    person: scaled(person(), PERSON_SCALE),
    umbrella: scaled(umbrella(), PERSON_SCALE),
    goat: scaled(goat(), ANIMAL_SCALE),
    chicken: scaled(chicken(), ANIMAL_SCALE),
};
export const FIGURE_IDS = Object.keys(FIGURES);

const pick = (list, random) => list[Math.floor(random() * list.length)];

/** A person's clothes and umbrella colours, the same for the same seed. */
export const outfit = (seed) => {
    const random = createRandom(`outfit:${seed}`);
    return { top: pick(TOPS, random), lower: pick(LOWERS, random), umbrella: pick(UMBRELLAS, random) };
};

/** An animal's coat colour, the same for the same seed. */
export const coat = (kind, seed) => pick(kind === 'goat' ? GOAT_COATS : HEN_COATS, createRandom(`coat:${seed}`));
