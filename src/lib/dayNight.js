// Day/night (P2-02): Buea's real sun position → sky colours, sun/moon light and ambient light.
// Keyframes are keyed by the sun's elevation, one set for the morning and one for the evening, and blended
// linearly between them, so the scene changes continuously. Rendered by src/city/DayNight.jsx.
import { solarPosition } from '../../shared/solar.js';
import { COLORS, mixHex } from './palette.js';
import { SKY_NIGHT } from './backdrop.js';
import { CLEAR, WEATHER_LIGHT, applyWeather } from './weatherFx.js';

export const BUEA_PLACE = { lat: 4.1527, lon: 9.241 };
export const BUEA_UTC_OFFSET_MINUTES = 60; // Africa/Douala, WAT, no daylight saving

// Phase boundaries (sun elevation, deg). Near the equator the sun crosses them fast (~15° an hour).
export const PHASES = { night: -10, day: 8 };

// The shadow-casting light never goes higher than this: Buea's noon sun is ~75–90° up, which flattens the city.
export const SHADOW_MAX_ELEVATION = 60;
// ...or lower than this, so a sun on the horizon doesn't light the city from below the ground.
export const SHADOW_MIN_ELEVATION = 6;
// Below this the light is the moon (both are dark around the swap).
export const MOON_BELOW = -6;
// A plain fixed moonlight (south-east, 45° up), not the real moon's position or phase.
export const MOON = { azimuth: 135, elevation: 45 };

const mist = COLORS.mist;
const indigo = COLORS.indigo;
const sky = COLORS.sky;
const ember = COLORS.ember;
const glow = COLORS.window;
const paper = COLORS.paper;
const basalt = COLORS.basalt;

const NIGHT_AMBIENT = { color: mixHex(mist, indigo, 0.3), intensity: 0.6 };

const KEY = {
    night: {
        ...SKY_NIGHT,
        light: { color: mixHex(mist, indigo, 0.35), intensity: 0.8 },
        ambient: NIGHT_AMBIENT,
    },
    preDawn: {
        zenith: mixHex(basalt, indigo, 0.45),
        horizon: mixHex(mixHex(indigo, ember, 0.25), mist, 0.2),
        mist: mixHex(mist, indigo, 0.3),
        light: { color: mixHex(ember, glow, 0.5), intensity: 0 },
        ambient: NIGHT_AMBIENT,
    },
    dawn: {
        zenith: mixHex(indigo, mist, 0.25),
        horizon: mixHex(mixHex(ember, mist, 0.55), glow, 0.1),
        mist: mixHex(mist, ember, 0.15),
        light: { color: mixHex(glow, ember, 0.35), intensity: 0.9 },
        ambient: { color: mixHex(mist, ember, 0.15), intensity: 0.8 },
    },
    morning: {
        zenith: mixHex(sky, mist, 0.4),
        horizon: mixHex(mist, glow, 0.15),
        mist,
        light: { color: mixHex(glow, paper, 0.5), intensity: 1.6 },
        ambient: { color: mist, intensity: 0.9 },
    },
    day: {
        zenith: sky,
        horizon: mixHex(sky, paper, 0.6),
        mist: mixHex(mist, paper, 0.5),
        light: { color: paper, intensity: 2.8 },
        ambient: { color: mixHex(mist, paper, 0.3), intensity: 1.15 },
    },
    golden: {
        zenith: mixHex(sky, indigo, 0.25),
        horizon: mixHex(mist, glow, 0.35),
        mist: mixHex(mist, glow, 0.2),
        light: { color: mixHex(glow, paper, 0.3), intensity: 1.6 },
        ambient: { color: mixHex(mist, glow, 0.15), intensity: 0.9 },
    },
    dusk: {
        zenith: mixHex(indigo, mist, 0.2),
        horizon: mixHex(ember, glow, 0.35),
        mist: mixHex(mist, ember, 0.3),
        light: { color: mixHex(ember, glow, 0.5), intensity: 1 },
        ambient: { color: mixHex(mist, ember, 0.2), intensity: 0.8 },
    },
    blueHour: {
        zenith: mixHex(basalt, indigo, 0.5),
        horizon: mixHex(mixHex(indigo, ember, 0.3), basalt, 0.2),
        mist: mixHex(mist, indigo, 0.35),
        light: { color: mixHex(ember, glow, 0.5), intensity: 0 },
        ambient: NIGHT_AMBIENT,
    },
};

// [sun elevation (deg), keyframe], ascending elevation. The two sets meet at night and day, so noon and midnight are seamless.
export const KEYFRAMES = {
    morning: [[-12, KEY.night], [MOON_BELOW, KEY.preDawn], [0, KEY.dawn], [PHASES.day, KEY.morning], [20, KEY.day]],
    evening: [[-12, KEY.night], [MOON_BELOW, KEY.blueHour], [0, KEY.dusk], [PHASES.day, KEY.golden], [20, KEY.day]],
};

/** Phase name for a sun elevation; dawn vs dusk by whether the sun is rising. */
export const phaseOf = (elevation, rising) => {
    if (elevation < PHASES.night) return 'night';
    if (elevation >= PHASES.day) return 'day';
    return rising ? 'dawn' : 'dusk';
};

/** The sun in Buea at `ms`: { elevation, azimuth, rising, phase }. */
export const sunState = (ms, place = BUEA_PLACE) => {
    const p = solarPosition(ms, place.lat, place.lon);
    return { ...p, phase: phaseOf(p.elevation, p.rising) };
};

// City lights (P2-03), by sun elevation: 0 at or above `off`, 1 at or below `on`, linear between. The same ramps run
// backwards at dawn. Windows lead the lamps, so lamps come on in the blue hour and go off just after sunrise.
export const CITY_LIGHTS = {
    windows: { off: 6, on: -4 },
    lamps: { off: 2, on: -6 },
};

const ramp = (elevation, { off, on }) => Math.min(1, Math.max(0, (off - elevation) / (off - on)));

/**
 * How far the city lights are switched on (0..1) for a sun elevation: { windows, lamps }. Under a dark sky
 * (`gloom`, weatherFx) they switch on earlier, as if the sun were up to WEATHER_LIGHT.lightsEarlier degrees lower.
 */
export const cityLightsAt = ({ elevation }, gloom = 0) => {
    const e = elevation - WEATHER_LIGHT.lightsEarlier * gloom;
    return { windows: ramp(e, CITY_LIGHTS.windows), lamps: ramp(e, CITY_LIGHTS.lamps) };
};

/** Status line shown in the city: local time, weather label and the owner line. */
export const statusLine = ({ localTime, weather } = {}) => {
    const parts = [`It's ${localTime ?? '--:--'} in Buea`];
    const label = weather?.label;
    if (label) parts.push(label);
    parts.push('Ojong is probably shipping something');
    return parts.join(' · ');
};

/** Unit vector towards a sky position in city space: east +x, up +y, north −z (Fako). */
export const skyDirection = (azimuth, elevation) => {
    const az = (azimuth * Math.PI) / 180;
    const el = (elevation * Math.PI) / 180;
    return [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)];
};

const lerp = (a, b, t) => a + (b - a) * t;
const blend = (a, b, t) => ({
    zenith: mixHex(a.zenith, b.zenith, t),
    horizon: mixHex(a.horizon, b.horizon, t),
    mist: mixHex(a.mist, b.mist, t),
    light: { color: mixHex(a.light.color, b.light.color, t), intensity: lerp(a.light.intensity, b.light.intensity, t) },
    ambient: { color: mixHex(a.ambient.color, b.ambient.color, t), intensity: lerp(a.ambient.intensity, b.ambient.intensity, t) },
});

/**
 * Scene lighting for a sun state under weather `fx` (weatherFx(); clear by default):
 * { zenith, horizon, mist, light: { color, intensity, direction, body }, ambient, city, fog: { near, far }, weather }.
 * `horizon` is also the fog and background colour. `body` is 'sun' or 'moon'. `city` = cityLightsAt().
 */
export const lightingAt = ({ elevation, azimuth, rising }, fx = CLEAR) => {
    const frames = rising ? KEYFRAMES.morning : KEYFRAMES.evening;
    let key;
    if (elevation <= frames[0][0]) key = frames[0][1];
    else if (elevation >= frames.at(-1)[0]) key = frames.at(-1)[1];
    else {
        const i = frames.findIndex(([e]) => e > elevation);
        const [e0, k0] = frames[i - 1];
        const [e1, k1] = frames[i];
        key = blend(k0, k1, (elevation - e0) / (e1 - e0));
    }

    const moon = elevation < MOON_BELOW;
    const clamped = Math.min(SHADOW_MAX_ELEVATION, Math.max(SHADOW_MIN_ELEVATION, elevation));
    const direction = moon ? skyDirection(MOON.azimuth, MOON.elevation) : skyDirection(azimuth, clamped);
    const lit = applyWeather({ ...key, light: { ...key.light, direction, body: moon ? 'moon' : 'sun' } }, fx);
    return { ...lit, city: cityLightsAt({ elevation }, fx.gloom) };
};

/** Epoch ms of HH:MM today in Buea (today = Buea's date at `nowMs`). For the dev time preview and P2-06. */
export const bueaTimeToday = (minutes, nowMs) => {
    const offset = BUEA_UTC_OFFSET_MINUTES * 60000;
    const date = new Date(nowMs + offset).toISOString().slice(0, 10);
    return Date.parse(`${date}T00:00:00Z`) - offset + minutes * 60000;
};

/** "HH:MM" in Buea at epoch ms (the status line and the dev HUD). */
export const bueaClock = (ms) => new Date(ms + BUEA_UTC_OFFSET_MINUTES * 60000).toISOString().slice(11, 16);

/** Milliseconds from `ms` to the start of the next minute (so a clock can tick on the minute). */
export const msToNextMinute = (ms) => 60000 - (((ms % 60000) + 60000) % 60000);
