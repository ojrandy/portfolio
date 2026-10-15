// Shared by build-content.js and validate-content.js: schema + cross-field rules + placeholder scan.
import { fileURLToPath } from 'node:url';
import { projectsFileSchema, profileFileSchema, TODO } from '../../content/schema.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

export const PATHS = {
    root,
    md: `${root}docs/projects.md`,
    projects: `${root}content/projects.json`,
    profile: `${root}content/profile.json`,
};

export const GENERATED = 'Generated from docs/projects.md by `npm run content:build`. Do not edit by hand.';
export const MAX_FEATURED = 3;

export const toFiles = ({ profile, projects }) => ({
    profile: { $generated: GENERATED, ...profile },
    projects: { $generated: GENERATED, projects },
});

export const serialize = (data) => `${JSON.stringify(data, null, 4)}\n`;

const formatPath = (path) =>
    path.reduce((s, p) => (typeof p === 'number' ? `${s}[${p}]` : s ? `${s}.${p}` : String(p)), '');

const PLACEHOLDER_RE = /<[^<>\n]+>/;

// Every TODO(content), <placeholder>, demo record and demo field, with its path.
const scanPlaceholders = (value, path, out) => {
    if (typeof value === 'string') {
        if (value.includes(TODO) || PLACEHOLDER_RE.test(value)) out.todos.push(path);
    } else if (Array.isArray(value)) {
        value.forEach((v, i) => scanPlaceholders(v, `${path}[${i}]`, out));
    } else if (value && typeof value === 'object') {
        if (value.demo === true) out.demos.push(path);
        else for (const f of value.demoFields ?? []) out.demos.push(`${path}.${f}`);
        for (const [k, v] of Object.entries(value)) {
            if (k === 'demo' || k === 'demoFields' || k === '$generated') continue;
            scanPlaceholders(v, path ? `${path}.${k}` : k, out);
        }
    }
    return out;
};

export const checkContent = (files, { strict = false } = {}) => {
    const errors = [];
    const warnings = [];

    const profileResult = profileFileSchema.safeParse(files.profile);
    const projectsResult = projectsFileSchema.safeParse(files.projects);
    for (const [name, result] of [['content/profile.json', profileResult], ['content/projects.json', projectsResult]]) {
        if (result.success) continue;
        for (const issue of result.error.issues) errors.push(`${name}: ${formatPath(issue.path) || '(root)'}: ${issue.message}`);
    }
    if (errors.length) return { errors, warnings, summary: null };

    const { projects } = projectsResult.data;
    const profile = profileResult.data;

    const seen = new Map();
    projects.forEach((p, i) => {
        if (seen.has(p.slug)) errors.push(`content/projects.json: projects[${i}].slug: "${p.slug}" is also used by projects[${seen.get(p.slug)}]`);
        seen.set(p.slug, i);
    });

    const featured = projects.filter((p) => p.featured);
    if (featured.length > MAX_FEATURED) {
        errors.push(`content/projects.json: ${featured.length} projects are featured (max ${MAX_FEATURED}): ${featured.map((p) => p.slug).join(', ')}`);
    }

    profile.testimonials.forEach((t, i) => {
        if (t.permission && (t.demo || t.demoFields.length || t.name.includes(TODO) || PLACEHOLDER_RE.test(t.name))) {
            errors.push(`content/profile.json: testimonials[${i}]: marked as permitted but has no real, attributed name`);
        }
        if (!t.permission && !t.demo) warnings.push(`content/profile.json: testimonials[${i}]: no permission yet, so it won't be shown`);
    });

    const found = scanPlaceholders({ profile, projects }, '', { todos: [], demos: [] });
    const summary = [
        `${projects.length} projects (${featured.length} featured)`,
        `${profile.experience.length} roles`,
        `${profile.teaching.length} teaching`,
        `${profile.video.length} videos`,
        `${found.demos.length} demo items`,
        `${found.todos.length} ${TODO}`,
    ].join(' · ');

    if (strict) {
        for (const p of found.demos) errors.push(`strict: [DEMO] still present: ${p}`);
        for (const p of found.todos) errors.push(`strict: missing content: ${p}`);
    }

    return { errors, warnings, summary };
};

export const report = ({ errors, warnings, summary }, { strict = false } = {}) => {
    for (const w of warnings) console.warn(`  warning  ${w}`);
    for (const e of errors) console.error(`  error    ${e}`);
    if (summary) console.log(`\n  ${summary}`);
    if (errors.length) {
        console.error(`\n✖ content check failed: ${errors.length} error(s)${strict ? ' (strict mode)' : ''}`);
    } else {
        console.log(`\n✔ content OK${strict ? ' (strict: launch-ready)' : ''}`);
    }
};
