// Performance check for the 3D city (P1-08). Run `npm run build` first, then `npm run perf`.
// Serves the production build (Express app in-process, GitHub off), opens /?city&perf in Chromium (real GPU) as a desktop and as an emulated
// mid-range Android phone (Pixel 7 screen, 4× CPU throttle; the phone GPU can't be emulated, see P5-07),
// and reports fps, frame times, draw calls and chunk sizes against the budget in CLAUDE.md.
// Three samples per profile: the start view, the flight to the first building, and zoomed right out (P3B-10).
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { createApp } from '../server/app.js';
import { createCityRouter } from '../server/routes/city.js';
import { createBueaRouter } from '../server/routes/buea.js';

const PORT = Number(process.env.PERF_PORT ?? 4173);
const BASE = `http://127.0.0.1:${PORT}`;
const IDLE_MS = 5000;
const FLIGHT_MS = 2000;
const ZOOM_OUT_MS = 1500; // holding '-' from the start view: far enough out to see the whole city and the roads out
const BUDGET = { desktopFps: 55, phoneFps: 30, drawCalls: 100, entryKb: 200 };
// --quality=low|medium|high pins the render quality (adaptive by default); --only=desktop|phone runs one profile.
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const QUALITY = arg('quality');
const ONLY = arg('only');
const REPEAT = Number(arg('repeat') ?? 1); // --repeat=N runs each profile N times in the same browser
// --time=HH:MM pins Buea time (P3B-10). The default is rush hour at dusk: every vehicle and person out, lamps and
// head/tail-light glows on, the heaviest the city gets. --time=live uses the real clock.
const TIME = arg('time') ?? '17:30';
if (TIME !== 'live' && !/^\d{1,2}:\d{2}$/.test(TIME)) throw new Error('--time must be HH:MM or live');
// --reduced-motion runs with prefers-reduced-motion: reduce and fails if any vehicle or person moves.
const REDUCED = process.argv.includes('--reduced-motion');
// --weather=cloudy|fog|rain|storm measures under that weather (P2-04): /api/buea answers with it.
const WEATHERS = {
    cloudy: { code: 3, kind: 'cloudy', label: 'overcast', cloud: 100, rain: 0 },
    fog: { code: 45, kind: 'fog', label: 'fog', cloud: 100, rain: 0 },
    rain: { code: 65, kind: 'rain', label: 'heavy rain', cloud: 100, rain: 8 },
    storm: { code: 95, kind: 'thunderstorm', label: 'thunderstorm', cloud: 100, rain: 8 },
};
const WEATHER = arg('weather');
if (WEATHER && !WEATHERS[WEATHER]) throw new Error(`--weather must be one of ${Object.keys(WEATHERS).join(', ')}`);

const PROFILES = [
    { name: 'desktop', minFps: BUDGET.desktopFps, context: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 } },
    { name: 'phone', minFps: BUDGET.phoneFps, cpuThrottle: 4, context: { ...devices['Pixel 7'] } },
];

const sizes = () => {
    const dist = path.resolve('dist');
    const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
    const initial = new Set([...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map((m) => m[1]));
    const files = readdirSync(path.join(dist, 'assets')).filter((f) => f.endsWith('.js'));
    const kb = (f) => gzipSync(readFileSync(path.join(dist, 'assets', f))).length / 1024;
    const sum = (list) => list.reduce((t, f) => t + kb(f), 0);
    const lazy = files.filter((f) => !initial.has(f));
    return {
        entryKb: sum([...initial]),
        lazyKb: sum(lazy),
        chunks: files.map((f) => ({ file: f, gzipKb: Number(kb(f).toFixed(1)), initial: initial.has(f) })),
    };
};

// The production app in this process, with GitHub stubbed out: perf runs use the cached stats as they are and
// never spend the GitHub rate limit (a failed refresh keeps the last good data and writes nothing). Open-Meteo is off
// too: /api/buea answers with the computed sun and fallback weather.
const off = () => Promise.reject(new Error('GitHub disabled for perf runs'));
const offline = { discover: off, allStats: off };
const quiet = { ...console, error: () => {}, warn: () => {} };

const startServer = async () => {
    const realConsole = globalThis.console;
    globalThis.console = quiet; // the cache logs the refusal on every refresh attempt
    const app = createApp({ env: { ...process.env, NODE_ENV: 'production' }, routes: [createCityRouter({ github: offline }), createBueaRouter({ weather: { current: off } })] });
    globalThis.console = realConsole;
    return new Promise((resolve, reject) => {
        const server = app.listen(PORT, '127.0.0.1', () => resolve(server));
        server.on('error', (e) => reject(new Error(`Can't listen on ${BASE}: ${e.message} (set PERF_PORT)`)));
    });
};

const stopServer = (server) => new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(() => resolve());
});

const summarise = (frames) => {
    const sorted = [...frames].sort((a, b) => a - b);
    const mean = frames.reduce((t, f) => t + f, 0) / frames.length;
    return {
        fps: Number((1000 / mean).toFixed(1)),
        p95Ms: Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(1)),
        maxMs: Number(sorted.at(-1).toFixed(1)),
        longFrames: frames.filter((f) => f > 50).length,
        frames: frames.length,
    };
};

const sample = async (page, ms) => {
    await page.evaluate(() => window.__cityPerf.reset());
    await page.waitForTimeout(ms);
    return page.evaluate(() => ({ ...window.__cityPerf, frames: [...window.__cityPerf.frames] }));
};

const moving = (before, after) => ['vehicles', 'people'].flatMap((kind) => {
    const was = new Map(before[kind].map(([id, x, z]) => [id, [x, z]]));
    return after[kind].filter(([id, x, z]) => was.has(id) && (was.get(id)[0] !== x || was.get(id)[1] !== z)).map(([id]) => `${kind} ${id}`);
});

const measure = async (browser, profile) => {
    const context = await browser.newContext({ ...profile.context, ...(REDUCED ? { reducedMotion: 'reduce' } : {}) });
    const page = await context.newPage();
    const problems = [];
    page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
    page.on('pageerror', (e) => problems.push(e.message));
    if (profile.cpuThrottle) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuThrottle });
    }

    if (WEATHER) {
        await page.route('**/api/buea', async (route) => {
            const response = await route.fetch();
            const json = await response.json();
            await route.fulfill({ response, json: { ...json, weather: { ...json.weather, ...WEATHERS[WEATHER], source: 'perf' } } });
        });
    }

    const t0 = Date.now();
    await page.goto(`${BASE}/?city&perf${QUALITY ? `&quality=${QUALITY}` : ''}${TIME === 'live' ? '' : `&time=${TIME}`}`);
    await page.waitForFunction(() => window.__cityPerf && !document.querySelector('[role=status]'), null, { timeout: 60000 });
    const readyMs = Date.now() - t0;
    await page.waitForTimeout(1000); // let the first-view settle and any quality change land

    const crowdBefore = await page.evaluate(() => window.__cityPerf.crowd());
    const idle = await sample(page, IDLE_MS);
    const crowdAfter = await page.evaluate(() => window.__cityPerf.crowd());
    await page.locator('[role=application]').focus();
    await page.keyboard.press('Tab'); // fly to the first building
    const flight = await sample(page, FLIGHT_MS);
    await page.keyboard.press('Escape'); // back to the start view
    await page.waitForTimeout(1500);
    await page.keyboard.down('Minus');
    await page.waitForTimeout(ZOOM_OUT_MS);
    await page.keyboard.up('Minus');
    await page.waitForTimeout(300);
    const zoomedOut = await sample(page, FLIGHT_MS);
    await context.close();

    // Reduced motion: everyone who was there at the start of the idle sample is still on the same spot.
    const moved = REDUCED ? moving(crowdBefore, crowdAfter) : [];
    if (moved.length) problems.push(`reduced motion: ${moved.length} moved (${moved.slice(0, 5).join(', ')})`);
    const crowd = { vehicles: crowdAfter.vehicles.length, people: crowdAfter.people.length };

    return {
        profile: profile.name,
        readyMs,
        idle: summarise(idle.frames),
        flight: summarise(flight.frames),
        zoomedOut: summarise(zoomedOut.frames),
        drawCalls: idle.calls,
        zoomedOutDrawCalls: zoomedOut.calls,
        crowd,
        triangles: idle.triangles,
        dpr: idle.dpr,
        quality: idle.quality ?? null,
        qualityChanges: [...idle.changes, ...flight.changes].map((c) => c.quality),
        problems,
        pass: [idle, flight, zoomedOut].every((x) => summarise(x.frames).fps >= profile.minFps && x.calls < BUDGET.drawCalls) && problems.length === 0,
    };
};

const main = async () => {
    const size = sizes();
    const server = await startServer();
    const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
    const results = [];
    try {
        for (const profile of PROFILES.filter((p) => !ONLY || p.name === ONLY)) {
            for (let i = 0; i < REPEAT; i++) results.push(await measure(browser, profile));
        }
    } finally {
        await browser.close();
        await stopServer(server);
    }

    if (process.argv.includes('--json')) {
        console.log(JSON.stringify({ size, results }, null, 2));
    } else {
        console.log(`Initial JS ${size.entryKb.toFixed(0)} KB gzip (budget ${BUDGET.entryKb}) · lazy chunks ${size.lazyKb.toFixed(0)} KB gzip`);
        console.log(`Buea time: ${TIME === 'live' ? 'live' : `${TIME} (pinned)`}${REDUCED ? ' · reduced motion' : ''}`);
        if (WEATHER) console.log(`Weather: ${WEATHER} (/api/buea stubbed)`);
        for (const c of size.chunks) console.log(`  ${c.initial ? 'initial' : 'lazy   '}  ${c.gzipKb.toString().padStart(6)} KB  ${c.file}`);
        for (const r of results) {
            console.log(`\n${r.profile}: ${r.pass ? 'PASS' : 'FAIL'}  (ready in ${r.readyMs} ms, dpr ${r.dpr}${r.quality ? `, quality ${r.quality}${QUALITY ? ' (pinned)' : ''}` : ''})`);
            for (const k of ['idle', 'flight', 'zoomedOut']) {
                const s = r[k];
                console.log(`  ${k.padEnd(9)} ${s.fps} fps, p95 ${s.p95Ms} ms, worst ${s.maxMs} ms, ${s.longFrames} frames > 50 ms`);
            }
            console.log(`  ${r.drawCalls} draw calls (${r.zoomedOutDrawCalls} zoomed out), ${r.triangles} triangles · ${r.crowd.vehicles} vehicles, ${r.crowd.people} people`);
            if (r.qualityChanges.length) console.log(`  quality changed while measuring: → ${r.qualityChanges.join(' → ')}`);
            if (r.problems.length) console.log(`  console: ${r.problems.join(' | ')}`);
        }
    }
    if (results.some((r) => !r.pass)) process.exitCode = 1;
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
