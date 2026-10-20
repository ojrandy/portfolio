// Preview capture (P3-02): `npm run previews` screenshots every non-demo project with an HTTPS live URL at 1280×800
// into public/previews/<slug>.webp (WebP from Chromium's own encoder). /api/city offers a preview only when its file exists.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { projectsFileSchema } from '../content/schema.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PROJECTS_FILE = path.join(ROOT, 'content', 'projects.json');
const PREVIEWS_DIR = path.join(ROOT, 'public', 'previews');
const VIEWPORT = { width: 1280, height: 800 };
const WEBP_QUALITY = 0.82;

export const captureCandidates = (projects) => projects.flatMap((project) => {
    if (project.demo || project.demoFields?.includes('live')) return [];
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug ?? '') || typeof project.live !== 'string') return [];
    try {
        const url = new URL(project.live);
        if (url.protocol !== 'https:' || url.username || url.password) return [];
        url.hash = '';
        return [{ slug: project.slug, url: url.href }];
    } catch {
        return [];
    }
});

export const isChallengePage = (title, body) => /checking your browser before accessing|just a moment\.\.\./i.test(`${title}\n${body}`);

// Age gates and cookie banners that would otherwise cover the screenshot.
export const GATE_BUTTON = /^\s*(?:yes,? )?(?:i(?:'m| am) )?(?:over )?(?:1[89]|2[01])\+?\s*$|^\s*(?:enter(?: site)?|accept(?: all)?(?: cookies)?|i agree|agree|got it)\s*$/i;

// True when every RGBA pixel is within `tolerance` of the first: the page had not rendered.
export const isBlankImage = (rgba, tolerance = 8) => {
    for (let i = 4; i < rgba.length; i += 4) {
        if (Math.abs(rgba[i] - rgba[0]) > tolerance || Math.abs(rgba[i + 1] - rgba[1]) > tolerance
            || Math.abs(rgba[i + 2] - rgba[2]) > tolerance) return false;
    }
    return true;
};

const dismissGates = async (page) => {
    const button = page.getByRole('button', { name: GATE_BUTTON }).first();
    if (!(await button.isVisible().catch(() => false))) return;
    await button.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1000);
};

const encodeWebp = async (page, png) => {
    const source = `data:image/png;base64,${png.toString('base64')}`;
    const { dataUrl, sample } = await page.evaluate(async ({ pngUrl, quality }) => {
        const image = new Image();
        image.src = pngUrl;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext('2d').drawImage(image, 0, 0);
        const small = document.createElement('canvas');
        small.width = 64;
        small.height = 40;
        const smallCtx = small.getContext('2d');
        smallCtx.drawImage(image, 0, 0, 64, 40);
        return { dataUrl: canvas.toDataURL('image/webp', quality), sample: Array.from(smallCtx.getImageData(0, 0, 64, 40).data) };
    }, { pngUrl: source, quality: WEBP_QUALITY });
    if (isBlankImage(sample)) throw new Error('Page rendered blank; no preview written');

    const prefix = 'data:image/webp;base64,';
    if (!dataUrl.startsWith(prefix)) throw new Error('This browser could not encode WebP images');
    const output = Buffer.from(dataUrl.slice(prefix.length), 'base64');
    if (output.toString('ascii', 0, 4) !== 'RIFF' || output.toString('ascii', 8, 12) !== 'WEBP') {
        throw new Error('WebP encoder returned an invalid image');
    }
    return output;
};

export const capturePreviews = async () => {
    const content = projectsFileSchema.parse(JSON.parse(await readFile(PROJECTS_FILE, 'utf8')));
    const candidates = captureCandidates(content.projects);
    if (!candidates.length) {
        console.log('No projects with HTTPS live URLs to capture.');
        return { captured: 0, failures: [] };
    }

    await mkdir(PREVIEWS_DIR, { recursive: true });
    const browser = await chromium.launch();
    const failures = [];
    let captured = 0;
    try {
        const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: 'reduce' });
        for (const { slug, url } of candidates) {
            const page = await context.newPage();
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
                await page.locator('body').waitFor({ state: 'attached', timeout: 10_000 });
                await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
                await page.getByRole('heading', { name: /Checking your browser before accessing/i })
                    .waitFor({ state: 'hidden', timeout: 12_000 }).catch(() => {});
                const title = await page.title();
                const body = await page.locator('body').innerText();
                if (isChallengePage(title, body)) throw new Error('Site is still presenting an anti-bot challenge; no preview written');
                await dismissGates(page);
                await page.evaluate(async () => {
                    await Promise.race([document.fonts.ready, new Promise((resolveFonts) => setTimeout(resolveFonts, 5000))]);
                    await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
                });
                const png = await page.screenshot({ type: 'png', fullPage: false, animations: 'disabled' });
                const webp = await encodeWebp(page, png);
                await writeFile(path.join(PREVIEWS_DIR, `${slug}.webp`), webp);
                captured += 1;
                console.log(`Captured ${slug}: ${VIEWPORT.width}x${VIEWPORT.height} → public/previews/${slug}.webp (${webp.length} bytes)`);
            } catch (error) {
                failures.push({ slug, message: error.message });
                console.error(`Failed ${slug} (${url}): ${error.message}`);
            } finally {
                await page.close();
            }
        }
        await context.close();
    } finally {
        await browser.close();
    }

    console.log(`Preview capture finished: ${captured}/${candidates.length} captured.`);
    if (failures.length) process.exitCode = 1;
    return { captured, failures };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    capturePreviews().catch((error) => {
        console.error(`Preview capture failed: ${error.message}`);
        process.exitCode = 1;
    });
}
