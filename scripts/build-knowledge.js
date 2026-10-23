// Content (+ the cached GitHub data, if the server has fetched it) → server/knowledge/knowledge.md, the review
// copy of what the AI guide knows (P4-01). The server builds the same text in memory; this file is git-ignored.
// Fails when the doc is over the token budget.
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildCity, loadGitHubConfig, loadProjects } from '../server/lib/city.js';
import { buildKnowledge, estimateTokens, loadProfile, MAX_TOKENS } from '../server/lib/knowledge.js';
import { buildSystem } from '../server/lib/systemPrompt.js';

const CACHE_FILE = fileURLToPath(new URL('../server/.cache/github-city.json', import.meta.url));
const OUT_DIR = new URL('../server/knowledge/', import.meta.url);

const readGitHubCache = () => {
    if (!existsSync(CACHE_FILE)) return null;
    try {
        return JSON.parse(readFileSync(CACHE_FILE, 'utf8')).data ?? null;
    } catch {
        return null;
    }
};

const profile = loadProfile();
const projects = loadProjects();
const github = readGitHubCache();
const buildings = buildCity(projects, github ?? {}, { hide: loadGitHubConfig().hide });
const text = buildKnowledge({ profile, projects, buildings });
const tokens = estimateTokens(text);

await mkdir(OUT_DIR, { recursive: true });
await writeFile(new URL('knowledge.md', OUT_DIR), text);

const discovered = buildings.filter((b) => b.source === 'github').length;
const system = buildSystem(text).map((b) => b.text).join('\n\n');
console.log(`  wrote server/knowledge/knowledge.md: ${text.length} chars, ~${tokens} tokens (budget ${MAX_TOKENS})`);
console.log(`  system prompt (rules + knowledge): ~${estimateTokens(system)} tokens`);
console.log(github
    ? `  GitHub data from server/.cache: ${discovered} discovered repos`
    : '  no GitHub cache yet (run the server once): content projects only, no GitHub numbers');

if (tokens > MAX_TOKENS) {
    console.error(`  over the budget by ~${tokens - MAX_TOKENS} tokens`);
    process.exit(1);
}
