// Project panel for a building (P1-06): status, stack, numbers, case study (P3-01), links.
// Non-modal dialog: right-hand sheet on desktop, bottom sheet on phones. Focus moves in on open and back on close.
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { projectSummary } from '../lib/projectSummary.js';
import useReducedMotion from '../hooks/useReducedMotion.js';
import ProjectCaseStudy, { ProjectMedia } from './ProjectCaseStudy.jsx';

const ProjectPanel = ({ project, onClose }) => {
    const panel = useRef(null);
    const heading = useRef(null);
    const reducedMotion = useReducedMotion();
    const s = projectSummary(project);
    const titleId = `project-panel-${s.slug}`;

    useGSAP(() => {
        if (reducedMotion) return;
        // opacity, not autoAlpha: visibility:hidden would stop the heading taking focus during the fade.
        gsap.fromTo(panel.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    }, { dependencies: [s.slug], scope: panel });

    // Move focus in; give it back to whatever opened the panel (the city or a list button) when it closes.
    useEffect(() => {
        const opener = document.activeElement;
        heading.current?.focus({ preventScroll: true });
        return () => {
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
        };
    }, [s.slug]);

    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
        }
    };

    return (
        <aside
            ref={panel}
            role="dialog"
            aria-labelledby={titleId}
            onKeyDown={onKeyDown}
            className="fixed inset-x-0 bottom-0 z-30 max-h-[60vh] overflow-y-auto rounded-t-2xl border-t border-mist/15 bg-basalt/95 p-5 text-mist md:inset-x-auto md:bottom-4 md:right-4 md:top-4 md:max-h-none md:w-[22rem] md:rounded-2xl md:border"
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-mono text-xs uppercase tracking-wider text-mist/60">
                        {s.district}{s.featured && ' · Featured'}
                    </p>
                    <h2 id={titleId} ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">{s.name}</h2>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close project panel"
                    className="rounded-md px-2 py-1 text-lg leading-none text-mist/70 hover:bg-mist/10 hover:text-mist focus-visible:outline-2 focus-visible:outline-window"
                >
                    ×
                </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {s.status && <span className="rounded-full bg-mist/10 px-2.5 py-1">{s.status}</span>}
                {s.demo && <span className="rounded-full bg-ember/20 px-2.5 py-1 text-ember">Demo content</span>}
                {s.fromGitHub && <span className="rounded-full bg-indigo/40 px-2.5 py-1">From GitHub</span>}
            </div>

            {s.description && (
                <p className="mt-3 text-sm text-mist/85">
                    {s.description}
                    {s.fromGitHub && <span className="text-mist/50"> · repo description</span>}
                </p>
            )}

            {s.stack.length > 0 && (
                <div className="mt-4">
                    <h3 className="text-xs uppercase tracking-wider text-mist/60">Stack</h3>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5 text-sm">
                        {s.stack.map((item) => <li key={item} className="rounded bg-ash px-2 py-0.5">{item}</li>)}
                    </ul>
                </div>
            )}

            {s.stats.items.length > 0 && (
                <div className="mt-4">
                    <h3 className="text-xs uppercase tracking-wider text-mist/60">Numbers <span className="normal-case tracking-normal">· from {s.stats.source}</span></h3>
                    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                        {s.stats.items.map((item) => (
                            <div key={item.label} className="contents">
                                <dt className="text-mist/60">{item.label}</dt>
                                <dd className="font-mono">{item.value}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            )}

            <ProjectCaseStudy caseStudy={s.caseStudy} titleId={`${titleId}-case-study`} />

            {s.links.length > 0 && (
                <div className="mt-4 flex gap-2">
                    {s.links.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md bg-mist/10 px-3 py-1.5 text-sm hover:bg-mist/20 focus-visible:outline-2 focus-visible:outline-window"
                        >
                            {link.label} <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span>
                        </a>
                    ))}
                </div>
            )}

            <ProjectMedia media={s.media} projectName={s.name} />
        </aside>
    );
};

export default ProjectPanel;
