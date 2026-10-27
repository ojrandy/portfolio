// "Ask OJ Guide" (P4-05): the always-there button. The panel is a separate chunk, loaded on the first open (or
// when the button is hovered or focused), so the guide adds almost nothing to the first load.
import { lazy, Suspense, useEffect, useRef } from 'react';
import useGuideStore from '../../store/useGuideStore.js';

const loadPanel = () => import('./GuidePanel.jsx');
const GuidePanel = lazy(loadPanel);

/**
 * @param {{ corner?: 'top' | 'bottom', className?: string, hidden?: boolean,
 *   onCite?: (slug: string) => void, onContact?: () => void, actions?: { label: Function, run: Function } }} props
 *   corner: where the button sits on sm+ screens (the panel opens away from it); className positions the button.
 *   onCite: open a cited project (the city); without it chips are labels. onContact: open the contact form.
 *   actions: what the page does with the guide's actions (P4-04, src/lib/guideActions.js).
 */
const GuideLauncher = ({ corner = 'top', className = 'fixed right-4 top-4', hidden = false, onCite, onContact, actions }) => {
    const open = useGuideStore((s) => s.open);
    const { toggle, setOpen } = useGuideStore.getState();
    const button = useRef(null);
    const wasOpen = useRef(open);

    // Closing the panel puts focus back on the button.
    useEffect(() => {
        if (wasOpen.current && !open && !hidden) button.current?.focus({ preventScroll: true });
        wasOpen.current = open;
    }, [open, hidden]);

    if (hidden) return null;
    return (
        <>
            <button
                ref={button}
                type="button"
                onClick={toggle}
                onPointerEnter={loadPanel}
                onFocus={loadPanel}
                aria-expanded={open}
                aria-controls="oj-guide"
                className={`${className} z-40 flex items-center gap-2 border border-mist/25 bg-black/60 px-3 py-1.5 font-mono text-xs text-mist backdrop-blur-[2px] hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-window`}
            >
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-window" />
                {open ? 'Close guide' : 'Ask OJ Guide'}
            </button>
            {open && (
                <Suspense fallback={null}>
                    <GuidePanel corner={corner} onCite={onCite} onContact={onContact} actions={actions} onClose={() => setOpen(false)} />
                </Suspense>
            )}
        </>
    );
};

export default GuideLauncher;
