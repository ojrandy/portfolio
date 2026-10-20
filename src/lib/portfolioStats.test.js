import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portfolioStats } from './portfolioStats.js';

const value = (stats, key) => stats.find((s) => s.key === key).value;

test('portfolio stats count real city projects and those with GitHub data; demos never count', () => {
    const stats = portfolioStats([
        { stats: { source: 'github' } },
        { stats: { source: 'owner' } },
        { stats: { source: 'none' } },
        { stats: { source: 'github' } },
        { demo: true, stats: { source: 'github' } },
        { demo: true, stats: { source: 'owner' } },
    ]);
    assert.equal(value(stats, 'city-projects'), 4);
    assert.equal(value(stats, 'github-projects'), 2);
    for (const s of stats) assert.ok(s.label && s.source, `${s.key} has a label and a source`);
    assert.deepEqual(portfolioStats().map((s) => s.value), [0, 0]);
});
