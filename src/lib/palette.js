// OJ City colour tokens (docs/design_system.md). Mirrored as --color-* in src/index.css.
export const COLORS = {
    basalt: '#15161A',
    ash: '#2A2C33',
    mist: '#C9D3DA',
    fakoGreen: '#2F6B4F',
    indigo: '#2B3A8C',
    window: '#FFC56B',
    ember: '#E2552B',
    paper: '#F4F1EA',
};

// GitHub language name → accent. Anything else uses indigo.
export const LANGUAGE_COLORS = {
    JavaScript: '#F7DF1E',
    TypeScript: '#3178C6',
    Python: '#3776AB',
    Dart: '#0175C2',
    PHP: '#777BB4',
};

export const languageColor = (language) => LANGUAGE_COLORS[language] ?? COLORS.indigo;

const toRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/** Linear mix of two hex colours; t = 0 → a, t = 1 → b. */
export const mixHex = (a, b, t) => {
    const ca = toRgb(a);
    const cb = toRgb(b);
    return toHex(ca.map((v, i) => v + (cb[i] - v) * t));
};

/** Move a colour towards its own grey by `amount` (0..1). */
export const desaturate = (hex, amount) => {
    const [r, g, b] = toRgb(hex);
    const grey = 0.299 * r + 0.587 * g + 0.114 * b;
    return toHex([r, g, b].map((v) => v + (grey - v) * amount));
};
