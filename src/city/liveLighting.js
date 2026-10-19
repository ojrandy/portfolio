// The lighting the scene is drawn with right now, as three.js objects that DayNight eases towards a target.
// Sky and Fako use these Color instances directly as uniform values, so nothing re-renders when they change.
import * as THREE from 'three';

// Above this angle a change of light direction is a moon/sun swap (both dark): snap instead of sweeping.
const SNAP_ANGLE = (10 * Math.PI) / 180;

export const createLighting = () => ({
    zenith: new THREE.Color(),
    horizon: new THREE.Color(),
    mist: new THREE.Color(),
    lightColor: new THREE.Color(),
    lightIntensity: 0,
    lightDirection: new THREE.Vector3(0, 1, 0),
    ambientColor: new THREE.Color(),
    ambientIntensity: 0,
    windows: 0, // city lights (P2-03), 0..1
    lamps: 0,
});

/** lightingAt() result (sRGB hex) → the same shape as createLighting() (linear colours). */
export const toTarget = (l, out = createLighting()) => {
    out.zenith.set(l.zenith);
    out.horizon.set(l.horizon);
    out.mist.set(l.mist);
    out.lightColor.set(l.light.color);
    out.lightIntensity = l.light.intensity;
    out.lightDirection.fromArray(l.light.direction).normalize();
    out.ambientColor.set(l.ambient.color);
    out.ambientIntensity = l.ambient.intensity;
    out.windows = l.city.windows;
    out.lamps = l.city.lamps;
    return out;
};

const COLOR_KEYS = ['zenith', 'horizon', 'mist', 'lightColor', 'ambientColor'];
const SCALAR_KEYS = ['lightIntensity', 'ambientIntensity', 'windows', 'lamps'];

/** Move `live` a fraction `t` (0..1) of the way to `target`; t = 1 copies it. */
export const easeLighting = (live, target, t) => {
    for (const k of COLOR_KEYS) live[k].lerp(target[k], t);
    for (const k of SCALAR_KEYS) live[k] += (target[k] - live[k]) * t;
    if (t >= 1 || live.lightDirection.angleTo(target.lightDirection) > SNAP_ANGLE) live.lightDirection.copy(target.lightDirection);
    else live.lightDirection.lerp(target.lightDirection, t).normalize();
};
