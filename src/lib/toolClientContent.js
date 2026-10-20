// Tools & clients on the homepage (P3-05), only from owner content: tool groups the owner has confirmed (not [DEMO]),
// plus the IDEs named in the owner's own tools summary; client lines only where `logoPermission` is yes.
// Placeholders (<…>, TODO(content)) are never shown.
const SUMMARY_TOOLS = [
    { label: 'VS Code', pattern: /\bvs\s*code\b/i },
    { label: 'WebStorm', pattern: /\bweb\s*storm\b/i },
];

const PLACEHOLDER = /<[^<>]+>|TODO\(content\)/i;
const real = (text) => typeof text === 'string' && text.trim() && !PLACEHOLDER.test(text);

export const toolClientContent = (profile = {}) => {
    const summary = profile.tools?.summary ?? '';
    const confirmed = (profile.tools?.groups ?? []).filter((group) => group.demo !== true).flatMap((group) => group.items ?? []);
    const named = SUMMARY_TOOLS.filter(({ pattern }) => pattern.test(summary)).map(({ label }) => label);
    const tools = [...new Set([...confirmed, ...named].filter(real).map((t) => t.trim()))];
    const clients = (profile.clients ?? [])
        .filter((client) => client.logoPermission === true && real(client.text))
        .map((client) => client.text.trim());

    return { tools, clients };
};
