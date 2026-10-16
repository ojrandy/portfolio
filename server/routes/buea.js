// GET /api/buea (P2-01): Buea's local time, sunrise/sunset and current weather. Time is computed per request;
// only the Open-Meteo response is cached (15 min, file-persisted). Works with Open-Meteo down: sun times are
// computed and the weather is a marked fallback.
import { Router } from 'express';
import { createCache } from '../lib/cache.js';
import { bueaState, createWeatherClient, weatherConfig } from '../lib/weather.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
// A cold start waits for the first fetch at most this long (the fetch itself times out at 4 s).
const COLD_WAIT_MS = 4500;

const withTimeout = (promise, ms) =>
    Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms, null).unref())]);

export const createBueaRouter = ({
    env = process.env,
    place = weatherConfig(env),
    weather = createWeatherClient(place),
    cacheDir,
    coldWaitMs = COLD_WAIT_MS,
    now = Date.now,
} = {}) => {
    const cache = createCache({
        key: 'buea-weather',
        ttlMs: FIFTEEN_MINUTES,
        retryMs: 2 * 60 * 1000,
        dir: cacheDir,
        now,
        load: () => weather.current(),
    });
    const upstream = () => cache.get().catch(() => null);

    const router = Router();
    router.get('/buea', async (req, res) => {
        const entry = await withTimeout(upstream(), coldWaitMs);
        res.set('Cache-Control', 'public, max-age=60');
        res.json(bueaState({ now: now(), place, upstream: entry }));
    });

    router.warm = () => upstream();
    return router;
};
