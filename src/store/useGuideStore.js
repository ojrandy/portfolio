// Ask My Portfolio (P4-05): the guide's panel and conversation, kept for the visit (closing the panel keeps it).
// A question that failed stays on screen with its notice but is never sent again as history.
// guideChat.js is loaded on the first question (it ships in the panel's chunk), not with the page.
import { create } from 'zustand';

let nextId = 1;
let controller = null;

const useGuideStore = create((set, get) => ({
    open: false,
    pending: false,
    // { id, role: 'user' | 'assistant' | 'notice', content, citations?, suggestions?, kind?, failed? }
    messages: [],

    setOpen: (open) => set({ open }),
    toggle: () => set({ open: !get().open }),

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
            set({
                messages: [...get().messages, { id: nextId++, role: 'assistant', content: reply.text, citations: reply.citations, suggestions: reply.suggestions, engine: reply.engine }],
                pending: false,
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
