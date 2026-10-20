import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EGGS, KONAMI, isNightInBuea, knockCounter, parseProgress, sequenceMatcher, serializeProgress } from './arcadeEggs.js';

test('arcade: egg ids are unique and every egg has a name, hint and found line', () => {
    assert.equal(new Set(EGGS.map((egg) => egg.id)).size, EGGS.length);
    for (const egg of EGGS) for (const field of ['name', 'hint', 'found']) assert.ok(egg[field], `${egg.id}.${field}`);
});

test('arcade: the cheat code matches only when complete, in any case, after any lead-in', () => {
    const match = sequenceMatcher(KONAMI);
    const keys = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'B'];
    assert.deepEqual(keys.map(match), keys.map(() => false));
    assert.equal(match('A'), true);
    assert.equal(match('a'), false, 'starts over after a match');

    const again = sequenceMatcher(KONAMI);
    // A stray key and an extra ArrowUp before the code still count.
    for (const key of ['x', 'ArrowUp']) again(key);
    assert.equal(KONAMI.map(again).at(-1), true);

    const wrong = sequenceMatcher(KONAMI);
    assert.equal([...KONAMI.slice(0, 5), 'q', ...KONAMI.slice(5)].map(wrong).at(-1), false, 'a wrong key inside breaks it');
});

test('arcade: five knocks in a row on Fako; a long pause starts over', () => {
    const knock = knockCounter({ count: 5, gapMs: 2000 });
    assert.deepEqual([0, 500, 1000, 1500].map(knock), [false, false, false, false]);
    assert.equal(knock(2000), true);
    assert.equal(knock(2100), false, 'starts over after a match');

    const steady = knockCounter({ count: 5, gapMs: 2000 });
    assert.equal([0, 1500, 3000, 4500, 6000].map(steady).at(-1), true, 'slow but steady knocks count');

    const paused = knockCounter({ count: 5, gapMs: 2000 });
    assert.deepEqual([0, 500, 1000, 1500, 4000].map(paused), [false, false, false, false, false]);
    assert.equal([4500, 5000, 5500, 6000].map(paused).at(-1), true, 'counts again from the knock after the pause');
});

test('arcade: night in Buea follows the real sun', () => {
    assert.equal(isNightInBuea(Date.UTC(2026, 9, 20, 23, 0)), true); // 00:00 WAT
    assert.equal(isNightInBuea(Date.UTC(2026, 9, 20, 11, 0)), false); // 12:00 WAT
});

test('arcade: saved progress keeps only known eggs and survives bad data', () => {
    assert.deepEqual(parseProgress(serializeProgress(['night', 'hub', 'nope'])), ['hub', 'night']);
    for (const bad of [null, '', 'not json', '{"found":"hub"}', '[]']) assert.deepEqual(parseProgress(bad), []);
});
