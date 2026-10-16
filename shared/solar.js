// Sun maths shared by the server (/api/buea fallback) and the browser (day/night, P2-02).
// NOAA solar calculator equations; pure, no dependencies.
const DAY = 24 * 60 * 60 * 1000;

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** Declination (deg) and equation of time (min) at Julian day `jd`. */
const sunCoordinates = (jd) => {
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
    return { decl, eqTime };
};

const julian = (ms) => ms / DAY + 2440587.5;

/**
 * Sunrise and sunset (epoch ms) on a calendar date at lat/lon (sun's upper limb with standard refraction,
 * sea-level horizon). Null during polar day or night.
 * @param {string} date 'YYYY-MM-DD' (the local date; the result is in absolute time)
 */
export const solarTimes = (date, lat, lon) => {
    const midnight = Date.parse(`${date}T00:00:00Z`);
    const { decl, eqTime } = sunCoordinates(julian(midnight) + 0.5 - lon / 360); // around local solar noon
    const cosHa = Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(rad(decl))) - Math.tan(rad(lat)) * Math.tan(rad(decl));
    if (cosHa < -1 || cosHa > 1) return null; // polar day or night (never in Buea)
    const ha = deg(Math.acos(cosHa));
    const noon = 720 - 4 * lon - eqTime; // minutes after UTC midnight
    return { sunrise: midnight + (noon - 4 * ha) * 60000, sunset: midnight + (noon + 4 * ha) * 60000 };
};

/**
 * Where the sun is at `ms`: elevation above the true horizon (deg, no refraction), azimuth (deg clockwise from
 * north) and whether it is still rising (before solar noon).
 */
export const solarPosition = (ms, lat, lon) => {
    const { decl, eqTime } = sunCoordinates(julian(ms));
    const utcMinutes = (((ms % DAY) + DAY) % DAY) / 60000;
    const solarMinutes = (((utcMinutes + eqTime + 4 * lon) % 1440) + 1440) % 1440;
    const ha = solarMinutes / 4 - 180; // hour angle, deg; negative in the morning
    const cosZenith = Math.sin(rad(lat)) * Math.sin(rad(decl)) + Math.cos(rad(lat)) * Math.cos(rad(decl)) * Math.cos(rad(ha));
    const zenith = Math.acos(Math.min(1, Math.max(-1, cosZenith)));
    const azimuth = deg(Math.atan2(
        Math.sin(rad(ha)),
        Math.cos(rad(ha)) * Math.sin(rad(lat)) - Math.tan(rad(decl)) * Math.cos(rad(lat)),
    )) + 180;
    return { elevation: 90 - deg(zenith), azimuth: azimuth % 360, rising: ha < 0 };
};
