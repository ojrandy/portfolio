// Arcade hub (P3-09): every egg, found or not, with a hint for the ones still hidden, and the Code runner
// mini-game (P3-09b, loaded on first play). Progress lives in this browser only; "Start over" clears it.
import { Suspense, lazy, useState } from 'react';
import Dialog from './Dialog.jsx';
import { EGGS } from '../lib/arcadeEggs.js';
import useArcadeStore from '../store/useArcadeStore.js';

const CodeRunner = lazy(() => import('./CodeRunner.jsx'));
const BUTTON_CLASS = 'border border-mist/25 px-3 py-1.5 text-xs hover:bg-mist/10 focus-visible:outline-2 focus-visible:outline-window';

/** @param {{ gaming?: string }} props  gaming: the owner's gaming hobby line from content, shown as written */
const ArcadeHub = ({ gaming }) => {
    const found = useArcadeStore((s) => s.found);
    const best = useArcadeStore((s) => s.best);
    const { closeHub, reset } = useArcadeStore.getState();
    const [playing, setPlaying] = useState(false);

    if (playing) {
        return (
            <Dialog id="arcade-title" title="Arcade: Code runner" onClose={closeHub} className="max-w-3xl">
                <Suspense fallback={<p className="font-mono text-xs text-mist/70">Loading the game…</p>}>
                    <CodeRunner />
                </Suspense>
                <button type="button" onClick={() => setPlaying(false)} className={`mt-4 ${BUTTON_CLASS}`}>
                    Back to the eggs
                </button>
            </Dialog>
        );
    }

    return (
        <Dialog id="arcade-title" title="Arcade: easter eggs" onClose={closeHub} className="max-w-lg">
            {gaming && <p className="mb-4 text-sm text-mist/80">Ojong on gaming: “{gaming}”</p>}
            <div className="mb-4 flex items-center justify-between gap-3 border border-window/30 p-3">
                <div>
                    <p className="text-sm font-semibold">Code runner</p>
                    <p className="text-xs text-mist/70">Jump the bugs through Buea.{best > 0 && ` Your best: ${best}.`}</p>
                </div>
                <button type="button" onClick={() => setPlaying(true)} className="whitespace-nowrap border border-window/60 px-3 py-1.5 font-mono text-xs text-window hover:bg-window/10 focus-visible:outline-2 focus-visible:outline-window">
                    Play
                </button>
            </div>
            <p className="mb-3 font-mono text-xs text-window">Found {found.length} of {EGGS.length}</p>
            <ul className="space-y-2">
                {EGGS.map((egg) => {
                    const isFound = found.includes(egg.id);
                    return (
                        <li key={egg.id} className="border border-mist/15 p-3">
                            <p className="text-sm font-semibold">
                                <span aria-hidden="true" className={isFound ? 'text-window' : 'text-mist/40'}>{isFound ? '★' : '☆'} </span>
                                {egg.name}
                                <span className="sr-only">{isFound ? ' (found)' : ' (not found yet)'}</span>
                            </p>
                            <p className="mt-1 text-sm text-mist/70">{isFound ? egg.found : `Hint: ${egg.hint}`}</p>
                        </li>
                    );
                })}
            </ul>
            <p className="mt-4 text-xs text-mist/50">Progress and your best score are saved in this browser only.</p>
            {(found.length > 0 || best > 0) && (
                <button type="button" onClick={reset} className={`mt-2 ${BUTTON_CLASS}`}>Start over</button>
            )}
        </Dialog>
    );
};

export default ArcadeHub;
