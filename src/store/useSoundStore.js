// Sound on/off (P3B-06; P5-08 builds on it): muted by default, the choice remembered in this browser.
import { create } from 'zustand';

export const SOUND_KEY = 'oj-city:sound';

const read = () => {
    try {
        return window.localStorage.getItem(SOUND_KEY) === 'on';
    } catch {
        return false;
    }
};

const useSoundStore = create((set, get) => ({
    on: read(),
    toggle: () => {
        const on = !get().on;
        try {
            window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
        } catch {
            // the toggle still works for this visit
        }
        set({ on });
    },
}));

export default useSoundStore;
