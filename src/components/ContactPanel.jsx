// Contact panel (P3-11): opened by a goal on the Pitch or its "Contact" button. Email and profile links from
// contactLinks (owner content only); the server-side form joins it in P5-03.
import { useState } from 'react';
import Dialog from './Dialog.jsx';

const LINK_CLASS = 'text-window underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-window';

/** @param {{ contact: ReturnType<import('../lib/contactLinks.js').contactLinks>, scored?: boolean, onClose: () => void }} props */
const ContactPanel = ({ contact, scored = false, onClose }) => {
    const [copied, setCopied] = useState(null);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(contact.email);
            setCopied('Copied');
        } catch {
            setCopied('Copy failed, select the address instead');
        }
    };

    return (
        <Dialog id="contact-title" title={scored ? 'Goal! Kick off a project' : 'Kick off a project'} onClose={onClose} className="max-w-md">
            <p className="mb-4 text-sm text-mist/80">Write to Ojong about a project, a role or a question.</p>
            {contact.email && (
                <div className="mb-4 border border-mist/15 p-3">
                    <p className="font-mono text-xs text-mist/60">Email</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                        <a href={`mailto:${contact.email}`} className={`text-sm break-all ${LINK_CLASS}`}>{contact.email}</a>
                        <button
                            type="button"
                            onClick={copy}
                            className="border border-mist/25 px-2 py-1 text-xs hover:bg-mist/10 focus-visible:outline-2 focus-visible:outline-window"
                        >
                            Copy
                        </button>
                        <span aria-live="polite" className="text-xs text-mist/60">{copied}</span>
                    </div>
                </div>
            )}
            {contact.links.length > 0 && (
                <ul className="flex flex-wrap gap-4 text-sm">
                    {contact.links.map((link) => (
                        <li key={link.label}>
                            <a href={link.href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                                {link.label} <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span>
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </Dialog>
    );
};

export default ContactPanel;
