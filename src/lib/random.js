// Deterministic randomness: the same seed string always gives the same sequence,
// so the city looks the same for every visitor until the data changes.

/** 32-bit FNV-1a hash of a string. */
export const hashString = (str) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
};

/** mulberry32 PRNG seeded by a string; returns () => float in [0, 1). */
export const createRandom = (seed) => {
    let a = hashString(String(seed));
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/** Fisher–Yates shuffle of [0..n-1] driven by a seeded PRNG. */
export const shuffledIndices = (n, random) => {
    const out = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};
