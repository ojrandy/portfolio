// Optional AI layer for OJ Guide (P4-03b, ADR-014 option B): Groq's free tier through its OpenAI-compatible API.
// Off unless GROQ_API_KEY and GROQ_MODEL are set. A daily cap (CHAT_DAILY_AI_LIMIT, counted per Buea day and kept on
// disk so a restart doesn't reset it) stays below Groq's free limit. Every failure (timeout, 429, empty answer)
// returns null, so the built-in guide answers instead. The account must never have a payment method (ADR-014).
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_CACHE_DIR } from './cache.js';

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_DAILY_LIMIT = 500;
const TIMEOUT_MS = 8000;
const MAX_TOKENS = 450;

/** Today in Buea (WAT), as YYYY-MM-DD. */
export const bueaDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

const positiveInt = (value, fallback) => {
    const n = Number.parseInt(value ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Daily request counter, persisted as { day, count }. */
const createDailyCounter = ({ file, limit, now, log }) => {
    let state = null;
    let saving = Promise.resolve();
    const load = async () => {
        if (state) return;
        try {
            const saved = JSON.parse(await readFile(file, 'utf8'));
            state = typeof saved?.day === 'string' && Number.isInteger(saved.count) ? saved : { day: '', count: 0 };
        } catch {
            state = { day: '', count: 0 };
        }
    };
    const today = () => {
        const day = bueaDay(now());
        if (state.day !== day) state = { day, count: 0 };
        return state;
    };
    const save = () => {
        const copy = JSON.stringify(state);
        saving = saving.then(async () => {
            try {
                await mkdir(path.dirname(file), { recursive: true });
                await writeFile(`${file}.tmp`, copy);
                await rename(`${file}.tmp`, file);
            } catch (err) {
                log.warn?.(`[chat] could not save the AI counter: ${err.message}`);
            }
        });
    };
    return {
        /** Room left today? */
        available: async () => {
            await load();
            return today().count < limit;
        },
        /** Take one request from today's allowance; false when it's used up. */
        take: async () => {
            await load();
            const s = today();
            if (s.count >= limit) return false;
            s.count += 1;
            save();
            return true;
        },
        flush: () => saving,
    };
};

/**
 * @param {{ env?: object, fetchImpl?: typeof fetch, now?: () => number, dir?: string, timeoutMs?: number, log?: object }} options
 * @returns {{ enabled: boolean, available: () => Promise<boolean>,
 *   answer: (o: { system: string, messages: { role: string, content: string }[] }) => Promise<string | null>, flush: () => Promise<void> }}
 */
export const createGroq = ({ env = process.env, fetchImpl = fetch, now = Date.now, dir = DEFAULT_CACHE_DIR, timeoutMs = TIMEOUT_MS, log = console } = {}) => {
    const key = env.GROQ_API_KEY?.trim();
    const model = env.GROQ_MODEL?.trim();
    if (!key || !model) {
        return { enabled: false, available: async () => false, answer: async () => null, flush: async () => {} };
    }
    const counter = createDailyCounter({ file: path.join(dir, 'chat-ai-day.json'), limit: positiveInt(env.CHAT_DAILY_AI_LIMIT, DEFAULT_DAILY_LIMIT), now, log });

    return {
        enabled: true,
        available: counter.available,
        flush: counter.flush,
        answer: async ({ system, messages }) => {
            // Counted before the call: a failed request still uses Groq's allowance.
            if (!(await counter.take())) return null;
            try {
                const res = await fetchImpl(GROQ_URL, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model,
                        messages: [{ role: 'system', content: system }, ...messages.map(({ role, content }) => ({ role, content }))],
                        max_tokens: MAX_TOKENS,
                        temperature: 0.3,
                        stream: false,
                    }),
                    signal: AbortSignal.timeout(timeoutMs),
                });
                if (!res.ok) {
                    // Status only: Groq's error body can echo the request.
                    log.warn?.(`[chat] groq status=${res.status}`);
                    return null;
                }
                const data = await res.json();
                const text = data?.choices?.[0]?.message?.content;
                return typeof text === 'string' && text.trim() ? text : null;
            } catch (err) {
                log.warn?.(`[chat] groq failed: ${err?.name === 'TimeoutError' ? 'timeout' : err?.name ?? 'error'}`);
                return null;
            }
        },
    };
};

// eslint-disable-next-line no-control-regex -- matching them is the point
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
export const MAX_AI_CHARS = 1500;

/**
 * Make an AI answer safe to show: known [slug]s only (an unknown one goes, with the space before it), no markdown
 * headings, bold or code fences, at most MAX_AI_CHARS (cut at a sentence or line end).
 * @param {string} text
 * @param {Set<string>} slugs  slugs that exist
 * @returns {{ text: string, citations: string[] }}
 */
export const cleanAnswer = (text, slugs) => {
    let out = String(text ?? '').replace(CONTROL, '').replace(/\r\n?/g, '\n')
        .replace(/```[^\n]*\n?/g, '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/^\s*[*•]\s+/gm, '- ')
        .replace(/\s?\[([^\]\n]{1,80})\](?!\()/g, (m, inner) => (slugs.has(inner) ? m : ''))
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (out.length > MAX_AI_CHARS) {
        const cut = out.slice(0, MAX_AI_CHARS);
        const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'), cut.lastIndexOf('\n'));
        out = (end > MAX_AI_CHARS / 2 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`).trim();
    }
    const citations = [...new Set([...out.matchAll(/\[([a-z0-9-]+)\]/g)].map((m) => m[1]).filter((s) => slugs.has(s)))];
    return { text: out, citations };
};
