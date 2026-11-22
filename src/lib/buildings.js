// Building rules (docs/design_system.md → "Building rules"): one /api/city project → one building.
// Pure and deterministic: no Date.now(), randomness seeded by slug.
import { COLORS, languageColor, mixHex, desaturate } from './palette.js';
import { createRandom, shuffledIndices } from './random.js';

export const FLOOR_HEIGHT = 0.6;
export const HEIGHT_K = 1.6;
export const MIN_FLOORS = 3;
export const MAX_FLOORS = 20;
export const MIN_HEIGHT = MIN_FLOORS * FLOOR_HEIGHT; // 1.8
export const MAX_HEIGHT = MAX_FLOORS * FLOOR_HEIGHT; // 12
// Owner effort sits on the same log2 scale as commits: effort 10 ≈ 128 commits (log2 = 7).
export const EFFORT_TO_LOG2 = 0.7;

export const FOOTPRINTS = {
    small: { size: 1.6, columns: 2 },
    medium: { size: 2.2, columns: 3 },
    large: { size: 3.0, columns: 4 },
};
export const FACES = 4;

// City kit (ART-03, design_system.md "City art"): footprints built from Blender pieces instead of boxes, and the
// window openings in those pieces (must match art/blender/pieces.py). Other footprints stay boxes until ART-04.
export const KIT = {
    widths: { medium: 'w3' },
    corner: 0.25,
    windowWidth: 0.42,
    sillTop: 0.16,
    lintel: 0.44,
    inset: 0.03, // glass set back from the wall (LOD0); LOD1 has its glass on the wall
    roofDeck: 0.03, // the roof's walkable surface above the roof piece's base
};

export const CRANE_DAYS = 7;
export const LIT_MAX = 0.9; // pushed today
export const LIT_MIN = 0.1; // pushed a year or more ago
const LIT_HORIZON_DAYS = 365;
// Without a push date, the owner's status stands in for activity.
export const LIT_BY_STATUS = { 'in-progress': 0.6, live: 0.4, archived: 0.1 };
export const LIT_UNKNOWN = 0.25;
// Dusk (P2-03): each lit window switches on when the city's window level (0..1) passes its seeded point in
// [0, SWITCH_LAST], so every lit window is on before the level reaches 1. Unlit windows never switch on.
export const SWITCH_LAST = 0.9;
export const SWITCH_NEVER = 2;

const MIN_LANGUAGE_SHARE = 0.05;
const DAY_MS = 86_400_000;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Score on the log2-commits scale, or null when there is no data. */
const activityScore = (stats, effort) => {
    if (stats?.source === 'github' && Number.isFinite(stats.commits)) return Math.log2(stats.commits + 1);
    if (stats?.source === 'owner' && Number.isFinite(effort)) return effort * EFFORT_TO_LOG2;
    return null;
};

export const buildingHeight = (project) => {
    const score = activityScore(project.stats, project.effort);
    // Snap to whole floors so windows line up.
    const floors = score === null
        ? MIN_FLOORS
        : clamp(Math.round((score * HEIGHT_K) / FLOOR_HEIGHT), MIN_FLOORS, MAX_FLOORS);
    return { floors, height: floors * FLOOR_HEIGHT };
};

/** Scope: stack size from content; GitHub-only projects fall back to languages over 5 %. */
export const buildingFootprint = (project) => {
    let scope = project.stack?.length ?? 0;
    if (scope === 0 && project.stats?.languages) {
        scope = Object.values(project.stats.languages).filter((share) => share >= MIN_LANGUAGE_SHARE).length;
    }
    if (scope >= 5) return 'large';
    if (scope >= 3) return 'medium';
    return 'small';
};

const daysSince = (iso, now) => {
    const t = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(t)) return null;
    return Math.max(0, (now - t) / DAY_MS);
};

export const litWindowRatio = (project, now) => {
    const days = daysSince(project.stats?.lastPush, now);
    if (days === null) return LIT_BY_STATUS[project.status] ?? LIT_UNKNOWN;
    const fade = Math.log1p(Math.min(days, LIT_HORIZON_DAYS)) / Math.log1p(LIT_HORIZON_DAYS);
    return LIT_MAX - (LIT_MAX - LIT_MIN) * fade;
};

export const hasCrane = (project, now) => {
    const days = daysSince(project.stats?.lastPush, now);
    return days !== null && days <= CRANE_DAYS;
};

/**
 * @param {object} project  one entry of /api/city `projects`
 * @param {{ now: number }} opts  current time in ms (injected for determinism and tests)
 */
export const toBuilding = (project, { now }) => {
    const { floors, height } = buildingHeight(project);
    const footprint = buildingFootprint(project);
    const { size, columns } = FOOTPRINTS[footprint];
    const weathered = project.status === 'archived';

    let accentColor = languageColor(project.primaryLanguage);
    let bodyColor = mixHex(COLORS.ash, accentColor, 0.12);
    if (weathered) {
        accentColor = desaturate(accentColor, 0.7);
        bodyColor = desaturate(bodyColor, 0.8);
    }

    const ratio = litWindowRatio(project, now);
    const windowCount = floors * columns * FACES;
    // Fixed per-slug order, so a higher ratio lights more of the same windows.
    const order = shuffledIndices(windowCount, createRandom(project.slug));
    const litCount = Math.round(ratio * windowCount);
    const lit = new Array(windowCount).fill(false);
    for (let i = 0; i < litCount; i++) lit[order[i]] = true;
    const switchRandom = createRandom(`${project.slug}:dusk`);
    const windowSwitch = lit.map((on) => (on ? switchRandom() * SWITCH_LAST : SWITCH_NEVER));

    return {
        slug: project.slug,
        height,
        floors,
        footprint,
        width: size,
        depth: size,
        columns,
        accentColor,
        bodyColor,
        // Kit wall paint (ART-03): the accent as paint, 35 % paper.
        paintColor: mixHex(accentColor, COLORS.paper, 0.35),
        litWindowRatio: ratio,
        // Index = face * floors * columns + floor * columns + column.
        litWindows: lit,
        // Same index; the window level at which each window switches on (SWITCH_NEVER when unlit).
        windowSwitch,
        crane: hasCrane(project, now),
        beacon: Boolean(project.live),
        flag: Boolean(project.featured),
        weathered,
    };
};

/** True when this building is drawn from the city kit. */
export const usesKit = (building) => Object.hasOwn(KIT.widths, building.footprint);

/** Window centres along a face (x from the face's middle), the same in every kit floor. */
export const kitWindowCentres = (size, columns) => {
    const gap = (size - 2 * KIT.corner - columns * KIT.windowWidth) / (columns - 1);
    const first = -size / 2 + KIT.corner + KIT.windowWidth / 2;
    return Array.from({ length: columns }, (_, i) => first + i * (KIT.windowWidth + gap));
};

const RUN_MIN = 2;
const RUN_SPREAD = 3; // runs of 2–4 floors

/**
 * The pieces of a kit building, bottom to top: [{ piece, y, rotationY }]. Rotation turns a piece's front (+z) to
 * face `face` (as in shopfronts.js: 0 +z, 1 +x, 2 −z, 3 −x).
 * - Ground floor: its door faces the first side without a shop.
 * - Middle floors: plain or balcony, seeded by slug, the same kind for a run of floors; balconies face a street.
 * - Roof: not turned, so its clutter keeps clear of the crane, beacon and flag spots.
 * @param {object} building  from toBuilding
 * @param {Set<number>} [shopFaces]  faces with a shop
 */
export const kitPieces = (building, shopFaces = new Set()) => {
    const w = KIT.widths[building.footprint];
    const turn = (face) => (face * Math.PI) / 2;
    const doorFace = [0, 1, 2, 3].find((face) => !shopFaces.has(face)) ?? 0;
    const balconyFace = [0, 1, 2, 3].find((face) => shopFaces.has(face)) ?? (doorFace + 2) % FACES;

    const pieces = [{ piece: `floor_ground_${w}`, y: 0, rotationY: turn(doorFace) }];
    const random = createRandom(`${building.slug}:floors`);
    let kind = random() < 0.5 ? 'plain' : 'balcony';
    let left = RUN_MIN + Math.floor(random() * RUN_SPREAD);
    for (let floor = 1; floor < building.floors; floor++) {
        if (left === 0) {
            kind = kind === 'plain' ? 'balcony' : 'plain';
            left = RUN_MIN + Math.floor(random() * RUN_SPREAD);
        }
        left--;
        pieces.push({
            piece: `floor_mid_${kind}_${w}`,
            y: floor * FLOOR_HEIGHT,
            rotationY: turn(kind === 'balcony' ? balconyFace : doorFace),
        });
    }
    pieces.push({ piece: `roof_flat_${w}`, y: building.height, rotationY: 0 });
    return pieces;
};

export const toBuildings = (projects, opts) => projects.map((p) => toBuilding(p, opts));
