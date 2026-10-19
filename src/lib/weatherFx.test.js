import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLEAR, LIGHTNING, WEATHER_LIGHT, applyWeather, lightningAt, weatherFx } from './weatherFx.js';
import { FOG } from './backdrop.js';
import { lightingAt, sunState } from './dayNight.js';

const at = (hhmm) => Date.parse(`2026-10-16T${hhmm}:00+01:00`);
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const saturation = (hex) => Math.max(...rgb(hex)) - Math.min(...rgb(hex));
const brightness = (hex) => rgb(hex).reduce((t, v) => t + v, 0);

// Shapes as /api/buea sends them (server/lib/weather.js).
const api = (code, kind, cloud = null, rain = null) => ({ code, kind, label: kind, cloud, rain });

test('missing, fallback and clear weather all draw the plain city', () => {
    assert.deepEqual(weatherFx(null), CLEAR);
    assert.deepEqual(weatherFx(undefined), CLEAR);
    assert.deepEqual(weatherFx({ kind: 'volcano' }), CLEAR);
    assert.deepEqual(weatherFx(api(0, 'clear')), CLEAR); // /api/buea fallback: code 0, no measurements
    const noon = sunState(at('12:10'));
    assert.deepEqual(lightingAt(noon, weatherFx(api(0, 'clear', 0, 0))), lightingAt(noon));
});

test('WMO weather maps to effect levels', () => {
    const overcast = weatherFx(api(3, 'cloudy', 95));
    const fog = weatherFx(api(45, 'fog', 100));
    const drizzle = weatherFx(api(53, 'drizzle', 100, 0.3));
    const rain = weatherFx(api(63, 'rain', 100, 2));
    const heavy = weatherFx(api(65, 'rain', 100, 9));
    const storm = weatherFx(api(95, 'thunderstorm', 100, 3));

    assert.equal(overcast.cloud, 0.95);
    assert.equal(overcast.rain, 0);
    assert.equal(fog.fog, 1);
    assert.ok(drizzle.rain > 0 && drizzle.rain < rain.rain && rain.rain < heavy.rain, `${drizzle.rain} ${rain.rain} ${heavy.rain}`);
    assert.equal(heavy.rain, 1);
    assert.ok(storm.storm && !rain.storm);
    assert.ok(storm.gloom > rain.gloom && rain.gloom > overcast.gloom && overcast.gloom > 0);
    // A measured cloud cover wins over the code; rain mm can only add to the code's level.
    assert.equal(weatherFx(api(2, 'cloudy', 20)).cloud, 0.2);
    assert.equal(weatherFx(api(2, 'cloudy')).cloud, 0.45);
    assert.equal(weatherFx(api(61, 'rain', 100, 0)).rain, 0.45);
    // The dev override sends only a kind.
    const devStorm = weatherFx({ kind: 'thunderstorm' });
    assert.ok(devStorm.storm && devStorm.rain > 0.5 && devStorm.cloud === 1);
});

test('overcast and rain grey and darken the sky and soften the sun', () => {
    const noon = sunState(at('12:10'));
    const clear = lightingAt(noon);
    const overcast = lightingAt(noon, weatherFx(api(3, 'cloudy', 100)));
    const storm = lightingAt(noon, weatherFx(api(95, 'thunderstorm', 100, 6)));

    assert.ok(saturation(overcast.zenith) < saturation(clear.zenith) / 2, `${overcast.zenith} vs ${clear.zenith}`);
    assert.ok(brightness(storm.zenith) < brightness(overcast.zenith));
    assert.ok(overcast.light.intensity < clear.light.intensity);
    assert.ok(storm.light.intensity < overcast.light.intensity);
    assert.ok(storm.ambient.intensity < clear.ambient.intensity);
    assert.deepEqual(storm.light.direction, clear.light.direction);
});

test('fog closes in, thickens the Fako mist and rain wets the streets', () => {
    const noon = sunState(at('12:10'));
    const clear = lightingAt(noon);
    const fog = lightingAt(noon, weatherFx(api(45, 'fog', 100)));
    const rain = lightingAt(noon, weatherFx(api(63, 'rain', 100, 2)));

    assert.deepEqual(clear.fog, { near: FOG.near, far: FOG.far });
    assert.deepEqual(clear.weather, { mistDensity: 1, wet: 0, rain: 0, cloud: 0, storm: false });
    assert.equal(fog.fog.far, WEATHER_LIGHT.fogFar);
    assert.ok(fog.weather.mistDensity > 2);
    assert.equal(fog.weather.wet, 0);
    assert.ok(rain.fog.far < FOG.far && rain.weather.wet > 0.5 && rain.weather.rain > 0);
});

test('city lights come on earlier under a storm sky, never in a bright one', () => {
    const storm = weatherFx(api(95, 'thunderstorm', 100, 6));
    const before = sunState(at('17:40')); // ~7° up: clear-sky lights are still off
    assert.deepEqual(lightingAt(before).city, { windows: 0, lamps: 0 });
    const dark = lightingAt(before, storm).city;
    assert.ok(dark.windows > 0, JSON.stringify(dark));
    assert.deepEqual(lightingAt(sunState(at('12:10')), storm).city, { windows: 0, lamps: 0 });
});

test('night stays night under weather; clear is unchanged by applyWeather', () => {
    const night = lightingAt(sunState(at('23:00')));
    const wetNight = lightingAt(sunState(at('23:00')), weatherFx(api(63, 'rain', 100, 2)));
    // Cloud greys the night sky but keeps it dark: nothing brighter than the clear night's horizon.
    assert.ok(brightness(wetNight.zenith) < brightness(night.horizon));
    assert.ok(brightness(wetNight.horizon) <= brightness(night.horizon));
    const lit = { ...night };
    delete lit.city;
    assert.deepEqual(applyWeather(lit, CLEAR), { ...lit, fog: { near: FOG.near, far: FOG.far }, weather: lightingAt(sunState(at('23:00'))).weather });
});

test('lightning: strikes 8–20 s apart, at most 3 flashes a second, the same for everyone', () => {
    const step = 0.005;
    const strikes = [];
    let flashes = [];
    let prev = 0;
    for (let t = 0; t < 1800; t += step) {
        const v = lightningAt(t);
        assert.ok(v >= 0 && v <= 1);
        if (v > 0 && prev === 0) {
            flashes.push(t);
            if (!strikes.length || t - strikes.at(-1) > 1) strikes.push(t);
        }
        prev = v;
    }
    assert.ok(strikes.length > 1800 / 20 && strikes.length < 1800 / 8, `${strikes.length} strikes`);
    for (let i = 1; i < strikes.length; i++) {
        const gap = strikes[i] - strikes[i - 1];
        assert.ok(gap >= 8 - step && gap <= 20 + LIGHTNING.second + step, `gap ${gap}`);
    }
    for (const t of flashes) assert.ok(flashes.filter((f) => f >= t && f < t + 1).length <= 3, `at ${t}`);
    const dark = Array.from({ length: 1000 }, (_, i) => lightningAt(i * 1.7)).filter((v) => v === 0).length;
    assert.ok(dark > 950, 'dark nearly all the time');
    assert.equal(lightningAt(1234.567), lightningAt(1234.567));
});
