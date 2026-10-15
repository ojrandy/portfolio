// docs/projects.md → content/profile.json + content/projects.json (ADR-010).
// Writes nothing if the markdown or the result is invalid.
import { readFile, writeFile } from 'node:fs/promises';
import { parseProjectsMd } from './lib/parse-projects-md.js';
import { PATHS, checkContent, report, serialize, toFiles } from './lib/content-check.js';

const md = await readFile(PATHS.md, 'utf8');
const parsed = parseProjectsMd(md);

if (parsed.errors.length) {
    report({ errors: parsed.errors, warnings: parsed.warnings, summary: null });
    console.error('Nothing was written. Fix docs/projects.md and run again.');
    process.exit(1);
}

const files = toFiles(parsed);
const result = checkContent(files);
result.warnings.unshift(...parsed.warnings);
report(result);

if (result.errors.length) {
    console.error('Nothing was written. Fix docs/projects.md and run again.');
    process.exit(1);
}

await writeFile(PATHS.profile, serialize(files.profile));
await writeFile(PATHS.projects, serialize(files.projects));
console.log('  wrote content/profile.json, content/projects.json');
