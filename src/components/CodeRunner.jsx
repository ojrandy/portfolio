// Code runner (P3-09b): the Arcade's mini-game, lazy-loaded from the hub. Rules live in src/lib/codeRunner.js;
// this draws them on a 2D canvas and feeds input. Nothing starts by itself; it pauses when the tab is hidden.
import { useCallback, useEffect, useRef, useState } from 'react';
import { CUP, RUNNER, RUNNER_EGG_SCORE, WORLD, createGame, jump, step } from '../lib/codeRunner.js';
import { COLORS, mixHex } from '../lib/palette.js';
import useArcadeStore from '../store/useArcadeStore.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

const MAX_DPR = 1.5;
const JUMP_KEYS = new Set([' ', 'ArrowUp', 'w', 'W']);
const SKY = [COLORS.basalt, mixHex(COLORS.basalt, COLORS.indigo, 0.55)];
const FAKO = mixHex(COLORS.basalt, COLORS.fakoGreen, 0.45);
const FAKO_SHAPE = [[0, 210], [140, 160], [320, 78], [470, 66], [620, 122], [800, 178], [800, WORLD.ground], [0, WORLD.ground]];
const BLOCKS = Array.from({ length: 14 }, (_, i) => ({ x: i * 58, w: 40 + ((i * 37) % 22), h: 34 + ((i * 53) % 60) }));
const BUTTON_CLASS = 'border border-window/60 bg-basalt px-4 py-2 font-mono text-sm text-window hover:bg-window/10 focus-visible:outline-2 focus-visible:outline-window';

const draw = (ctx, game) => {
    const { width, height, ground } = WORLD;
    const sky = ctx.createLinearGradient(0, 0, 0, ground);
    sky.addColorStop(0, SKY[0]);
    sky.addColorStop(1, SKY[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = FAKO;
    ctx.beginPath();
    FAKO_SHAPE.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.fill();

    // Town blocks scroll at a third of the street's speed.
    const span = BLOCKS.length * 58;
    const shift = (game.distance * 0.33) % span;
    for (const block of BLOCKS) {
        const x = ((block.x - shift + span) % span) - 40;
        ctx.fillStyle = COLORS.ash;
        ctx.fillRect(x, ground - block.h, block.w, block.h);
        ctx.fillStyle = COLORS.window;
        for (let wy = ground - block.h + 8; wy < ground - 10; wy += 14) ctx.fillRect(x + 8, wy, 5, 5);
    }

    ctx.fillStyle = mixHex(COLORS.ash, COLORS.basalt, 0.4);
    ctx.fillRect(0, ground, width, height - ground);
    ctx.fillStyle = COLORS.mist;
    for (let x = -(game.distance % 60); x < width; x += 60) ctx.fillRect(x, ground + 24, 28, 3);

    for (const thing of game.things) {
        const top = ground - thing.lift - thing.h;
        if (thing.kind === 'cup') {
            ctx.fillStyle = COLORS.paper;
            ctx.beginPath();
            ctx.moveTo(thing.x, top);
            ctx.lineTo(thing.x + thing.w, top);
            ctx.lineTo(thing.x + thing.w - 3, top + thing.h);
            ctx.lineTo(thing.x + 3, top + thing.h);
            ctx.fill();
            ctx.fillStyle = COLORS.ember;
            ctx.fillRect(thing.x + 1.5, top + 8, thing.w - 3, 6);
            ctx.strokeStyle = COLORS.mist;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(thing.x + 6, top - 4);
            ctx.lineTo(thing.x + 8, top - 10);
            ctx.moveTo(thing.x + 12, top - 4);
            ctx.lineTo(thing.x + 14, top - 10);
            ctx.stroke();
        } else {
            const cx = thing.x + thing.w / 2;
            ctx.strokeStyle = COLORS.mist;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (const f of [0.25, 0.5, 0.75]) {
                const lx = thing.x + thing.w * f;
                ctx.moveTo(lx, ground - thing.h * 0.4);
                ctx.lineTo(lx - 4, ground);
            }
            ctx.moveTo(cx - 4, top + 2);
            ctx.lineTo(cx - 9, top - 7);
            ctx.moveTo(cx + 4, top + 2);
            ctx.lineTo(cx + 9, top - 7);
            ctx.stroke();
            ctx.fillStyle = COLORS.ember;
            ctx.beginPath();
            ctx.ellipse(cx, ground - thing.h / 2 - 2, thing.w / 2, thing.h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = COLORS.basalt;
            ctx.fillRect(cx - 1, top + 3, 2, thing.h - 6);
        }
    }

    const { y } = game.runner;
    const top = ground - y - RUNNER.height;
    const stride = y > 0 ? 0 : Math.sin(game.distance / 14) * 5;
    ctx.strokeStyle = COLORS.paper;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(RUNNER.x + 10, top + 30);
    ctx.lineTo(RUNNER.x + 10 + stride, ground - y);
    ctx.moveTo(RUNNER.x + 18, top + 30);
    ctx.lineTo(RUNNER.x + 18 - stride, ground - y);
    ctx.stroke();
    ctx.fillStyle = COLORS.window;
    ctx.fillRect(RUNNER.x + 4, top + 12, RUNNER.width - 8, 20);
    ctx.beginPath();
    ctx.arc(RUNNER.x + RUNNER.width / 2, top + 7, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.indigo;
    ctx.fillRect(RUNNER.x + 15, top + 4, 7, 3);
};

const CodeRunner = () => {
    const reducedMotion = useReducedMotion();
    const best = useArcadeStore((s) => s.best);
    const canvas = useRef(null);
    const stage = useRef(null);
    const game = useRef(createGame());
    const bestAtStart = useRef(0);
    const [phase, setPhase] = useState('ready'); // ready | running | paused | over
    const [score, setScore] = useState(0);
    const [message, setMessage] = useState('');

    const paint = useCallback(() => {
        const element = canvas.current;
        const ctx = element?.getContext('2d');
        if (!ctx) return;
        const scale = element.width / WORLD.width;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        draw(ctx, game.current);
    }, []);

    // Canvas follows the dialog's width (8:3), sharp up to DPR 1.5.
    useEffect(() => {
        const element = canvas.current;
        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
            element.width = Math.round(element.clientWidth * dpr);
            element.height = Math.round((element.width * WORLD.height) / WORLD.width);
            paint();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(element);
        return () => observer.disconnect();
    }, [paint]);

    useEffect(() => {
        if (phase !== 'running') return undefined;
        let frame = 0;
        let last = performance.now();
        const { find, recordScore } = useArcadeStore.getState();
        const tick = (now) => {
            const g = step(game.current, (now - last) / 1000);
            last = now;
            // Saved as it rises, so leaving mid-run keeps it.
            if (g.events.length) { setScore(g.score); recordScore(g.score); }
            if (g.score >= RUNNER_EGG_SCORE) find('runner');
            paint();
            if (g.over) {
                const newBest = g.score > bestAtStart.current;
                setMessage(`Game over. Score ${g.score}.${newBest ? ' New best!' : ''}`);
                setPhase('over');
                return;
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        const onHidden = () => document.hidden && setPhase('paused');
        document.addEventListener('visibilitychange', onHidden);
        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener('visibilitychange', onHidden);
        };
    }, [phase, paint]);

    const start = () => {
        if (phase === 'ready' || phase === 'over') {
            game.current = createGame();
            bestAtStart.current = useArcadeStore.getState().best;
            setScore(0);
        }
        setMessage(phase === 'paused' ? 'Resumed.' : 'Game started. Space, up arrow or tap to jump.');
        setPhase('running');
        stage.current?.focus();
    };

    const press = () => {
        if (phase === 'running') jump(game.current);
        else start();
    };

    const onKeyDown = (event) => {
        if (event.target !== stage.current) return; // buttons keep their own Space/Enter
        if (JUMP_KEYS.has(event.key)) {
            event.preventDefault();
            if (!event.repeat) press();
        } else if (event.key === 'p' || event.key === 'P') {
            if (phase === 'running') { setPhase('paused'); setMessage('Paused.'); }
            else if (phase === 'paused') start();
        }
    };

    return (
        <div>
            <div className="mb-2 flex items-center justify-between font-mono text-xs">
                <span className="text-mist/70">Jump the bugs. Coffee is +{CUP.points}.</span>
                <span className="text-window">Score {score} · Best {best}</span>
            </div>
            <div
                ref={stage}
                tabIndex={0}
                role="group"
                aria-roledescription="game"
                aria-label="Code runner. Space, up arrow or W to jump, P to pause."
                onKeyDown={onKeyDown}
                className="relative outline-none focus-visible:ring-2 focus-visible:ring-window"
            >
                <canvas
                    ref={canvas}
                    className="block aspect-[8/3] w-full touch-none select-none bg-basalt"
                    onPointerDown={(event) => { event.preventDefault(); press(); }}
                />
                {phase !== 'running' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-basalt/75 p-4 text-center">
                        {phase === 'ready' && (
                            <>
                                <p className="text-sm">Run through Buea, jump the bugs, grab coffee.</p>
                                <p className="text-xs text-mist/70">Space, ↑ or tap to jump · P to pause</p>
                                {reducedMotion && <p className="text-xs text-mist/70">This game is fast-moving. It only runs while you play.</p>}
                            </>
                        )}
                        {phase === 'paused' && <p className="text-sm">Paused</p>}
                        {phase === 'over' && <p className="text-sm">{message}</p>}
                        <button type="button" onClick={start} className={BUTTON_CLASS}>
                            {{ ready: 'Start', paused: 'Resume', over: 'Play again' }[phase]}
                        </button>
                    </div>
                )}
            </div>
            <p className="sr-only" aria-live="polite">{message}</p>
        </div>
    );
};

export default CodeRunner;
