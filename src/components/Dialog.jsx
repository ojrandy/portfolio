// Modal dialog for the city (Cinema player, Arcade hub): Escape, Close or a click outside shuts it, Tab stays
// inside, and focus goes back where it was.
import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';

/** @param {{ id: string, title: string, onClose: () => void, className?: string, children: React.ReactNode }} props */
const Dialog = ({ id, title, onClose, className = 'max-w-5xl', children }) => {
    const dialog = useRef(null);
    const closeButton = useRef(null);

    useEffect(() => {
        const previousFocus = document.activeElement;
        closeButton.current?.focus();
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
            if (event.key !== 'Tab' || !dialog.current) return;
            const focusable = [...dialog.current.querySelectorAll(FOCUSABLE)];
            const first = focusable[0];
            const last = focusable.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
            {/* A div, not <section>: the template forces every section to 100dvw (overflows on phones). */}
            <div
                ref={dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby={id}
                className={`max-h-full w-full overflow-y-auto border border-mist/20 bg-basalt p-4 text-mist sm:p-6 ${className}`}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between gap-4">
                    <h2 id={id} className="text-sm font-semibold">{title}</h2>
                    <button
                        ref={closeButton}
                        type="button"
                        onClick={onClose}
                        className="border border-mist/25 px-3 py-1.5 text-sm hover:bg-mist/10 focus-visible:outline-2 focus-visible:outline-window"
                    >
                        Close
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};

export default Dialog;
