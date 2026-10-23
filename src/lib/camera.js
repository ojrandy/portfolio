// Camera rig maths (P1-05): views, limits and keyboard order as plain data. Rendered by src/city/CameraRig.jsx.
// Axes as in layout.js: Fako is north (−z), the camera enters from the south (+z).
import { FAKO, fakoPlacement } from './backdrop.js';

export const CAMERA = {
    fov: 45, // vertical, degrees
    near: 0.1,
    far: 2000, // the backdrop needs ≥ 2000
    minDistance: 6,
    maxDistance: 100, // with the target kept inside the city, the camera stays within ~120 of it
    minPolar: 0.2, // rad from straight up; avoids the gimbal flip overhead
    maxPolar: Math.PI / 2 - 0.03, // never below the target, and the target never below minTargetY
    minTargetY: 1,
    maxTargetY: 20,
};

export const HOME = {
    height: 12, // eye height above the start of Career Road
    summitAt: 0.6, // Fako's summit sits at 60 % of the upper half of the view
    minPitch: 0.05, // always look a little down (rad), so the view is within maxPolar
    sideMargin: 2, // room beside downtown's front row on narrow screens
    maxBackOff: 0.9, // never back off further than 90 % of maxDistance from downtown's centre
};

export const BUILDING_VIEW = {
    // From the south-west for every building; the next sides are only used when a tower hides it from there.
    azimuths: [-Math.PI / 4, 0, -Math.PI / 2, Math.PI / 4, (-3 * Math.PI) / 4],
    elevation: 0.45, // rad above the horizon; raised in steps when a taller building is in the way
    maxElevation: Math.PI / 2 - CAMERA.minPolar,
    step: 0.1,
    distance: (height) => Math.min(40, Math.max(CAMERA.minDistance + 4, height * 1.4 + 8)),
    backOff: 1.3, // if no angle clears at this distance, move back and try again
    maxDistance: 60,
    clearance: 0.3, // around other buildings' footprints
    roofClearance: 1, // above their roofs (flags, beacons; a thin crane mast in the way is fine)
    samples: 32,
};

// Critically damped flights (camera-controls smoothDamp) settle in ~3.3 × smoothTime: 1.2–1.8 s.
export const FLIGHT = { minSmoothTime: 0.36, maxSmoothTime: 0.55, farDistance: 100, restSmoothTime: 0.25 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Start view: at the entrance, looking up Career Road with downtown in front and Fako in frame.
 * On narrow (portrait) screens it backs down Career Road, and rises with it, until downtown's front row fits.
 */
export const homeView = (layout, { aspect = 16 / 9 } = {}) => {
    const { entrance, bounds, downtown } = layout;
    const halfFov = (CAMERA.fov * Math.PI) / 360;
    const halfWidth = Math.atan(Math.tan(halfFov) * aspect);
    const front = downtown.z + downtown.size / 2;
    const fitZ = front + (downtown.size / 2 + HOME.sideMargin) / Math.tan(halfWidth);
    const z = clamp(fitZ, entrance.z, downtown.z + CAMERA.maxDistance * HOME.maxBackOff);
    const run = z - downtown.z;
    const height = HOME.height * (run / (entrance.z - downtown.z));

    const fako = fakoPlacement(bounds);
    const toSummit = Math.atan2(FAKO.height - height, Math.hypot(fako.x - entrance.x, fako.z - z));
    const pitch = Math.min(toSummit - HOME.summitAt * halfFov, -HOME.minPitch);
    const targetY = clamp(height + Math.tan(pitch) * run, CAMERA.minTargetY, CAMERA.maxTargetY);
    return { position: [entrance.x, height, z], target: [entrance.x, targetY, downtown.z] };
};

const insideBuilding = ([x, y, z], lot, { clearance, roofClearance }) => {
    const b = lot.building;
    return Math.abs(x - lot.x) < b.width / 2 + clearance
        && Math.abs(z - lot.z) < b.depth / 2 + clearance
        && y < b.height + roofClearance;
};

/** True when another building stands between `from` and `to`. */
export const isBlocked = (from, to, lots, ignoreSlug, opts = BUILDING_VIEW) => {
    for (let i = 0; i < opts.samples; i++) {
        const t = i / opts.samples;
        const p = [0, 1, 2].map((k) => from[k] + (to[k] - from[k]) * t);
        if (lots.some((lot) => lot.slug !== ignoreSlug && insideBuilding(p, lot, opts))) return true;
    }
    return false;
};

/**
 * View of one building from the south-west, raised (then moved back) until nothing taller is in the way.
 * Only if no angle clears from there does it try the next sides (south, west, south-east, north-west).
 */
export const buildingView = (lot, lots, opts = BUILDING_VIEW) => {
    const { height } = lot.building;
    const target = [lot.x, Math.max(CAMERA.minTargetY, height * 0.5), lot.z];
    const at = (azimuth, elevation, distance) => {
        const flat = Math.cos(elevation) * distance;
        return [
            target[0] + Math.sin(azimuth) * flat,
            target[1] + Math.sin(elevation) * distance,
            target[2] + Math.cos(azimuth) * flat,
        ];
    };
    let position;
    for (const azimuth of opts.azimuths) {
        for (let distance = opts.distance(height); distance <= opts.maxDistance; distance *= opts.backOff) {
            for (let elevation = opts.elevation; elevation <= opts.maxElevation; elevation += opts.step) {
                position = at(azimuth, elevation, distance);
                if (!isBlocked(position, target, lots, lot.slug, opts)) return { position, target };
            }
        }
    }
    return { position, target }; // not reached with real heights (tested): the highest, furthest view
};

/** Keyboard order: front row (nearest Career Road) first, then row by row; west to east within a row. */
export const tabOrder = (lots) => [...lots].sort((a, b) => b.z - a.z || a.x - b.x).map((l) => l.slug);

/**
 * Next focus for Tab (dir 1) / Shift+Tab (dir −1). `null` focus is the start view.
 * Returns undefined past either end, so focus can leave the canvas (no keyboard trap).
 */
export const stepFocus = (order, focus, dir) => {
    const i = order.indexOf(focus);
    if (i === -1) return dir > 0 ? order[0] : order.at(-1);
    return order[i + dir];
};

/** smoothTime for a flight of `distance`: longer trips take a little longer. */
export const flightSmoothTime = (distance, f = FLIGHT) =>
    f.minSmoothTime + (f.maxSmoothTime - f.minSmoothTime) * clamp(distance / f.farDistance, 0, 1);

/** Target box for camera-controls' setBoundary: the city footprint (layout.reach: down to the T), from MIN to MAX target height. */
export const targetBounds = (bounds) => ({
    min: [bounds.minX, CAMERA.minTargetY, bounds.minZ],
    max: [bounds.maxX, CAMERA.maxTargetY, bounds.maxZ],
});
