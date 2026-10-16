import { Router } from 'express';
import { createCache } from '../lib/cache.js';
import { createGitHubClient } from '../lib/github.js';
import { buildCity, loadGitHubConfig, loadProjects, repoRefs, selectRepos } from '../lib/city.js';

const SIX_HOURS = 6 * 60 * 60 * 1000;
// On a cold start, don't hold the page longer than this; the refresh carries on in the background.
const COLD_WAIT_MS = 4000;

const withTimeout = (promise, ms) =>
    Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms, null).unref())]);

const sameAccounts = (a = [], b = []) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * GET /api/city. Works without GitHub: projects fall back to owner-supplied effort, and discovered repos
 * keep the last good list. Options exist for tests; production uses the defaults.
 */
export const createCityRouter = ({
    env = process.env,
    projects = loadProjects(),
    config = loadGitHubConfig(),
    github = createGitHubClient({ token: env.GITHUB_TOKEN || undefined }),
    cacheDir,
    coldWaitMs = COLD_WAIT_MS,
    now = Date.now,
} = {}) => {
    const accounts = [...new Set(config.accounts.map((a) => a.toLowerCase()))].sort();
    const contentRefs = repoRefs(projects);

    const cache = createCache({
        // New key for the { accounts, listing, stats } shape (ADR-012); the old stats-only file is ignored.
        key: 'github-city',
        ttlMs: SIX_HOURS,
        dir: cacheDir,
        load: async (previous) => {
            const listing = accounts.length ? await github.discover(accounts, previous?.listing) : {};
            const refs = [...contentRefs, ...selectRepos(listing, config)];
            const stats = refs.length ? await github.allStats(refs, previous?.stats) : {};
            return { accounts, listing, stats };
        },
        // Changed accounts, or a repo (in content or newly un-hidden) without stats, trigger an early refresh.
        isUsable: (data) => sameAccounts(data?.accounts, accounts)
            && [...contentRefs, ...selectRepos(data.listing, config)].every((r) => r.key in (data.stats ?? {})),
    });

    const githubData = () => cache.get().catch(() => null);

    const router = Router();
    // Rate limit: the /api default (60/min) already matches the 'data' preset in security.md.
    router.get('/city', async (req, res) => {
        const entry = await withTimeout(githubData(), coldWaitMs);
        res.set('Cache-Control', entry ? 'public, max-age=300' : 'public, max-age=30');
        res.json({
            generatedAt: new Date(now()).toISOString(),
            statsUpdatedAt: entry ? new Date(entry.fetchedAt).toISOString() : null,
            projects: buildCity(projects, entry?.data, { hide: config.hide, now: now() }),
        });
    });

    // Fetch at startup so the first visitor doesn't wait.
    router.warm = () => (contentRefs.length || accounts.length ? githubData() : Promise.resolve(null));
    return router;
};
