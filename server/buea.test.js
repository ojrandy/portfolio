import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from './app.js';
import {
    BUEA, WMO_CODES, WEATHER_MAX_AGE, bueaState, createWeatherClient, describeWeather, localParts, localToMs,
    openMeteoUrl, parseOpenMeteo, solarTimes, toOffsetIso, weatherConfig,
} from './lib/weather.js';
import { createBueaRouter } from './routes/buea.js';

// A real Open-Meteo response for Buea, captured 2026-10-16 12:30 local.
const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/open-meteo-buea.json', import.meta.url), 'utf8'));
const MIN = 60 * 1000;
const at = (iso) => Date.parse(iso);

test('every documented WMO code maps to a design_system.md kind and a label', () => {
    const kinds = new Set(['clear', 'cloudy', 'fog', 'drizzle', 'rain', 'showers', 'thunderstorm', 'snow']);
    assert.equal(WMO_CODES.length, 28);
    for (const code of WMO_CODES) {
        const w = describeWeather(code);
        assert.ok(kinds.has(w.kind), `${code}: ${w.kind}`);
        assert.ok(w.label, String(code));
    }
    assert.deepEqual(describeWeather(61), { kind: 'rain', label: 'light rain' });
    assert.deepEqual(describeWeather(45), { kind: 'fog', label: 'fog' });
    assert.equal(describeWeather(42), null);
});

test('local time helpers: Open-Meteo stamps, offset ISO strings, time-zone parts', () => {
    assert.equal(localToMs('2026-10-16T06:07', 3600), at('2026-10-16T05:07:00Z'));
    assert.equal(toOffsetIso(at('2026-10-16T05:07:00Z'), 60), '2026-10-16T06:07:00+01:00');
    assert.equal(toOffsetIso(at('2026-10-16T05:07:00Z'), -330), '2026-10-15T23:37:00-05:30');
    assert.deepEqual(localParts(at('2026-10-16T23:30:00Z'), 'Africa/Douala'), { date: '2026-10-17', time: '00:30', offsetMinutes: 60 });
    assert.deepEqual(localParts(at('2026-07-01T12:00:00Z'), 'America/New_York'), { date: '2026-07-01', time: '08:00', offsetMinutes: -240 });
    assert.equal(localParts(at('2026-10-16T12:00:00Z'), 'UTC').offsetMinutes, 0);
});

test('parseOpenMeteo reads the real response', () => {
    const p = parseOpenMeteo(FIXTURE);
    assert.equal(p.offsetSeconds, 3600);
    assert.deepEqual(p.weather, {
        code: 2, kind: 'cloudy', label: 'partly cloudy', tempC: 24.9, cloud: 78, rain: 0, wind: 7.7,
        observedAt: at('2026-10-16T11:30:00Z'),
    });
    assert.deepEqual(p.days, [
        { date: '2026-10-16', sunrise: at('2026-10-16T05:07:00Z'), sunset: at('2026-10-16T17:09:00Z') },
        { date: '2026-10-17', sunrise: at('2026-10-17T05:07:00Z'), sunset: at('2026-10-17T17:08:00Z') },
    ]);
    assert.throws(() => parseOpenMeteo({ ...FIXTURE, current: { ...FIXTURE.current, weather_code: 42 } }), /unknown WMO code/);
    assert.throws(() => parseOpenMeteo({ ...FIXTURE, daily: { ...FIXTURE.daily, sunrise: ['06:07'] } }));
});

test('computed sunrise/sunset match Open-Meteo within 2 minutes', () => {
    for (const day of parseOpenMeteo(FIXTURE).days) {
        const s = solarTimes(day.date, BUEA.lat, BUEA.lon);
        assert.ok(Math.abs(s.sunrise - day.sunrise) <= 2 * MIN, `${day.date} sunrise off by ${(s.sunrise - day.sunrise) / MIN} min`);
        assert.ok(Math.abs(s.sunset - day.sunset) <= 2 * MIN, `${day.date} sunset off by ${(s.sunset - day.sunset) / MIN} min`);
    }
    // Near the equator, day length stays close to 12 h all year.
    for (const date of ['2026-01-15', '2026-06-21', '2026-12-21']) {
        const s = solarTimes(date, BUEA.lat, BUEA.lon);
        const hours = (s.sunset - s.sunrise) / 3600000;
        assert.ok(hours > 11.6 && hours < 12.5, `${date}: ${hours} h`);
    }
    assert.equal(solarTimes('2026-06-21', 80, 0), null, 'midnight sun has no sunrise');
});

test('weatherConfig: Buea by default, env overrides validated', () => {
    assert.deepEqual(weatherConfig({}), BUEA);
    assert.deepEqual(weatherConfig({ BUEA_LAT: '4.2', BUEA_LON: '9.3', BUEA_TZ: 'Africa/Lagos' }), { lat: 4.2, lon: 9.3, tz: 'Africa/Lagos' });
    assert.deepEqual(weatherConfig({ BUEA_LAT: '', BUEA_TZ: '' }), BUEA, 'empty values fall back');
    assert.throws(() => weatherConfig({ BUEA_LAT: '91' }));
    assert.throws(() => weatherConfig({ BUEA_LON: 'east' }));
    assert.throws(() => weatherConfig({ BUEA_TZ: 'Mars/Olympus' }));
});

const upstream = (fetchedAt) => ({ data: parseOpenMeteo(FIXTURE), fetchedAt });

test('bueaState: fresh Open-Meteo data', () => {
    const now = at('2026-10-16T11:35:00Z');
    const s = bueaState({ now, place: BUEA, upstream: upstream(at('2026-10-16T11:31:00Z')) });
    assert.deepEqual(s, {
        now: '2026-10-16T11:35:00.000Z', tz: 'Africa/Douala', utcOffsetMinutes: 60, localDate: '2026-10-16', localTime: '12:35', isDay: true,
        sun: { sunrise: '2026-10-16T06:07:00+01:00', sunset: '2026-10-16T18:09:00+01:00', nextSunrise: '2026-10-17T06:07:00+01:00', source: 'open-meteo' },
        weather: { code: 2, kind: 'cloudy', label: 'partly cloudy', tempC: 24.9, cloud: 78, rain: 0, wind: 7.7, source: 'open-meteo', updatedAt: '2026-10-16T11:31:00.000Z' },
    });
});

test('bueaState: next sunrise before dawn and after dusk; night is not day', () => {
    const fetchedAt = at('2026-10-16T03:00:00Z');
    const early = bueaState({ now: at('2026-10-16T04:30:00Z'), place: BUEA, upstream: upstream(fetchedAt) });
    assert.equal(early.isDay, false);
    assert.equal(early.sun.nextSunrise, '2026-10-16T06:07:00+01:00');
    const late = bueaState({ now: at('2026-10-16T20:00:00Z'), place: BUEA, upstream: upstream(at('2026-10-16T19:00:00Z')) });
    assert.equal(late.isDay, false);
    assert.equal(late.localTime, '21:00');
    assert.equal(late.sun.nextSunrise, '2026-10-17T06:07:00+01:00');
});

test('bueaState: stale weather becomes the marked fallback; no data means computed sun times', () => {
    const now = at('2026-10-16T14:00:00Z');
    const stale = bueaState({ now, place: BUEA, upstream: upstream(now - WEATHER_MAX_AGE - MIN) });
    assert.deepEqual(stale.weather, { code: 0, kind: 'clear', label: null, tempC: null, cloud: null, rain: null, wind: null, source: 'fallback', updatedAt: null });
    assert.equal(stale.sun.source, 'open-meteo', 'sun times for today are still valid when the weather is old');
    assert.equal(bueaState({ now, place: BUEA, upstream: upstream(now - WEATHER_MAX_AGE) }).weather.source, 'open-meteo');

    const none = bueaState({ now, place: BUEA });
    assert.equal(none.weather.source, 'fallback');
    assert.equal(none.sun.source, 'computed');
    assert.match(none.sun.sunrise, /^2026-10-16T06:0\d:\d{2}\+01:00$/);

    // Cached days that no longer cover today fall back to the computed times.
    const nextWeek = bueaState({ now: at('2026-10-23T12:00:00Z'), place: BUEA, upstream: upstream(at('2026-10-23T11:00:00Z')) });
    assert.equal(nextWeek.sun.source, 'computed');
    assert.equal(nextWeek.weather.source, 'open-meteo');
});

// Fake Open-Meteo.
const fakeFetch = (handler) => {
    const fn = async (url, opts) => {
        fn.calls.push({ url, opts });
        return handler(url);
    };
    fn.calls = [];
    return fn;
};
const respond = (body, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('weather client: fixed Open-Meteo URL; HTTP errors and bad shapes throw', async () => {
    const fetch = fakeFetch(respond(FIXTURE));
    const client = createWeatherClient({ fetch });
    assert.equal((await client.current()).weather.code, 2);
    const url = new URL(fetch.calls[0].url);
    assert.equal(url.origin + url.pathname, 'https://api.open-meteo.com/v1/forecast');
    assert.deepEqual([url.searchParams.get('latitude'), url.searchParams.get('longitude'), url.searchParams.get('timezone')], ['4.1527', '9.241', 'Africa/Douala']);
    assert.ok(fetch.calls[0].opts.signal, 'requests have a timeout');
    assert.equal(openMeteoUrl({ lat: 1, lon: 2, tz: 'UTC' }).startsWith('https://api.open-meteo.com/v1/forecast?latitude=1&longitude=2'), true);

    await assert.rejects(createWeatherClient({ fetch: fakeFetch(respond({}, 500)) }).current(), /HTTP 500/);
    await assert.rejects(createWeatherClient({ fetch: fakeFetch(respond({ hello: 'world' })) }).current(), /unexpected response shape/);
});

const listen = (app) => new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
});

test('GET /api/buea: cached weather, ignored query, and a working fallback when Open-Meteo is down', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ojcity-buea-'));
    const now = () => at('2026-10-16T11:35:00Z');
    let calls = 0;
    const up = createBueaRouter({ cacheDir: path.join(dir, 'up'), now, weather: { current: async () => { calls += 1; return parseOpenMeteo(FIXTURE); } } });
    const down = createBueaRouter({ cacheDir: path.join(dir, 'down'), now, coldWaitMs: 50, weather: { current: async () => { throw new Error('down'); } } });
    const origError = console.error;
    console.error = () => {};
    const a = await listen(createApp({ distDir: dir, routes: [up] }));
    const b = await listen(createApp({ distDir: dir, routes: [down] }));
    try {
        const res = await fetch(`${a.url}/api/buea?lat=0&tz=evil`);
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('cache-control'), 'public, max-age=60');
        const body = await res.json();
        assert.equal(body.tz, 'Africa/Douala');
        assert.equal(body.weather.label, 'partly cloudy');
        assert.equal(body.sun.source, 'open-meteo');
        await fetch(`${a.url}/api/buea`);
        assert.equal(calls, 1, 'Open-Meteo is called once per 15 minutes, not per request');

        const res2 = await fetch(`${b.url}/api/buea`);
        assert.equal(res2.status, 200);
        const body2 = await res2.json();
        assert.equal(body2.weather.source, 'fallback');
        assert.equal(body2.weather.label, null);
        assert.equal(body2.sun.source, 'computed');
        assert.equal(body2.localTime, '12:35');
    } finally {
        console.error = origError;
        for (const s of [a, b]) { s.server.closeAllConnections(); s.server.close(); }
        await rm(dir, { recursive: true, force: true });
    }
});
