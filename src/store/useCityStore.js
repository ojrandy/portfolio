// Small global city state (ADR-002): which building the camera is on.
// The camera rig (P1-05), building clicks (P1-06) and the AI's fly_to_project tool (P4-04) share these actions.
import { create } from 'zustand';
import { stepFocus } from '../lib/camera.js';

const useCityStore = create((set, get) => ({
    focus: null, // building slug, or null for the start view
    order: [], // keyboard order (tabOrder), set by the camera rig

    setOrder: (order) => set(({ focus }) => ({ order, focus: order.includes(focus) ? focus : null })),
    flyTo: (slug) => set({ focus: get().order.includes(slug) ? slug : null }),
    goHome: () => set({ focus: null }),
    /** Tab / Shift+Tab. Returns false past either end, so focus can leave the canvas. */
    step: (dir) => {
        const next = stepFocus(get().order, get().focus, dir);
        if (next === undefined) return false;
        set({ focus: next });
        return true;
    },
}));

export default useCityStore;
