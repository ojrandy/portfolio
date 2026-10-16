// Buea time, sun and weather for /api/buea (P2-01, ADR-005). Open-Meteo needs no key; the request URL is fixed
// to api.open-meteo.com and built from validated numbers. Everything except the client is pure and tested.
import { z } from 'zod';

const API = 'https://api.open-meteo.com/v1/forecast';
const DAY = 24 * 60 * 60 * 1000;

export const BUEA = { lat: 4.1527, lon: 9.241, tz: 'Africa/Douala' };

const validTimeZone = (tz) => {
    try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
    } catch {
        return false;
    }
};

const configSchema = z.object({
    BUEA_LAT: z.coerce.number().min(-90).max(90).default(BUEA.lat),
    BUEA_LON: z.coerce.number().min(-180).max(180).default(BUEA.lon),
    BUEA_TZ: z.string().refine(validTimeZone, 'unknown IANA time zone').default(BUEA.tz),
});

/** { lat, lon, tz } from BUEA_LAT / BUEA_LON / BUEA_TZ (empty values use Buea's). Throws on invalid values. */
export const weatherConfig = (env = {}) => {
    const clean = Object.fromEntries(['BUEA_LAT', 'BUEA_LON', 'BUEA_TZ'].filter((k) => env[k]).map((k) => [k, env[k]]));
    const c = configSchema.parse(clean);
    return { lat: c.BUEA_LAT, lon: c.BUEA_LON, tz: c.BUEA_TZ };
};

// WMO weather codes (Open-Meteo docs) → the kinds in design_system.md and the words the status line uses.
const WMO = {
    0: ['clear', 'clear'], 1: ['clear', 'mostly clear'], 2: ['cloudy', 'partly cloudy'], 3: ['cloudy', 'overcast'],
    45: ['fog', 'fog'], 48: ['fog', 'freezing fog'],
    51: ['drizzle', 'light drizzle'], 53: ['drizzle', 'drizzle'], 55: ['drizzle', 'heavy drizzle'],
    56: ['drizzle', 'light freezing drizzle'], 57: ['drizzle', 'freezing drizzle'],
    61: ['rain', 'light rain'], 63: ['rain', 'rain'], 65: ['rain', 'heavy rain'],
    66: ['rain', 'light freezing rain'], 67: ['rain', 'freezing rain'],
    71: ['snow', 'light snow'], 73: ['snow', 'snow'], 75: ['snow', 'heavy snow'], 77: ['snow', 'snow grains'],
    80: ['showers', 'light showers'], 81: ['showers', 'showers'], 82: ['showers', 'heavy showers'],
    85: ['snow', 'light snow showers'], 86: ['snow', 'snow showers'],
    95: ['thunderstorm', 'thunderstorm'], 96: ['thunderstorm', 'thunderstorm with hail'], 99: ['thunderstorm', 'thunderstorm with heavy hail'],
};
export const WMO_CODES = Object.keys(WMO).map(Number);

/** WMO code → { kind, label }, or null for a code Open-Meteo doesn't document. */
export const describeWeather = (code) => {
    const entry = WMO[code];
    return entry ? { kind: entry[0], label: entry[1] } : null;
};

const localStamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const responseSchema = z.object({
    utc_offset_seconds: z.int().min(-14 * 3600).max(14 * 3600),
    current: z.object({
        time: localStamp,
        temperature_2m: z.number(),
        weather_code: z.int().refine((c) => c in WMO, 'unknown WMO code'),
        cloud_cover: z.number().min(0).max(100),
        rain: z.number().min(0),
        wind_speed_10m: z.number().min(0),
    }),
    daily: z.object({
        time: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
        sunrise: z.array(localStamp).min(1),
        sunset: z.array(localStamp).min(1),
    }),
});

/** '2026-10-16T06:07' at UTC+1 (3600 s) → epoch ms. */
export const localToMs = (stamp, offsetSeconds) => Date.parse(`${stamp}:00Z`) - offsetSeconds * 1000;

/** Epoch ms → ISO with the place's offset, e.g. '2026-10-16T06:07:00+01:00'. */
export const toOffsetIso = (ms, offsetMinutes) => {
    const shifted = new Date(ms + offsetMinutes * 60 * 1000).toISOString().slice(0, 19);
    const sign = offsetMinutes < 0 ? '-' : '+';
    const abs = Math.abs(offsetMinutes);
    return `${shifted}${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
};

/** Local date 'YYYY-MM-DD', time 'HH:MM' and UTC offset in minutes for `ms` in time zone `tz`. */
export const localParts = (ms, tz) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        hourCycle: 'h23', timeZoneName: 'longOffset',
    }).formatToParts(ms).map((p) => [p.type, p.value]));
    const m = parts.timeZoneName.match(/GMT([+-])(\d{2}):?(\d{2})?/);
    const offsetMinutes = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, offsetMinutes };
};

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/**
 * Sunrise and sunset (epoch ms) on a calendar date at lat/lon, NOAA solar calculator equations
 * (sun's upper limb with standard refraction, sea-level horizon). Used only when Open-Meteo is unavailable.
 * @param {string} date 'YYYY-MM-DD' (the local date; the result is in absolute time)
 */
export const solarTimes = (date, lat, lon) => {
    const midnight = Date.parse(`${date}T00:00:00Z`);
    const jd = midnight / DAY + 2440587.5 + 0.5 - lon / 360; // around local solar noon
    const t = (jd - 2451545) / 36525;

    const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
    const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
    const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
    const c = Math.sin(rad(m)) * (1.914602 - t * (0.004817 + 0.000014 * t))
        + Math.sin(rad(2 * m)) * (0.019993 - 0.000101 * t) + Math.sin(rad(3 * m)) * 0.000289;
    const appLong = l0 + c - 0.00569 - 0.00478 * Math.sin(rad(125.04 - 1934.136 * t));
    const obliq = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
        + 0.00256 * Math.cos(rad(125.04 - 1934.136 * t));
    const decl = deg(Math.asin(Math.sin(rad(obliq)) * Math.sin(rad(appLong))));
    const y = Math.tan(rad(obliq / 2)) ** 2;
    const eqTime = 4 * deg(y * Math.sin(2 * rad(l0)) - 2 * e * Math.sin(rad(m))
        + 4 * e * y * Math.sin(rad(m)) * Math.cos(2 * rad(l0))
        - 0.5 * y * y * Math.sin(4 * rad(l0)) - 1.25 * e * e * Math.sin(2 * rad(m)));

    const cosHa = Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(rad(decl))) - Math.tan(rad(lat)) * Math.tan(rad(decl));
    if (cosHa < -1 || cosHa > 1) return null; // polar day or night (never in Buea)
    const ha = deg(Math.acos(cosHa));
    const noon = 720 - 4 * lon - eqTime; // minutes after UTC midnight
    return { sunrise: midnight + (noon - 4 * ha) * 60000, sunset: midnight + (noon + 4 * ha) * 60000 };
};

/** Open-Meteo response → { offsetSeconds, weather, days: [{ date, sunrise, sunset }] } (times in epoch ms). Throws on a bad shape. */
export const parseOpenMeteo = (json) => {
    const r = responseSchema.parse(json);
    const off = r.utc_offset_seconds;
    const { current: c, daily: d } = r;
    return {
        offsetSeconds: off,
        weather: {
            code: c.weather_code,
            ...describeWeather(c.weather_code),
            tempC: c.temperature_2m,
            cloud: c.cloud_cover,
            rain: c.rain,
            wind: c.wind_speed_10m,
            observedAt: localToMs(c.time, off),
        },
        days: d.time.map((date, i) => ({ date, sunrise: localToMs(d.sunrise[i], off), sunset: localToMs(d.sunset[i], off) }))
            .filter((day) => Number.isFinite(day.sunrise) && Number.isFinite(day.sunset)),
    };
};

export const openMeteoUrl = ({ lat, lon, tz }) => {
    const q = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        current: 'temperature_2m,weather_code,cloud_cover,rain,wind_speed_10m',
        daily: 'sunrise,sunset',
        timezone: tz,
        forecast_days: '2',
    });
    return `${API}?${q}`;
};

class WeatherError extends Error {}

/** Fetches and parses Buea's current weather + 2 days of sunrise/sunset. Throws on timeout, HTTP error or bad shape. */
export const createWeatherClient = ({ fetch = globalThis.fetch, timeoutMs = 4000, ...place } = {}) => {
    const url = openMeteoUrl({ ...BUEA, ...place });
    return {
        current: async () => {
            const res = await fetch(url, {
                headers: { Accept: 'application/json', 'User-Agent': 'oj-city (ojongrandy.com)' },
                signal: AbortSignal.timeout(timeoutMs),
            });
            if (!res.ok) throw new WeatherError(`Open-Meteo: HTTP ${res.status}`);
            const parsed = responseSchema.safeParse(await res.json());
            if (!parsed.success) throw new WeatherError('Open-Meteo: unexpected response shape');
            return parseOpenMeteo(parsed.data);
        },
    };
};

export const WEATHER_MAX_AGE = 2 * 60 * 60 * 1000; // older cached weather is not shown as current

/**
 * The /api/buea body for `now`. `upstream` is the cached parseOpenMeteo() result with its fetch time, or null.
 * Sun times come from Open-Meteo when it covers the local date, else from solarTimes(); weather older than
 * WEATHER_MAX_AGE (or missing) becomes the "clear" fallback with source 'fallback', which must not be shown as fact.
 * @param {{ now: number, place: { lat, lon, tz }, upstream?: { data: object, fetchedAt: number } | null }} o
 */
export const bueaState = ({ now, place, upstream = null }) => {
    const local = localParts(now, place.tz);
    const offset = local.offsetMinutes;
    const tomorrow = localParts(Date.parse(`${local.date}T12:00:00Z`) + DAY, 'UTC').date;

    const dayFromUpstream = (date) => upstream?.data.days.find((d) => d.date === date);
    const sunFor = (date) => {
        const d = dayFromUpstream(date);
        if (d) return { sunrise: d.sunrise, sunset: d.sunset, source: 'open-meteo' };
        const s = solarTimes(date, place.lat, place.lon);
        return { ...s, source: 'computed' };
    };
    const today = sunFor(local.date);
    const next = now < today.sunrise ? today : sunFor(tomorrow);

    const fresh = upstream && now - upstream.fetchedAt <= WEATHER_MAX_AGE;
    const w = fresh ? upstream.data.weather : null;
    const weather = w
        ? { code: w.code, kind: w.kind, label: w.label, tempC: w.tempC, cloud: w.cloud, rain: w.rain, wind: w.wind,
            source: 'open-meteo', updatedAt: new Date(upstream.fetchedAt).toISOString() }
        : { code: 0, kind: 'clear', label: null, tempC: null, cloud: null, rain: null, wind: null, source: 'fallback', updatedAt: null };

    return {
        now: new Date(now).toISOString(),
        tz: place.tz,
        utcOffsetMinutes: offset,
        localDate: local.date,
        localTime: local.time,
        isDay: now >= today.sunrise && now < today.sunset,
        sun: {
            sunrise: toOffsetIso(today.sunrise, offset),
            sunset: toOffsetIso(today.sunset, offset),
            nextSunrise: toOffsetIso(next.sunrise, offset),
            source: today.source === 'open-meteo' && next.source === 'open-meteo' ? 'open-meteo' : 'computed',
        },
        weather,
    };
};
