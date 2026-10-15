// Loading screen for the 3D city (P1-07): the real city's skyline rises under Fako as each real step finishes.
// Also used as the Suspense fallback while the 3D code downloads, so it is a single screen from start to finish.
import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { loadingState, skyline, SHOW_DELAY, FADE_OUT, RISE, RISE_SPREAD } from '../lib/loading.js';
import { COLORS, mixHex } from '../lib/palette.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

// Drawing area (SVG units): ground line at GROUND, skyline fits inside MAX_W × MAX_H.
const VIEW = { w: 200, h: 80 };
const GROUND = 70;
const MAX_W = 140;
const MAX_H = 40;
// Broad, flat-topped ridge, like Fako seen from the city.
const FAKO = 'M8 70 L40 50 L66 35 L84 27 L93 24.5 L101 25.5 L108 23.5 L117 26.5 L136 37 L166 53 L194 70 Z';

// Survives the swap from the Suspense fallback to the city's own screen, so the fade-in only plays once.
let appeared = false;
const NO_LOTS = [];

const LoadingScreen = ({ code = false, data = 'loading', frame = false, webgl = true, lots = NO_LOTS, onRetry }) => {
    const root = useRef(null);
    const reducedMotion = useReducedMotion();
    const state = loadingState({ code, data, frame, webgl });
    const [visible, setVisible] = useState(() => appeared || performance.now() >= SHOW_DELAY);
    const [gone, setGone] = useState(false);
    const [riseDone, setRiseDone] = useState(false);

    const city = useMemo(() => skyline(lots), [lots]);
    const scale = city.bars.length ? Math.min(MAX_W / city.width, MAX_H / city.height) : 0;
    const left = (VIEW.w - city.width * scale) / 2;
    // The fade waits for the skyline to finish rising (≤ 0.9 s), so a visitor who saw the screen sees the city arrive.
    const risen = reducedMotion || !city.bars.length || riseDone;

    useEffect(() => {
        if (visible || state.done) return undefined;
        const timer = setTimeout(() => setVisible(true), SHOW_DELAY - performance.now());
        return () => clearTimeout(timer);
    }, [visible, state.done]);

    useGSAP(() => {
        if (!visible || appeared) return;
        appeared = true;
        if (!reducedMotion) gsap.fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.out' });
    }, { dependencies: [visible] });

    useGSAP(() => {
        if (!city.bars.length || reducedMotion) return;
        gsap.from('[data-bar]', {
            scaleY: 0,
            transformOrigin: '50% 100%',
            duration: RISE,
            ease: 'power2.out',
            stagger: (i, el) => Number(el.dataset.bar) * RISE_SPREAD,
            onComplete: () => setRiseDone(true),
        });
    }, { dependencies: [city], scope: root });

    useGSAP(() => {
        if (!visible || !state.done || !risen) return;
        gsap.to(root.current, {
            opacity: 0,
            duration: reducedMotion ? 0 : FADE_OUT,
            ease: 'power2.out',
            onComplete: () => setGone(true),
        });
    }, { dependencies: [visible, state.done, risen] });

    if (gone || !visible) return null;

    return (
        <div
            ref={root}
            className={`fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-basalt px-6 text-mist ${state.done ? 'pointer-events-none' : ''}`}
        >
            <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="w-full max-w-md" aria-hidden="true">
                <path d={FAKO} fill={mixHex(COLORS.basalt, COLORS.indigo, 0.35)} />
                <g transform={`translate(${left} ${GROUND}) scale(${scale} ${-scale})`}>
                    {city.bars.map((bar) => (
                        <g key={bar.slug} data-bar={city.width ? (bar.x / city.width).toFixed(3) : 0}>
                            <rect x={bar.x} y={0} width={bar.width} height={bar.height} fill={bar.fill} />
                            <rect x={bar.x} y={bar.height - 0.25} width={bar.width} height={0.25} fill={bar.accent} />
                        </g>
                    ))}
                </g>
                <line x1={0} y1={GROUND} x2={VIEW.w} y2={GROUND} stroke={COLORS.ash} strokeWidth={0.6} />
            </svg>

            <div className="flex flex-col items-center gap-3 text-center" role="status" aria-live="polite">
                <p className="font-mono text-sm">
                    {state.error || state.done ? state.label : <><span className="sr-only">Step {Math.min(state.completed + 1, state.total)} of {state.total}: </span>{state.label}</>}
                </p>
                {!state.error && (
                    <div className="flex gap-2" aria-hidden="true">
                        {Array.from({ length: state.total }, (_, i) => (
                            <span
                                key={i}
                                className={`size-2 rounded-full ${i < state.completed ? 'bg-window' : i === state.completed ? 'bg-mist/50 motion-safe:animate-pulse' : 'bg-mist/15'}`}
                            />
                        ))}
                    </div>
                )}
                {state.error === 'data' && onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="rounded-md bg-mist/10 px-3 py-1.5 text-sm hover:bg-mist/20 focus-visible:outline-2 focus-visible:outline-window"
                    >
                        Try again
                    </button>
                )}
            </div>
        </div>
    );
};

export default LoadingScreen;
