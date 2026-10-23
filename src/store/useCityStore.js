// Small global city state (ADR-002): which building the camera is on, which is hovered, which panel is open.
// The camera rig (P1-05), building clicks (P1-06) and the AI's fly_to_project tool (P4-04) share these actions.
// P3B-06: the vehicle the camera follows, taxi rides (rideTo, also for the AI guide) and places the camera is on.
// P3B-09: drive mode (you drive a taxi or a bendskin; Drive.jsx) and the building you are stopped next to.
// P3B-11: the police chase, for the drive chip.
import { create } from 'zustand';
import { stepFocus } from '../lib/camera.js';

const BUBBLE_MS = 1600;
// Taxi rides never hang (owner): a taxi must answer within RIDE_FIND_MS, and the ride ends by RIDE_MAX_MS (traffic.js
// RIDE.max = 120 s, plus a little to step out).
const RIDE_FIND_MS = 1500;
const RIDE_MAX_MS = 125000;
// Anything that moves the camera on purpose ends a follow or a ride.
const away = { place: null, following: null, ride: null, driving: null, driveNear: null, chase: null };

const useCityStore = create((set, get) => ({
    focus: null, // building slug the camera is on, or null for the start view
    hovered: null, // building slug under the mouse
    openSlug: null, // building whose project panel is open
    xraySlug: null, // building currently separated into X-Ray layers
    order: [], // keyboard order (tabOrder), set by the camera rig
    place: null, // place id (places.js) the camera is on, after a ride
    visit: 0, // counts arrivals, so arriving again at the same place still moves the camera
    following: null, // { id, type }: the vehicle the camera follows
    ride: null, // { place, id, riding }: id = the taxi once one is on its way (riding true)
    bubble: null, // { key, text, at: () => [x, y, z] | null }: a speech bubble over something clicked
    driving: null, // { vehicle: 'taxi' | 'moto', view: 'chase' | 'seat', key }: you drive
    driveNear: null, // slug of the building you are stopped next to while driving
    chase: null, // { phase, distance }: the police car after you (P3B-11), for the drive chip

    setOrder: (order) => set(({ focus, hovered, openSlug, xraySlug }) => {
        const keep = (slug) => (order.includes(slug) ? slug : null);
        return { order, focus: keep(focus), hovered: keep(hovered), openSlug: keep(openSlug), xraySlug: keep(xraySlug) };
    }),
    flyTo: (slug) => set({ ...away, focus: get().order.includes(slug) ? slug : null }),
    goHome: () => set({ ...away, focus: null }),
    /** Tab / Shift+Tab. Returns false past either end, so focus can leave the canvas. */
    step: (dir) => {
        const next = stepFocus(get().order, get().focus, dir);
        if (next === undefined) return false;
        set({ ...away, focus: next });
        return true;
    },
    setHovered: (slug) => set({ hovered: slug }),
    /** Fly to a building and open its panel. */
    openProject: (slug) => {
        if (get().order.includes(slug)) set({ ...away, focus: slug, openSlug: slug, xraySlug: null });
    },
    toggleXRay: (slug) => set((state) => (
        state.openSlug === slug ? { xraySlug: state.xraySlug === slug ? null : slug } : {}
    )),
    closeProject: () => set({ openSlug: null, xraySlug: null }),

    /** Open a building's panel without moving the camera (stopped next to it in drive mode). */
    peekProject: (slug) => {
        if (get().order.includes(slug)) set({ openSlug: slug, xraySlug: null });
    },

    /** Follow a vehicle with the camera (a click on it). Leaves any ride or drive. */
    follow: (vehicle) => set({ following: { id: vehicle.id, type: vehicle.type }, ride: null, driving: null, driveNear: null }),
    /** Stop following (Esc, the Stop button): the camera goes back to where it was. Cancels a ride. */
    stopFollowing: () => set({ following: null, ride: null }),
    /**
     * Take a taxi to a place (places.js id). The traffic finds the taxi (Traffic.jsx). Watchdog, whatever happens in
     * the 3D loop: no taxi within RIDE_FIND_MS, or still riding after RIDE_MAX_MS → the camera goes to the place.
     */
    rideTo: (place) => {
        const key = Date.now() + Math.random();
        set({ ride: { place, id: null, riding: false, key }, driving: null, driveNear: null });
        const giveUp = (riding) => () => {
            const r = get().ride;
            if (r?.key === key && (riding || !r.riding)) get().arrive(place);
        };
        window.setTimeout(giveUp(false), RIDE_FIND_MS);
        window.setTimeout(giveUp(true), RIDE_MAX_MS);
    },
    /** The traffic found a taxi for the ride: follow it. */
    rideStarted: (vehicle) => set(({ ride }) => (ride && !ride.riding
        ? { ride: { ...ride, id: vehicle.id, riding: true }, following: { id: vehicle.id, type: vehicle.type } }
        : {})),
    /** Arrived (or skipped, or no taxi could go): the camera goes to the place. */
    arrive: (place) => set({ ...away, focus: null, place, visit: get().visit + 1 }),
    skipRide: () => {
        const { ride, arrive } = get();
        if (ride) arrive(ride.place);
    },
    /** Drive a taxi or a bendskin (drive.js DRIVABLE). Leaves any follow or ride; the camera comes back on park. */
    startDrive: (vehicle) => set({ ...away, place: get().place, driving: { vehicle, view: 'chase', key: Date.now() + Math.random() } }),
    /** The chase view or the driver's seat (taxi only). */
    setDriveView: (view) => set(({ driving }) => (driving ? { driving: { ...driving, view } } : {})),
    stopDrive: () => set({ driving: null, driveNear: null, chase: null }),
    /** The police chase for the chip (P3B-11): { phase: 'chasing' | 'stopped', distance (whole units) }, or null. */
    setChase: (chase) => {
        const now = get().chase;
        if (now?.phase !== chase?.phase || now?.distance !== chase?.distance) set({ chase });
    },
    setDriveNear: (slug) => { if (get().driveNear !== slug) set({ driveNear: slug }); },
    /** A speech bubble over `at()` for `ms` (a honk is short; a sentence stays longer). */
    say: (text, at, ms = BUBBLE_MS) => {
        const key = Date.now() + Math.random();
        set({ bubble: { key, text, at } });
        window.setTimeout(() => { if (get().bubble?.key === key) set({ bubble: null }); }, ms);
    },
}));

export default useCityStore;
