import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toolClientContent } from './toolClientContent.js';

const profile = JSON.parse(readFileSync(new URL('../../content/profile.json', import.meta.url), 'utf8'));

test('tools: confirmed groups plus IDEs named in the summary; demo groups never', () => {
    const { tools } = toolClientContent({
        tools: {
            summary: 'Best with IDEs like VScode and Webstorm',
            groups: [
                { demo: false, items: ['Git/GitHub', 'VS Code', 'TODO(content)'] },
                { demo: true, items: ['Fake Tool'] },
            ],
        },
    });
    assert.deepEqual(tools, ['Git/GitHub', 'VS Code', 'WebStorm']);
    assert.deepEqual(toolClientContent({ tools: { summary: 'No named IDEs here', groups: [{ demo: true, items: ['Fake Tool'] }] } }).tools, []);
});

test('clients: only lines the owner allowed, never placeholders', () => {
    const { clients } = toolClientContent({
        clients: [
            { text: ' Built the site for Example Ltd ', logoPermission: true },
            { text: 'Not permitted', logoPermission: false },
            { text: '<client name>', logoPermission: true },
            { text: 'TODO(content)', logoPermission: true },
        ],
    });
    assert.deepEqual(clients, ['Built the site for Example Ltd']);
    assert.deepEqual(toolClientContent(), { tools: [], clients: [] });
});

test('the real profile shows no demo tools and only permitted clients', () => {
    const { tools, clients } = toolClientContent(profile);
    const confirmed = new Set(profile.tools.groups.filter((g) => !g.demo).flatMap((g) => g.items));
    const squash = (s) => s.toLowerCase().replace(/\s+/g, '');
    const inSummary = (t) => squash(profile.tools.summary).includes(squash(t));
    for (const t of tools) assert.ok(confirmed.has(t) || inSummary(t), `${t} is confirmed or named by the owner`);
    const allowed = new Set(profile.clients.filter((c) => c.logoPermission === true).map((c) => c.text.trim()));
    for (const c of clients) assert.ok(allowed.has(c), c);
});
