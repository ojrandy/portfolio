// Ask My Portfolio, browser side (P4-05): read /api/chat's SSE stream, split answers into safe parts (text,
// https links, project chips) and keep the conversation within the server's limits. Pure, apart from askGuide's
// fetch; tested in guideChat.test.js.

// Server limits (server/routes/chat.js): alternating turns that start and end with the visitor.
export const MAX_TURNS = 11;
export const MAX_USER_CHARS = 600;
export const MAX_ASSISTANT_CHARS = 3000;

/** SSE reader that copes with events split across network chunks. Calls onEvent(name, data) per event. */
export const createSSEReader = (onEvent) => {
    let buffer = '';
    const flush = (block) => {
        let name = 'message';
        const data = [];
        for (const line of block.split('\n')) {
            if (line.startsWith('event:')) name = line.slice(6).trim();
            else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
        }
        if (!data.length) return;
        try {
            onEvent(name, JSON.parse(data.join('\n')));
        } catch {
            // a malformed event is skipped, the rest of the stream still counts
        }
    };
    return {
        push(chunk) {
            buffer += chunk.replace(/\r\n?/g, '\n');
            let end;
            while ((end = buffer.indexOf('\n\n')) !== -1) {
                flush(buffer.slice(0, end));
                buffer = buffer.slice(end + 2);
            }
        },
        end() {
            if (buffer.trim()) flush(buffer);
            buffer = '';
        },
    };
};

/**
 * The messages to send: the last turns that fit the server's limits, starting with the visitor.
 * @param {{ role: 'user' | 'assistant', content: string }[]} messages
 */
export const trimHistory = (messages) => {
    const clean = messages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .map((m) => ({ role: m.role, content: m.content.slice(0, m.role === 'user' ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS) }));
    let start = Math.max(0, clean.length - MAX_TURNS);
    while (start < clean.length && clean[start].role !== 'user') start += 1;
    return clean.slice(start);
};

const LINK_RE = /https:\/\/[^\s<>"'«»]+/g;
const CITE_RE = /\[([a-z0-9]+(?:-[a-z0-9]+)*)\]/g;
// Trailing punctuation belongs to the sentence, not the link.
const trimLink = (url) => url.replace(/[.,;:!?)\]]+$/, '');

const splitLinks = (text) => {
    const parts = [];
    let last = 0;
    for (const m of text.matchAll(LINK_RE)) {
        const href = trimLink(m[0]);
        if (m.index > last) parts.push({ type: 'text', text: text.slice(last, m.index) });
        parts.push({ type: 'link', href, text: href.replace(/^https:\/\//, '').replace(/\/$/, '') });
        last = m.index + href.length;
    }
    if (last < text.length) parts.push({ type: 'text', text: text.slice(last) });
    return parts;
};

/**
 * Answer text → lines of parts. Only https links become links; "[slug]" becomes a chip when the slug was
 * cited (names: slug → project name), and a "Name [slug]" pair becomes one chip labelled with the name.
 * Anything else stays text (React escapes it).
 * @param {string} text
 * @param {Map<string, string>} names  cited slugs → project names
 * @returns {{ list: boolean, parts: ({ type: 'text', text: string } | { type: 'link', href: string, text: string } | { type: 'cite', slug: string, label: string })[] }[]}
 */
export const answerLines = (text, names = new Map()) => String(text ?? '').split('\n').filter((l) => l.trim()).map((raw) => {
    const list = /^\s*-\s+/.test(raw);
    const line = list ? raw.replace(/^\s*-\s+/, '') : raw;
    const parts = [];
    let last = 0;
    for (const m of line.matchAll(CITE_RE)) {
        const slug = m[1];
        if (!names.has(slug)) continue;
        const label = names.get(slug) || slug;
        let before = line.slice(last, m.index);
        // "Vital Pulse [vital-pulse]" → one chip "Vital Pulse".
        if (before.trimEnd().endsWith(label)) before = before.trimEnd().slice(0, -label.length);
        parts.push(...splitLinks(before));
        parts.push({ type: 'cite', slug, label });
        last = m.index + m[0].length;
    }
    parts.push(...splitLinks(line.slice(last)));
    return { list, parts: parts.filter((p) => p.type !== 'text' || p.text) };
});

// Guide actions (P4-04, server/lib/guide/actions.js). Anything else the server might send is dropped.
export const PLACE_IDS = ['downtown', 'market', 'cinema', 'arcade', 'school', 'pitch', 'about'];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_ACTIONS = 3;

/**
 * Keep only well-formed actions, with nothing but the known fields.
 * @returns {({ type: 'fly_to_project' | 'open_case_study', slug: string, auto: boolean } | { type: 'go_to', place: string, auto: boolean }
 *   | { type: 'open_contact', auto: boolean } | { type: 'switch_mode', mode: 'city' | 'site', auto: boolean })[]}
 */
export const parseActions = (items) => (Array.isArray(items) ? items : []).flatMap((a) => {
    const auto = a?.auto === true;
    if ((a?.type === 'fly_to_project' || a?.type === 'open_case_study') && typeof a.slug === 'string' && SLUG_RE.test(a.slug)) return [{ type: a.type, slug: a.slug, auto }];
    if (a?.type === 'go_to' && PLACE_IDS.includes(a.place)) return [{ type: 'go_to', place: a.place, auto }];
    if (a?.type === 'open_contact') return [{ type: 'open_contact', auto }];
    if (a?.type === 'switch_mode' && (a.mode === 'city' || a.mode === 'site')) return [{ type: 'switch_mode', mode: a.mode, auto }];
    return [];
}).slice(0, MAX_ACTIONS);

/** Does the answer point to the contact form (so the panel offers a button)? */
export const mentionsContact = (text) => /contact form|formulaire de contact/i.test(String(text ?? ''));

export class GuideError extends Error {
    /** @param {'busy' | 'unavailable'} kind */
    constructor(kind, message) {
        super(message);
        this.kind = kind;
    }
}

const UNAVAILABLE = "The guide can't be reached right now. You can still contact Ojong directly.";

/**
 * POST the conversation to /api/chat and read the answer.
 * @returns {Promise<{ text: string, suggestions: string[], citations: { slug: string, name: string }[], actions: object[], engine: string | null }>}
 */
export const askGuide = async (messages, { fetchImpl = fetch, signal, url = '/api/chat' } = {}) => {
    let res;
    try {
        res = await fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            body: JSON.stringify({ messages: trimHistory(messages) }),
            signal,
        });
    } catch (err) {
        if (err?.name === 'AbortError') throw err;
        throw new GuideError('unavailable', UNAVAILABLE);
    }
    if (!res.ok) {
        let message = UNAVAILABLE;
        try {
            message = (await res.json()).error || message;
        } catch {
            // keep the generic message
        }
        throw new GuideError(res.status === 429 ? 'busy' : 'unavailable', res.status === 429 ? message : UNAVAILABLE);
    }

    const reply = { text: '', suggestions: [], citations: [], actions: [], engine: null };
    let failed = null;
    const reader = createSSEReader((name, data) => {
        if (name === 'text' && typeof data?.delta === 'string') reply.text += data.delta;
        else if (name === 'suggestions' && Array.isArray(data?.items)) reply.suggestions = data.items.filter((s) => typeof s === 'string').slice(0, 4);
        else if (name === 'citations' && Array.isArray(data?.items)) reply.citations = data.items.filter((c) => typeof c?.slug === 'string');
        else if (name === 'actions') reply.actions = parseActions(data?.items);
        else if (name === 'done') reply.engine = typeof data?.engine === 'string' ? data.engine : null;
        else if (name === 'error') failed = data?.message || UNAVAILABLE;
    });
    const decoder = new TextDecoder();
    const stream = res.body?.getReader();
    if (stream) {
        for (;;) {
            const { done, value } = await stream.read();
            if (done) break;
            reader.push(decoder.decode(value, { stream: true }));
        }
        reader.push(decoder.decode());
    } else {
        reader.push(await res.text());
    }
    reader.end();
    if (failed || !reply.text) throw new GuideError('unavailable', failed || UNAVAILABLE);
    return reply;
};
