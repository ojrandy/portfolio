// Arcade state (P3-09): eggs found (saved in this browser only), the latest find for the toast, and the short
// effects the scene reads each frame through getState() (no re-renders).
import { create } from 'zustand';
import { STORAGE_KEY, parseProgress, serializeProgress } from '../lib/arcadeEggs.js';

const EFFECT_MS = 6000;

// Storage can be missing or throw (private windows, blocked site data); the eggs still work for this visit.
const load = () => {
    try {
        return parseProgress(window.localStorage.getItem(STORAGE_KEY));
    } catch {
        return [];
    }
};

const save = (found) => {
    try {
        window.localStorage.setItem(STORAGE_KEY, serializeProgress(found));
    } catch {
        // nothing to do
    }
};

const useArcadeStore = create((set, get) => ({
    found: load(),
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
    reset: () => {
        save([]);
        set({ found: [], latest: null });
    },
}));

export default useArcadeStore;
