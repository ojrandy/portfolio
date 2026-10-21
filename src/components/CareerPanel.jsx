// Career panel (P3-12): the owner's roles, newest first, from careerRoles (owner content only, no demo entries).
// Opened from a Career Road sign, which is marked and scrolled into view.
import { useEffect, useRef } from 'react';
import Dialog from './Dialog.jsx';

/** @param {{ roles: ReturnType<import('../lib/careerRoad.js').careerRoles>, selected?: number, onClose: () => void }} props */
const CareerPanel = ({ roles, selected = 0, onClose }) => {
    const list = useRef(null);

    useEffect(() => {
        if (selected > 0) list.current?.children[selected]?.scrollIntoView({ block: 'nearest' });
    }, [selected]);

    return (
        <Dialog id="career-title" title="Career Road: experience" onClose={onClose} className="max-w-lg">
            <ol ref={list} className="space-y-2">
                {roles.map((role, i) => (
                    <li
                        key={`${role.company}-${role.dates}`}
                        aria-current={i === selected ? 'true' : undefined}
                        className={`border p-3 ${i === selected ? 'border-window/60' : 'border-mist/15'}`}
                    >
                        {role.dates && <p className="font-mono text-xs text-window">{role.dates}</p>}
                        <p className="mt-1 text-sm font-semibold">{[role.role, role.company].filter(Boolean).join(' · ')}</p>
                        {role.location && <p className="mt-0.5 text-sm text-mist/70">{role.location}</p>}
                        {role.did.length > 0 && (
                            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-mist/85">
                                {role.did.map((line) => <li key={line}>{line}</li>)}
                            </ul>
                        )}
                        {role.proudest && (
                            <p className="mt-2 text-sm text-mist/85">
                                <span className="text-mist/60">Proudest result: </span>{role.proudest}
                            </p>
                        )}
                    </li>
                ))}
            </ol>
        </Dialog>
    );
};

export default CareerPanel;
