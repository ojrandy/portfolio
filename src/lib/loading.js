// Loading screen logic (P1-07). Progress is the real steps the city goes through, never a made-up percentage.
import { COLORS, mixHex } from './palette.js';

// Each label says what is happening while that step is still running.
export const STEPS = [
    { id: 'code', label: 'Loading the city…' },
    { id: 'data', label: 'Fetching the projects…' },
    { id: 'frame', label: 'Raising the buildings…' },
];

// Below this (ms since navigation) the screen never shows, so fast loads don't flash.
export const SHOW_DELAY = 300;
export const FADE_OUT = 0.4; // s
export const RISE = 0.5; // s per building
export const RISE_SPREAD = 0.4; // s from the west end to the east end

/**
 * @param {{ code: boolean, data: 'loading'|'ready'|'error', frame: boolean, webgl: boolean }} s
 * Steps count in order: a later step only counts once the earlier ones are done.
 */
export const loadingState = ({ code = false, data = 'loading', frame = false, webgl = true } = {}) => {
    const total = STEPS.length;
    if (!webgl) return { completed: 0, total, label: 'This browser can’t show the 3D city (WebGL is off or not supported).', error: 'webgl', done: false };
    if (data === 'error') return { completed: code ? 1 : 0, total, label: 'Couldn’t fetch the projects.', error: 'data', done: false };

    const flags = [code, data === 'ready', frame];
    let completed = 0;
    while (completed < total && flags[completed]) completed++;
    const done = completed === total;
    return { completed, total, label: done ? 'Ready.' : STEPS[completed].label, error: null, done };
};

/**
 * Front elevation of the city (seen from Career Road) for the loader.
 * Back rows come first so nearer buildings are drawn on top; nearer rows are lighter.
 * @param {{ slug: string, x: number, z: number, building: { width: number, height: number, accentColor: string } }[]} lots
 */
export const skyline = (lots) => {
    if (!lots.length) return { bars: [], width: 0, height: 0 };
    const minX = Math.min(...lots.map((l) => l.x - l.building.width / 2));
    const maxX = Math.max(...lots.map((l) => l.x + l.building.width / 2));
    const rows = [...new Set(lots.map((l) => l.z))].sort((a, b) => a - b);
    const depth = (z) => (rows.length > 1 ? rows.indexOf(z) / (rows.length - 1) : 1);

    const bars = [...lots]
        .sort((a, b) => a.z - b.z || a.x - b.x)
        .map((l) => ({
            slug: l.slug,
            x: l.x - l.building.width / 2 - minX,
            width: l.building.width,
            height: l.building.height,
            fill: mixHex(COLORS.ash, COLORS.mist, 0.05 + 0.2 * depth(l.z)),
            accent: l.building.accentColor,
        }));
    return { bars, width: maxX - minX, height: Math.max(...lots.map((l) => l.building.height)) };
};
