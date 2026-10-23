// Ground-floor shopfronts downtown (P3B-08, design_system.md → "Interactive city"): every project building has a shop on
// each face that looks onto a street (a block is 2 × 2 lots, so two faces), with the project's own name over it.
// Pure and deterministic; src/city/Shopfronts.jsx draws them and Buildings.jsx leaves those ground-floor windows out.
// Faces as in Buildings.jsx: 0 south (+z), 1 east (+x), 2 north (−z), 3 west (−x); rotationY = face × π/2 turns a
// shop's local front (+z) to face out.
import { COLORS, mixHex } from './palette.js';
import { createRandom } from './random.js';

export const AWNINGS = [
    COLORS.ember,
    COLORS.indigo,
    mixHex(COLORS.fakoGreen, COLORS.basalt, 0.1),
    mixHex(COLORS.window, COLORS.ember, 0.35),
    mixHex(COLORS.sky, COLORS.indigo, 0.35),
];

const inside = (p, r) => Math.abs(p.x - r.x) <= r.width / 2 && Math.abs(p.z - r.z) <= r.depth / 2;

/**
 * @param {ReturnType<import('./layout.js').layoutCity>} layout
 * @returns {{ slug: string, face: number, x: number, z: number, rotationY: number, width: number, awning: string }[]}
 */
export const shopfronts = (layout) => layout.lots.flatMap((lot) => {
    const block = layout.pavements.find((p) => inside(lot, p));
    if (!block) return [];
    const { width: w, depth: d } = lot.building;
    const awning = AWNINGS[Math.floor(createRandom(`shop:${lot.slug}`)() * AWNINGS.length)];
    const faces = [lot.z > block.z ? 0 : 2, lot.x > block.x ? 1 : 3];
    return faces.map((face) => {
        const angle = (face * Math.PI) / 2;
        const out = face % 2 ? w / 2 : d / 2;
        return {
            slug: lot.slug, face, awning,
            x: lot.x + Math.sin(angle) * out, z: lot.z + Math.cos(angle) * out, rotationY: angle,
            width: face % 2 ? d : w,
        };
    });
});

/** slug → Set of faces with a shop (their ground-floor windows give way to it). */
export const shopFaces = (shops) => {
    const map = new Map();
    for (const s of shops) map.set(s.slug, (map.get(s.slug) ?? new Set()).add(s.face));
    return map;
};
