// City layout (docs/design_system.md → "City map"): buildings → lots, roads, district plots.
// Pure and deterministic: input order doesn't matter, and adding one project moves at most a few others.
// Axes: Fako is north (−z); the camera enters from the south (+z) along Career Road.
import { COLORS, mixHex } from './palette.js';
import { hashString } from './random.js';

export const LOT = 3.6; // fits the largest footprint (3.0) with a gap
export const BLOCK_LOTS = 2; // a city block is 2 × 2 lots
export const SIDEWALK = 0.4;
export const BLOCK = BLOCK_LOTS * LOT + 2 * SIDEWALK; // 8
export const STREET = 2.4;
export const MAIN_ROAD = 4;
export const CAREER_ROAD = 3;
export const CAREER_LENGTH = 30;
export const PLOT = 16; // district plot size
export const PLOT_GAP = 1;
// Downtown grows in fixed steps (blocks per side) so the city only reshuffles when it changes step.
export const TIERS = [3, 4, 5, 6, 8];
// Centre lots on the main-road front row, kept for featured projects (content allows max 3).
export const FEATURED_LOTS = 3;

const DASH = 1;
const DASH_WIDTH = 0.15;

export const DISTRICT_PLOTS = {
    cinema: { side: -1, row: 'north', color: COLORS.indigo, height: 3.2 },
    school: { side: 1, row: 'north', color: COLORS.window, height: 2.4 },
    arcade: { side: -1, row: 'south', color: COLORS.ember, height: 2 },
    pitch: { side: 1, row: 'south', color: COLORS.fakoGreen, height: 0.6 },
};

export const LAYOUT_COLORS = {
    ground: mixHex(COLORS.basalt, COLORS.fakoGreen, 0.25),
    street: COLORS.ash,
    main: mixHex(COLORS.ash, COLORS.mist, 0.1),
    career: mixHex(COLORS.ash, COLORS.indigo, 0.2),
    marking: COLORS.mist,
    pavement: mixHex(COLORS.ash, COLORS.mist, 0.15),
    park: mixHex(COLORS.fakoGreen, COLORS.basalt, 0.2),
};

/** Smallest tier whose non-featured lots fit `count` buildings. */
export const chooseTier = (count) => {
    const tier = TIERS.find((g) => (g * BLOCK_LOTS) ** 2 - FEATURED_LOTS >= count);
    if (!tier) throw new Error(`Too many buildings for the largest downtown tier (${count})`);
    return tier;
};

const rect = (kind, x0, z0, x1, z1, extra = {}) => ({
    kind, x: (x0 + x1) / 2, z: (z0 + z1) / 2, width: x1 - x0, depth: z1 - z0, ...extra,
});

/** Lot centres, row-major from the north-west corner. */
const downtownLots = (blocks, span) => {
    const lots = [];
    const perSide = blocks * BLOCK_LOTS;
    const lotCentre = (i) => {
        const block = Math.floor(i / BLOCK_LOTS);
        return -span / 2 + block * (BLOCK + STREET) + SIDEWALK + LOT * ((i % BLOCK_LOTS) + 0.5);
    };
    for (let row = 0; row < perSide; row++) {
        for (let col = 0; col < perSide; col++) lots.push({ row, col, x: lotCentre(col), z: lotCentre(row) });
    }
    return lots;
};

const dashes = (from, to, along, at) => {
    const out = [];
    for (let p = from + DASH; p + DASH <= to; p += DASH * 2) {
        const c = p + DASH / 2;
        out.push(along === 'x'
            ? { x: c, z: at, width: DASH, depth: DASH_WIDTH }
            : { x: at, z: c, width: DASH_WIDTH, depth: DASH });
    }
    return out;
};

/**
 * @param {object[]} buildings  output of toBuildings (uses slug, flag)
 */
export const layoutCity = (buildings) => {
    const sorted = [...buildings].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    const featured = sorted.filter((b) => b.flag).slice(0, FEATURED_LOTS);
    const others = sorted.filter((b) => !featured.includes(b));

    const blocks = chooseTier(others.length);
    const span = blocks * BLOCK + (blocks - 1) * STREET;
    const half = span / 2;
    const allLots = downtownLots(blocks, span);

    // Featured: front row (next to the main road), closest to Career Road first.
    const frontRow = blocks * BLOCK_LOTS - 1;
    const reserved = allLots
        .filter((l) => l.row === frontRow)
        .sort((a, b) => Math.abs(a.x) - Math.abs(b.x) || a.x - b.x)
        .slice(0, FEATURED_LOTS);
    const free = allLots.filter((l) => !reserved.includes(l));

    // Others: slug hash → preferred lot, linear probing on collision.
    const taken = new Array(free.length).fill(null);
    for (const b of others) {
        let i = hashString(b.slug) % free.length;
        while (taken[i]) i = (i + 1) % free.length;
        taken[i] = b;
    }

    const lots = [
        ...featured.map((building, i) => ({ slug: building.slug, building, x: reserved[i].x, z: reserved[i].z })),
        ...free.flatMap((l, i) => (taken[i] ? [{ slug: taken[i].slug, building: taken[i], x: l.x, z: l.z }] : [])),
    ];
    const parks = [...reserved.slice(featured.length), ...free.filter((_, i) => !taken[i])]
        .map((l) => ({ x: l.x, z: l.z, size: LOT - 0.4 }));

    // Pavement under each block.
    const pavements = [];
    for (let r = 0; r < blocks; r++) {
        for (let c = 0; c < blocks; c++) {
            const x0 = -half + c * (BLOCK + STREET);
            const z0 = -half + r * (BLOCK + STREET);
            pavements.push(rect('pavement', x0, z0, x0 + BLOCK, z0 + BLOCK));
        }
    }

    // Plots sit beside downtown's perimeter streets; north plots line up with the front row.
    const outer = half + STREET;
    const plotInner = outer + PLOT_GAP;
    const plotOuter = plotInner + PLOT;
    const mainZ0 = half;
    const mainZ1 = half + MAIN_ROAD;
    const careerEnd = mainZ1 + CAREER_LENGTH;

    const districts = Object.entries(DISTRICT_PLOTS).map(([id, d]) => {
        const [x0, x1] = d.side < 0 ? [-plotOuter, -plotInner] : [plotInner, plotOuter];
        const [z0, z1] = d.row === 'north'
            ? [mainZ0 - PLOT_GAP - PLOT, mainZ0 - PLOT_GAP]
            : [mainZ1 + PLOT_GAP, mainZ1 + PLOT_GAP + PLOT];
        const plot = rect('district', x0, z0, x1, z1, { id, color: mixHex(COLORS.ash, d.color, 0.25) });
        // Placeholder block until the district gets real content (P3-08 → P3-11).
        const size = id === 'pitch' ? PLOT * 0.6 : PLOT * 0.35;
        return { ...plot, placeholder: { x: plot.x, z: plot.z, width: size, depth: size * (id === 'pitch' ? 0.6 : 1), height: d.height, color: d.color } };
    });

    const roads = [
        rect('street', -outer, -outer, outer, -half), // north
        rect('street', -outer, -half, -half, mainZ0), // west
        rect('street', half, -half, outer, mainZ0), // east
        rect('main', -plotOuter, mainZ0, plotOuter, mainZ1),
        rect('career', -CAREER_ROAD / 2, mainZ1, CAREER_ROAD / 2, careerEnd),
    ];
    for (let i = 1; i < blocks; i++) {
        const a = -half + i * BLOCK + (i - 1) * STREET;
        roads.push(rect('street', a, -half, a + STREET, half)); // between columns
        roads.push(rect('street', -half, a, half, a + STREET)); // between rows
    }

    const mainCentre = (mainZ0 + mainZ1) / 2;
    const markings = [
        ...dashes(-plotOuter, -CAREER_ROAD / 2 - DASH, 'x', mainCentre),
        ...dashes(CAREER_ROAD / 2 + DASH, plotOuter, 'x', mainCentre),
        ...dashes(mainZ1, careerEnd, 'z', 0),
    ];

    return {
        tier: blocks,
        downtown: { x: 0, z: 0, size: span },
        lots,
        parks,
        pavements,
        roads,
        markings,
        districts,
        // Where Career Road starts; the camera rig (P1-05) begins here.
        entrance: { x: 0, z: careerEnd },
        bounds: { minX: -plotOuter, maxX: plotOuter, minZ: -outer, maxZ: careerEnd },
    };
};
