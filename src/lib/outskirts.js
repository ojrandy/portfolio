// Outskirts (P3B-08, design_system.md → "Interactive city"): small houses round the town, not clickable, and the road
// sign at the T where the road out meets the Limbe–Douala road. Pure and deterministic (seeded by grid cell and
// position), so the same city always has the same houses. src/city/Outskirts.jsx draws them.
// Houses never go inside the town's bounds (plots, market, pens, props and signs all live there), so they only need
// to keep clear of the roads out, the sign and each other. Local frames: front +z, rotationY 0 faces south.
import { COLORS, mixHex } from './palette.js';
import { createRandom } from './random.js';

export const HOUSE = {
    width: [1.8, 3.2], depth: [1.5, 2.3], wall: [0.85, 1.2], // people are about 0.47 tall
    roadside: 1.1, // gap between a roadside house's front (or veranda) and the road
    spacing: 4.2, // along a road out
    cell: 4.8, // scatter grid elsewhere
    jitter: 1.2,
    gap: 0.5, // between houses
    townClear: 2.5, // from the town's bounds
    faceRoad: 7, // a scattered house this close to a road turns to face it
    entranceClear: 11, // round the start view's camera, just south of the entrance
};
export const SIGN_POST = { width: 3.4, height: 1.4, bottom: 1.5, back: 1.4 };

export const WALLS = [
    COLORS.paper,
    mixHex(COLORS.paper, COLORS.window, 0.35),
    mixHex(COLORS.paper, COLORS.sky, 0.3),
    mixHex(COLORS.paper, COLORS.fakoGreen, 0.25),
    mixHex(COLORS.paper, COLORS.ember, 0.25),
    mixHex(COLORS.mist, COLORS.ash, 0.25),
];
// Zinc roofs: bare grey, rusty, painted.
export const ROOFS = [
    mixHex(COLORS.mist, COLORS.ash, 0.45),
    mixHex(COLORS.mist, COLORS.ash, 0.3),
    mixHex(COLORS.ember, COLORS.basalt, 0.5),
    mixHex(COLORS.ember, COLORS.basalt, 0.3),
    mixHex(COLORS.sky, COLORS.ash, 0.55),
];

const between = (random, [lo, hi]) => lo + random() * (hi - lo);
const pick = (random, list) => list[Math.floor(random() * list.length)];
const distToRect = (x, z, r) => Math.hypot(Math.max(r.x - r.width / 2 - x, 0, x - r.x - r.width / 2), Math.max(r.z - r.depth / 2 - z, 0, z - r.z - r.depth / 2));

/** One house's look, seeded by `seed`; `radius` covers it and its veranda or yard wall. */
const houseAt = (seed) => {
    const random = createRandom(`house:${seed}`);
    const width = between(random, HOUSE.width);
    const depth = between(random, HOUSE.depth);
    const extra = random();
    const veranda = extra < 0.3;
    const fence = extra >= 0.3 && extra < 0.5;
    const front = veranda ? 0.8 : fence ? 0.7 : 0;
    return {
        width, depth, front, veranda, fence,
        wall: between(random, HOUSE.wall),
        wallColor: pick(random, WALLS),
        roofColor: pick(random, ROOFS),
        lit: random() < 0.6, // windows lit at night
        radius: Math.hypot(width / 2 + (fence ? 0.35 : 0), depth / 2 + front) + 0.1,
        random,
    };
};

/**
 * @param {ReturnType<import('./layout.js').layoutCity>} layout
 * @returns {{ houses: object[], sign: { x: number, z: number, rotationY: number } }}
 */
export const outskirts = (layout) => {
    const { bounds, outskirts: area, roadOut } = layout;
    const out = layout.roads.filter((r) => r.kind === 'out');
    const roads = layout.roads;
    // The direction sign stands across the T from the road out, facing the traffic coming down it (north).
    const sign = { x: roadOut.x, z: roadOut.z + roadOut.width / 2 + SIGN_POST.back, rotationY: Math.PI };
    const taken = [
        { x: sign.x, z: sign.z, r: SIGN_POST.width / 2 + 0.4 },
        { x: layout.entrance.x, z: layout.entrance.z + 4, r: HOUSE.entranceClear - HOUSE.gap },
    ];
    const town = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2, width: bounds.maxX - bounds.minX, depth: bounds.maxZ - bounds.minZ };

    const free = (x, z, r) => x - r >= area.minX && x + r <= area.maxX && z - r >= area.minZ && z + r <= area.maxZ
        && distToRect(x, z, town) >= r + HOUSE.townClear
        && roads.every((road) => distToRect(x, z, road) >= r + 0.3)
        && taken.every((t) => Math.hypot(x - t.x, z - t.z) >= r + t.r + HOUSE.gap);

    const houses = [];
    const add = (house, x, z, rotationY) => {
        const { random, ...rest } = house;
        houses.push({ ...rest, x, z, rotationY: rotationY + (random() - 0.5) * 0.12 });
        taken.push({ x, z, r: house.radius });
    };

    // Rows along both sides of every road out, facing it; a few gaps.
    for (const road of out) {
        const alongX = road.width > road.depth;
        const [from, to] = alongX ? [road.x - road.width / 2, road.x + road.width / 2] : [road.z - road.depth / 2, road.z + road.depth / 2];
        const half = (alongX ? road.depth : road.width) / 2;
        for (let p = from + HOUSE.spacing / 2; p < to; p += HOUSE.spacing) {
            for (const side of [-1, 1]) {
                const seed = `${alongX ? 'x' : 'z'}:${p.toFixed(1)}:${(alongX ? road.z : road.x).toFixed(1)}:${side}`;
                const house = houseAt(seed);
                if (house.random() < 0.2) continue;
                const back = half + HOUSE.roadside + house.front + house.depth / 2;
                const x = alongX ? p : road.x + side * back;
                const z = alongX ? road.z + side * back : p;
                // Face the road: north of it faces south (0), south faces north (π), west faces east, east faces west.
                const rotationY = alongX ? (side < 0 ? 0 : Math.PI) : side < 0 ? Math.PI / 2 : -Math.PI / 2;
                if (free(x, z, house.radius)) add(house, x, z, rotationY);
            }
        }
    }

    // Scattered houses on a jittered grid, thinning out away from the town.
    const first = (v) => Math.ceil(v / HOUSE.cell) * HOUSE.cell;
    for (let gz = first(area.minZ); gz <= area.maxZ; gz += HOUSE.cell) {
        for (let gx = first(area.minX); gx <= area.maxX; gx += HOUSE.cell) {
            const house = houseAt(`cell:${gx.toFixed(1)},${gz.toFixed(1)}`);
            const { random } = house;
            const x = gx + (random() - 0.5) * HOUSE.jitter * 2;
            const z = gz + (random() - 0.5) * HOUSE.jitter * 2;
            const far = distToRect(x, z, town);
            if (random() > Math.min(0.75, Math.max(0.12, 0.75 - (0.6 * far) / 35))) continue;
            if (!free(x, z, house.radius)) continue;
            const near = roads.map((road) => ({ road, d: distToRect(x, z, road) })).sort((a, b) => a.d - b.d)[0];
            let rotationY = Math.floor(random() * 4) * (Math.PI / 2);
            if (near && near.d < HOUSE.faceRoad) {
                const r = near.road;
                rotationY = r.width > r.depth ? (z < r.z ? 0 : Math.PI) : x < r.x ? Math.PI / 2 : -Math.PI / 2;
            }
            add(house, x, z, rotationY);
        }
    }

    return { houses, sign };
};
