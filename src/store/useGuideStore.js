// Ask My Portfolio (P4-05): the guide's panel and conversation, kept for the visit (closing the panel keeps it).
// A question that failed stays on screen with its notice but is never sent again as history.
// guideChat.js is loaded on the first question (it ships in the panel's chunk), not with the page.
// P4-04: an answer's actions are kept on it; `autorun` is the answer whose requested action (auto) the panel runs.
// Switching between the city and the one-page site reloads the page, so the conversation goes along in sessionStorage.
import { create } from 'zustand';

const HANDOFF_KEY = 'oj-guide-handoff';
let nextId = 1;
let controller = null;

// The conversation handed over by the other mode, read once.
const handedOver = () => {
    try {
        const raw = window.sessionStorage.getItem(HANDOFF_KEY);
        window.sessionStorage.removeItem(HANDOFF_KEY);
        const list = JSON.parse(raw ?? '[]');
        if (!Array.isArray(list)) return [];
        return list
            .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
            .slice(-20)
            .map((m) => ({ id: nextId++, role: m.role, content: m.content, citations: Array.isArray(m.citations) ? m.citations : [], failed: m.failed === true }));
    } catch {
        return [];
    }
};

const useGuideStore = create((set, get) => ({
    open: false,
    pending: false,
    // { id, role: 'user' | 'assistant' | 'notice', content, citations?, suggestions?, actions?, kind?, failed? }
    messages: typeof window === 'undefined' ? [] : handedOver(),
    autorun: null, // id of the answer whose auto action is waiting to run
    ai: null, // P4-03b: true when answers may come from the AI (Groq), false when not, null until asked

    /** Ask the server once whether the AI layer is on, so the panel can say messages go to Groq. */
    checkAi: async ({ fetchImpl = fetch } = {}) => {
        if (get().ai !== null) return;
        try {
            const res = await fetchImpl('/api/chat', { headers: { Accept: 'application/json' } });
            set({ ai: res.ok ? (await res.json())?.ai === true : false });
        } catch {
            set({ ai: false });
        }
    },

    // Closed before the answer came: the camera doesn't move later out of nowhere.
    setOpen: (open) => set(open ? { open } : { open, autorun: null }),
    toggle: () => get().setOpen(!get().open),
    /** The panel ran (or skipped) the waiting action. */
    clearAutorun: () => set({ autorun: null }),
    /** Keep the conversation for the page about to load (switch_mode). */
    handOff: () => {
        try {
            const keep = get().messages.filter((m) => m.role === 'user' || m.role === 'assistant')
                .map(({ role, content, citations, failed }) => ({ role, content, citations, failed }));
            window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(keep));
        } catch {
            // private mode or storage off: the new page starts a fresh conversation
        }
    },
    /** Go to the other mode, taking the conversation along. */
    leaveTo: (url) => {
        get().handOff();
        window.location.assign(url);
    },

    send: async (text, { fetchImpl } = {}) => {
        const content = String(text ?? '').trim();
        if (!content || get().pending) return;
        const question = { id: nextId++, role: 'user', content };
        set({ messages: [...get().messages, question], pending: true });
        controller = new AbortController();
        const history = get().messages.filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.failed);
        let chat = null;
        try {
            chat = await import('../lib/guideChat.js');
            const reply = await chat.askGuide(history, { fetchImpl, signal: controller.signal });
            const id = nextId++;
            set({
                messages: [...get().messages, { id, role: 'assistant', content: reply.text, citations: reply.citations, suggestions: reply.suggestions, actions: reply.actions ?? [], engine: reply.engine }],
                pending: false,
                // Only while the panel is still open: an answer that lands after it closed never moves the camera.
                autorun: get().open && reply.actions?.some((a) => a.auto) ? id : null,
            });
        } catch (err) {
            if (err?.name === 'AbortError') {
                set({ pending: false });
                return;
            }
            const kind = chat && err instanceof chat.GuideError ? err.kind : 'unavailable';
            set({
                messages: [
                    ...get().messages.map((m) => (m.id === question.id ? { ...m, failed: true } : m)),
                    { id: nextId++, role: 'notice', kind, content: err?.message || "The guide can't be reached right now." },
                ],
                pending: false,
            });
        } finally {
            controller = null;
        }
    },

    /** Stop a question in flight (e.g. the page is leaving). */
    cancel: () => controller?.abort(),
}));

export default useGuideStore;
