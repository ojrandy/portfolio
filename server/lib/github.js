// GitHub REST client for building stats. Only github.com/{owner}/{repo} URLs are accepted and the
// request URL is always built on api.github.com, so content can't point the server elsewhere.
import { z } from 'zod';

const API = 'https://api.github.com';
const REPO_URL = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/;

/** 'https://github.com/OJ/Repo' → { owner, repo, key: 'oj/repo' }, or null if it isn't a repo URL. */
export const parseRepoUrl = (url) => {
    const m = typeof url === 'string' ? REPO_URL.exec(url) : null;
    if (!m || m[2] === '.' || m[2] === '..') return null;
    return { owner: m[1], repo: m[2], key: `${m[1]}/${m[2]}`.toLowerCase() };
};

// Loose objects: GitHub sends many more fields; we only rely on these.
const repoSchema = z.object({
    private: z.boolean(),
    archived: z.boolean(),
    stargazers_count: z.int().min(0),
    pushed_at: z.string().nullable(),
    language: z.string().nullable(),
});
const languagesSchema = z.record(z.string(), z.number().min(0));

class GitHubError extends Error {}

/** Byte counts → shares that sum to ~1, largest first, rounded to 3 decimals. */
export const languageShares = (bytes) => {
    const total = Object.values(bytes).reduce((a, b) => a + b, 0);
    if (!total) return {};
    return Object.fromEntries(
        Object.entries(bytes)
            .sort((a, b) => b[1] - a[1])
            .map(([lang, n]) => [lang, Math.round((n / total) * 1000) / 1000]),
    );
};

/** Total commits from a per_page=1 response: the rel="last" page number, else the page length. */
export const commitCount = (linkHeader, pageLength) => {
    const last = linkHeader?.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
    return last ? Number(last[1]) : pageLength;
};

export const createGitHubClient = ({ token, fetch = globalThis.fetch, timeoutMs = 8000 } = {}) => {
    const headers = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'oj-city (ojongrandy.com)',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const get = (p) => fetch(`${API}${p}`, { headers, signal: AbortSignal.timeout(timeoutMs) });

    const json = async (res, schema, what) => {
        if (!res.ok) throw new GitHubError(`${what}: HTTP ${res.status}`);
        const parsed = schema.safeParse(await res.json());
        if (!parsed.success) throw new GitHubError(`${what}: unexpected response shape`);
        return parsed.data;
    };

    /**
     * Stats for one public repo. Missing or private repos resolve to { available: false };
     * anything transient (rate limit, timeout, 5xx) throws so the caller can keep older data.
     */
    const repoStats = async ({ owner, repo }) => {
        const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
        const [repoRes, langRes, commitRes] = await Promise.all([
            get(base),
            get(`${base}/languages`),
            get(`${base}/commits?per_page=1`),
        ]);
        if (repoRes.status === 404) return { available: false };
        const info = await json(repoRes, repoSchema, `${owner}/${repo}`);
        if (info.private) return { available: false }; // never publish stats of a private repo

        const languages = await json(langRes, languagesSchema, `${owner}/${repo} languages`);
        let commits;
        if (commitRes.status === 409) {
            commits = 0; // empty repository
        } else {
            const page = await json(commitRes, z.array(z.unknown()), `${owner}/${repo} commits`);
            commits = commitCount(commitRes.headers.get('link'), page.length);
        }

        return {
            available: true,
            commits,
            stars: info.stargazers_count,
            lastPush: info.pushed_at,
            primaryLanguage: info.language,
            languages: languageShares(languages),
            archived: info.archived,
        };
    };

    /**
     * Stats for many repos, keyed by lowercase 'owner/repo'. A repo that fails keeps its previous
     * value (or is left out); if every repo fails, this throws so the cache keeps the last good copy.
     */
    const allStats = async (refs, previous = {}) => {
        const unique = [...new Map(refs.map((r) => [r.key, r])).values()];
        const results = await Promise.allSettled(unique.map((r) => repoStats(r)));
        const out = {};
        let failures = 0;
        results.forEach((result, i) => {
            const { key } = unique[i];
            if (result.status === 'fulfilled') {
                out[key] = result.value;
            } else {
                failures += 1;
                console.warn(`[github] ${key}: ${result.reason?.message ?? result.reason}`);
                if (previous[key]) out[key] = previous[key];
            }
        });
        if (unique.length && failures === unique.length) throw new GitHubError('all GitHub requests failed');
        return out;
    };

    return { repoStats, allStats };
};
