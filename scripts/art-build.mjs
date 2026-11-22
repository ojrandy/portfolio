// City kit build (ART-02): Blender scripts → raw .glb (+ preview renders) → gltf-transform (dedup, weld, meshopt)
// → public/models/city-kit.glb → budget check. Pipeline in docs/architecture.md "Art pipeline".
//   npm run art:build                   build, optimise, check, render previews
//   npm run art:build -- --no-previews  skip the renders (faster)
//   npm run art:check                   only check the committed kit (no Blender needed)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { ART_BUDGET, checkKit, summarizeKit } from './lib/artBudget.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'art/build/city-kit.raw.glb');
const OUT = path.join(ROOT, 'public/models/city-kit.glb');
const PREVIEWS = path.join(ROOT, 'art/previews');
const SCRIPT = path.join(ROOT, 'art/blender/build_kit.py');
const DEFAULT_BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender';

const checkOnly = process.argv.includes('--check');
const previews = !process.argv.includes('--no-previews');

const fail = (message) => {
    console.error(`\n[art] ${message}`);
    process.exit(1);
};

const runBlender = () => {
    const blender = process.env.BLENDER_PATH || DEFAULT_BLENDER;
    if (!existsSync(blender)) fail(`Blender not found at ${blender}. Install Blender 4.5 LTS or set BLENDER_PATH.`);
    const args = ['--background', '--factory-startup', '--python-exit-code', '1', '--python', SCRIPT, '--', '--out', RAW];
    if (previews) args.push('--previews', PREVIEWS);
    console.log(`[art] Blender: building the kit${previews ? ' and preview renders' : ''}…`);
    const run = spawnSync(blender, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const log = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    for (const line of log.split('\n')) if (line.startsWith('[art]')) console.log(line);
    if (run.status !== 0) {
        console.error(log.split('\n').slice(-40).join('\n'));
        fail(`Blender exited with ${run.status ?? run.signal}`);
    }
};

const makeIO = async () => {
    await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
    return new NodeIO()
        .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
        .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
};

const optimise = async (io) => {
    const doc = await io.read(RAW);
    // The exporter's placeholder material stays: the browser replaces it, and one shared material costs nothing.
    await doc.transform(dedup(), weld(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    mkdirSync(path.dirname(OUT), { recursive: true });
    await io.write(OUT, doc);
};

const check = async (io) => {
    if (!existsSync(OUT)) fail(`${path.relative(ROOT, OUT)} does not exist. Run npm run art:build.`);
    const bytes = statSync(OUT).size;
    const pieces = summarizeKit(await io.read(OUT));
    console.log(`\n[art] ${path.relative(ROOT, OUT)}: ${(bytes / 1024).toFixed(1)} KB (budget ${ART_BUDGET.kitBytes / 1024} KB), sha256 ${createHash('sha256').update(readFileSync(OUT)).digest('hex').slice(0, 12)}`);
    console.table(pieces.map((p) => ({ piece: p.name, triangles: p.triangles, attributes: p.attributes.join(' ') })));
    const problems = checkKit({ pieces, bytes });
    if (problems.length) fail(`over budget or malformed:\n  - ${problems.join('\n  - ')}`);
    console.log('[art] budget check passed');
};

const io = await makeIO();
if (!checkOnly) {
    runBlender();
    await optimise(io);
}
await check(io);
if (!checkOnly && previews) console.log(`[art] previews in ${path.relative(ROOT, PREVIEWS)}/ (git-ignored)`);
