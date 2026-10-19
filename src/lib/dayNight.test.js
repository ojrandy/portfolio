import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    CITY_LIGHTS, KEYFRAMES, MOON, SHADOW_MAX_ELEVATION, SHADOW_MIN_ELEVATION, bueaTimeToday, cityLightsAt, lightingAt, phaseOf,
    bueaClock, msToNextMinute, skyDirection, statusLine, sunState,
} from './dayNight.js';
import { SKY_NIGHT } from './backdrop.js';

const at = (hhmm, date = '2026-10-16') => Date.parse(`${date}T${hhmm}:00+01:00`);
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const near = (a, b, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);

test('phases follow Buea time (sunrise 06:07, sunset 18:09 on 2026-10-16)', () => {
    const cases = {
        '00:30': 'night', '05:20': 'night', '05:45': 'dawn', '06:07': 'dawn', '06:50': 'day',
        '12:00': 'day', '17:20': 'day', '18:09': 'dusk', '18:40': 'dusk', '19:00': 'night', '23:59': 'night',
    };
    for (const [time, phase] of Object.entries(cases)) assert.equal(sunState(at(time)).phase, phase, time);
    assert.equal(phaseOf(0, true), 'dawn');
    assert.equal(phaseOf(0, false), 'dusk');
});

test('night keeps the P1-04 sky and lights the city with the moon', () => {
    const l = lightingAt(sunState(at('23:00')));
    assert.equal(l.zenith, SKY_NIGHT.zenith);
    assert.equal(l.horizon, SKY_NIGHT.horizon);
    assert.equal(l.mist, SKY_NIGHT.mist);
    assert.equal(l.light.body, 'moon');
    assert.ok(near(l.light.direction, skyDirection(MOON.azimuth, MOON.elevation)));
    assert.ok(l.light.intensity > 0);
});

test('day is brighter than night, and dawn and dusk differ', () => {
    const night = lightingAt(sunState(at('02:00')));
    const noon = lightingAt(sunState(at('12:10')));
    assert.ok(noon.light.intensity > 2 * night.light.intensity);
    assert.ok(noon.ambient.intensity > night.ambient.intensity);
    const dawn = lightingAt({ elevation: 0, azimuth: 100, rising: true });
    const dusk = lightingAt({ elevation: 0, azimuth: 260, rising: false });
    assert.notEqual(dawn.horizon, dusk.horizon);
    // A bright, clear day: a blue zenith over a pale horizon.
    const [zr, , zb] = rgb(noon.zenith);
    assert.ok(zb > zr + 100, noon.zenith);
    assert.ok(rgb(noon.horizon).every((v) => v > 170), noon.horizon);
    // Dusk is orange: more red than blue, and redder than the day sky.
    const [r, , b] = rgb(dusk.horizon);
    assert.ok(r > b + 60, dusk.horizon);
});

test('the shadow light stays between 6° and 60°, follows the sun azimuth, and swaps to the moon only in the dark', () => {
    for (let m = 0; m < 24 * 60; m += 5) {
        const s = sunState(at('00:00') + m * 60000);
        const l = lightingAt(s);
        const [, y] = l.light.direction;
        const el = (Math.asin(y) * 180) / Math.PI;
        if (l.light.body === 'sun') {
            assert.ok(el >= SHADOW_MIN_ELEVATION - 1e-9 && el <= SHADOW_MAX_ELEVATION + 1e-9, `${m}: ${el}`);
            const [x, , z] = l.light.direction;
            const az = ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360;
            assert.ok(Math.abs(az - s.azimuth) < 1e-6, `${m}: azimuth`);
        }
    }
    // Around the swap both lights are dark.
    for (const rising of [true, false]) {
        assert.ok(lightingAt({ elevation: -6.01, azimuth: 0, rising }).light.intensity < 0.01);
        assert.ok(lightingAt({ elevation: -5.99, azimuth: 0, rising }).light.intensity < 0.01);
    }
});

test('the scene changes smoothly: no jumps from one minute to the next, all day', () => {
    let prev = lightingAt(sunState(at('00:00')));
    for (let m = 1; m <= 24 * 60; m++) {
        const cur = lightingAt(sunState(at('00:00') + m * 60000));
        for (const key of ['zenith', 'horizon', 'mist']) {
            const d = Math.max(...rgb(cur[key]).map((v, i) => Math.abs(v - rgb(prev[key])[i])));
            assert.ok(d <= 8, `minute ${m} ${key} jumps by ${d}`);
        }
        assert.ok(Math.abs(cur.light.intensity - prev.light.intensity) < 0.06, `minute ${m} light`);
        assert.ok(Math.abs(cur.ambient.intensity - prev.ambient.intensity) < 0.02, `minute ${m} ambient`);
        prev = cur;
    }
});

test('morning and evening keyframes meet at night and at day', () => {
    assert.equal(KEYFRAMES.morning[0][1], KEYFRAMES.evening[0][1]);
    assert.equal(KEYFRAMES.morning.at(-1)[1], KEYFRAMES.evening.at(-1)[1]);
    for (const frames of Object.values(KEYFRAMES)) {
        frames.slice(1).forEach(([e], i) => assert.ok(e > frames[i][0], 'ascending elevations'));
    }
});

test('bueaTimeToday uses Buea’s date, not UTC’s', () => {
    // 23:30 UTC on the 15th is already 00:30 on the 16th in Buea.
    const now = Date.parse('2026-10-15T23:30:00Z');
    assert.equal(bueaTimeToday(21 * 60, now), at('21:00'));
    assert.equal(bueaTimeToday(0, Date.parse('2026-10-16T12:00:00Z')), at('00:00'));
});

test('city lights: off by day, on at night, windows before lamps at dusk and lamps off first at dawn', () => {
    for (const t of ['09:00', '12:10', '17:20']) assert.deepEqual(lightingAt(sunState(at(t))).city, { windows: 0, lamps: 0 }, t);
    for (const t of ['19:30', '23:00', '02:00', '05:00']) assert.deepEqual(lightingAt(sunState(at(t))).city, { windows: 1, lamps: 1 }, t);
    // Just before sunset (18:09) windows are coming on while the lamps are still off.
    const sunset = cityLightsAt(sunState(at('17:55')));
    assert.ok(sunset.windows > 0 && sunset.windows < 1);
    assert.equal(sunset.lamps, 0);
    // Twenty minutes after sunrise (06:07) the lamps are off and some windows are still on.
    const morning = cityLightsAt(sunState(at('06:30')));
    assert.equal(morning.lamps, 0);
    assert.ok(morning.windows > 0);
    assert.ok(CITY_LIGHTS.windows.off > CITY_LIGHTS.lamps.off && CITY_LIGHTS.windows.on > CITY_LIGHTS.lamps.on);
});

test('city lights change smoothly, minute to minute, all day', () => {
    let prev = cityLightsAt(sunState(at('00:00')));
    for (let m = 1; m < 24 * 60; m++) {
        const now = cityLightsAt(sunState(at('00:00') + m * 60000));
        assert.ok(Math.abs(now.windows - prev.windows) < 0.05 && Math.abs(now.lamps - prev.lamps) < 0.05, `minute ${m}`);
        prev = now;
    }
});

test('status line formats Buea time, weather and the owner joke', () => {
    assert.equal(statusLine({ localTime: '23:40', weather: { label: 'light rain' } }), "It's 23:40 in Buea · light rain · Ojong is probably shipping something");
    assert.equal(statusLine({ localTime: '06:10', weather: { label: null } }), "It's 06:10 in Buea · Ojong is probably shipping something");
    assert.equal(statusLine({ localTime: '12:00', weather: null }), "It's 12:00 in Buea · Ojong is probably shipping something");
});

test('Buea clock: HH:MM in Buea from any epoch, and the wait until the next minute', () => {
    assert.equal(bueaClock(at('23:40')), '23:40');
    assert.equal(bueaClock(at('00:05')), '00:05');
    assert.equal(bueaClock(Date.parse('2026-10-16T23:30:00Z')), '00:30'); // already tomorrow in Buea
    assert.equal(bueaClock(at('09:59') + 59_999), '09:59');
    assert.equal(msToNextMinute(at('12:00')), 60_000);
    assert.equal(msToNextMinute(at('12:00') + 15_000), 45_000);
    assert.equal(msToNextMinute(at('12:00') + 59_999), 1);
    // The status line built from the clock: weather without a label (the /api/buea fallback) is left out.
    assert.equal(statusLine({ localTime: bueaClock(at('18:07')), weather: { kind: 'clear', label: null } }), "It's 18:07 in Buea · Ojong is probably shipping something");
});
