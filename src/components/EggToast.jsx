// "Easter egg found" notice (P3-09): bottom-centre, above dialogs (the runner egg is found mid-game), gone after a few seconds.
import { useEffect } from 'react';
import { EGGS } from '../lib/arcadeEggs.js';
import useArcadeStore from '../store/useArcadeStore.js';

const SHOW_MS = 5000;

const EggToast = () => {
    const latest = useArcadeStore((s) => s.latest);
    const count = useArcadeStore((s) => s.found.length);
    const dismiss = useArcadeStore((s) => s.dismissToast);
    const egg = EGGS.find((e) => e.id === latest);

    useEffect(() => {
        if (!latest) return undefined;
        const timer = window.setTimeout(dismiss, SHOW_MS);
        return () => window.clearTimeout(timer);
    }, [latest, dismiss]);

    return (
        // Always mounted so the live region exists before a find. No role="status": that marks the loading screen.
        <div aria-live="polite" aria-atomic="true" className="pointer-events-none fixed inset-x-0 bottom-16 z-[60] flex justify-center px-4">
            {egg && (
                <p className="max-w-sm border border-window/40 bg-basalt/90 px-4 py-2 text-center text-sm text-mist">
                    <span className="font-mono text-xs text-window">Easter egg {count}/{EGGS.length}: {egg.name}</span>
                    <br />
                    {egg.found}
                </p>
            )}
        </div>
    );
};

export default EggToast;
