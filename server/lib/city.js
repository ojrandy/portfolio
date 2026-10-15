// /api/city data: content/projects.json + cached GitHub stats → the public building list.
// Content is merged on every request, so a content deploy shows up without waiting for the cache.
import { readFileSync } from 'node:fs';
import { projectsFileSchema, TODO } from '../../content/schema.js';
import { parseRepoUrl } from './github.js';

const PROJECTS_FILE = new URL('../../content/projects.json', import.meta.url);

export const loadProjects = (file = PROJECTS_FILE) => projectsFileSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).projects;

/** GitHub refs for every project with a public github.com repo URL. */
export const repoRefs = (projects) => projects.map((p) => parseRepoUrl(p.repo)).filter(Boolean);

const clean = (value) => (value === TODO ? null : value);

const EMPTY_STATS = { commits: null, stars: null, lastPush: null, languages: null };

/**
 * @param {object[]} projects  validated content projects
 * @param {Record<string, object>} githubStats  from github.allStats(), keyed by 'owner/repo'
 */
export const buildCity = (projects, githubStats = {}) =>
    projects.map((p) => {
        const ref = parseRepoUrl(p.repo);
        const gh = ref ? githubStats[ref.key] : undefined;
        const fromGitHub = gh?.available === true;
        const effort = p.stats.effort;

        let stats;
        if (fromGitHub) {
            const { commits, stars, lastPush, languages } = gh;
            stats = { source: 'github', commits, stars, lastPush, languages };
        } else {
            stats = { source: effort === null ? 'none' : 'owner', ...EMPTY_STATS };
        }

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
            primaryLanguage: fromGitHub ? gh.primaryLanguage : null,
            effort,
            stats,
            preview: null, // P3-02
            demo: p.demo,
        };
    });
