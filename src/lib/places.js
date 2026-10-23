// Places a taxi can take you to (P3B-06), each with the camera view to arrive at. Also the destinations of the AI
// guide's rides (P4-04). Pure; the drop-off on the road comes from traffic.js rideTarget(place.point).
import { CAMERA } from './camera.js';
import { aboutHouseSpot } from './aboutContent.js';

export const PLACE_VIEW = { elevation: 0.55, district: 24, about: 13, downtownExtra: 14 };

const NAMES = { cinema: 'Cinema', school: 'School', arcade: 'Arcade', pitch: 'Pitch', market: 'Market' };

/**
 * @param {object} layout  layoutCity() output
 * @param {{ about?: boolean }} options  about: the About house is built (it has content)
 * @returns {{ id: string, name: string, point: { x: number, z: number }, from: { x: number, z: number }, distance: number }[]}
 *   point = what you came to see; from = the direction the camera looks at it from (unit vector on the ground)
 */
export const cityPlaces = (layout, { about = false } = {}) => {
    const unit = (x, z) => ({ x: x / Math.hypot(x, z), z: z / Math.hypot(x, z) });
    const { downtown } = layout;
    const places = [{
        id: 'downtown', name: 'Downtown', point: { x: downtown.x, z: downtown.z }, from: unit(0.35, 1),
        distance: downtown.size + PLACE_VIEW.downtownExtra,
    }];
    // Districts: seen from the main road side, a little towards Career Road. The Market's stalls face south, so it's
    // seen from the entrance side.
    for (const d of layout.districts) {
        const row = d.z < downtown.z + downtown.size / 2 ? 1 : -1;
        const from = d.id === 'market' ? unit(0.35, 1) : unit(-Math.sign(d.x) * 0.5, row);
        places.push({ id: d.id, name: NAMES[d.id] ?? d.id, point: { x: d.x, z: d.z }, from, distance: PLACE_VIEW.district });
    }
    const career = layout.roads.find((r) => r.kind === 'career');
    if (about && career) {
        places.push({ id: 'about', name: 'About house', point: aboutHouseSpot(career), from: unit(-1, 0.4), distance: PLACE_VIEW.about });
    }
    return places;
};

/** Camera position and target for arriving at `place`. */
export const placeView = (place) => {
    const { point, from, distance } = place;
    const d = Math.min(distance, CAMERA.maxDistance);
    const flat = Math.cos(PLACE_VIEW.elevation) * d;
    return {
        position: [point.x + from.x * flat, CAMERA.minTargetY + Math.sin(PLACE_VIEW.elevation) * d, point.z + from.z * flat],
        target: [point.x, CAMERA.minTargetY, point.z],
    };
};
