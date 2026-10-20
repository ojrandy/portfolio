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

const encodeWebp = async (page, png) => {
    const source = `data:image/png;base64,${png.toString('base64')}`;
    const dataUrl = await page.evaluate(async ({ pngUrl, quality }) => {
        const image = new Image();
        image.src = pngUrl;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext('2d').drawImage(image, 0, 0);
        return canvas.toDataURL('image/webp', quality);
    }, { pngUrl: source, quality: WEBP_QUALITY });

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
                await page.getByRole('heading', { name: /Checking your browser before accessing/i })
                    .waitFor({ state: 'hidden', timeout: 12_000 }).catch(() => {});
                const title = await page.title();
                const body = await page.locator('body').innerText();
                if (isChallengePage(title, body)) throw new Error('Site is still presenting an anti-bot challenge; no preview written');
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
