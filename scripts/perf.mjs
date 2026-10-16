// Performance check for the 3D city (P1-08). Run `npm run build` first, then `npm run perf`.
// Serves the production build (Express app in-process, GitHub off), opens /?city&perf in Chromium (real GPU) as a desktop and as an emulated
// mid-range Android phone (Pixel 7 screen, 4× CPU throttle; the phone GPU can't be emulated, see P5-07),
// and reports fps, frame times, draw calls and chunk sizes against the budget in CLAUDE.md.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { createApp } from '../server/app.js';
import { createCityRouter } from '../server/routes/city.js';

const PORT = Number(process.env.PERF_PORT ?? 4173);
const BASE = `http://127.0.0.1:${PORT}`;
const IDLE_MS = 5000;
const FLIGHT_MS = 2000;
const BUDGET = { desktopFps: 55, phoneFps: 30, drawCalls: 100, entryKb: 200 };
// --quality=low|medium|high pins the render quality (adaptive by default); --only=desktop|phone runs one profile.
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const QUALITY = arg('quality');
const ONLY = arg('only');
const REPEAT = Number(arg('repeat') ?? 1); // --repeat=N runs each profile N times in the same browser

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
// never spend the GitHub rate limit (a failed refresh keeps the last good data and writes nothing).
const off = () => Promise.reject(new Error('GitHub disabled for perf runs'));
const offline = { discover: off, allStats: off };
const quiet = { ...console, error: () => {}, warn: () => {} };

const startServer = async () => {
    const realConsole = globalThis.console;
    globalThis.console = quiet; // the cache logs the refusal on every refresh attempt
    const app = createApp({ env: { ...process.env, NODE_ENV: 'production' }, routes: [createCityRouter({ github: offline })] });
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

const measure = async (browser, profile) => {
    const context = await browser.newContext(profile.context);
    const page = await context.newPage();
    const problems = [];
    page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
    page.on('pageerror', (e) => problems.push(e.message));
    if (profile.cpuThrottle) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuThrottle });
    }

    const t0 = Date.now();
    await page.goto(`${BASE}/?city&perf${QUALITY ? `&quality=${QUALITY}` : ''}`);
    await page.waitForFunction(() => window.__cityPerf && !document.querySelector('[role=status]'), null, { timeout: 60000 });
    const readyMs = Date.now() - t0;
    await page.waitForTimeout(1000); // let the first-view settle and any quality change land

    const idle = await sample(page, IDLE_MS);
    await page.locator('[role=application]').focus();
    await page.keyboard.press('Tab'); // fly to the first building
    const flight = await sample(page, FLIGHT_MS);
    await context.close();

    return {
        profile: profile.name,
        readyMs,
        idle: summarise(idle.frames),
        flight: summarise(flight.frames),
        drawCalls: idle.calls,
        triangles: idle.triangles,
        dpr: idle.dpr,
        quality: idle.quality ?? null,
        qualityChanges: [...idle.changes, ...flight.changes].map((c) => c.quality),
        problems,
        pass: summarise(idle.frames).fps >= profile.minFps && summarise(flight.frames).fps >= profile.minFps && idle.calls < BUDGET.drawCalls && problems.length === 0,
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
        for (const c of size.chunks) console.log(`  ${c.initial ? 'initial' : 'lazy   '}  ${c.gzipKb.toString().padStart(6)} KB  ${c.file}`);
        for (const r of results) {
            console.log(`\n${r.profile}: ${r.pass ? 'PASS' : 'FAIL'}  (ready in ${r.readyMs} ms, dpr ${r.dpr}${r.quality ? `, quality ${r.quality}${QUALITY ? ' (pinned)' : ''}` : ''})`);
            for (const k of ['idle', 'flight']) {
                const s = r[k];
                console.log(`  ${k.padEnd(7)} ${s.fps} fps, p95 ${s.p95Ms} ms, worst ${s.maxMs} ms, ${s.longFrames} frames > 50 ms`);
            }
            console.log(`  ${r.drawCalls} draw calls, ${r.triangles} triangles`);
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
