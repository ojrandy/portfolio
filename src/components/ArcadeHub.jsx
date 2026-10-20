// Arcade hub (P3-09): every egg, found or not, with a hint for the ones still hidden. Progress lives in this
// browser only (useArcadeStore); "Start over" clears it.
import Dialog from './Dialog.jsx';
import { EGGS } from '../lib/arcadeEggs.js';
import useArcadeStore from '../store/useArcadeStore.js';

/** @param {{ gaming?: string }} props  gaming: the owner's gaming hobby line from content, shown as written */
const ArcadeHub = ({ gaming }) => {
    const found = useArcadeStore((s) => s.found);
    const { closeHub, reset } = useArcadeStore.getState();

    return (
        <Dialog id="arcade-title" title="Arcade: easter eggs" onClose={closeHub} className="max-w-lg">
            {gaming && <p className="mb-4 text-sm text-mist/80">Ojong on gaming: “{gaming}”</p>}
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
            <p className="mt-4 text-xs text-mist/50">Progress is saved in this browser only.</p>
            {found.length > 0 && (
                <button
                    type="button"
                    onClick={reset}
                    className="mt-2 border border-mist/25 px-3 py-1.5 text-xs hover:bg-mist/10 focus-visible:outline-2 focus-visible:outline-window"
                >
                    Start over
                </button>
            )}
        </Dialog>
    );
};

export default ArcadeHub;
