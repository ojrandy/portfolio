// What OJ Guide knows (P4-01, ADR-014): owner content + the city's buildings → cleaned facts, used by the
// built-in guide (P4-03) and rendered as compact Markdown for the AI layer's system prompt. Same honesty
// rules as the site, applied once here: demo records, demo fields, TODO(content) and <placeholders> never
// appear; numbers only with a source; testimonials only with permission. Output depends only on the input
// (fixed order, no timestamps).
import { readFileSync } from 'node:fs';
import { profileFileSchema, TODO } from '../../content/schema.js';

const PROFILE_FILE = new URL('../../content/profile.json', import.meta.url);

// Rough budget for the whole doc; `npm run knowledge:build` fails above it.
export const MAX_TOKENS = 15000;
// ~3.5 characters per token for English prose with Markdown; errs on the high side.
export const estimateTokens = (text) => Math.ceil(text.length / 3.5);

export const loadProfile = (file = PROFILE_FILE) => profileFileSchema.parse(JSON.parse(readFileSync(file, 'utf8')));

const PLACEHOLDER_RE = /<[^<>\n]+>/;

/** Trimmed text, or null when empty, TODO(content) or a <placeholder>. */
const clean = (value) => {
    if (typeof value === 'number') return String(value);
    if (typeof value !== 'string') return null;
    const v = value.trim();
    return v && !v.includes(TODO) && !PLACEHOLDER_RE.test(v) ? v : null;
};

const oneLine = (value) => clean(value)?.replace(/\s*\n\s*/g, ' ') ?? null;

/** Field reader for a record with { demo, demoFields }: null for a demo record or a demo field. */
const reader = (record) => {
    const demoFields = new Set(record.demoFields ?? []);
    return (name) => (record.demo || demoFields.has(name) ? null : record[name]);
};

const list = (items) => (Array.isArray(items) ? items.map(oneLine).filter(Boolean) : []);

export const DISTRICT_NAMES = { downtown: 'Downtown', cinema: 'Cinema', arcade: 'Arcade', school: 'School', pitch: 'Pitch' };
const month = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : null);

const dateRange = (dates) => {
    const start = clean(dates?.start);
    const end = clean(dates?.end);
    if (!start) return null;
    return end ? `${start} → ${end}` : `from ${start}`;
};

const githubFacts = (stats) => {
    if (stats?.source !== 'github') return null;
    const facts = {
        commits: Number.isInteger(stats.commits) ? stats.commits : null,
        stars: Number.isInteger(stats.stars) ? stats.stars : null,
        lastPush: month(stats.lastPush),
    };
    return Object.values(facts).some((v) => v !== null) ? facts : null;
};

const bySlug = (a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);

const projectFacts = (project, building) => {
    const field = reader(project);
    const b = building ?? {};
    const team = field('teamSize');
    const effort = field('stats')?.effort;
    const cs = b.caseStudy;
    const xray = b.xray ? Object.fromEntries(['ui', 'api', 'data', 'infra'].map((k) => [k, oneLine(b.xray[k])])) : null;
    return {
        slug: project.slug,
        name: oneLine(project.name),
        district: project.district,
        status: clean(b.status ?? field('status')),
        featured: project.featured,
        builtFor: oneLine(field('builtFor')),
        role: oneLine(field('role')),
        teamSize: Number.isInteger(team) ? team : null,
        dates: dateRange(field('dates')),
        stack: list(field('stack')),
        description: oneLine(b.description),
        live: b.live ?? null,
        repo: b.repo ?? null,
        github: githubFacts(b.stats),
        effort: Number.isInteger(effort) && !(project.demoFields ?? []).includes('stats.effort') ? effort : null,
        caseStudy: cs ? {
            problem: oneLine(cs.problem),
            hardestPart: oneLine(cs.hardestPart),
            decision: oneLine(cs.decision),
            result: oneLine(cs.result),
            resultSource: oneLine(cs.resultSource),
        } : null,
        xray: xray && Object.values(xray).some(Boolean) ? xray : null,
        source: 'content',
    };
};

const repoFacts = (b) => ({
    slug: b.slug,
    name: oneLine(b.name),
    district: 'downtown',
    status: b.status ?? null,
    description: oneLine(b.description),
    stack: b.stack ?? [],
    live: b.live ?? null,
    repo: b.repo ?? null,
    github: githubFacts(b.stats),
    source: 'github',
});

const AVAILABILITY_KEYS = ['freelance', 'fullTime', 'contract', 'remote'];

// Profile fields the site keeps as demo, in words the guide can use for "I don't know".
const UNKNOWN_FIELDS = { title: 'a final headline', availability: 'current availability', cv: 'a CV to download', languages: 'spoken languages', email: 'an email address' };

/**
 * @param {{ profile: object, projects: object[], buildings?: object[] | null }} input
 *   profile / projects: validated content; buildings: buildCity() output (GitHub numbers, cleaned case
 *   studies, discovered repos). Without buildings, content projects have no GitHub data.
 * @returns {object} cleaned facts; every string is publishable, missing values are null / empty lists
 */
export const knowledgeFacts = ({ profile, projects, buildings = null }) => {
    const field = reader(profile);
    const byBuilding = new Map((buildings ?? []).map((b) => [b.slug, b]));
    const real = projects.filter((p) => !p.demo).sort(bySlug).map((p) => projectFacts(p, byBuilding.get(p.slug)));
    const repos = (buildings ?? []).filter((b) => b.source === 'github').sort(bySlug).map(repoFacts);
    const knownSlugs = new Set([...real, ...repos].map((p) => p.slug));
    const availability = field('availability');
    const links = field('links') ?? {};

    const facts = {
        name: oneLine(field('name')),
        headline: oneLine(field('title')),
        location: oneLine(field('location')),
        roots: oneLine(field('culture')),
        degree: oneLine(field('degree')),
        yearsCoding: oneLine(field('yearsCoding')),
        spokenLanguages: list(field('languages')),
        bio: oneLine(field('bio')),
        origin: (clean(field('origin')) ?? '').split(/\n\s*\n/).map(oneLine).filter(Boolean),
        availability: availability ? Object.fromEntries(AVAILABILITY_KEYS.map((k) => [k, Boolean(availability[k])])) : null,
        contact: {
            email: clean(field('email')),
            github: clean(links.github),
            linkedin: clean(links.linkedin),
            x: clean(links.x),
            youtube: clean(links.youtube),
            cv: clean(field('cv')),
        },
        services: profile.services.map((s) => {
            const f = reader(s);
            return { name: oneLine(f('name')), delivered: oneLine(f('delivered')), examples: (f('examples') ?? []).filter((slug) => knownSlugs.has(slug)) };
        }).filter((s) => s.name),
        projects: real,
        repos,
        experience: profile.experience.map((e) => {
            const f = reader(e);
            return { role: oneLine(f('role')), company: oneLine(f('company')), dates: dateRange(f('dates')), location: oneLine(f('location')), did: list(f('did')), proudest: oneLine(f('proudest')) };
        }).filter((e) => e.role && e.company),
        teaching: profile.teaching.map((t) => {
            const f = reader(t);
            return { title: oneLine(f('title')), venue: oneLine(f('venue')), audience: oneLine(f('audience')), courses: oneLine(f('courses')), date: oneLine(f('date')), link: clean(f('link')) };
        }).filter((t) => t.title),
        video: profile.video.map((v) => {
            const f = reader(v);
            return { title: oneLine(f('title')), role: oneLine(f('role')), tools: list(f('tools')), link: clean(f('link')) };
        }).filter((v) => v.title),
        hobbies: profile.hobbies.map((h) => ({ name: oneLine(h.name), text: oneLine(h.text) })).filter((h) => h.name && h.text),
        tools: {
            summary: oneLine(profile.tools.summary),
            groups: profile.tools.groups.map((g) => {
                const f = reader(g);
                return { name: oneLine(f('name')), items: list(f('items')) };
            }).filter((g) => g.name && g.items.length),
        },
        clients: profile.clients.map((c) => oneLine(c.text)).filter(Boolean),
        testimonials: profile.testimonials.filter((t) => t.permission).map((t) => {
            const f = reader(t);
            return { quote: oneLine(f('quote')), name: oneLine(f('name')), link: clean(f('link')) };
        }).filter((t) => t.quote && t.name),
        // A number only with a real source: 'auto' values are counted elsewhere, and a TODO source drops the stat.
        numbers: profile.stats.map((s) => {
            const f = reader(s);
            return { label: oneLine(f('label')), value: oneLine(f('value')), source: oneLine(f('source')) };
        }).filter((s) => s.label && s.value && s.value !== 'auto' && s.source),
        faq: profile.faq.map((q) => {
            const f = reader(q);
            return { q: oneLine(f('q')), a: oneLine(f('a')) };
        }).filter((q) => q.q && q.a),
    };

    facts.unknown = (profile.demoFields ?? []).map((f) => UNKNOWN_FIELDS[f]).filter(Boolean);
    if (!facts.testimonials.length) facts.unknown.push('client testimonials');
    if (!facts.video.length) facts.unknown.push('video work');
    if (!facts.numbers.length) facts.unknown.push('figures such as users served or projects shipped');
    return facts;
};

// --- Markdown for the AI layer ---

const bullet = (label, value) => (value ? `- ${label}: ${value}` : null);
const section = (title, lines) => {
    const body = lines.filter(Boolean);
    return body.length ? [`## ${title}`, ...body].join('\n') : null;
};
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const githubLine = (gh) => {
    if (!gh) return null;
    const parts = [];
    if (gh.commits !== null) parts.push(plural(gh.commits, 'commit'));
    if (gh.stars !== null) parts.push(plural(gh.stars, 'star'));
    if (gh.lastPush) parts.push(`last push ${gh.lastPush}`);
    return parts.join(', ');
};

const links = (p) => [p.live && `live ${p.live}`, p.repo && `repo ${p.repo}`].filter(Boolean).join(' · ') || null;

const AVAILABILITY = { freelance: 'freelance projects', fullTime: 'full-time roles', contract: 'contracts', remote: 'remote work' };

const projectBlock = (p) => {
    const meta = [DISTRICT_NAMES[p.district], p.status && `status ${p.status}`, p.featured && 'featured'].filter(Boolean).join(' · ');
    const who = [
        p.builtFor && `built for: ${p.builtFor}`,
        p.role && `role: ${p.role}`,
        p.teamSize !== null && `team of ${p.teamSize}`,
        p.dates,
    ].filter(Boolean).join(' · ');
    const cs = p.caseStudy;
    const xray = p.xray ? Object.entries(p.xray).filter(([, v]) => v).map(([k, v]) => `${k.toUpperCase()}: ${v}`) : [];
    return [
        `### ${p.name} [${p.slug}]`,
        meta && `- ${meta}`,
        who && `- ${who}`,
        p.stack.length ? `- Stack: ${p.stack.join(', ')}` : null,
        bullet('Description (GitHub)', p.description),
        bullet('Links', links(p)),
        bullet('GitHub', githubLine(p.github)),
        p.effort !== null && `- Effort (owner's 1–10 rating): ${p.effort}`,
        cs && bullet('Problem', cs.problem),
        cs && bullet('Hardest part', cs.hardestPart),
        cs && bullet('Key decision', cs.decision),
        cs?.result && `- Result: ${cs.result}${cs.resultSource ? ` (source: ${cs.resultSource})` : ''}`,
        xray.length ? `- Under the hood: ${xray.join(' · ')}` : null,
    ].filter(Boolean).join('\n');
};

const repoLine = (r) => {
    const details = [r.description, r.stack.length && `stack ${r.stack.join(', ')}`, r.status && `status ${r.status}`, githubLine(r.github), links(r)].filter(Boolean);
    return `- ${r.name} [${r.slug}]${details.length ? `: ${details.join(' · ')}` : ''}`;
};

/** knowledgeFacts() → the Markdown doc. */
export const renderKnowledge = (f) => {
    const name = f.name ?? 'the owner';
    const open = f.availability ? Object.keys(AVAILABILITY).filter((k) => f.availability[k]).map((k) => AVAILABILITY[k]) : [];
    const c = f.contact;
    return [
        `# Knowledge: ${name}`,
        `Everything the guide knows about ${name} and his work. Facts only come from here.`,
        section('About', [
            bullet('Name', f.name),
            bullet('Headline', f.headline),
            bullet('Based in', f.location),
            bullet('Roots', f.roots),
            bullet('Degree', f.degree),
            bullet('Years coding', f.yearsCoding),
            bullet('Spoken languages', f.spokenLanguages.join(', ')),
            f.bio && `\nBio: ${f.bio}`,
            f.origin.length ? `\nOrigin story:\n${f.origin.join('\n\n')}` : null,
        ]),
        section('Contact and availability', [
            f.availability && bullet('Open to', open.length ? open.join(', ') : 'nothing at the moment'),
            bullet('Email', c.email),
            bullet('GitHub', c.github),
            bullet('LinkedIn', c.linkedin),
            bullet('X', c.x),
            bullet('YouTube', c.youtube),
            bullet('CV (PDF on this site)', c.cv),
        ]),
        section('Services (the Market stalls)', f.services.map((s) =>
            `- ${s.name}${s.delivered ? `: ${s.delivered}` : ''}${s.examples.length ? ` Examples: ${s.examples.map((x) => `[${x}]`).join(', ')}` : ''}`)),
        section('Projects (buildings in OJ City; [slug] identifies each one)', f.projects.map(projectBlock)),
        section('More public repos (buildings in Downtown, from GitHub data only, no write-up)', f.repos.map(repoLine)),
        section('Experience', f.experience.map((e) => [
            `### ${[`${e.role}, ${e.company}`, e.dates, e.location].filter(Boolean).join(' · ')}`,
            ...e.did.map((d) => `- ${d}`),
            bullet('Proudest of', e.proudest),
        ].filter(Boolean).join('\n'))),
        section('Teaching (the School)', f.teaching.map((t) => {
            const details = [t.venue, t.audience && `for ${t.audience}`, t.courses, t.date, t.link].filter(Boolean);
            return `- ${t.title}${details.length ? ` (${details.join('; ')})` : ''}`;
        })),
        section('Video work (the Cinema)', f.video.map((v) => {
            const details = [v.role, v.tools.join(', '), v.link].filter(Boolean);
            return `- ${v.title}${details.length ? ` (${details.join('; ')})` : ''}`;
        })),
        section('Hobbies', f.hobbies.map((h) => `- ${h.name}: ${h.text}`)),
        section('Tools', [f.tools.summary, ...f.tools.groups.map((g) => `- ${g.name}: ${g.items.join(', ')}`)]),
        section('Clients and workplaces', f.clients.map((t) => `- ${t}`)),
        section('Testimonials (shared with permission)', f.testimonials.map((t) => `- "${t.quote}" — ${t.name}${t.link ? ` (${t.link})` : ''}`)),
        section('Numbers (owner-supplied, with source)', f.numbers.map((s) => `- ${s.label}: ${s.value} (source: ${s.source})`)),
        section('FAQ (owner answers)', f.faq.map((q) => `Q: ${q.q}\nA: ${q.a}`)),
        section('Not known (say you don\'t know and suggest the contact form)', [
            ...f.unknown,
            'prices beyond the FAQ, private repos, and anything not written in this document',
        ].map((i) => `- ${i}`)),
    ].filter(Boolean).join('\n\n') + '\n';
};

/** Content + buildings → the Markdown doc (knowledgeFacts + renderKnowledge). */
export const buildKnowledge = (input) => renderKnowledge(knowledgeFacts(input));
