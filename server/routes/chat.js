// POST /api/chat (P4-03, ADR-014): rate limit → body (48 KB) → zod → answer, as a short SSE stream.
// The built-in guide answers today; P4-03b puts the optional Groq layer in front of it with the same events:
//   text {delta} · suggestions {items} · done {engine} · error {message, fallback}
import express, { Router } from 'express';
import { z } from 'zod';
import { limits } from '../lib/rateLimit.js';
import { validate } from '../lib/validate.js';
import { knowledgeFacts, loadProfile } from '../lib/knowledge.js';
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
 * @param {{ city: { buildings: () => Promise<object[]> }, profile?: object, projects?: object[], rateLimits?: Function[], log?: object }} options
 *   city: the /api/city router (its buildings() feeds the knowledge). The rest default to the real content and limits.
 */
export const createChatRouter = ({ city, profile = loadProfile(), projects = loadProjects(), rateLimits = limits.chat(), log = console } = {}) => {
    let cached = { key: null, guide: null };
    // Rebuilt only when the facts change (a content deploy or a GitHub refresh).
    const guideFor = async () => {
        const buildings = await city.buildings();
        const facts = knowledgeFacts({ profile, projects, buildings });
        const key = JSON.stringify(facts);
        if (key !== cached.key) cached = { key, guide: createGuide(facts) };
        return cached.guide;
    };

    const router = Router();
    router.post('/chat', ...rateLimits, express.json({ limit: '48kb' }), validate({ body: chatBody }), async (req, res) => {
        res.status(200).set({
            'Content-Type': 'text/event-stream; charset=utf-8',
            // no-transform keeps compression from buffering the stream.
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no',
        });
        res.flushHeaders();
        try {
            const guide = await guideFor();
            const reply = guide.answer(req.valid.body.messages);
            sse(res, 'text', { delta: reply.text });
            sse(res, 'suggestions', { items: reply.suggestions });
            sse(res, 'done', { engine: 'guide' });
            // No message text or IP in the log (docs/security.md rule 6).
            log.info?.(`[chat] engine=guide intent=${reply.intent} lang=${reply.detected}`);
        } catch (err) {
            log.error?.('[chat] failed:', err?.message);
            sse(res, 'error', { message: 'The guide is resting. Please use the contact form.', fallback: 'contact' });
        }
        res.end();
    });
    return router;
};
