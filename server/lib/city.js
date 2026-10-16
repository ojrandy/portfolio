// /api/city data: content/projects.json + public repos discovered on GitHub + cached GitHub stats → the
// public building list (ADR-012). Content is merged on every request, so a content deploy shows up without
// waiting for the cache. A repo listed in content uses the owner's entry; GitHub only fills in the numbers.
import { readFileSync } from 'node:fs';
import { projectsFileSchema, profileFileSchema, TODO } from '../../content/schema.js';
import { parseRepoUrl } from './github.js';

const PROJECTS_FILE = new URL('../../content/projects.json', import.meta.url);
const PROFILE_FILE = new URL('../../content/profile.json', import.meta.url);

export const loadProjects = (file = PROJECTS_FILE) => projectsFileSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).projects;

/** { accounts, hide } from content/profile.json: which GitHub accounts to scan and which repos to leave out. */
export const loadGitHubConfig = (file = PROFILE_FILE) => profileFileSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).github;

/** GitHub refs for every project with a public github.com repo URL. */
export const repoRefs = (projects) => projects.map((p) => parseRepoUrl(p.repo)).filter(Boolean);

const clean = (value) => (value === TODO ? null : value);

const EMPTY_STATS = { commits: null, stars: null, lastPush: null, languages: null };
const ACTIVE_DAYS = 90;
const DAY = 24 * 60 * 60 * 1000;
const MAX_STACK = 5;
// Left out of an auto stack (the panel's language shares stay raw GitHub data): build tooling, and the
// native runner code every Flutter project generates, which GitHub counts as C++/Swift/Kotlin etc.
const TOOLING = new Set(['CMake', 'Makefile', 'Dockerfile', 'Batchfile', 'Procfile']);
const FLUTTER_RUNNER = new Set(['C++', 'C', 'Swift', 'Kotlin', 'Objective-C', 'HTML']);

/** GitHub language shares → stack: ≥ 5 % of the code, largest first, without tooling / Flutter runner code. */
export const languageStack = (languages = {}) => {
    const entries = Object.entries(languages);
    const flutter = entries.some(([name]) => name === 'Dart');
    return entries
        .filter(([name, share]) => share >= 0.05 && !TOOLING.has(name) && !(flutter && FLUTTER_RUNNER.has(name)))
        .slice(0, MAX_STACK)
        .map(([name]) => name);
};

const slugify = (s) =>
    s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Repo name → display name: 'food_recipe2' → 'Food Recipe2', 'novaTransport' → 'Nova Transport', 'WVL' stays. */
export const prettyName = (repo) =>
    repo.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[-_.\s]+/).filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || repo;

const httpsUrl = (value) => {
    if (!value) return null;
    try {
        const u = new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`);
        return u.protocol === 'https:' ? u.href : null;
    } catch {
        return null;
    }
};

/**
 * Discovered repos that become buildings: public, not forks, not empty, not the profile README repo or
 * `.github`, and not on the owner's hide list. Sorted by key, so the result is stable.
 * @param {Record<string, object[]>} listing  github.discover() output, keyed by account
 * @param {{ hide?: string[] }} options       'owner/repo' entries (any case)
 */
export const selectRepos = (listing = {}, { hide = [] } = {}) => {
    const hidden = new Set(hide.map((h) => h.toLowerCase()));
    return Object.values(listing).flat()
        .filter((r) => !r.private && !r.fork && r.size > 0)
        .filter((r) => r.repo.toLowerCase() !== r.owner.toLowerCase() && r.repo !== '.github')
        .filter((r) => !hidden.has(r.key))
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
};

/** archived → archived; a https homepage → live; pushed in the last 90 days → in-progress; else unknown. */
export const repoStatus = (repo, now) => {
    if (repo.archived) return 'archived';
    if (httpsUrl(repo.homepage)) return 'live';
    const pushed = Date.parse(repo.pushedAt ?? '');
    if (!Number.isNaN(pushed) && now - pushed <= ACTIVE_DAYS * DAY) return 'in-progress';
    return null;
};

const statsFor = (gh, effort) => {
    if (gh?.available === true) {
        const { commits, stars, lastPush, languages } = gh;
        return { source: 'github', commits, stars, lastPush, languages };
    }
    return { source: effort === null ? 'none' : 'owner', ...EMPTY_STATS };
};

/**
 * @param {object[]} projects  validated content projects
 * @param {{ stats?: Record<string, object>, listing?: Record<string, object[]> }} github  cached GitHub data
 * @param {{ hide?: string[], now?: number }} options
 */
export const buildCity = (projects, { stats = {}, listing = {} } = {}, { hide = [], now = Date.now() } = {}) => {
    const discovered = new Map(Object.values(listing).flat().map((r) => [r.key, r]));

    const fromContent = projects.map((p) => {
        const ref = parseRepoUrl(p.repo);
        const gh = ref ? stats[ref.key] : undefined;
        return {
            slug: p.slug,
            name: p.name,
            district: p.district,
            featured: p.featured,
            status: clean(p.status),
            category: clean(p.category) ?? [],
            stack: clean(p.stack) ?? [],
            live: clean(p.live),
            // Only link repos GitHub confirmed are public (or not checked yet); never 'private'.
            repo: ref && gh?.available !== false ? p.repo : null,
            primaryLanguage: gh?.available === true ? gh.primaryLanguage : null,
            effort: p.stats.effort,
            stats: statsFor(gh, p.stats.effort),
            description: (ref && discovered.get(ref.key)?.description) ?? null,
            source: 'content',
            preview: null, // P3-02
            demo: p.demo,
        };
    });

    const contentKeys = new Set(repoRefs(projects).map((r) => r.key));
    const slugs = new Set(fromContent.map((p) => p.slug));
    const fromGitHub = selectRepos(listing, { hide })
        .filter((r) => !contentKeys.has(r.key))
        .map((r) => {
            let slug = slugify(r.repo) || slugify(r.key);
            if (slugs.has(slug)) slug = slugify(`${r.owner}-${r.repo}`); // same name on two accounts
            slugs.add(slug);
            const gh = stats[r.key];
            return {
                slug,
                name: prettyName(r.repo),
                district: 'downtown',
                featured: false,
                status: repoStatus(r, now),
                category: [],
                stack: gh?.available === true ? languageStack(gh.languages ?? {}) : [],
                live: httpsUrl(r.homepage),
                repo: gh?.available === false ? null : r.url,
                primaryLanguage: gh?.available === true ? gh.primaryLanguage : null,
                effort: null,
                stats: statsFor(gh, null),
                description: r.description,
                source: 'github',
                preview: null,
                demo: false,
            };
        });

    return [...fromContent, ...fromGitHub];
};
