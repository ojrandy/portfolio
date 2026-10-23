// Market panel (P3B-07): the service on the stall that was clicked, from marketContent (owner content only).
// What's delivered, the buildings that show the work (each flies to its project), "Ask for a quote" (→ the contact
// panel) and the other stalls. No prices: they depend on the job.
import { useState } from 'react';
import Dialog from './Dialog.jsx';

const BUTTON = 'border px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-window';

/**
 * @param {{ market: ReturnType<import('../lib/marketContent.js').marketContent>, selected?: number,
 *   onProject: (slug: string) => void, onQuote: (service: string) => void, onClose: () => void }} props
 */
const MarketPanel = ({ market, selected = 0, onProject, onQuote, onClose }) => {
    const [index, setIndex] = useState(selected);
    const stall = market.stalls[index] ?? market.stalls[0];

    return (
        <Dialog id="market-title" title="Market: services" onClose={onClose} className="max-w-lg">
            <div className="border border-window/60 p-3" aria-live="polite">
                <p className="font-mono text-xs text-window">Stall {stall.index + 1} of {market.stalls.length}</p>
                <h3 className="mt-1 text-base font-semibold">{stall.name}</h3>
                {stall.delivered && <p className="mt-2 text-sm text-mist/85">{stall.delivered}</p>}
                {stall.examples.length > 0 && (
                    <div className="mt-3">
                        <p className="text-xs text-mist/60">See it in the city</p>
                        <ul className="mt-1 flex flex-wrap gap-2">
                            {stall.examples.map((example) => (
                                <li key={example.slug}>
                                    <button type="button" onClick={() => onProject(example.slug)} className={`${BUTTON} border-mist/25 hover:bg-mist/10`}>
                                        {example.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => onQuote(stall.name)} className={`${BUTTON} border-window bg-window font-semibold text-basalt hover:bg-window/85`}>
                        Ask for a quote
                    </button>
                    <span className="text-xs text-mist/60">Prices depend on the job.</span>
                </div>
            </div>
            {market.stalls.length > 1 && (
                <>
                    <p className="mt-4 text-xs text-mist/60">Other stalls</p>
                    <ul className="mt-1 flex flex-wrap gap-2">
                        {market.stalls.map((other) => (
                            <li key={other.index}>
                                <button
                                    type="button"
                                    aria-current={other.index === stall.index ? 'true' : undefined}
                                    onClick={() => setIndex(other.index)}
                                    className={`border px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-window ${other.index === stall.index ? 'border-window/60 text-window' : 'border-mist/20 hover:bg-mist/10'}`}
                                >
                                    {other.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </Dialog>
    );
};

export default MarketPanel;
