// Knowledge doc for "Ask My Portfolio" (P4-01, ADR-004): owner content + the city's buildings → compact
// Markdown that goes whole into the cached system prompt. Same honesty rules as the site: demo records,
// demo fields, TODO(content) and <placeholders> never appear; numbers only with a source; testimonials only
// with permission. Output depends only on the input (fixed order, no timestamps), so the prompt cache holds
// until the content or the GitHub data changes.
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
const bullet = (label, value) => (value ? `- ${label}: ${value}` : null);
const section = (title, lines) => {
    const body = lines.filter(Boolean);
    return body.length ? [`## ${title}`, ...body].join('\n') : null;
};

const DISTRICT_NAMES = { downtown: 'Downtown', cinema: 'Cinema', arcade: 'Arcade', school: 'School', pitch: 'Pitch' };
const month = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : null);

const dateRange = (dates) => {
    const start = clean(dates?.start);
    const end = clean(dates?.end);
    if (!start) return null;
    return end ? `${start} → ${end}` : `from ${start}`;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const githubNumbers = (stats) => {
    if (stats?.source !== 'github') return null;
    const parts = [];
    if (Number.isInteger(stats.commits)) parts.push(plural(stats.commits, 'commit'));
    if (Number.isInteger(stats.stars)) parts.push(plural(stats.stars, 'star'));
    if (month(stats.lastPush)) parts.push(`last push ${month(stats.lastPush)}`);
    return parts.length ? parts.join(', ') : null;
};

const links = (b) => [b.live && `live ${b.live}`, b.repo && `repo ${b.repo}`].filter(Boolean).join(' · ') || null;

const aboutSection = (profile) => {
    const field = reader(profile);
    const origin = (clean(field('origin')) ?? '').split(/\n\s*\n/).map(oneLine).filter(Boolean);
    return section('About', [
        bullet('Name', oneLine(field('name'))),
        bullet('Headline', oneLine(field('title'))),
        bullet('Based in', oneLine(field('location'))),
        bullet('Roots', oneLine(field('culture'))),
        bullet('Degree', oneLine(field('degree'))),
        bullet('Years coding', oneLine(field('yearsCoding'))),
        bullet('Spoken languages', list(field('languages')).join(', ')),
        clean(field('bio')) && `\nBio: ${oneLine(field('bio'))}`,
        origin.length ? `\nOrigin story:\n${origin.join('\n\n')}` : null,
    ]);
};

const AVAILABILITY = { freelance: 'freelance projects', fullTime: 'full-time roles', contract: 'contracts', remote: 'remote work' };

const contactSection = (profile) => {
    const field = reader(profile);
    const availability = field('availability');
    const open = availability ? Object.keys(AVAILABILITY).filter((k) => availability[k]).map((k) => AVAILABILITY[k]) : [];
    const l = field('links') ?? {};
    return section('Contact and availability', [
        availability && bullet('Open to', open.length ? open.join(', ') : 'nothing at the moment'),
        bullet('Email', clean(field('email'))),
        bullet('GitHub', clean(l.github)),
        bullet('LinkedIn', clean(l.linkedin)),
        bullet('X', clean(l.x)),
        bullet('YouTube', clean(l.youtube)),
        bullet('CV (PDF on this site)', clean(field('cv'))),
    ]);
};

const servicesSection = (profile, knownSlugs) => section('Services (the Market stalls)', profile.services.map((s) => {
    const field = reader(s);
    const name = oneLine(field('name'));
    if (!name) return null;
    const examples = (field('examples') ?? []).filter((slug) => knownSlugs.has(slug));
    const delivered = oneLine(field('delivered'));
    return `- ${name}${delivered ? `: ${delivered}` : ''}${examples.length ? ` Examples: ${examples.map((x) => `[${x}]`).join(', ')}` : ''}`;
}));

const experienceSection = (profile) => section('Experience', profile.experience.map((e) => {
    const field = reader(e);
    const role = oneLine(field('role'));
    const company = oneLine(field('company'));
    if (!role || !company) return null;
    const head = [`${role}, ${company}`, dateRange(field('dates')), oneLine(field('location'))].filter(Boolean).join(' · ');
    const did = list(field('did'));
    return [
        `### ${head}`,
        ...did.map((d) => `- ${d}`),
        bullet('Proudest of', oneLine(field('proudest'))),
    ].filter(Boolean).join('\n');
}));

const teachingSection = (profile) => section('Teaching (the School)', profile.teaching.map((t) => {
    const field = reader(t);
    const title = oneLine(field('title'));
    if (!title) return null;
    const details = [
        oneLine(field('venue')),
        oneLine(field('audience')) && `for ${oneLine(field('audience'))}`,
        oneLine(field('courses')),
        oneLine(field('date')),
        clean(field('link')),
    ].filter(Boolean);
    return `- ${title}${details.length ? ` (${details.join('; ')})` : ''}`;
}));

const videoSection = (profile) => section('Video work (the Cinema)', profile.video.map((v) => {
    const field = reader(v);
    const title = oneLine(field('title'));
    if (!title) return null;
    const details = [oneLine(field('role')), list(field('tools')).join(', '), clean(field('link'))].filter(Boolean);
    return `- ${title}${details.length ? ` (${details.join('; ')})` : ''}`;
}));

const hobbiesSection = (profile) => section('Hobbies', profile.hobbies.map((h) => {
    const name = oneLine(h.name);
    const text = oneLine(h.text);
    return name && text ? `- ${name}: ${text}` : null;
}));

const toolsSection = (profile) => section('Tools', [
    oneLine(profile.tools.summary),
    ...profile.tools.groups.map((g) => {
        const field = reader(g);
        const items = list(field('items'));
        return oneLine(field('name')) && items.length ? `- ${oneLine(field('name'))}: ${items.join(', ')}` : null;
    }),
]);

const clientsSection = (profile) => section('Clients and workplaces', profile.clients.map((c) => (oneLine(c.text) ? `- ${oneLine(c.text)}` : null)));

const testimonialsSection = (profile) => section('Testimonials (shared with permission)', profile.testimonials.map((t) => {
    if (!t.permission) return null;
    const field = reader(t);
    const quote = oneLine(field('quote'));
    const name = oneLine(field('name'));
    return quote && name ? `- "${quote}" — ${name}${clean(field('link')) ? ` (${clean(field('link'))})` : ''}` : null;
}));

// A number only with a real source: 'auto' values are counted elsewhere, and a TODO source drops the stat.
const numbersSection = (profile) => section('Numbers (owner-supplied, with source)', profile.stats.map((s) => {
    const field = reader(s);
    const label = oneLine(field('label'));
    const value = oneLine(field('value'));
    const source = oneLine(field('source'));
    return label && value && value !== 'auto' && source ? `- ${label}: ${value} (source: ${source})` : null;
}));

const faqSection = (profile) => section('FAQ (owner answers)', profile.faq.map((f) => {
    const field = reader(f);
    const q = oneLine(field('q'));
    const a = oneLine(field('a'));
    return q && a ? `Q: ${q}\nA: ${a}` : null;
}));

const projectBlock = (project, building) => {
    const field = reader(project);
    const b = building ?? {};
    const status = clean(b.status ?? field('status'));
    const meta = [
        DISTRICT_NAMES[project.district],
        status && `status ${status}`,
        project.featured && 'featured',
    ].filter(Boolean).join(' · ');
    const builtFor = oneLine(field('builtFor'));
    const team = field('teamSize');
    const who = [
        builtFor && `built for: ${builtFor}`,
        oneLine(field('role')) && `role: ${oneLine(field('role'))}`,
        Number.isInteger(team) && `team of ${team}`,
        dateRange(field('dates')),
    ].filter(Boolean).join(' · ');
    const stack = list(field('stack'));
    const cs = b.caseStudy;
    const xray = b.xray ? ['ui', 'api', 'data', 'infra'].map((k) => b.xray[k] && `${k.toUpperCase()}: ${oneLine(b.xray[k])}`).filter(Boolean) : [];
    const effort = field('stats')?.effort;
    const effortKnown = Number.isInteger(effort) && !(project.demoFields ?? []).includes('stats.effort');
    return [
        `### ${oneLine(project.name)} [${project.slug}]`,
        meta && `- ${meta}`,
        who && `- ${who}`,
        stack.length ? `- Stack: ${stack.join(', ')}` : null,
        bullet('Description (GitHub)', oneLine(b.description)),
        bullet('Links', links(b)),
        bullet('GitHub', githubNumbers(b.stats)),
        effortKnown && `- Effort (owner's 1–10 rating): ${effort}`,
        cs && bullet('Problem', oneLine(cs.problem)),
        cs && bullet('Hardest part', oneLine(cs.hardestPart)),
        cs && bullet('Key decision', oneLine(cs.decision)),
        cs?.result && `- Result: ${oneLine(cs.result)}${oneLine(cs.resultSource) ? ` (source: ${oneLine(cs.resultSource)})` : ''}`,
        xray.length ? `- Under the hood: ${xray.join(' · ')}` : null,
    ].filter(Boolean).join('\n');
};

const repoLine = (b) => {
    const details = [
        oneLine(b.description),
        b.stack?.length && `stack ${b.stack.join(', ')}`,
        b.status && `status ${b.status}`,
        githubNumbers(b.stats),
        links(b),
    ].filter(Boolean);
    return `- ${oneLine(b.name)} [${b.slug}]${details.length ? `: ${details.join(' · ')}` : ''}`;
};

const bySlug = (a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);

// Profile fields the site keeps as demo, in words the guide can use for "I don't know".
const UNKNOWN_FIELDS = { title: 'a final headline', availability: 'current availability', cv: 'a CV to download', languages: 'spoken languages', email: 'an email address' };

const unknownSection = (profile, sections) => {
    const items = (profile.demoFields ?? []).map((f) => UNKNOWN_FIELDS[f]).filter(Boolean);
    if (!sections.testimonials) items.push('client testimonials');
    if (!sections.video) items.push('video work');
    if (!sections.numbers) items.push('figures such as users served or projects shipped');
    items.push('prices beyond the FAQ, private repos, and anything not written in this document');
    return section('Not known (say you don\'t know and suggest the contact form)', items.map((i) => `- ${i}`));
};

/**
 * @param {{ profile: object, projects: object[], buildings?: object[] | null }} input
 *   profile / projects: validated content; buildings: buildCity() output (GitHub numbers, cleaned case
 *   studies, discovered repos). Without buildings, content projects are listed without GitHub data.
 * @returns {string} Markdown
 */
export const buildKnowledge = ({ profile, projects, buildings = null }) => {
    const byBuilding = new Map((buildings ?? []).map((b) => [b.slug, b]));
    const real = projects.filter((p) => !p.demo).sort(bySlug);
    const discovered = (buildings ?? []).filter((b) => b.source === 'github').sort(bySlug);
    const knownSlugs = new Set([...real, ...discovered].map((p) => p.slug));

    const sections = {
        about: aboutSection(profile),
        contact: contactSection(profile),
        services: servicesSection(profile, knownSlugs),
        projects: section('Projects (buildings in OJ City; [slug] identifies each one)', real.map((p) => projectBlock(p, byBuilding.get(p.slug)))),
        repos: section('More public repos (buildings in Downtown, from GitHub data only, no write-up)', discovered.map(repoLine)),
        experience: experienceSection(profile),
        teaching: teachingSection(profile),
        video: videoSection(profile),
        hobbies: hobbiesSection(profile),
        tools: toolsSection(profile),
        clients: clientsSection(profile),
        testimonials: testimonialsSection(profile),
        numbers: numbersSection(profile),
        faq: faqSection(profile),
    };
    const name = oneLine(profile.name) ?? 'the owner';
    return [
        `# Knowledge: ${name}`,
        `Everything the guide knows about ${name} and their work. Facts only come from here.`,
        ...Object.values(sections),
        unknownSection(profile, sections),
    ].filter(Boolean).join('\n\n') + '\n';
};
