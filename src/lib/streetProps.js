// Street props (P3B-05, design_system.md → "Interactive city"): where the trees, palms, benches, taxi/bus stops,
// call-box kiosks, the fuel station and the billboards stand. Pure and deterministic (seeded by position).
// Each prop has a clearance radius and is placed at the first free spot from a short list of candidates, so it keeps
// clear of roads, city blocks, district plots, lamps, the Career Road signs, the About house and every prop before it.
// Local frames: a prop's front is +z (rotationY 0 faces south, towards the start view).
import { lampSpots } from './lamps.js';
import { careerSigns, SIGN } from './careerRoad.js';
import { ABOUT_HOUSE, aboutHouseSpot } from './aboutContent.js';
import { createRandom } from './random.js';

export const PROP_RADIUS = { tree: 0.6, palm: 0.5, bench: 0.6, stop: 1.1, kiosk: 0.6, billboard: 2 };
export const FUEL = { width: 8, depth: 6 }; // the station's ground rectangle; its front faces the main road
export const BILLBOARDS = ['featured', 'github', 'weather'];
const LAMP_RADIUS = 0.3;
const SIGN_RADIUS = SIGN.width / 2 + 0.2;
const PARK_CORNER = 0.85; // park trees this far from the park's centre on each axis
const PARK_BENCH = 1.15; // park bench this far from the centre, on one side
const STOP_SETBACK = 1.15; // a stop's centre from the road's edge

const rectOf = (r, pad = 0) => ({ x0: r.x - r.width / 2 - pad, x1: r.x + r.width / 2 + pad, z0: r.z - r.depth / 2 - pad, z1: r.z + r.depth / 2 + pad });
const distToRect = (x, z, r) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
const rectsOverlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
const range = (from, to, step) => {
    const out = [];
    for (let v = from; step > 0 ? v <= to + 1e-9 : v >= to - 1e-9; v += step) out.push(v);
    return out;
};

/**
 * @param {ReturnType<import('./layout.js').layoutCity>} layout
 * @param {{ roles?: number }} options  roles = number of Career Road signs (careerRoles(profile).length)
 */
export const streetProps = (layout, { roles = 0 } = {}) => {
    const main = layout.roads.find((r) => r.kind === 'main');
    const career = layout.roads.find((r) => r.kind === 'career');
    const mainSouth = main.z + main.depth / 2;
    const north = career.z - career.depth / 2;
    const end = career.z + career.depth / 2;
    const left = career.x - career.width / 2;
    const right = career.x + career.width / 2;
    const { bounds } = layout;

    const rects = [...layout.roads, ...layout.pavements, ...layout.districts].map((r) => rectOf(r));
    const circles = [
        ...lampSpots(layout).map(({ x, z }) => ({ x, z, r: LAMP_RADIUS })),
        ...careerSigns(roles, career).map(({ x, z }) => ({ x, z, r: SIGN_RADIUS })),
        { ...aboutHouseSpot(career), r: ABOUT_HOUSE.radius },
    ];
    const inBounds = (x, z, r) => x - r >= bounds.minX && x + r <= bounds.maxX && z - r >= bounds.minZ && z + r <= bounds.maxZ;
    const free = (x, z, r) => inBounds(x, z, r)
        && rects.every((rect) => distToRect(x, z, rect) >= r)
        && circles.every((c) => Math.hypot(x - c.x, z - c.z) >= r + c.r);
    // First free candidate, which then blocks its spot for everything placed after it.
    const place = (kind, candidates) => {
        const r = PROP_RADIUS[kind];
        const spot = candidates.find(({ x, z }) => free(x, z, r));
        if (spot) circles.push({ x: spot.x, z: spot.z, r });
        return spot ?? null;
    };

    // Fuel station: south of the main road, west of Career Road and its signs, so traffic drives past it.
    const fuel = range(left - 6.5 - FUEL.width / 2, bounds.minX + FUEL.width / 2, -1)
        .map((x) => ({ x, z: mainSouth + 1.2 + FUEL.depth / 2, rotationY: Math.PI }))
        .find(({ x, z }) => {
            const rect = rectOf({ x, z, width: FUEL.width, depth: FUEL.depth });
            return inBounds(x, z, 0) && rects.every((r) => !rectsOverlap(rect, r))
                && circles.every((c) => distToRect(c.x, c.z, rect) >= c.r);
        }) ?? null;
    if (fuel) rects.push(rectOf({ ...fuel, width: FUEL.width, depth: FUEL.depth }, 0.3));

    // Billboards in a row east of Career Road, facing the start view (featured projects nearest the road). Where the
    // row is full (a small city), behind the fuel station.
    const row = range(right + 4, bounds.maxX, 0.2).map((x) => ({ x, z: mainSouth + 5, rotationY: 0 }));
    const behindFuel = fuel ? range(fuel.x, bounds.minX, -0.5).map((x) => ({ x, z: fuel.z + FUEL.depth / 2 + 3, rotationY: 0 })) : [];
    const billboards = BILLBOARDS.flatMap((id) => {
        const spot = place('billboard', [...row, ...behindFuel]);
        return spot ? [{ id, ...spot }] : [];
    });

    // Taxi/bus stops: on the main road east of Career Road (facing north, to the road), and on Career Road's west
    // side near the entrance (facing east). Each gets a call-box kiosk beside it.
    const stops = [
        place('stop', range(right + 3, bounds.maxX - 2, 0.5).map((x) => ({ x, z: mainSouth + STOP_SETBACK, rotationY: Math.PI }))),
        place('stop', range(end - 3, north + 3, -0.5).map((z) => ({ x: left - STOP_SETBACK, z, rotationY: Math.PI / 2 }))),
    ].filter(Boolean);
    const kiosks = stops.map((stop) => {
        const along = { x: Math.cos(stop.rotationY), z: -Math.sin(stop.rotationY) }; // the stop's local +x
        return place('kiosk', [2, -2, 2.6, -2.6].map((d) => ({ x: stop.x + along.x * d, z: stop.z + along.z * d, rotationY: stop.rotationY })));
    }).filter(Boolean);
    if (fuel) {
        const kiosk = place('kiosk', [1.4, 2].map((d) => ({ x: fuel.x + FUEL.width / 2 + d, z: mainSouth + 1.2, rotationY: Math.PI })));
        if (kiosk) kiosks.push(kiosk);
    }

    const seeded = (kind, x, z) => createRandom(`${kind}:${x.toFixed(2)},${z.toFixed(2)}`);

    // Palms: both sides of Career Road between the lamps, and along the main road's south side.
    const palmSpots = [
        ...range(north + 5, end - 2, 5).flatMap((z) => [{ x: left - 0.9, z }, { x: right + 0.9, z }]),
        ...range(main.x - main.width / 2 + 6, main.x + main.width / 2 - 6, 6).map((x) => ({ x, z: mainSouth + 0.9 })),
    ];
    const palms = palmSpots.flatMap((spot) => {
        const placed = place('palm', [spot]);
        if (!placed) return [];
        const random = seeded('palm', spot.x, spot.z);
        return [{ ...placed, rotationY: random() * Math.PI * 2, scale: 0.9 + random() * 0.25 }];
    });

    // Benches facing Career Road, in every other gap between a palm and the next lamp.
    const benches = range(north + 6.2, end - 3, 10).flatMap((z) => [
        place('bench', [{ x: left - 0.8, z, rotationY: Math.PI / 2 }]),
        place('bench', [{ x: right + 0.8, z: z + 5, rotationY: -Math.PI / 2 }]),
    ]).filter(Boolean);

    // Parks: a bench on one side facing in and two trees in the far corners (size and green vary).
    const trees = [];
    for (const park of layout.parks) {
        const random = seeded('park', park.x, park.z);
        const side = Math.floor(random() * 4); // 0 south, 1 east, 2 north, 3 west
        const n = [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: -1, z: 0 }][side];
        benches.push({ x: park.x + n.x * PARK_BENCH, z: park.z + n.z * PARK_BENCH, rotationY: Math.atan2(-n.x, -n.z) });
        // The two corners on the far side from the bench.
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].filter(([cx, cz]) => cx * n.x + cz * n.z < 0);
        const spots = corners.map(([cx, cz]) => ({ x: park.x + cx * PARK_CORNER, z: park.z + cz * PARK_CORNER }));
        for (const spot of spots) trees.push({ ...spot, rotationY: random() * Math.PI * 2, scale: 0.85 + random() * 0.35, variant: Math.floor(random() * 3) });
    }

    return { fuel, billboards, stops, kiosks, palms, benches, trees };
};
