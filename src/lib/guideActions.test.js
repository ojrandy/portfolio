import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cityGuideActions, siteGuideActions } from './guideActions.js';

const recorder = () => {
    const calls = [];
    const fn = (name) => (...args) => calls.push([name, ...args]);
    return { calls, fn };
};

test('city: labels only what the city has, and runs each action', () => {
    const { calls, fn } = recorder();
    const city = cityGuideActions({
        places: [{ id: 'downtown', name: 'Downtown' }, { id: 'market', name: 'Market' }],
        names: new Map([['vital-pulse', 'Vital Pulse']]),
        store: { flyTo: fn('flyTo'), openProject: fn('openProject'), arrive: fn('arrive') },
        openContact: fn('contact'),
        navigate: fn('navigate'),
    });
    assert.equal(city.label({ type: 'fly_to_project', slug: 'vital-pulse' }), 'Show Vital Pulse');
    assert.equal(city.label({ type: 'open_case_study', slug: 'unknown' }), null);
    assert.equal(city.label({ type: 'go_to', place: 'market' }), 'Go to the Market');
    assert.equal(city.label({ type: 'go_to', place: 'cinema' }), null); // not built
    assert.equal(city.label({ type: 'switch_mode', mode: 'city' }), null); // already here

    city.run({ type: 'fly_to_project', slug: 'vital-pulse' });
    city.run({ type: 'open_case_study', slug: 'vital-pulse' });
    city.run({ type: 'go_to', place: 'market' });
    city.run({ type: 'open_contact' });
    city.run({ type: 'switch_mode', mode: 'site' });
    assert.deepEqual(calls, [['flyTo', 'vital-pulse'], ['openProject', 'vital-pulse'], ['arrive', 'market'], ['contact'], ['navigate', '/']]);
});

test('one-page site: work, contact and the 3D city; nothing else', () => {
    const { calls, fn } = recorder();
    const site = siteGuideActions({ scrollTo: fn('scroll'), navigate: fn('navigate'), hasSection: (id) => id !== 'work' });
    assert.equal(site.label({ type: 'go_to', place: 'downtown' }), null); // section missing
    assert.equal(site.label({ type: 'go_to', place: 'market' }), null);
    assert.equal(site.label({ type: 'fly_to_project', slug: 'a' }), null);
    assert.equal(site.label({ type: 'open_contact' }), 'Open contact form');
    assert.equal(site.label({ type: 'switch_mode', mode: 'city' }), 'Open OJ City (3D)');
    site.run({ type: 'open_contact' });
    site.run({ type: 'switch_mode', mode: 'city' });
    assert.deepEqual(calls, [['scroll', 'contact'], ['navigate', '/?city']]);
});
