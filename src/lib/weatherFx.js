// Weather FX (P2-04, docs/design_system.md → Weather): /api/buea weather → effect levels, how they change the
// day/night lighting, and when lightning flashes. Pure, so it is tested without a browser.
import { COLORS, desaturate, mixHex } from './palette.js';
import { FOG } from './backdrop.js';
import { createRandom } from './random.js';

// Defaults per kind (server/lib/weather.js), used when the code or the measurement doesn't say more.
const KINDS = {
    clear: { cloud: 0.1, rain: 0, fog: 0 },
    cloudy: { cloud: 0.7, rain: 0, fog: 0 },
    fog: { cloud: 0.6, rain: 0, fog: 1 },
    drizzle: { cloud: 0.85, rain: 0.3, fog: 0.3 },
    rain: { cloud: 0.9, rain: 0.7, fog: 0.2 },
    showers: { cloud: 0.85, rain: 0.75, fog: 0.1 },
    thunderstorm: { cloud: 1, rain: 0.9, fog: 0.2 },
    snow: { cloud: 0.9, rain: 0, fog: 0.4 }, // never in Buea; drawn as a grey, misty day
};
const CLOUD_BY_CODE = { 0: 0, 1: 0.15, 2: 0.45, 3: 0.85 };
const RAIN_BY_CODE = {
    51: 0.2, 53: 0.3, 55: 0.4, 56: 0.2, 57: 0.3,
    61: 0.45, 63: 0.7, 65: 1, 66: 0.45, 67: 0.7,
    80: 0.5, 81: 0.75, 82: 1,
    95: 0.9, 96: 1, 99: 1,
};
const HEAVY_RAIN_MM = 6; // mm in the last hour that counts as full rain

export const CLEAR = { cloud: 0, rain: 0, fog: 0, storm: false, gloom: 0 };

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const round = (v) => Math.round(v * 1000) / 1000;

/**
 * /api/buea `weather` ({ code, kind, cloud %, rain mm, … }; the dev override sends only `kind`) → effect levels:
 * { cloud, rain, fog } (0..1), `storm`, and `gloom` (0..1, how much darker the city gets). Missing → CLEAR.
 */
export const weatherFx = (weather) => {
    const base = weather && KINDS[weather.kind];
    if (!base) return CLEAR;
    const precipitating = base.rain > 0 || base.fog > 0;

    let cloud = Number.isFinite(weather.cloud) ? weather.cloud / 100 : CLOUD_BY_CODE[weather.code] ?? base.cloud;
    if (precipitating) cloud = Math.max(cloud, base.cloud);
    let rain = base.rain > 0 ? RAIN_BY_CODE[weather.code] ?? base.rain : 0;
    if (rain > 0 && Number.isFinite(weather.rain)) rain = Math.max(rain, weather.rain / HEAVY_RAIN_MM);
    const storm = weather.kind === 'thunderstorm';
    cloud = clamp01(cloud);
    rain = clamp01(rain);
    const gloom = clamp01(0.55 * cloud + 0.35 * rain + 0.1 * base.fog + (storm ? 0.15 : 0));

    return { cloud: round(cloud), rain: round(rain), fog: base.fog, storm, gloom: round(gloom) };
};

// How far the weather moves the lighting at full strength.
export const WEATHER_LIGHT = {
    skyGrey: 0.85, // zenith → overcast grey, × cloud
    horizonGrey: 0.7, // horizon (and fog) → overcast grey, × max(cloud, fog)
    darken: 0.45, // overcast grey → basalt, × gloom
    sunDim: 0.8, // direct light lost, × gloom (overcast light is soft: faint shadows)
    ambientDim: 0.2,
    fogNear: 20, // scene fog at full fog (clear: FOG.near / FOG.far)
    fogFar: 260,
    rainFog: 0.35, // fog distances shrink by this × rain
    mist: { fog: 1.6, cloud: 0.6 }, // Fako mist band density: 1 + fog × 1.6 + cloud × 0.6
    lightsEarlier: 5, // degrees: city lights switch on this much earlier at full gloom
};

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * A lightingAt() result (sRGB) under `fx` → { zenith, horizon, mist, light, ambient, fog: { near, far }, weather }.
 * Clear weather changes nothing. `weather` = { mistDensity, wet, rain, cloud, storm } for the scene.
 */
export const applyWeather = (lit, fx = CLEAR) => {
    const W = WEATHER_LIGHT;
    const { cloud, rain, fog, gloom } = fx;
    const near = lerp(FOG.near, W.fogNear, fog) * (1 - W.rainFog * rain);
    const far = lerp(FOG.far, W.fogFar, fog) * (1 - W.rainFog * rain);
    const weather = {
        mistDensity: 1 + W.mist.fog * fog + W.mist.cloud * cloud,
        wet: rain > 0 ? Math.min(1, 0.4 + rain) : 0,
        rain,
        cloud,
        storm: fx.storm,
    };
    if (cloud === 0 && rain === 0 && fog === 0 && gloom === 0) return { ...lit, fog: { near, far }, weather };

    const grey = mixHex(desaturate(mixHex(lit.horizon, lit.zenith, 0.5), 1), COLORS.basalt, W.darken * gloom);
    return {
        ...lit,
        zenith: mixHex(lit.zenith, grey, W.skyGrey * cloud),
        horizon: mixHex(lit.horizon, grey, W.horizonGrey * Math.max(cloud, fog)),
        mist: desaturate(lit.mist, 0.5 * cloud),
        light: { ...lit.light, color: desaturate(lit.light.color, 0.6 * cloud), intensity: lit.light.intensity * (1 - W.sunDim * gloom) },
        ambient: { color: desaturate(lit.ambient.color, 0.6 * cloud), intensity: lit.ambient.intensity * (1 - W.ambientDim * gloom) },
        fog: { near, far },
        weather,
    };
};

// Lightning: at most one strike per 14 s slot, 3–9 s into it, so strikes are 8–20 s apart. A strike is one or two
// short flashes within 0.32 s, so never more than 3 flashes in a second (WCAG 2.3.1).
export const LIGHTNING = { slot: 14, from: 3, spread: 6, pulse: 0.12, second: 0.2 };

const strike = (slot) => {
    const random = createRandom(`lightning:${slot}`);
    return { at: slot * LIGHTNING.slot + LIGHTNING.from + random() * LIGHTNING.spread, double: random() > 0.4 };
};

const pulse = (dt) => (dt >= 0 && dt < LIGHTNING.pulse ? 1 - dt / LIGHTNING.pulse : 0);

/** Lightning brightness (0..1) at `seconds` on the scene clock. Seeded, so the same for everyone. */
export const lightningAt = (seconds) => {
    const s = strike(Math.floor(seconds / LIGHTNING.slot));
    const dt = seconds - s.at;
    return Math.max(pulse(dt), s.double ? 0.7 * pulse(dt - LIGHTNING.second) : 0);
};
