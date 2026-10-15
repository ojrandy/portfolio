// Validates content/*.json and checks they match docs/projects.md.
// --strict (or CONTENT_STRICT=1): also fails on any [DEMO] or TODO(content). Use at launch.
import { readFile } from 'node:fs/promises';
import { parseProjectsMd } from './lib/parse-projects-md.js';
import { PATHS, checkContent, report, serialize, toFiles } from './lib/content-check.js';

const strict = process.argv.includes('--strict') || process.env.CONTENT_STRICT === '1';

const readJson = async (path, label) => {
    try {
        return JSON.parse(await readFile(path, 'utf8'));
    } catch (e) {
        const why = e.code === 'ENOENT' ? 'file is missing' : e.message;
        report({ errors: [`${label}: ${why}. Run \`npm run content:build\`.`], warnings: [], summary: null });
        process.exit(1);
    }
};

const files = {
    profile: await readJson(PATHS.profile, 'content/profile.json'),
    projects: await readJson(PATHS.projects, 'content/projects.json'),
};

const result = checkContent(files, { strict });

const parsed = parseProjectsMd(await readFile(PATHS.md, 'utf8'));
if (parsed.errors.length) {
    result.errors.push(...parsed.errors);
} else {
    const expected = toFiles(parsed);
    for (const key of ['profile', 'projects']) {
        if (serialize(expected[key]) !== serialize(files[key])) {
            result.errors.push(`content/${key}.json is out of date with docs/projects.md. Run \`npm run content:build\`.`);
        }
    }
}

report(result, { strict });
if (result.errors.length) process.exit(1);
