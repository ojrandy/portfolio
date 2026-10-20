import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from './app.js';
import { createCache } from './lib/cache.js';
import { parseRepoUrl, languageShares, commitCount, createGitHubClient } from './lib/github.js';
import { buildCity, languageStack, loadProjects, prettyName, repoStatus, selectRepos } from './lib/city.js';
import { createCityRouter } from './routes/city.js';

const quiet = { warn() {}, error() {} };
const tempDir = () => mkdtemp(path.join(tmpdir(), 'ojcity-cache-'));

const project = (over = {}) => ({
    slug: 'p', name: 'P', district: 'downtown', featured: false, status: 'live',
    live: null, repo: null, stack: ['React'], category: ['web'], stats: { effort: 5 }, demo: false,
    ...over,
});

const ghStats = { available: true, commits: 412, stars: 3, lastPush: '2026-10-01T00:00:00Z', primaryLanguage: 'JavaScript', languages: { JavaScript: 0.8, CSS: 0.2 }, archived: false };

// --- github.js ---

test('parseRepoUrl accepts only github.com repo URLs', () => {
    assert.deepEqual(parseRepoUrl('https://github.com/ojrandy/Portfolio'), { owner: 'ojrandy', repo: 'Portfolio', key: 'ojrandy/portfolio' });
    assert.equal(parseRepoUrl('https://github.com/ojrandy/portfolio.git').repo, 'portfolio');
    assert.equal(parseRepoUrl('https://github.com/ojrandy/portfolio/').repo, 'portfolio');
    for (const bad of ['private', null, 'TODO(content)', 'http://github.com/a/b', 'https://evil.com/a/b',
        'https://github.com/a/b/tree/main', 'https://github.com/a/..', 'https://github.com.evil.com/a/b', 'https://github.com/a/b?x=1']) {
        assert.equal(parseRepoUrl(bad), null, String(bad));
    }
});

test('languageShares and commitCount', () => {
    assert.deepEqual(languageShares({ CSS: 200, JavaScript: 800 }), { JavaScript: 0.8, CSS: 0.2 });
    assert.deepEqual(languageShares({}), {});
    const link = '<https://api.github.com/repositories/1/commits?per_page=1&page=2>; rel="next", <https://api.github.com/repositories/1/commits?per_page=1&page=412>; rel="last"';
    assert.equal(commitCount(link, 1), 412);
    assert.equal(commitCount(null, 1), 1);
    assert.equal(commitCount(null, 0), 0);
});

// Fake GitHub: routes keyed by path suffix.
const fakeFetch = (routes) => {
    const calls = [];
    const fn = async (url, opts) => {
        calls.push({ url, opts });
        const p = new URL(url).pathname + new URL(url).search;
        for (const [pattern, handler] of Object.entries(routes)) {
            if (p.endsWith(pattern)) return handler();
        }
        return new Response('{}', { status: 404 });
    };
    fn.calls = calls;
    return fn;
};
const json = (body, init = {}) => () => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', ...init.headers }, status: init.status ?? 200 });

test('repoStats merges repo, languages and commit count; sends the token', async () => {
    const fetch = fakeFetch({
        '/repos/oj/app': json({ private: false, archived: false, stargazers_count: 3, pushed_at: '2026-10-01T00:00:00Z', language: 'JavaScript' }),
        '/repos/oj/app/languages': json({ JavaScript: 800, CSS: 200 }),
        '/repos/oj/app/commits?per_page=1': json([{}], { headers: { link: '<https://api.github.com/x?per_page=1&page=412>; rel="last"' } }),
    });
    const gh = createGitHubClient({ token: 't0k', fetch });
    assert.deepEqual(await gh.repoStats(parseRepoUrl('https://github.com/oj/app')), ghStats);
    assert.ok(fetch.calls.every((c) => c.url.startsWith('https://api.github.com/') && c.opts.headers.Authorization === 'Bearer t0k'));
});

test('repoStats: 404 and private repos are unavailable; empty repo has 0 commits; rate limit throws', async () => {
    const ref = parseRepoUrl('https://github.com/oj/app');
    const missing = createGitHubClient({ fetch: fakeFetch({}) });
    assert.deepEqual(await missing.repoStats(ref), { available: false });

    const priv = createGitHubClient({ fetch: fakeFetch({
        '/repos/oj/app': json({ private: true, archived: false, stargazers_count: 0, pushed_at: null, language: null }),
    }) });
    assert.deepEqual(await priv.repoStats(ref), { available: false });

    const empty = createGitHubClient({ fetch: fakeFetch({
        '/repos/oj/app': json({ private: false, archived: false, stargazers_count: 0, pushed_at: null, language: null }),
        '/repos/oj/app/languages': json({}),
        '/repos/oj/app/commits?per_page=1': json({ message: 'Git Repository is empty.' }, { status: 409 }),
    }) });
    assert.equal((await empty.repoStats(ref)).commits, 0);

    const limited = createGitHubClient({ fetch: fakeFetch({ '/repos/oj/app': json({ message: 'rate limited' }, { status: 403 }) }) });
    await assert.rejects(limited.repoStats(ref), /HTTP 403/);
});

test('allStats keeps previous data for a failing repo and throws when all fail', async () => {
    const a = parseRepoUrl('https://github.com/oj/a');
    const b = parseRepoUrl('https://github.com/oj/b');
    const fetch = fakeFetch({
        '/repos/oj/a': json({ private: false, archived: false, stargazers_count: 1, pushed_at: null, language: 'Dart' }),
        '/repos/oj/a/languages': json({ Dart: 1 }),
        '/repos/oj/a/commits?per_page=1': json([{}]),
        '/repos/oj/b': json({}, { status: 500 }),
    });
    const origWarn = console.warn;
    console.warn = () => {};
    try {
        const gh = createGitHubClient({ fetch });
        const out = await gh.allStats([a, b, a], { 'oj/b': ghStats });
        assert.equal(out['oj/a'].commits, 1);
        assert.deepEqual(out['oj/b'], ghStats);
        const down = createGitHubClient({ fetch: async () => { throw new Error('ECONNRESET'); } });
        await assert.rejects(down.allStats([a, b]), /all GitHub requests failed/);
    } finally {
        console.warn = origWarn;
    }
});

// --- city.js ---

test('buildCity merges GitHub stats and falls back to owner effort', () => {
    const city = buildCity([
        project({ slug: 'gh', repo: 'https://github.com/oj/app', stats: { effort: null } }),
        project({ slug: 'priv', repo: 'private', stats: { effort: 9 } }),
        project({ slug: 'none', repo: null, stats: { effort: null } }),
        project({ slug: 'todo', repo: 'TODO(content)', status: 'TODO(content)', stack: 'TODO(content)', live: 'TODO(content)', category: 'TODO(content)' }),
        project({ slug: 'gone', repo: 'https://github.com/oj/gone' }),
        project({ slug: 'unchecked', repo: 'https://github.com/oj/new' }),
    ], { stats: { 'oj/app': ghStats, 'oj/gone': { available: false } } });
    const by = Object.fromEntries(city.map((p) => [p.slug, p]));

    assert.deepEqual(by.gh.stats, { source: 'github', commits: 412, stars: 3, lastPush: '2026-10-01T00:00:00Z', languages: { JavaScript: 0.8, CSS: 0.2 } });
    assert.equal(by.gh.primaryLanguage, 'JavaScript');
    assert.equal(by.gh.repo, 'https://github.com/oj/app');

    assert.equal(by.priv.stats.source, 'owner');
    assert.equal(by.priv.effort, 9);
    assert.equal(by.priv.repo, null, '"private" is never exposed as a link');
    assert.equal(by.priv.primaryLanguage, null);
    assert.equal(by.priv.stats.commits, null);

    assert.equal(by.none.stats.source, 'none');
    assert.deepEqual([by.todo.status, by.todo.live, by.todo.repo, by.todo.stack, by.todo.category], [null, null, null, [], []]);
    assert.equal(by.gone.repo, null, 'a repo GitHub says is missing/private is not linked');
    assert.equal(by.gone.stats.source, 'owner');
    assert.equal(by.unchecked.repo, 'https://github.com/oj/new');
    assert.ok(!JSON.stringify(city).includes('TODO(content)'));
});

test('buildCity on the real content publishes nothing marked demo or TODO', () => {
    const projects = loadProjects();
    const city = buildCity(projects);
    assert.ok(city.length > 0);
    const keys = ['slug', 'name', 'district', 'featured', 'status', 'category', 'stack', 'live', 'repo', 'primaryLanguage', 'effort', 'stats', 'description', 'source', 'preview', 'caseStudy', 'media', 'demo'];
    for (const p of city) assert.deepEqual(Object.keys(p), keys);
    assert.ok(!JSON.stringify(city.map(({ caseStudy, media }) => ({ caseStudy, media }))).includes('TODO(content)'));
    const content = new Map(projects.map((p) => [p.slug, p]));
    for (const p of city.filter((c) => c.demo)) {
        assert.deepEqual([p.caseStudy, p.media], [null, null], `${p.slug} is a demo`);
    }
    for (const p of city.filter((c) => !c.demo && content.has(c.slug))) {
        for (const field of content.get(p.slug).demoFields ?? []) {
            const [group, key] = field.split('.');
            if (group === 'caseStudy') assert.equal(p.caseStudy?.[key] ?? null, null, `${p.slug} ${field}`);
            if (field === 'media') assert.equal(p.media, null, `${p.slug} media`);
        }
        if (p.caseStudy?.result && /\d/.test(p.caseStudy.result)) assert.ok(p.caseStudy.resultSource, `${p.slug}: a number needs a source`);
    }
});

test('buildCity publishes the owner case study, minus demo fields, TODOs and unsourced numbers', () => {
    const caseStudy = { problem: 'Bookings by WhatsApp only', hardestPart: 'TODO(content)', decision: 'Online booking form', result: '120 bookings in a month', resultSource: null };
    const city = buildCity([
        project({ slug: 'a', caseStudy, demoFields: ['caseStudy.problem'], media: 'public/images/a.webp' }),
        project({ slug: 'b', caseStudy: { ...caseStudy, resultSource: 'booking system export' }, media: 'public/images/b.webp', demoFields: ['media'] }),
        project({ slug: 'c', caseStudy, media: 'public/images/c.webp', demo: true }),
        project({ slug: 'd', caseStudy: { problem: 'TODO(content)', hardestPart: null, decision: null, result: 'Done', resultSource: null } }),
    ]);
    const [a, b, c, d] = city;
    assert.deepEqual(a.caseStudy, { problem: null, hardestPart: null, decision: 'Online booking form', result: null, resultSource: null });
    assert.equal(a.media, 'public/images/a.webp');
    assert.deepEqual(b.caseStudy, { problem: 'Bookings by WhatsApp only', hardestPart: null, decision: 'Online booking form', result: '120 bookings in a month', resultSource: 'booking system export' });
    assert.equal(b.media, null, 'demo-marked media is omitted');
    assert.deepEqual([c.caseStudy, c.media], [null, null], 'a whole demo project publishes none of it');
    assert.deepEqual(d.caseStudy, { problem: null, hardestPart: null, decision: null, result: 'Done', resultSource: null }, 'text results need no source');
});

// --- discovery (ADR-012) ---

const NOW = Date.parse('2026-10-16T12:00:00Z');
const listed = (owner, name, over = {}) => ({
    name, html_url: `https://github.com/${owner}/${name}`, owner: { login: owner },
    private: false, fork: false, archived: false, size: 120, description: null, homepage: null, topics: [],
    pushed_at: '2026-01-01T00:00:00Z', created_at: '2025-01-01T00:00:00Z', ...over,
});
const repo = (owner, name, over = {}) => ({
    ...parseRepoUrl(`https://github.com/${owner}/${name}`), url: `https://github.com/${owner}/${name}`,
    private: false, fork: false, archived: false, size: 120, description: null, homepage: null, topics: [],
    pushedAt: '2026-01-01T00:00:00Z', createdAt: '2025-01-01T00:00:00Z', ...over,
});

test('listRepos pages through an account, keeps only github.com repo URLs; a missing account is []', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => listed('oj', `r${i}`));
    const fetch = fakeFetch({
        '/users/oj/repos?type=owner&sort=pushed&per_page=100&page=1': json(page1),
        '/users/oj/repos?type=owner&sort=pushed&per_page=100&page=2': json([
            listed('oj', 'last', { description: '  A thing  ', homepage: '' }),
            listed('oj', 'odd', { html_url: 'https://evil.example/oj/odd' }),
        ]),
    });
    const gh = createGitHubClient({ fetch });
    const repos = await gh.listRepos('oj');
    assert.equal(repos.length, 101);
    const last = repos.at(-1);
    assert.deepEqual([last.key, last.description, last.homepage], ['oj/last', 'A thing', null]);
    assert.ok(fetch.calls.every((c) => c.url.startsWith('https://api.github.com/users/oj/repos')));

    assert.deepEqual(await createGitHubClient({ fetch: fakeFetch({}) }).listRepos('nobody'), []);
    await assert.rejects(gh.listRepos('../etc'), /invalid account/);
});

test('discover keeps the previous list for a failing account and throws when all fail', async () => {
    const fetch = fakeFetch({
        '/users/a/repos?type=owner&sort=pushed&per_page=100&page=1': json([listed('a', 'one')]),
        '/users/b/repos?type=owner&sort=pushed&per_page=100&page=1': json({ message: 'rate limited' }, { status: 403 }),
    });
    const origWarn = console.warn;
    console.warn = () => {};
    try {
        const gh = createGitHubClient({ fetch });
        const out = await gh.discover(['A', 'b', 'a'], { b: [repo('b', 'kept')] });
        assert.deepEqual(Object.keys(out), ['a', 'b']);
        assert.equal(out.a[0].key, 'a/one');
        assert.equal(out.b[0].key, 'b/kept');
        const down = createGitHubClient({ fetch: async () => { throw new Error('ECONNRESET'); } });
        await assert.rejects(down.discover(['a', 'b']), /all GitHub account listings failed/);
    } finally {
        console.warn = origWarn;
    }
});

test('selectRepos skips private, forks, empty, profile README, .github and hidden repos', () => {
    const listing = {
        oj: [
            repo('oj', 'zeta'), repo('oj', 'App'),
            repo('oj', 'secret', { private: true }), repo('oj', 'forked', { fork: true }), repo('oj', 'empty', { size: 0 }),
            repo('oj', 'OJ'), repo('oj', '.github'), repo('oj', 'Old-Demo'),
        ],
    };
    assert.deepEqual(selectRepos(listing, { hide: ['OJ/old-demo'] }).map((r) => r.key), ['oj/app', 'oj/zeta']);
});

test('languageStack: ≥ 5 %, no build tooling, no Flutter runner languages', () => {
    assert.deepEqual(languageStack({ Go: 0.9, Shell: 0.07, Makefile: 0.03 }), ['Go', 'Shell']);
    assert.deepEqual(languageStack({ 'C++': 0.4, Dart: 0.3, CMake: 0.2, Swift: 0.06, HTML: 0.04 }), ['Dart']);
    assert.deepEqual(languageStack({ 'C++': 0.7, CMake: 0.3 }), ['C++'], 'C++ stays when it is not a Flutter app');
    assert.deepEqual(languageStack({}), []);
});

test('prettyName and repoStatus', () => {
    assert.equal(prettyName('food_recipe2'), 'Food Recipe2');
    assert.equal(prettyName('novaTransport'), 'Nova Transport');
    assert.equal(prettyName('WVL'), 'WVL');
    assert.equal(prettyName('sns-glam'), 'Sns Glam');
    assert.equal(repoStatus(repo('o', 'r', { archived: true, homepage: 'https://x.dev' }), NOW), 'archived');
    assert.equal(repoStatus(repo('o', 'r', { homepage: 'x.dev' }), NOW), 'live');
    assert.equal(repoStatus(repo('o', 'r', { homepage: 'http://x.dev' }), NOW), null, 'http homepages are not live links');
    assert.equal(repoStatus(repo('o', 'r', { pushedAt: '2026-09-01T00:00:00Z' }), NOW), 'in-progress');
    assert.equal(repoStatus(repo('o', 'r', { pushedAt: '2025-01-01T00:00:00Z' }), NOW), null);
});

test('buildCity adds discovered repos; content entries win; same names on two accounts get distinct slugs', () => {
    const listing = {
        oj: [
            repo('oj', 'app', { description: 'From GitHub' }),
            repo('oj', 'tool', { description: 'A CLI tool', homepage: 'tool.dev', topics: ['cli'] }),
            repo('oj', 'secret', { private: true }),
        ],
        other: [repo('other', 'tool'), repo('other', 'gone')],
    };
    const stats = {
        'oj/app': ghStats,
        'oj/tool': { ...ghStats, primaryLanguage: 'Go', languages: { Go: 0.9, Shell: 0.07, Makefile: 0.03 } },
        'other/gone': { available: false },
    };
    const city = buildCity([project({ slug: 'app', name: 'My App', repo: 'https://github.com/OJ/app', featured: true })], { stats, listing }, { now: NOW });
    const by = Object.fromEntries(city.map((p) => [p.slug, p]));

    assert.deepEqual(city.map((p) => p.slug), ['app', 'tool', 'gone', 'other-tool']);
    assert.equal(by.app.name, 'My App', 'the content entry wins');
    assert.equal(by.app.source, 'content');
    assert.equal(by.app.featured, true);
    assert.equal(by.app.description, 'From GitHub');

    assert.deepEqual(
        [by.tool.source, by.tool.name, by.tool.status, by.tool.live, by.tool.stack, by.tool.description, by.tool.featured, by.tool.effort, by.tool.demo],
        ['github', 'Tool', 'live', 'https://tool.dev/', ['Go', 'Shell'], 'A CLI tool', false, null, false],
    );
    assert.equal(by.tool.stats.source, 'github');
    assert.equal(by.tool.primaryLanguage, 'Go');

    assert.equal(by['other-tool'].stats.source, 'none', 'no stats fetched yet');
    assert.equal(by['other-tool'].repo, 'https://github.com/other/tool');
    assert.equal(by.gone.repo, null, 'a repo GitHub says is gone is not linked');
    assert.ok(!city.some((p) => p.slug === 'secret'));

    const hidden = buildCity([], { stats, listing }, { hide: ['oj/tool'], now: NOW });
    assert.ok(!hidden.some((p) => p.repo === 'https://github.com/oj/tool'));
});

// --- cache.js ---

const clock = (t = 0) => {
    const fn = () => t;
    fn.advance = (ms) => { t += ms; };
    return fn;
};

test('cache: fresh data is reused; stale data is served while one refresh runs', async () => {
    const dir = await tempDir();
    const now = clock(1000);
    let calls = 0;
    let release;
    const cache = createCache({
        key: 'k', ttlMs: 100, dir, now, log: quiet, retryMs: 0,
        load: async () => {
            calls += 1;
            if (calls === 2) await new Promise((r) => { release = r; });
            return { n: calls };
        },
    });
    assert.deepEqual((await cache.get()).data, { n: 1 });
    now.advance(50);
    assert.deepEqual((await cache.get()).data, { n: 1 });
    assert.equal(calls, 1);

    now.advance(100);
    const [a, b] = await Promise.all([cache.get(), cache.get()]);
    assert.deepEqual([a.data, b.data, a.stale], [{ n: 1 }, { n: 1 }, true]);
    assert.equal(calls, 2, 'concurrent stale reads share one refresh');
    release();
    await cache.inflight;
    assert.deepEqual((await cache.get()).data, { n: 2 });
    await rm(dir, { recursive: true, force: true });
});

test('cache: a failed refresh keeps the last good data and backs off', async () => {
    const dir = await tempDir();
    const now = clock(1000);
    let fail = false;
    let calls = 0;
    const cache = createCache({
        key: 'k', ttlMs: 100, retryMs: 60, dir, now, log: quiet,
        load: async () => {
            calls += 1;
            if (fail) throw new Error('down');
            return { ok: calls };
        },
    });
    await cache.get();
    fail = true;
    now.advance(200);
    assert.deepEqual((await cache.get()).data, { ok: 1 });
    await cache.inflight?.catch(() => {});
    assert.deepEqual((await cache.get()).data, { ok: 1 });
    assert.equal(calls, 2, 'no retry inside retryMs');
    now.advance(60);
    await cache.get();
    await cache.inflight?.catch(() => {});
    assert.equal(calls, 3);
    await rm(dir, { recursive: true, force: true });
});

test('cache: data survives a restart via the file; isUsable forces an early refresh', async () => {
    const dir = await tempDir();
    const now = clock(1000);
    const first = createCache({ key: 'k', ttlMs: 1000, dir, now, log: quiet, load: async () => ({ a: 1 }) });
    await first.get();
    assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'k.json'), 'utf8')).data, { a: 1 });

    let loaded = 0;
    const restarted = createCache({ key: 'k', ttlMs: 1000, dir, now, log: quiet, load: async () => { loaded += 1; return { a: 2 }; } });
    assert.deepEqual((await restarted.get()).data, { a: 1 });
    assert.equal(loaded, 0, 'fresh disk copy is used without fetching');

    const grown = createCache({ key: 'k', ttlMs: 1000, dir, now, log: quiet, isUsable: (d) => 'b' in d, load: async () => ({ a: 3, b: 1 }) });
    assert.deepEqual((await grown.get()).data, { a: 1 });
    await grown.inflight;
    assert.deepEqual((await grown.get()).data, { a: 3, b: 1 });
    await rm(dir, { recursive: true, force: true });
});

test('cache: with no data ever, get() rejects (and backs off)', async () => {
    const dir = await tempDir();
    let calls = 0;
    const cache = createCache({ key: 'k', ttlMs: 1000, retryMs: 1000, dir, now: clock(5000), log: quiet, load: async () => { calls += 1; throw new Error('down'); } });
    await assert.rejects(cache.get(), /down/);
    await assert.rejects(cache.get(), /no data/);
    assert.equal(calls, 1);
    await rm(dir, { recursive: true, force: true });
});

// --- route ---

const listen = (app) => new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
});

test('GET /api/city returns merged data, and still works when GitHub is down', async () => {
    const dir = await tempDir();
    const projects = [project({ slug: 'gh', repo: 'https://github.com/oj/app' }), project({ slug: 'priv', repo: 'private' })];

    const config = { accounts: ['oj'], hide: ['oj/hidden'] };
    const seen = {};
    const upGitHub = {
        discover: async (accounts) => { seen.accounts = accounts; return { oj: [repo('oj', 'app'), repo('oj', 'extra'), repo('oj', 'hidden')] }; },
        allStats: async (refs) => { seen.refs = refs.map((r) => r.key); return { 'oj/app': ghStats, 'oj/extra': ghStats }; },
    };
    const up = createCityRouter({ projects, config, cacheDir: path.join(dir, 'up'), github: upGitHub });
    const fail = async () => { throw new Error('down'); };
    const down = createCityRouter({ projects, config, cacheDir: path.join(dir, 'down'), coldWaitMs: 50, github: { discover: fail, allStats: fail } });
    const origError = console.error;
    console.error = () => {};
    const a = await listen(createApp({ distDir: dir, routes: [up] }));
    const b = await listen(createApp({ distDir: dir, routes: [down] }));
    try {
        const res = await fetch(`${a.url}/api/city?anything=ignored`);
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('cache-control'), 'public, max-age=300');
        const body = await res.json();
        assert.ok(body.generatedAt && body.statsUpdatedAt);
        assert.equal(body.projects[0].stats.commits, 412);
        assert.equal(body.projects[1].stats.source, 'owner');
        assert.deepEqual(body.projects.map((p) => p.slug), ['gh', 'priv', 'extra'], 'discovered repo added, hidden one left out');
        assert.equal(body.projects[2].source, 'github');
        assert.deepEqual(seen.accounts, ['oj']);
        assert.deepEqual(seen.refs, ['oj/app', 'oj/app', 'oj/extra'], 'stats are fetched for content + selected repos only');

        const res2 = await fetch(`${b.url}/api/city`);
        assert.equal(res2.status, 200);
        const body2 = await res2.json();
        assert.equal(body2.statsUpdatedAt, null);
        assert.equal(body2.projects[0].stats.source, 'owner');
        assert.equal(res2.headers.get('cache-control'), 'public, max-age=30');
    } finally {
        console.error = origError;
        for (const s of [a, b]) { s.server.closeAllConnections(); s.server.close(); }
        await rm(dir, { recursive: true, force: true });
    }
});
