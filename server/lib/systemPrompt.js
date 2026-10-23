// System prompt for OJ Guide (P4-02): the owner's rules (server/prompts/system.md) + the knowledge doc
// (P4-01), as Messages API `system` blocks. Rules first (never change), knowledge second (changes on a
// content deploy or a GitHub refresh), one cache breakpoint on the last block so the whole prompt is cached.
// Nothing per request (time, visitor, IP) goes in here: it would break the cache.
import { readFileSync } from 'node:fs';

const RULES_FILE = new URL('../prompts/system.md', import.meta.url);

export const loadRules = (file = RULES_FILE) => readFileSync(file, 'utf8').trim();

/**
 * @param {string} knowledge  buildKnowledge() output
 * @param {{ rules?: string }} options
 * @returns {{ type: 'text', text: string, cache_control?: { type: 'ephemeral' } }[]}
 */
export const buildSystem = (knowledge, { rules = loadRules() } = {}) => {
    // The knowledge builder already drops <tag>-like text; this keeps data from closing the section early.
    if (/<\/?knowledge\b/i.test(knowledge)) throw new Error('knowledge must not contain a <knowledge> tag');
    return [
        { type: 'text', text: rules },
        { type: 'text', text: `<knowledge>\n${knowledge.trim()}\n</knowledge>`, cache_control: { type: 'ephemeral' } },
    ];
};
