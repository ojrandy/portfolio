import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCity, loadProjects } from './lib/city.js';
import { buildKnowledge, estimateTokens, loadProfile, MAX_TOKENS } from './lib/knowledge.js';

const TODO = 'TODO(content)';
const tmpPreviews = '/nonexistent-previews';

const project = (over = {}) => ({
    slug: 'p', name: 'P', district: 'downtown', featured: false, status: 'live',
    live: 'https://p.example.com/', repo: null, builtFor: 'client', role: 'solo', teamSize: 1,
    dates: { start: '2025-01', end: 'present' }, stack: ['React'], category: ['web'],
    caseStudy: { problem: 'Slow site', hardestPart: 'Caching', decision: 'Static build', result: 'Faster pages', resultSource: null },
    xray: { ui: 'React', api: null, data: null, infra: 'Hostinger' },
    stats: { effort: 6 }, media: null, iframe: false, demo: false, demoFields: [],
    ...over,
});

const profile = (over = {}) => ({
    name: 'Ojong Randy', title: 'Engineer', location: 'Buea, Cameroon', culture: 'Bayangi',
    availability: { freelance: true, fullTime: false, contract: true, remote: true },
    email: 'contact@example.com',
    links: { github: 'https://github.com/oj', githubUsername: 'oj', linkedin: null, x: TODO, youtube: null },
    cv: null, yearsCoding: '5+', languages: ['English'], degree: 'BSc', bio: 'I build things.', origin: 'Para one.\n\nPara two.',
    services: [{ name: 'Web', delivered: 'Sites', examples: ['p', 'demo-p', 'missing'], demo: false, demoFields: [] }],
    marketCalls: ['Buy here!'], taxiLines: { pickup: ['Enter'], arrival: ['We don reach'] }, policeLines: { chase: [], pullOver: [] },
    hobbies: [{ name: 'Football', text: 'Goalkeeper' }], motifs: [],
    experience: [{ role: 'Dev', company: 'Acme', dates: { start: TODO, end: 'present' }, location: 'Remote', did: ['Built apps', TODO], proudest: TODO, demo: false, demoFields: [] }],
    teaching: [{ title: 'Intro to JS', venue: 'TUIB', audience: null, courses: null, date: `${TODO} → present`, link: null, demo: false, demoFields: [] }],
    video: [{ title: 'Demo reel', link: null, file: null, role: null, tools: [], demo: true, demoFields: [] }],
    testimonials: [
        { quote: 'Shared quote', name: 'Ada, Client', link: null, permission: true, demo: false, demoFields: [] },
        { quote: 'Private quote', name: 'Bob', link: null, permission: false, demo: false, demoFields: [] },
        { quote: 'Placeholder quote', name: '<Name>, Owner', link: null, permission: true, demo: false, demoFields: [] },
    ],
    stats: [
        { label: 'Users served', value: '100', source: TODO, demo: false, demoFields: [] },
        { label: 'Public repos', value: 'auto', source: 'GitHub', demo: false, demoFields: [] },
        { label: 'Students taught', value: '120', source: 'TUIB class lists', demo: false, demoFields: [] },
    ],
    tools: { summary: 'VS Code', groups: [{ name: 'Langs', items: ['JS'], demo: true, demoFields: [] }] },
    clients: [{ text: 'Web Spectron Ltd', logoPermission: false }],
    github: { accounts: ['oj'], hide: [] },
    faq: [
        { q: 'Rates?', a: 'From 75,000 FCFA', demo: false, demoFields: [] },
        { q: 'Demo question?', a: 'Demo answer', demo: true, demoFields: [] },
    ],
    demoFields: ['title', 'cv'],
    ...over,
});

const build = (projects, { listing = {}, stats = {}, prof = profile() } = {}) =>
    buildKnowledge({ profile: prof, projects, buildings: buildCity(projects, { listing, stats }, { previewDir: tmpPreviews }) });

test('leaves out demo records, demo fields, TODO(content) and placeholders', () => {
    const text = build([
        project(),
        project({ slug: 'demo-p', name: 'Demo Project', demo: true }),
        project({ slug: 'half', name: 'Half', role: TODO, stack: TODO, demoFields: ['builtFor', 'caseStudy.problem', 'xray.infra'] }),
    ]);
    for (const banned of ['TODO', 'Demo Project', '[demo-p]', 'Demo answer', 'Demo reel', '<Name>', 'Langs', 'Engineer', 'Buy here', 'We don reach']) {
        assert.ok(!text.includes(banned), `must not contain ${banned}`);
    }
    const half = text.slice(text.indexOf('[half]')).split('\n##')[0];
    assert.doesNotMatch(half, /built for|role:|Stack:|Problem:|INFRA/, 'demo / TODO fields of a real project are dropped');
    assert.match(half, /Hardest part: Caching/);
    assert.match(text, /### P \[p\]/);
    assert.match(text, /- Problem: Slow site/);
    assert.match(text, /Under the hood: UI: React · INFRA: Hostinger/);
    assert.match(text, /- Web: Sites Examples: \[p\]\n/, 'service examples only name real projects');
    assert.match(text, /Intro to JS \(TUIB\)/, 'a TODO date is dropped, the entry stays');
    assert.match(text, /### Dev, Acme · Remote\n- Built apps\n/);
    assert.match(text, /Para one\.\n\nPara two\./);
});

test('testimonials need permission, numbers need a real source', () => {
    const text = build([project()]);
    assert.match(text, /"Shared quote" — Ada, Client/);
    assert.ok(!text.includes('Private quote') && !text.includes('Placeholder quote'));
    assert.match(text, /- Students taught: 120 \(source: TUIB class lists\)/);
    assert.ok(!text.includes('Users served') && !text.includes('Public repos'));
});

test('a result with a number but no source is left out', () => {
    const text = build([project({ caseStudy: { ...project().caseStudy, result: '100+ users', resultSource: TODO } })]);
    assert.ok(!text.includes('100+ users'));
});

test('lists what is not known', () => {
    const text = build([project()], { prof: profile({ testimonials: [], demoFields: ['availability', 'cv'] }) });
    const unknown = text.slice(text.indexOf('## Not known'));
    for (const item of ['current availability', 'a CV to download', 'client testimonials', 'video work']) assert.ok(unknown.includes(item), item);
    assert.ok(!text.includes('Open to:'), 'demo availability is not stated');
    assert.match(build([project()]), /- Open to: freelance projects, contracts, remote work/);
});

test('adds GitHub numbers and discovered repos without duplicating content projects', () => {
    const repo = (name, extra = {}) => ({ owner: 'oj', repo: name, key: `oj/${name}`, url: `https://github.com/oj/${name}`, description: null, homepage: null, private: false, fork: false, archived: false, size: 10, pushedAt: '2026-10-01T00:00:00Z', ...extra });
    const gh = { available: true, commits: 1, stars: 3, lastPush: '2026-10-01T00:00:00Z', primaryLanguage: 'JavaScript', languages: { JavaScript: 1 } };
    const text = build([project({ repo: 'https://github.com/oj/app' })], {
        listing: { oj: [repo('app'), repo('extra_tool', { description: 'A CLI' })] },
        stats: { 'oj/app': gh, 'oj/extra_tool': gh },
    });
    assert.match(text, /- GitHub: 1 commit, 3 stars, last push 2026-10/);
    assert.match(text, /- Extra Tool \[extra-tool\]: A CLI · stack JavaScript/);
    assert.equal(text.match(/\[p\]/g).length, 2, 'content project once, plus the service example');
    assert.ok(!text.includes('[app]'));
});

test('output is stable: same input, same text, independent of input order', () => {
    const a = build([project({ slug: 'b', name: 'B' }), project({ slug: 'a', name: 'A' })]);
    const b = build([project({ slug: 'a', name: 'A' }), project({ slug: 'b', name: 'B' })]);
    assert.equal(a, b);
    assert.ok(a.indexOf('[a]') < a.indexOf('[b]'));
    assert.doesNotMatch(a, /\d{4}-\d{2}-\d{2}T/, 'no timestamps');
});

test('real content: every non-demo project is in, nothing demo, within the token budget', () => {
    const projects = loadProjects();
    const text = buildKnowledge({ profile: loadProfile(), projects, buildings: buildCity(projects, {}, { previewDir: tmpPreviews }) });
    for (const p of projects) assert.equal(text.includes(`[${p.slug}]`), !p.demo, p.slug);
    assert.ok(!text.includes(TODO));
    assert.ok(estimateTokens(text) <= MAX_TOKENS, `~${estimateTokens(text)} tokens`);
});
