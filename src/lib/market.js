// Market district (P3B-07, design_system.md → "Interactive city"): where the stalls stand on the Market plot, the
// shoppers walking the aisles, market hours and clicks. Pure and deterministic (seeded); src/city/MarketPlot.jsx draws it.
// Stalls stand in rows facing south (towards the start view), each row with its aisle in front. The owner's first
// service takes the front row's corner nearest Career Road. Local frame of a stall: front +z, rotationY 0.
import { createRandom } from './random.js';
import { rayBox } from './cityPicking.js';

// Sized to the people (0.47 tall): counter at waist height, the tarp at about twice head height, the sign above it.
export const STALL = { width: 1.5, depth: 1.1, pitch: 1.75, aisle: 1.3, height: 1.4, perRow: 6, rows: 3 };
export const SHOPPER = { speed: [0.35, 0.55], browse: [3, 8], ahead: 0.45, lane: 0.35, half: 0.18, height: 0.5 };
const FADE = 1; // seconds for a shopper to arrive or leave
const STRIDE = 22; // gait phase per unit walked (as pedestrians.js)
const SIGN_SPACE = 2.3; // the plot's east end (towards Career Road) is left for the MARKET sign
const SELLER_BACK = 0.1; // the seller stands this far behind the stall's centre, between the shelf and the counter

// Market hours (Buea time, minutes → share of shoppers): sellers set up from 06:00, busiest 09:00–16:00, closed by 19:30.
const HOURS = [[0, 0], [360, 0], [420, 0.5], [540, 1], [960, 1], [1080, 0.5], [1170, 0], [1440, 0]];

export const marketDensity = (minutes) => {
    const m = ((minutes % 1440) + 1440) % 1440;
    const i = HOURS.findIndex(([at]) => at > m);
    const [a, va] = HOURS[i - 1];
    const [b, vb] = HOURS[i];
    return va + ((vb - va) * (m - a)) / (b - a);
};

/** The stalls are open (sellers in, lights on at dusk) while any shoppers are expected. */
export const marketOpen = (minutes) => marketDensity(minutes) > 0;

/**
 * Stall spots on the plot for `count` services (at most rows × perRow), in the owner's order.
 * @returns {{ index, x, z, rotationY, seller: { x, z }, front: number }[]}  front = the z of the stall's aisle line
 */
export const marketStalls = (plot, count) => {
    const n = Math.min(count, STALL.rows * STALL.perRow);
    if (n <= 0) return [];
    const rows = Math.ceil(n / STALL.perRow);
    const perRow = Math.ceil(n / rows);
    const rowDepth = STALL.depth + STALL.aisle;
    // The rows fill the plot from the south edge; the front row's aisle ends at the plot's edge.
    const south = plot.z + plot.depth / 2;
    const east = plot.x + plot.width / 2;
    const out = [];
    for (let index = 0; index < n; index++) {
        const row = Math.floor(index / perRow);
        const col = index % perRow;
        const z = south - STALL.aisle - STALL.depth / 2 - row * rowDepth;
        const x = east - SIGN_SPACE - STALL.pitch * (col + 0.5);
        out.push({ index, x, z, rotationY: 0, seller: { x, z: z - SELLER_BACK }, front: z + STALL.depth / 2 + SHOPPER.ahead });
    }
    return out;
};

/** How many shoppers walk the market at most: about two for every three stalls. */
export const maxShoppers = (stalls) => Math.ceil((stalls.length * 2) / 3);

/** Shoppers walk their row's aisle from stall to stall and stop to browse. */
export const createShoppers = (stalls, { count = maxShoppers(stalls), seed = 'market' } = {}) => {
    const random = createRandom(`shoppers:${seed}`);
    const shoppers = Array.from({ length: stalls.length ? count : 0 }, (_, i) => {
        const at = stalls[Math.floor(random() * stalls.length)];
        return {
            id: `shopper-${i}`, x: at.x, z: at.front + (i % 3) * SHOPPER.lane, lane: (i % 3) * SHOPPER.lane, rotationY: Math.PI, target: at.index,
            speed: SHOPPER.speed[0] + random() * (SHOPPER.speed[1] - SHOPPER.speed[0]),
            wait: random() * SHOPPER.browse[1], phase: random() * Math.PI * 2, scale: 0, look: 0,
        };
    });
    return { stalls, shoppers, random, t: 0 };
};

/**
 * One step: `target` shoppers are out (the rest fade away). A browsing shopper faces the stall; then walks to another
 * stall in the same row.
 */
export const stepShoppers = (state, dt, { target = state.shoppers.length } = {}) => {
    const { stalls, random } = state;
    state.t += dt;
    state.shoppers.forEach((s, i) => {
        const out = i < target;
        s.scale = Math.min(1, Math.max(0, s.scale + (out ? dt : -dt) / FADE));
        s.look = Math.max(0, s.look - dt);
        if (s.wait > 0) {
            s.wait -= dt;
            if (s.wait <= 0) {
                const goal = stalls[s.target];
                const row = stalls.filter((st) => st.front === goal.front && st.index !== goal.index);
                if (row.length) s.target = row[Math.floor(random() * row.length)].index;
                else s.wait = SHOPPER.browse[0];
            }
            return;
        }
        const goal = stalls[s.target];
        const dx = goal.x - s.x;
        const step = s.speed * dt;
        if (Math.abs(dx) <= step) {
            s.x = goal.x;
            s.wait = SHOPPER.browse[0] + random() * (SHOPPER.browse[1] - SHOPPER.browse[0]);
            return;
        }
        s.x += Math.sign(dx) * step;
        s.z = goal.front + s.lane;
        s.rotationY = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
        s.phase += step * STRIDE;
    });
};

/** Where to draw a shopper: browsing ones face their stall (north); clicked ones turn to the camera for a moment. */
export const shopperPose = (s) => {
    const walking = s.wait <= 0;
    return { x: s.x, z: s.z, rotationY: walking ? s.rotationY : Math.PI + (s.look > 0 ? Math.PI : 0), scale: s.scale, phase: walking ? s.phase : 0, stride: walking ? 1 : 0 };
};

/** A clicked shopper stops and turns round for `seconds`. */
export const pokeShopper = (s, seconds = 2) => {
    s.look = seconds;
    s.wait = Math.max(s.wait, seconds);
};

/** The nearest stall or shopper the ray hits: { kind: 'stall' | 'shopper', item, distance } or null. */
export const pickMarket = (state, ray) => {
    let best = null;
    const consider = (kind, item, distance) => {
        if (distance !== null && (!best || distance < best.distance)) best = { kind, item, distance };
    };
    for (const st of state.stalls) {
        consider('stall', st, rayBox(ray, { x: st.x, z: st.z, rotationY: 0, hw: STALL.width / 2, hl: STALL.depth / 2, y1: STALL.height }));
    }
    for (const s of state.shoppers) {
        if (s.scale < 0.5) continue;
        consider('shopper', s, rayBox(ray, { x: s.x, z: s.z, rotationY: 0, hw: SHOPPER.half, hl: SHOPPER.half, y1: SHOPPER.height }));
    }
    return best;
};

/** The MARKET sign at the plot's south-east corner, turned to Career Road and the entrance. */
export const marketSign = (plot) => ({
    x: plot.x + plot.width / 2 - SIGN_SPACE / 2,
    z: plot.z + plot.depth / 2 - 0.65,
    rotationY: Math.PI / 4,
});
