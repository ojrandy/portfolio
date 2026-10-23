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

// Market (P3B-07): west of Career Road beside the entrance, on red earth. `setback` from the road's edge keeps it
// clear of the Career Road signs (0.8 out, 3 wide) and leaves the roadside to the lamps, palms and the taxi stop.
export const MARKET = { width: 13, depth: 9, setback: 4.6, back: 0.5, color: mixHex(COLORS.ash, '#9A5B3C', 0.45) };

// Outskirts (P3B-08): Career Road carries on `length` south past the entrance to a T with the road to Limbe (west)
// and Douala (east), as Buea's road runs down to Mutengene; the main road runs on `reach` past the plots each way.
// Traffic enters and leaves at the far ends, out of the start view. Houses may use `north` beyond the town's north
// edge and `south` beyond the T.
export const ROAD_OUT = { length: 24, reach: 30, north: 30, south: 16 };

export const LAYOUT_COLORS = {
    ground: mixHex(COLORS.basalt, COLORS.fakoGreen, 0.25),
    street: COLORS.ash,
    main: mixHex(COLORS.ash, COLORS.mist, 0.1),
    out: mixHex(COLORS.ash, COLORS.mist, 0.05),
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
    const marketX1 = -CAREER_ROAD / 2 - MARKET.setback;
    const marketZ1 = careerEnd - MARKET.back;
    const market = rect('district', marketX1 - MARKET.width, marketZ1 - MARKET.depth, marketX1, marketZ1, { id: 'market', color: MARKET.color });
    districts.push({ ...market, placeholder: { x: market.x, z: market.z, width: 4, depth: 3, height: 1.2, color: COLORS.ember } });

    const roads = [
        rect('street', -outer, -outer, outer, -half), // north
        rect('street', -outer, -half, -half, mainZ0), // west
        rect('street', half, -half, outer, mainZ0), // east
        rect('main', -plotOuter, mainZ0, plotOuter, mainZ1),
        rect('career', -CAREER_ROAD / 2, mainZ1, CAREER_ROAD / 2, careerEnd),
    ];
    // Roads out: the same widths as the roads they continue, so the lanes line up (roadGraph joins them end to end).
    const reach = plotOuter + ROAD_OUT.reach;
    const teeZ0 = careerEnd + ROAD_OUT.length;
    const teeZ1 = teeZ0 + MAIN_ROAD;
    roads.push(
        rect('out', -reach, mainZ0, -plotOuter, mainZ1),
        rect('out', plotOuter, mainZ0, reach, mainZ1),
        rect('out', -CAREER_ROAD / 2, careerEnd, CAREER_ROAD / 2, teeZ0),
        rect('out', -reach, teeZ0, reach, teeZ1), // Limbe (west) – Douala (east)
    );
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
        ...dashes(-reach, -plotOuter, 'x', mainCentre),
        ...dashes(plotOuter, reach, 'x', mainCentre),
        ...dashes(careerEnd, teeZ0 - DASH, 'z', 0),
        ...dashes(-reach, -CAREER_ROAD / 2 - DASH, 'x', teeZ0 + MAIN_ROAD / 2),
        ...dashes(CAREER_ROAD / 2 + DASH, reach, 'x', teeZ0 + MAIN_ROAD / 2),
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
        // Where the camera target may go: the town and the road out down to the T.
        reach: { minX: -plotOuter, maxX: plotOuter, minZ: -outer, maxZ: teeZ1 },
        // The T where the road out meets the Limbe–Douala road, and the area the outskirts' houses may use.
        roadOut: { x: 0, z: (teeZ0 + teeZ1) / 2, width: MAIN_ROAD, reach },
        outskirts: { minX: -reach, maxX: reach, minZ: -outer - ROAD_OUT.north, maxZ: teeZ1 + ROAD_OUT.south },
    };
};
