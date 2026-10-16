import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseProjectsMd } from './lib/parse-projects-md.js';
import { PATHS, checkContent, serialize, toFiles } from './lib/content-check.js';
import { TODO } from '../content/schema.js';

// Smallest valid document; tests splice extra lines into a section.
const doc = ({ profile = '', experience = '', projects = '', teaching = '', video = '', testimonials = '', stats = '', tools = '', faq = '' } = {}) => `
## 1. Profile
- **Full name:** Test Person
- **Available for:** freelance ☑ · full-time ☐ · contract ☐ · remote ☑
- **GitHub username:** https://github.com/tester
${profile}
### Short bio
 Hello.
## 2. Experience
${experience}
## 3. Projects
${projects}
## 4. Teaching
${teaching}
## 5. Video work
${video}
## 6. Testimonials
${testimonials}
## 7. Real numbers
| Stat | Value | Source |
|---|---|---|
${stats}
## 8. Tools & clients
- Tools you actually use: VS Code
${tools}
## 9. FAQ
${faq}
`;

const project = (name, extra = '') => `
### ${name}
- **Status:** live
${extra}`;

test('the real docs/projects.md parses, validates, and matches the committed JSON', async () => {
    const parsed = parseProjectsMd(await readFile(PATHS.md, 'utf8'));
    assert.deepEqual(parsed.errors, []);
    const files = toFiles(parsed);
    assert.deepEqual(checkContent(files).errors, []);
    assert.equal(serialize(files.profile), await readFile(PATHS.profile, 'utf8'), 'run npm run content:build');
    assert.equal(serialize(files.projects), await readFile(PATHS.projects, 'utf8'), 'run npm run content:build');
});

test('strict mode fails while [DEMO] or TODO(content) remain', async () => {
    const files = toFiles(parseProjectsMd(await readFile(PATHS.md, 'utf8')));
    const { errors } = checkContent(files, { strict: true });
    assert.ok(errors.some((e) => e.startsWith('strict: [DEMO]')));
    assert.ok(errors.some((e) => e.startsWith('strict: missing content')));
});

test('tolerates the formatting slips in owner-written markdown', () => {
    const { errors, profile, projects } = parseProjectsMd(doc({
        experience: `
### Somewhere
- **Role:** Dev
- **Company:** ACME
*Dates:** 2026-06 → Present-
- **Location: Buea Cameroon
- **What you did (3 bullets max):**
  - Built things: fast
- **Proudest result:** It works`,
        projects: project('My Thing', `
- **Slug:** My Thing
- **Dates:** 1 october 2026
- **Stack:** Flutter, Firebase (Auth, Firestore), …
- **Category:** web / 3D
- **Can the live site be shown in an iframe?** no (mobile app)
- **Repo URL:** private
- **Live URL:** private (internal)`),
    }));
    assert.deepEqual(errors, []);
    const role = profile.experience[0];
    assert.deepEqual(role.dates, { start: '2026-06', end: 'present' });
    assert.equal(role.location, 'Buea Cameroon');
    assert.deepEqual(role.did, ['Built things: fast']);
    const p = projects[0];
    assert.equal(p.slug, 'my-thing');
    assert.deepEqual(p.dates, { start: '2026-10', end: '2026-10' });
    assert.deepEqual(p.stack, ['Flutter', 'Firebase (Auth, Firestore)']);
    assert.deepEqual(p.category, ['web', '3d']);
    assert.equal(p.iframe, false);
    assert.equal(p.repo, 'private');
    assert.equal(p.live, null);
    assert.deepEqual(profile.availability, { freelance: true, fullTime: false, contract: false, remote: true });
    assert.equal(profile.links.githubUsername, 'tester');
});

test('"2025-" end dates keep the year; blanks become TODO(content), "—" becomes null', () => {
    const { errors, projects } = parseProjectsMd(doc({
        projects: project('A', `
- **Dates:** 2024-11 → 2025-
- **Media:** —
- **Problem:**
- **X-Ray layers:**
  - API: —`),
    }));
    assert.deepEqual(errors, []);
    assert.deepEqual(projects[0].dates, { start: '2024-11', end: '2025' });
    assert.equal(projects[0].media, null);
    assert.equal(projects[0].caseStudy.problem, TODO);
    assert.equal(projects[0].xray.api, null);
    assert.equal(projects[0].xray.ui, TODO);
});

test('[DEMO] marks a whole block or a single field', () => {
    const { projects } = parseProjectsMd(doc({
        projects: project('[DEMO] Fake', '') + project('Real', '- **Team size:** [DEMO] 2'),
    }));
    assert.equal(projects[0].demo, true);
    assert.equal(projects[0].name, 'Fake');
    assert.equal(projects[1].demo, false);
    assert.deepEqual(projects[1].demoFields, ['teamSize']);
    assert.equal(projects[1].teamSize, 2);
});

test('unknown fields and unreadable values are errors with line numbers, never dropped', () => {
    const { errors } = parseProjectsMd(doc({
        projects: `
### A
- **Colour:** blue
- **Dates:** sometime soon
- **Status:** finished
- **Team size:** a few
- **Team size:** 2`,
    }));
    assert.equal(errors.length, 5);
    assert.match(errors.join('\n'), /"Team size" is written twice/);
    assert.match(errors[0], /^docs\/projects\.md:\d+: unknown field "Colour"/);
    assert.match(errors.join('\n'), /can't read the date/);
    assert.match(errors.join('\n'), /expected one of live, in-progress, archived/);
    assert.match(errors.join('\n'), /whole number/);
});

test('missing sections and malformed stats rows are errors', () => {
    const { errors } = parseProjectsMd('## 1. Profile\n- **Full name:** X\n');
    assert.ok(errors.some((e) => e.includes('missing section for "projects"')));
    const bad = parseProjectsMd(doc({ stats: '| Projects | 50+ | file | 100' }));
    assert.ok(bad.errors.some((e) => e.includes('exactly 3 cells')));
});

test('stray text is reported, italic notes are ignored', () => {
    const { warnings } = parseProjectsMd(doc({ projects: `_a note_\nsome loose text\n${project('A')}` }));
    assert.equal(warnings.filter((w) => w.includes('ignored text')).length, 1);
});

test('results with numbers need a source', () => {
    const { projects, warnings } = parseProjectsMd(doc({
        projects: project('A', '- **Result:** 300 users') + project('B', '- **Result:** 300 users. Source: analytics'),
    }));
    assert.equal(projects[0].caseStudy.resultSource, TODO);
    assert.ok(warnings.some((w) => w.includes('no "Source')));
    assert.equal(projects[1].caseStudy.result, '300 users');
    assert.equal(projects[1].caseStudy.resultSource, 'analytics');
});

test('rules: max 3 featured, unique slugs', () => {
    const projects = ['a', 'b', 'c', 'd', 'a'].map((s) => project(`P ${s}`, `- **Slug:** ${s}\n- **Featured:** yes`)).join('');
    const { errors } = checkContent(toFiles(parseProjectsMd(doc({ projects }))));
    assert.ok(errors.some((e) => e.includes('5 projects are featured')));
    assert.ok(errors.some((e) => e.includes('"a" is also used')));
});

test('rules: a testimonial with permission needs a real name; "yes / no" counts as no', () => {
    const parsed = parseProjectsMd(doc({
        testimonials: `
- **Quote:** Great work.
  - **Name, role, company:**
  - **Permission confirmed:** yes
- **Quote:** Also great.
  - **Permission confirmed:** yes / no`,
    }));
    assert.equal(parsed.profile.testimonials[1].permission, false);
    const { errors } = checkContent(toFiles(parsed));
    assert.ok(errors.some((e) => e.includes('testimonials[0]: marked as permitted')));
});

test('FAQ answers with or without "A:" and teaching/video lines', () => {
    const { errors, profile } = parseProjectsMd(doc({
        faq: `- **Q:** Rates? **A: From 75,000 FCFA**\n- **Q:** Availability? **Within hours**`,
        teaching: '- **Intro to JS** · TUIB · audience: year 1 · date: 2025-10 → present',
        video: '- **Reel**: https://youtu.be/x · what you did: edit · tools: Premiere Pro, CapCut',
    }));
    assert.deepEqual(errors, []);
    assert.deepEqual(profile.faq.map((f) => f.a), ['From 75,000 FCFA', 'Within hours']);
    assert.equal(profile.teaching[0].venue, 'TUIB');
    assert.equal(profile.teaching[0].audience, 'year 1');
    assert.equal(profile.video[0].link, 'https://youtu.be/x');
    assert.deepEqual(profile.video[0].tools, ['Premiere Pro', 'CapCut']);
});

test('GitHub accounts for the city: defaults to the username; lists, URLs and hides are read; bad names are errors', () => {
    assert.deepEqual(parseProjectsMd(doc()).profile.github, { accounts: ['tester'], hide: [] });

    const { errors, profile } = parseProjectsMd(doc({
        profile: '- **GitHub accounts for the city:** tester, https://github.com/Second-Acct, tester\n- **Hide these repos:** tester/old-demo, https://github.com/Second-Acct/Scratch',
    }));
    assert.deepEqual(errors, []);
    assert.deepEqual(profile.github, { accounts: ['tester', 'Second-Acct'], hide: ['tester/old-demo', 'second-acct/scratch'] });

    assert.deepEqual(parseProjectsMd(doc({ profile: '- **GitHub accounts for the city:** —' })).profile.github.accounts, []);

    const bad = parseProjectsMd(doc({ profile: '- **GitHub accounts for the city:** not a name!\n- **Hide these repos:** just-a-repo' }));
    assert.equal(bad.errors.length, 2);
    assert.match(bad.errors.join('\n'), /GitHub account name/);
    assert.match(bad.errors.join('\n'), /owner\/repo/);
});
