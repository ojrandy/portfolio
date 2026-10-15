import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safeUrl, shortStack, labelText, projectStats, projectSummary } from './projectSummary.js';
import { isClick, slugAt, canHover, CLICK_TOLERANCE } from './picking.js';
import useCityStore from '../store/useCityStore.js';
import { buildCity, loadProjects } from '../../server/lib/city.js';

const NONE = { source: 'none', commits: null, stars: null, lastPush: null, languages: null };
const project = (over = {}) => ({
    slug: 'p', name: 'Project', district: 'downtown', featured: false, status: 'live',
    stack: ['React', 'Node'], live: null, repo: null, effort: null, stats: NONE, demo: false, ...over,
});

test('safeUrl keeps https only', () => {
    assert.equal(safeUrl('https://ojongrandy.com/x'), 'https://ojongrandy.com/x');
    for (const bad of ['http://example.com', 'javascript:alert(1)', 'data:text/html,hi', 'not a url', '', null, undefined, 42]) {
        assert.equal(safeUrl(bad), null, String(bad));
    }
});

test('label: name + up to 3 stack items, then "+n more"', () => {
    assert.deepEqual(shortStack(['a', 'b', 'c', 'd', 'e']), { shown: ['a', 'b', 'c'], more: 2 });
    assert.deepEqual(labelText(project()), { name: 'Project', stack: 'React · Node' });
    assert.deepEqual(labelText(project({ stack: ['A', 'B', 'C', 'D'] })), { name: 'Project', stack: 'A · B · C +1 more' });
    assert.deepEqual(labelText(project({ stack: [] })), { name: 'Project', stack: null });
});

test('stats: GitHub numbers with their source, missing ones left out', () => {
    const gh = projectStats(project({
        stats: { source: 'github', commits: 48, stars: 0, lastPush: '2026-10-02T19:56:47Z', languages: { TypeScript: 0.93, CSS: 0.05, HTML: 0.02 } },
    }));
    assert.equal(gh.source, 'GitHub');
    assert.deepEqual(gh.items, [
        { label: 'Commits', value: '48' },
        { label: 'Stars', value: '0' },
        { label: 'Last push', value: '2026-10-02' },
        { label: 'Languages', value: 'TypeScript 93 % · CSS 5 %' },
    ]);
    const partial = projectStats(project({ stats: { source: 'github', commits: null, stars: null, lastPush: 'garbage', languages: null } }));
    assert.deepEqual(partial, { items: [], source: null });
});

test('stats: owner effort is labelled as an estimate; no data means no numbers', () => {
    assert.deepEqual(projectStats(project({ effort: 7, stats: { ...NONE, source: 'owner' } })), {
        items: [{ label: 'Effort', value: '7/10' }], source: 'Owner estimate',
    });
    assert.deepEqual(projectStats(project()), { items: [], source: null });
});

test('summary: status words, safe links only, demo flag', () => {
    const s = projectSummary(project({
        status: 'in-progress', live: 'http://insecure.example', repo: 'https://github.com/ojrandy/x', demo: true,
    }));
    assert.equal(s.status, 'In progress');
    assert.equal(s.district, 'Downtown');
    assert.deepEqual(s.links, [{ label: 'Code', href: 'https://github.com/ojrandy/x' }]);
    assert.equal(s.demo, true);
    assert.equal(projectSummary(project({ status: null })).status, null);
});

test('summary works for every real project', () => {
    const stats = JSON.parse(readFileSync(new URL('./fixtures/github-stats.json', import.meta.url), 'utf8'));
    for (const p of buildCity(loadProjects(), stats)) {
        const s = projectSummary(p);
        assert.ok(s.name, p.slug);
        s.links.forEach((l) => assert.ok(l.href.startsWith('https://'), `${p.slug}: ${l.href}`));
        s.stats.items.forEach((i) => assert.ok(i.value && !/null|undefined|NaN/.test(i.value), `${p.slug}: ${i.value}`));
    }
});

test('picking: instance → slug, drags are not clicks, hover only for mouse/pen', () => {
    const placed = [{ slug: 'a' }, { slug: 'b' }];
    assert.equal(slugAt(placed, 1), 'b');
    assert.equal(slugAt(placed, 2), null);
    assert.equal(slugAt(placed, undefined), null);
    assert.ok(isClick(0) && isClick(CLICK_TOLERANCE));
    assert.ok(!isClick(CLICK_TOLERANCE + 1));
    assert.ok(canHover('mouse') && canHover('pen') && !canHover('touch'));
});

test('store: open flies and opens; unknown slugs are ignored; a new city drops stale slugs', () => {
    const s = useCityStore.getState;
    s().setOrder(['a', 'b', 'c']);
    s().openProject('b');
    assert.equal(s().focus, 'b');
    assert.equal(s().openSlug, 'b');
    s().openProject('nope');
    assert.equal(s().openSlug, 'b');
    s().closeProject();
    assert.equal(s().openSlug, null);
    assert.equal(s().focus, 'b', 'closing keeps the camera where it is');
    s().setHovered('c');
    s().openProject('c');
    s().setOrder(['a']);
    assert.deepEqual([s().focus, s().hovered, s().openSlug], [null, null, null]);
});
