import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featuredBoards, githubBoard, weatherBoard } from './billboards.js';

const projects = [
    { slug: 'a', name: 'Alpha', featured: true, stack: ['React', 'Node'], live: 'https://www.alpha.example/', stats: { source: 'github', commits: 40, stars: 2 } },
    { slug: 'b', name: 'Beta', featured: true, demo: true, stats: { source: 'github', commits: 1000, stars: 50 } },
    { slug: 'c', name: 'TODO(content)', featured: true, stats: { source: 'github', commits: 5, stars: 0 } },
    { slug: 'd', name: 'Delta', featured: false, live: 'http://insecure.example', stats: { source: 'owner', commits: 99 } },
    { slug: 'e', name: 'Echo', featured: true, live: 'http://insecure.example', stack: [], stats: { source: 'github', commits: 1, stars: 1 } },
];

test('featured boards: featured non-demo projects only, no TODO text, HTTPS domains only', () => {
    const boards = featuredBoards(projects);
    assert.deepEqual(boards.map((b) => b.slug), ['a', 'e']);
    assert.deepEqual(boards[0], { slug: 'a', name: 'Alpha', stack: 'React · Node', site: 'alpha.example' });
    assert.equal(boards[1].site, null);
    assert.equal(boards[1].stack, null);
    assert.deepEqual(featuredBoards([]), []);
});

test('GitHub board: real sums over non-demo GitHub projects, with the source and date', () => {
    const board = githubBoard(projects, '2026-10-21T05:07:25Z');
    assert.equal(board.headline, '46 commits · 3 stars');
    assert.equal(board.detail, 'across 3 GitHub repositories');
    assert.equal(board.source, 'Source: GitHub API · updated 21 Oct 2026');
    assert.equal(githubBoard([projects[0]], null).detail, 'across 1 GitHub repository');
    assert.equal(githubBoard([projects[0]], null).source, 'Source: GitHub API');
    assert.equal(githubBoard([projects[1], projects[3]]), null);
    // Late on 31 Dec UTC is already 1 Jan in Buea.
    assert.match(githubBoard(projects, '2026-12-31T23:30:00Z').source, /1 Jan 2027$/);
});

test('weather board: rounded temperature, label and source; nothing without a temperature', () => {
    const board = weatherBoard({ tempC: 24.7, label: 'partly cloudy', updatedAt: '2026-10-21T09:45:18Z' });
    assert.deepEqual(board, { headline: 'Buea now 25 °C', detail: 'Partly cloudy', source: 'Source: Open-Meteo · 10:45 WAT' });
    assert.equal(weatherBoard({ label: 'rain' }), null);
    assert.equal(weatherBoard(null), null);
    assert.equal(weatherBoard({ tempC: 20 }).detail, null);
});
