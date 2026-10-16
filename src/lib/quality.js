// Render quality levels (P1-08). The city starts at a guess from the device, then drei's PerformanceMonitor
// steps it down when frames are slow and back up when there's headroom.

export const LEVELS = ['low', 'medium', 'high'];

// Levels change only the pixel ratio and the shadow map size: neither recompiles shaders (turning shadows
// off would recompile every material, a long freeze on a phone). The shadow map is static (src/city/Sun.jsx),
// so even at 'low' its only per-frame cost is sampling it.
export const QUALITY = {
    // dpr: max device pixel ratio (CLAUDE.md caps phones at 1.5).
    low: { dpr: 1, shadowMap: 512 },
    medium: { dpr: 1.25, shadowMap: 1024 },
    high: { dpr: 1.5, shadowMap: 2048 },
};

/**
 * First guess from what the browser tells us. Unknown values (Safari/Firefox have no deviceMemory) don't count against.
 * @param {{ cores?: number, memoryGb?: number, touch?: boolean }} device
 */
export const initialQuality = ({ cores, memoryGb, touch = false } = {}) => {
    const weak = (cores !== undefined && cores <= 2) || (memoryGb !== undefined && memoryGb <= 2);
    if (weak) return 'low';
    const modest = (cores !== undefined && cores <= 4) || (memoryGb !== undefined && memoryGb <= 4);
    if (touch) return modest ? 'low' : 'medium';
    return modest ? 'medium' : 'high';
};

/** One level up (dir = 1) or down (dir = -1), clamped. */
export const stepQuality = (level, dir) => {
    const i = LEVELS.indexOf(level);
    return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, (i < 0 ? 0 : i) + dir))];
};
