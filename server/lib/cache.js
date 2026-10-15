// Memory + file cache with stale-while-revalidate (architecture.md "Data refresh").
// Old data is served immediately while one background refresh runs; a failed refresh keeps
// the last good copy. The copy on disk survives restarts and upstream outages.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_CACHE_DIR = fileURLToPath(new URL('../.cache', import.meta.url));

/**
 * @param {object} o
 * @param {string} o.key           file name (without .json) in `dir`
 * @param {number} o.ttlMs         age after which data is refreshed
 * @param {(previous: any) => Promise<any>} o.load  fetches fresh data; gets the last good data
 * @param {(data: any) => boolean} [o.isUsable]     false ⇒ refresh early (e.g. content added a repo)
 * @param {number} [o.retryMs]     min gap between refresh attempts after a failure or early refresh
 */
export const createCache = ({ key, ttlMs, load, isUsable = () => true, retryMs = 5 * 60 * 1000, dir = DEFAULT_CACHE_DIR, now = Date.now, log = console }) => {
    const file = path.join(dir, `${key}.json`);
    let entry = null; // { data, fetchedAt }
    let loadedFromDisk = false;
    let inflight = null;
    let lastAttempt = -Infinity;

    const readDisk = async () => {
        loadedFromDisk = true;
        try {
            const parsed = JSON.parse(await readFile(file, 'utf8'));
            if (parsed && typeof parsed.fetchedAt === 'number' && 'data' in parsed) entry = parsed;
        } catch (err) {
            if (err.code !== 'ENOENT') log.warn(`[cache] ignoring unreadable ${key}.json: ${err.message}`);
        }
    };

    const writeDisk = async (value) => {
        try {
            await mkdir(dir, { recursive: true });
            const tmp = `${file}.${process.pid}.tmp`;
            await writeFile(tmp, JSON.stringify(value));
            await rename(tmp, file); // atomic: a crash never leaves half a file
        } catch (err) {
            log.warn(`[cache] could not persist ${key}: ${err.message}`);
        }
    };

    const refresh = () => {
        inflight ??= (async () => {
            lastAttempt = now();
            try {
                const data = await load(entry?.data);
                entry = { data, fetchedAt: now() };
                await writeDisk(entry);
                return entry;
            } catch (err) {
                log.error(`[cache] refresh of ${key} failed, keeping last good data: ${err.message}`);
                throw err;
            } finally {
                inflight = null;
            }
        })();
        return inflight;
    };

    const needsRefresh = () => {
        if (now() - lastAttempt < retryMs) return false;
        return now() - entry.fetchedAt >= ttlMs || !isUsable(entry.data);
    };

    return {
        /** Resolves to { data, fetchedAt, stale }. Rejects only when there has never been good data. */
        async get() {
            if (!loadedFromDisk) await readDisk();
            if (!entry) {
                if (inflight || now() - lastAttempt >= retryMs) return { ...(await refresh()), stale: false };
                throw new Error(`no data for ${key} yet`);
            }
            if (needsRefresh()) refresh().catch(() => {});
            return { ...entry, stale: now() - entry.fetchedAt >= ttlMs };
        },
        // Exposed for tests and graceful shutdown.
        get inflight() {
            return inflight;
        },
    };
};
