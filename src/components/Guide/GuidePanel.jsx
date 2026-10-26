// OJ Guide's panel (P4-05): the conversation, suggested questions and the question box. Answers are shown as
// text (React escapes them): https links, project chips and lists come from answerLines, never from HTML.
// Not modal: the city stays usable beside it. Escape closes it.
import { useEffect, useRef, useState } from 'react';
import useGuideStore from '../../store/useGuideStore.js';
import { answerLines, MAX_USER_CHARS, mentionsContact } from '../../lib/guideChat.js';

const STARTERS = ['What has Ojong built?', 'Does he know Flutter?', 'How much does a website cost?', 'How can I contact him?'];
const GREETING = "Hi! I'm OJ Guide. Ask me about Ojong's projects, skills, services, or how to reach him. Answers come only from his portfolio.";

const CHIP = 'inline-flex items-center gap-1 border border-window/40 bg-window/10 px-1.5 py-0.5 align-baseline font-mono text-[11px] text-window';
const BUTTON = 'border border-mist/25 px-2.5 py-1 text-left text-xs text-mist hover:bg-mist/10 focus-visible:outline-2 focus-visible:outline-window disabled:opacity-40';
const LINK = 'text-window underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-window break-all';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** One answer: lines of text, links and project chips. */
const Answer = ({ text, citations = [], onCite }) => {
    const names = new Map(citations.map((c) => [c.slug, c.name]));
    const lines = answerLines(text, names);
    const render = (part, i) => {
        if (part.type === 'link') {
            return (
                <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className={LINK}>
                    {part.text}<span className="sr-only"> (opens in a new tab)</span>
                </a>
            );
        }
        if (part.type === 'cite') {
            return onCite ? (
                <button key={i} type="button" onClick={() => onCite(part.slug)} className={`${CHIP} hover:bg-window/20 focus-visible:outline-2 focus-visible:outline-window`}>
                    {part.label}<span aria-hidden="true">→</span><span className="sr-only"> (open the project)</span>
                </button>
            ) : <span key={i} className={CHIP}>{part.label}</span>;
        }
        return <span key={i}>{part.text}</span>;
    };
    const blocks = [];
    for (const line of lines) {
        const last = blocks.at(-1);
        if (line.list && last?.list) last.items.push(line);
        else blocks.push(line.list ? { list: true, items: [line] } : line);
    }
    return blocks.map((b, i) => (b.list ? (
        <ul key={i} className="my-1 list-disc space-y-0.5 pl-5">
            {b.items.map((item, k) => <li key={k}>{item.parts.map(render)}</li>)}
        </ul>
    ) : <p key={i} className="my-1">{b.parts.map(render)}</p>));
};

/**
 * @param {{ corner: 'top' | 'bottom', onClose: () => void, onCite?: (slug: string) => void, onContact?: () => void }} props
 */
const GuidePanel = ({ corner, onClose, onCite, onContact }) => {
    const messages = useGuideStore((s) => s.messages);
    const pending = useGuideStore((s) => s.pending);
    const { send } = useGuideStore.getState();
    const [draft, setDraft] = useState('');
    const input = useRef(null);
    const log = useRef(null);

    useEffect(() => {
        input.current?.focus({ preventScroll: true });
    }, []);

    // Keep the newest message in view.
    useEffect(() => {
        log.current?.lastElementChild?.scrollIntoView({ block: 'end', behavior: reducedMotion() ? 'auto' : 'smooth' });
    }, [messages.length, pending]);

    const ask = (text) => {
        if (!text.trim() || pending) return;
        send(text);
        setDraft('');
        input.current?.focus({ preventScroll: true });
    };

    const lastAnswer = [...messages].reverse().find((m) => m.role === 'assistant' || m.role === 'notice');
    const suggestions = !messages.length ? STARTERS : lastAnswer?.role === 'assistant' ? lastAnswer.suggestions ?? [] : [];
    const showContact = onContact && lastAnswer && (lastAnswer.role === 'notice' || mentionsContact(lastAnswer.content));
    const cite = onCite ? (slug) => { onClose(); onCite(slug); } : undefined;

    const place = corner === 'bottom' ? 'sm:bottom-16 sm:top-auto' : 'sm:top-14 sm:bottom-auto';

    return (
        <div
            id="oj-guide"
            role="dialog"
            aria-modal="false"
            aria-labelledby="oj-guide-title"
            onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}
            className={`fixed inset-x-0 bottom-0 z-40 flex max-h-[75dvh] flex-col rounded-t-2xl border-t border-mist/20 bg-basalt/95 text-mist shadow-2xl backdrop-blur-[2px] sm:inset-x-auto sm:right-4 sm:max-h-[70vh] sm:w-[24rem] sm:rounded-2xl sm:border ${place}`}
        >
            <div className="flex items-center justify-between gap-3 border-b border-mist/15 px-4 py-3">
                <div>
                    <h2 id="oj-guide-title" className="text-sm font-semibold">OJ Guide</h2>
                    <p className="font-mono text-[11px] text-mist/60">Answers from Ojong&apos;s portfolio</p>
                </div>
                <button type="button" onClick={onClose} className={BUTTON}>Close</button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed">
                <ol ref={log} aria-live="polite" aria-relevant="additions" className="space-y-3">
                    {!messages.length && <li className="text-mist/85">{GREETING}</li>}
                    {messages.map((m) => (
                        <li key={m.id} data-role={m.role} className={m.role === 'user' ? 'flex justify-end' : ''}>
                            {m.role === 'user' && (
                                <p className={`max-w-[85%] whitespace-pre-wrap break-words bg-ash px-3 py-2 ${m.failed ? 'opacity-60' : ''}`}>
                                    <span className="sr-only">You: </span>{m.content}
                                </p>
                            )}
                            {m.role === 'assistant' && (
                                <div className="break-words">
                                    <span className="sr-only">OJ Guide: </span>
                                    <Answer text={m.content} citations={m.citations} onCite={cite} />
                                </div>
                            )}
                            {m.role === 'notice' && (
                                <p role="status" className="border-l-2 border-ember pl-3 text-mist/85">{m.content}</p>
                            )}
                        </li>
                    ))}
                    {pending && (
                        <li className="text-mist/60">
                            <span aria-hidden="true">…</span><span className="sr-only">OJ Guide is answering</span>
                        </li>
                    )}
                </ol>

                {(suggestions.length > 0 || showContact) && !pending && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {showContact && (
                            <button type="button" onClick={() => { onClose(); onContact(); }} className={`${BUTTON} border-window/50 text-window`}>
                                Open contact form
                            </button>
                        )}
                        {suggestions.map((s) => (
                            <button key={s} type="button" onClick={() => ask(s)} className={BUTTON}>{s}</button>
                        ))}
                    </div>
                )}
            </div>

            <form
                className="border-t border-mist/15 p-3"
                onSubmit={(event) => { event.preventDefault(); ask(draft); }}
            >
                <label htmlFor="oj-guide-input" className="sr-only">Your question for OJ Guide</label>
                <div className="flex items-end gap-2">
                    <textarea
                        id="oj-guide-input"
                        ref={input}
                        rows={2}
                        value={draft}
                        maxLength={MAX_USER_CHARS}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                event.preventDefault();
                                ask(draft);
                            }
                        }}
                        placeholder="Ask about Ojong's work…"
                        className="min-h-[2.75rem] flex-1 resize-none border border-mist/25 bg-black/40 px-3 py-2 text-sm text-mist placeholder:text-mist/40 focus-visible:outline-2 focus-visible:outline-window"
                    />
                    <button type="submit" disabled={pending || !draft.trim()} className={`${BUTTON} py-2`}>Send</button>
                </div>
                <p aria-hidden="true" className="mt-1 text-right font-mono text-[10px] text-mist/40">{draft.length}/{MAX_USER_CHARS}</p>
            </form>
        </div>
    );
};

export default GuidePanel;
