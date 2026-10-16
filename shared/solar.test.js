import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solarPosition, solarTimes } from './solar.js';

const BUEA = { lat: 4.1527, lon: 9.241 };
const at = (iso) => Date.parse(iso);

test('the sun sits on the horizon at sunrise and sunset (upper limb with refraction ≈ −0.83°)', () => {
    // Open-Meteo for 2026-10-16 (server/fixtures/open-meteo-buea.json): 06:07 and 18:09 local.
    for (const iso of ['2026-10-16T06:07:00+01:00', '2026-10-16T18:09:00+01:00']) {
        const { elevation } = solarPosition(at(iso), BUEA.lat, BUEA.lon);
        assert.ok(Math.abs(elevation + 0.83) < 0.6, `${iso}: ${elevation.toFixed(2)}°`);
    }
    const s = solarTimes('2026-10-16', BUEA.lat, BUEA.lon);
    for (const ms of [s.sunrise, s.sunset]) {
        assert.ok(Math.abs(solarPosition(ms, BUEA.lat, BUEA.lon).elevation + 0.833) < 0.05);
    }
});

test('Buea sun path in October: east → high in the south → west', () => {
    const rise = solarPosition(at('2026-10-16T06:10:00+01:00'), BUEA.lat, BUEA.lon);
    const noon = solarPosition(at('2026-10-16T12:08:00+01:00'), BUEA.lat, BUEA.lon);
    const set = solarPosition(at('2026-10-16T18:05:00+01:00'), BUEA.lat, BUEA.lon);
    assert.ok(rise.azimuth > 95 && rise.azimuth < 105 && rise.rising, `rise ${rise.azimuth}`);
    assert.ok(set.azimuth > 255 && set.azimuth < 265 && !set.rising, `set ${set.azimuth}`);
    // Declination ≈ −9° in mid-October: noon elevation ≈ 90 − 4.15 − 9 ≈ 77°, due south.
    assert.ok(Math.abs(noon.elevation - 76.9) < 0.5, `noon ${noon.elevation}`);
    assert.ok(Math.abs(noon.azimuth - 180) < 5, `noon azimuth ${noon.azimuth}`);
    const midnight = solarPosition(at('2026-10-17T00:08:00+01:00'), BUEA.lat, BUEA.lon);
    assert.ok(midnight.elevation < -70);
});
