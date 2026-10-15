import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadingState, skyline, STEPS } from './loading.js';
import { toBuildings } from './buildings.js';
import { layoutCity } from './layout.js';
import { buildCity, loadProjects } from '../../server/lib/city.js';

test('loading steps count in order, and only real steps', () => {
    assert.equal(STEPS.length, 3);
    assert.deepEqual(loadingState({}), { completed: 0, total: 3, label: STEPS[0].label, error: null, done: false });
    assert.equal(loadingState({ code: true }).label, STEPS[1].label);
    assert.equal(loadingState({ code: true, data: 'ready' }).completed, 2);
    // A frame drawn before the data arrived doesn't count.
    assert.equal(loadingState({ code: true, frame: true }).completed, 1);
    assert.equal(loadingState({ data: 'ready', frame: true }).completed, 0);
    const done = loadingState({ code: true, data: 'ready', frame: true });
    assert.equal(done.done, true);
    assert.equal(done.completed, 3);
});

test('loading errors: no WebGL wins, then a failed fetch', () => {
    assert.equal(loadingState({ code: true, data: 'ready', frame: true, webgl: false }).error, 'webgl');
    assert.equal(loadingState({ code: true, data: 'ready', frame: true, webgl: false }).done, false);
    const failed = loadingState({ code: true, data: 'error' });
    assert.equal(failed.error, 'data');
    assert.equal(failed.completed, 1);
    assert.equal(failed.done, false);
});

test('skyline: front elevation, back rows first, nearer rows lighter', () => {
    const b = (width, height) => ({ width, height, accentColor: '#2B3A8C' });
    const lots = [
        { slug: 'front', x: 0, z: 10, building: b(2, 3) },
        { slug: 'back', x: -5, z: -10, building: b(3, 9) },
    ];
    const s = skyline(lots);
    assert.deepEqual(s.bars.map((bar) => bar.slug), ['back', 'front']);
    assert.equal(s.width, 7.5); // -6.5 → 1
    assert.equal(s.height, 9);
    assert.equal(s.bars[0].x, 0);
    assert.equal(s.bars[1].x, 5.5);
    assert.notEqual(s.bars[0].fill, s.bars[1].fill);
    assert.deepEqual(skyline([]), { bars: [], width: 0, height: 0 });
});

test('skyline of the real city: one bar per building, inside its width', () => {
    const layout = layoutCity(toBuildings(buildCity(loadProjects()), { now: Date.parse('2026-10-15T12:00:00Z') }));
    const s = skyline(layout.lots);
    assert.equal(s.bars.length, layout.lots.length);
    for (const bar of s.bars) {
        assert.ok(bar.x >= 0 && bar.x + bar.width <= s.width + 1e-9, bar.slug);
        assert.ok(bar.height > 0 && bar.height <= s.height, bar.slug);
    }
});
