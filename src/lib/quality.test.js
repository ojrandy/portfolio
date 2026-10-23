import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crowdShare, initialQuality, stepQuality, QUALITY, LEVELS } from './quality.js';

test('quality levels: dpr never above 1.5, every level keeps shadows (no recompiles), higher = sharper', () => {
    for (const level of LEVELS) {
        assert.ok(QUALITY[level].dpr <= 1.5, level);
        assert.ok(QUALITY[level].shadowMap > 0, level);
    }
    assert.ok(QUALITY.low.shadowMap < QUALITY.medium.shadowMap && QUALITY.medium.shadowMap < QUALITY.high.shadowMap);
    assert.ok(QUALITY.low.dpr < QUALITY.medium.dpr && QUALITY.medium.dpr < QUALITY.high.dpr);
});

test('initial quality from the device', () => {
    assert.equal(initialQuality({ cores: 8, memoryGb: 8 }), 'high');
    assert.equal(initialQuality({ cores: 4, memoryGb: 8 }), 'medium');
    assert.equal(initialQuality({ cores: 2 }), 'low');
    assert.equal(initialQuality({ cores: 8, memoryGb: 2 }), 'low');
    // Phones start lower: a mid-range Android (8 cores, 6 GB) → medium, a modest one → low.
    assert.equal(initialQuality({ cores: 8, memoryGb: 6, touch: true }), 'medium');
    assert.equal(initialQuality({ cores: 8, memoryGb: 4, touch: true }), 'low');
    // Unknown values (no deviceMemory in Safari/Firefox) don't count against the device.
    assert.equal(initialQuality({ cores: 8 }), 'high');
    assert.equal(initialQuality({}), 'high');
});

test('stepQuality moves one level and clamps', () => {
    assert.equal(stepQuality('high', -1), 'medium');
    assert.equal(stepQuality('medium', -1), 'low');
    assert.equal(stepQuality('low', -1), 'low');
    assert.equal(stepQuality('low', 1), 'medium');
    assert.equal(stepQuality('high', 1), 'high');
});

test('crowd share: half on phones and weak devices, full otherwise', () => {
    assert.equal(crowdShare({ touch: true, tier: 'medium' }), 0.5);
    assert.equal(crowdShare({ touch: false, tier: 'low' }), 0.5);
    assert.equal(crowdShare({ touch: false, tier: 'medium' }), 1);
    assert.equal(crowdShare({ touch: false, tier: 'high' }), 1);
    assert.equal(crowdShare(), 1);
});
