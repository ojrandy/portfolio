// Street lamps (P2-03, docs/design_system.md → "City lights"): lamp spots from layoutCity().
// Pure and deterministic; each lamp's switch-on point is seeded by its position, so it is the same for everyone.
import { STREET } from './layout.js';
import { SWITCH_LAST } from './buildings.js';
import { createRandom } from './random.js';

export const LAMP_INSET = 0.2; // inside a block's pavement edge
export const ROADSIDE = 0.3; // outside a road's edge
export const MAIN_SPACING = 6;
export const CAREER_SPACING = 5;
const JUNCTION_CLEAR = 1; // keep the main-road lamps this far from Career Road's sides

const along = (from, length, spacing) => {
    const out = [];
    for (let p = from + spacing / 2; p < from + length; p += spacing) out.push(p);
    return out;
};

/**
 * @param {ReturnType<import('./layout.js').layoutCity>} layout
 * @returns {{ x: number, z: number, switchAt: number }[]}
 */
export const lampSpots = (layout) => {
    const spots = [];

    // Each block: 4 corners + 4 edge midpoints, just inside the pavement (every 4 units on today's 8-unit blocks).
    for (const p of layout.pavements) {
        const xs = [p.x - p.width / 2 + LAMP_INSET, p.x, p.x + p.width / 2 - LAMP_INSET];
        const zs = [p.z - p.depth / 2 + LAMP_INSET, p.z, p.z + p.depth / 2 - LAMP_INSET];
        for (const z of zs) {
            for (const x of xs) if (x !== p.x || z !== p.z) spots.push({ x, z });
        }
    }

    // Both sides of Career Road.
    const career = layout.roads.find((r) => r.kind === 'career');
    for (const z of along(career.z - career.depth / 2, career.depth, CAREER_SPACING)) {
        spots.push({ x: career.x - career.width / 2 - ROADSIDE, z }, { x: career.x + career.width / 2 + ROADSIDE, z });
    }

    // Main road: the south side minus Career Road's mouth; the north side only beside the district plots
    // (downtown's own pavement lamps already line the rest).
    const main = layout.roads.find((r) => r.kind === 'main');
    const outer = layout.downtown.size / 2 + STREET;
    for (const x of along(main.x - main.width / 2, main.width, MAIN_SPACING)) {
        if (Math.abs(x - career.x) > career.width / 2 + JUNCTION_CLEAR) spots.push({ x, z: main.z + main.depth / 2 + ROADSIDE });
        if (Math.abs(x) > outer + JUNCTION_CLEAR) spots.push({ x, z: main.z - main.depth / 2 - ROADSIDE });
    }

    return spots.map(({ x, z }) => ({ x, z, switchAt: createRandom(`lamp:${x.toFixed(2)},${z.toFixed(2)}`)() * SWITCH_LAST }));
};
