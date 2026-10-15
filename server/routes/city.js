import { Router } from 'express';
import { createCache } from '../lib/cache.js';
import { createGitHubClient } from '../lib/github.js';
import { buildCity, loadProjects, repoRefs } from '../lib/city.js';

const SIX_HOURS = 6 * 60 * 60 * 1000;
// On a cold start, don't hold the page longer than this; the refresh carries on in the background.
const COLD_WAIT_MS = 4000;

const withTimeout = (promise, ms) =>
    Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms, null).unref())]);

/**
 * GET /api/city. Works without GitHub: projects fall back to owner-supplied effort.
 * Options exist for tests; production uses the defaults.
 */
export const createCityRouter = ({
    env = process.env,
    projects = loadProjects(),
    github = createGitHubClient({ token: env.GITHUB_TOKEN || undefined }),
    cacheDir,
    coldWaitMs = COLD_WAIT_MS,
} = {}) => {
    const refs = repoRefs(projects);
    const cache = createCache({
        key: 'github-stats',
        ttlMs: SIX_HOURS,
        dir: cacheDir,
        load: (previous) => github.allStats(refs, previous),
        // A repo added to content since the last fetch triggers an early refresh.
        isUsable: (data) => refs.every((r) => r.key in data),
    });

    const stats = () => cache.get().catch(() => null);

    const router = Router();
    // Rate limit: the /api default (60/min) already matches the 'data' preset in security.md.
    router.get('/city', async (req, res) => {
        const entry = await withTimeout(stats(), coldWaitMs);
        res.set('Cache-Control', entry ? 'public, max-age=300' : 'public, max-age=30');
        res.json({
            generatedAt: new Date().toISOString(),
            statsUpdatedAt: entry ? new Date(entry.fetchedAt).toISOString() : null,
            projects: buildCity(projects, entry?.data),
        });
    });

    // Fetch at startup so the first visitor doesn't wait.
    router.warm = () => (refs.length ? stats() : Promise.resolve(null));
    return router;
};
