// Arcade state (P3-09): eggs found (saved in this browser only), the latest find for the toast, and the short
// effects the scene reads each frame through getState() (no re-renders).
import { create } from 'zustand';
import { STORAGE_KEY, parseProgress, serializeProgress } from '../lib/arcadeEggs.js';
import { BEST_KEY, parseBest } from '../lib/codeRunner.js';

const EFFECT_MS = 6000;

// Storage can be missing or throw (private windows, blocked site data); the eggs still work for this visit.
const read = (key) => {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
};

const write = (key, value) => {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // nothing to do
    }
};

const save = (found) => write(STORAGE_KEY, serializeProgress(found));

const useArcadeStore = create((set, get) => ({
    found: parseProgress(read(STORAGE_KEY)),
    best: parseBest(read(BEST_KEY)), // Code runner (P3-09b)
    latest: null, // egg id for the toast
    hubOpen: false,
    marqueeFlashUntil: 0, // performance.now() ms
    mistClearUntil: 0,

    /** Records an egg; returns true the first time. */
    find: (id) => {
        if (get().found.includes(id)) return false;
        const found = [...get().found, id];
        save(found);
        set({ found, latest: id });
        return true;
    },
    dismissToast: () => set({ latest: null }),
    flashMarquee: () => set({ marqueeFlashUntil: performance.now() + EFFECT_MS }),
    clearMist: () => set({ mistClearUntil: performance.now() + EFFECT_MS }),
    openHub: () => {
        set({ hubOpen: true });
        get().find('hub');
    },
    closeHub: () => set({ hubOpen: false }),
    /** Keeps the best Code runner score; returns true for a new best. */
    recordScore: (score) => {
        if (score <= get().best) return false;
        write(BEST_KEY, String(score));
        set({ best: score });
        return true;
    },
    reset: () => {
        save([]);
        write(BEST_KEY, '0');
        set({ found: [], latest: null, best: 0 });
    },
}));

export default useArcadeStore;
