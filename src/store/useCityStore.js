// Small global city state (ADR-002): which building the camera is on, which is hovered, which panel is open.
// The camera rig (P1-05), building clicks (P1-06) and the AI's fly_to_project tool (P4-04) share these actions.
import { create } from 'zustand';
import { stepFocus } from '../lib/camera.js';

const useCityStore = create((set, get) => ({
    focus: null, // building slug the camera is on, or null for the start view
    hovered: null, // building slug under the mouse
    openSlug: null, // building whose project panel is open
    order: [], // keyboard order (tabOrder), set by the camera rig

    setOrder: (order) => set(({ focus, hovered, openSlug }) => {
        const keep = (slug) => (order.includes(slug) ? slug : null);
        return { order, focus: keep(focus), hovered: keep(hovered), openSlug: keep(openSlug) };
    }),
    flyTo: (slug) => set({ focus: get().order.includes(slug) ? slug : null }),
    goHome: () => set({ focus: null }),
    /** Tab / Shift+Tab. Returns false past either end, so focus can leave the canvas. */
    step: (dir) => {
        const next = stepFocus(get().order, get().focus, dir);
        if (next === undefined) return false;
        set({ focus: next });
        return true;
    },
    setHovered: (slug) => set({ hovered: slug }),
    /** Fly to a building and open its panel. */
    openProject: (slug) => {
        if (get().order.includes(slug)) set({ focus: slug, openSlug: slug });
    },
    closeProject: () => set({ openSlug: null }),
}));

export default useCityStore;
