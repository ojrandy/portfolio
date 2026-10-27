// POST /api/chat (P4-03, ADR-014): rate limit → body (48 KB) → zod → answer, as a short SSE stream.
// P4-03b: the optional Groq layer (lib/groq.js) answers first when it's on; the built-in guide answers when it's off,
// over the daily cap, failing, or when the question is a rule-change attempt, abuse or a request to go somewhere.
// Suggestions and actions always come from the built-in guide. Same events for both engines:
//   text {delta} · citations {items: [{slug, name}]} · suggestions {items} · actions {items} (P4-04, guide/actions.js)
//   · done {engine: 'ai' | 'guide'} · error {message, fallback}
// GET /api/chat → { ai }: whether answers may come from the AI (the panel says messages then go to Groq).
import express, { Router } from 'express';
import { z } from 'zod';
import { limits } from '../lib/rateLimit.js';
import { validate } from '../lib/validate.js';
import { knowledgeFacts, loadProfile, renderKnowledge } from '../lib/knowledge.js';
import { buildSystem } from '../lib/systemPrompt.js';
import { cleanAnswer, createGroq } from '../lib/groq.js';
import { createGuide } from '../lib/guide/index.js';
import { loadProjects } from '../lib/city.js';

export const MAX_MESSAGES = 12;
export const MAX_USER_CHARS = 600;
export const MAX_ASSISTANT_CHARS = 3000;

// Control characters (except tab and newline) are dropped before anything reads the text.
// eslint-disable-next-line no-control-regex -- matching them is the point
const stripControl = (s) => s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n');

const message = z.discriminatedUnion('role', [
    z.strictObject({ role: z.literal('user'), content: z.string().transform(stripControl).pipe(z.string().trim().min(1).max(MAX_USER_CHARS)) }),
    z.strictObject({ role: z.literal('assistant'), content: z.string().transform(stripControl).pipe(z.string().trim().min(1).max(MAX_ASSISTANT_CHARS)) }),
]);

export const chatBody = z.strictObject({
    messages: z.array(message).min(1).max(MAX_MESSAGES)
        .refine((ms) => ms.every((m, i) => m.role === (i % 2 === 0 ? 'user' : 'assistant')), 'messages must alternate, starting with user')
        .refine((ms) => ms.at(-1)?.role === 'user', 'the last message must be from the user'),
});

const sse = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

/**
 * @param {{ city: { buildings: () => Promise<object[]> }, profile?: object, projects?: object[], rateLimits?: Function[],
 *   ai?: ReturnType<typeof createGroq>, log?: object }} options
 *   city: the /api/city router (its buildings() feeds the knowledge). ai: the Groq layer (off without its env vars).
 *   The rest default to the real content and limits.
 */
export const createChatRouter = ({ city, profile = loadProfile(), projects = loadProjects(), rateLimits = limits.chat(), log = console, ai = createGroq({ log }) } = {}) => {
    let cached = { key: null, guide: null, names: new Map(), system: null };
    // Rebuilt only when the facts change (a content deploy or a GitHub refresh).
    const guideFor = async () => {
        const buildings = await city.buildings();
        const facts = knowledgeFacts({ profile, projects, buildings });
        const key = JSON.stringify(facts);
        if (key !== cached.key) {
            cached = {
                key,
                guide: createGuide(facts),
                names: new Map([...facts.projects, ...facts.repos].map((p) => [p.slug, p.name ?? p.slug])),
                // The P4-02 rules + knowledge, as one system message for the AI.
                system: ai.enabled ? buildSystem(renderKnowledge(facts)).map((b) => b.text).join('\n\n') : null,
            };
        }
        return cached;
    };

    // An AI answer, or null when the built-in guide should answer.
    const aiAnswer = async ({ system, names }, messages, reply) => {
        if (!ai.enabled || ['injection', 'abuse', 'navigate'].includes(reply.intent) || reply.actions.some((a) => a.auto)) return null;
        const text = await ai.answer({ system, messages });
        if (!text) return null;
        const clean = cleanAnswer(text, new Set(names.keys()));
        return clean.text ? clean : null;
    };

    const router = Router();
    router.get('/chat', async (req, res) => {
        res.set('Cache-Control', 'no-store').json({ ai: ai.enabled && await ai.available() });
    });
    router.post('/chat', ...rateLimits, express.json({ limit: '48kb' }), validate({ body: chatBody }), async (req, res) => {
        res.status(200).set({
            'Content-Type': 'text/event-stream; charset=utf-8',
            // no-transform keeps compression from buffering the stream.
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no',
        });
        res.flushHeaders();
        try {
            const current = await guideFor();
            const { messages } = req.valid.body;
            const reply = current.guide.answer(messages);
            const smart = await aiAnswer(current, messages, reply);
            const engine = smart ? 'ai' : 'guide';
            const { text, citations } = smart ?? reply;
            sse(res, 'text', { delta: text });
            // Project names for the chips, so the page needs no project data of its own.
            sse(res, 'citations', { items: citations.map((slug) => ({ slug, name: current.names.get(slug) ?? slug })) });
            sse(res, 'suggestions', { items: reply.suggestions });
            // P4-04: from the question, not the answer text, so it is the same whichever engine answers.
            sse(res, 'actions', { items: reply.actions });
            sse(res, 'done', { engine });
            // No message text or IP in the log (docs/security.md rule 6).
            log.info?.(`[chat] engine=${engine} intent=${reply.intent} lang=${reply.detected}`);
        } catch (err) {
            log.error?.('[chat] failed:', err?.message);
            sse(res, 'error', { message: 'The guide is resting. Please use the contact form.', fallback: 'contact' });
        }
        res.end();
    });
    return router;
};
