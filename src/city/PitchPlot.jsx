// Pitch district (P3-11): a penalty on the SE plot (5 draw calls: grass, goal frame, net, ball, keeper).
// Click or tap the ball where you want to strike it (pitchKick.js has the rules). A goal opens contact; the "Kick"
// button always scores and "Contact" skips the game. Reduced motion: the kick resolves at once, the keeper stands still.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS, mixHex } from '../lib/palette.js';
import { isClick } from '../lib/picking.js';
import { BALL, GOAL, PITCH, createPitch, kick, scoringOffset, settled, simulate, step } from '../lib/pitchKick.js';
import useReducedMotion from '../hooks/useReducedMotion.js';
import useArcadeStore from '../store/useArcadeStore.js';

const OFFSET_X = -0.3; // keeps the net inside the plot
const PX = 80; // grass texture pixels per unit
const HIT_RADIUS = BALL.radius * 2.2; // easier to tap than the ball itself
const AIM_RADIUS = BALL.radius * 1.5; // a click this far from the centre (on screen) is a full-edge strike
const RESET_MS = 2500;
const GOAL_TO_CONTACT_MS = 1200;
const KEEPER_X = GOAL.line - 0.4;
const BUTTON_CLASS = 'whitespace-nowrap border border-white/50 bg-black/65 px-3 py-1.5 font-mono text-xs text-white hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-window';
const MESSAGES = {
    goal: 'GOAL!',
    save: 'Saved! Strike the ball off-centre to aim for a corner.',
    post: 'Off the post!',
    wide: 'Wide. Try again.',
};

const canvasTexture = (width, height, paint) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
};

// Canvas x → pitch x, canvas y → pitch z (the plane is laid flat, top edge towards −z).
const grassTexture = () => canvasTexture(PITCH.length * PX, PITCH.width * PX, (g) => {
    const u = (x) => (x + PITCH.length / 2) * PX;
    const v = (z) => (z + PITCH.width / 2) * PX;
    const stripe = PITCH.length / 10;
    for (let i = 0; i < 10; i++) {
        g.fillStyle = mixHex(COLORS.fakoGreen, COLORS.basalt, i % 2 ? 0.1 : 0.22);
        g.fillRect(i * stripe * PX, 0, stripe * PX + 1, PITCH.width * PX);
    }
    g.strokeStyle = mixHex(COLORS.mist, COLORS.fakoGreen, 0.15);
    g.fillStyle = g.strokeStyle;
    g.lineWidth = 0.1 * PX;
    const line = (x0, z0, x1, z1) => g.strokeRect(u(x0), v(z0), u(x1) - u(x0), v(z1) - v(z0));
    line(-PITCH.length / 2 + 0.2, -PITCH.width / 2 + 0.2, GOAL.line, PITCH.width / 2 - 0.2); // touch lines
    line(GOAL.line - 7.5, -4.4, GOAL.line, 4.4); // penalty area
    line(GOAL.line - 2, -3.6, GOAL.line, 3.6); // goal area
    g.beginPath();
    g.arc(u(0), v(0), 0.15 * PX, 0, Math.PI * 2); // penalty spot
    g.fill();
});

const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

const FRAME_GEOMETRY = (() => {
    const p = GOAL.post;
    const side = GOAL.halfWidth + p;
    const back = GOAL.line + GOAL.depth;
    const h = GOAL.height;
    return mergeGeometries([
        box(2 * p, h + p, 2 * p, GOAL.line, (h + p) / 2, -side),
        box(2 * p, h + p, 2 * p, GOAL.line, (h + p) / 2, side),
        box(2 * p, 2 * p, 2 * side + 2 * p, GOAL.line, h + p, 0), // crossbar
        box(p, p, 2 * side, back, p / 2, 0), // ground bar at the back
        box(GOAL.depth, p, p, GOAL.line + GOAL.depth / 2, p / 2, -side),
        box(GOAL.depth, p, p, GOAL.line + GOAL.depth / 2, p / 2, side),
    ]);
})();

const NET_GEOMETRY = (() => {
    const w = 2 * GOAL.halfWidth;
    const h = GOAL.height;
    const d = GOAL.depth;
    const back = new THREE.PlaneGeometry(w, h).rotateY(-Math.PI / 2).translate(GOAL.line + d, h / 2, 0);
    const top = new THREE.PlaneGeometry(d, w).rotateX(-Math.PI / 2).translate(GOAL.line + d / 2, h, 0);
    const left = new THREE.PlaneGeometry(d, h).translate(GOAL.line + d / 2, h / 2, -GOAL.halfWidth);
    const right = new THREE.PlaneGeometry(d, h).translate(GOAL.line + d / 2, h / 2, GOAL.halfWidth);
    return mergeGeometries([back, top, left, right]);
})();

const netTexture = () => {
    const texture = canvasTexture(256, 256, (g) => {
        g.strokeStyle = COLORS.paper;
        g.lineWidth = 3;
        for (let i = 0; i <= 256; i += 32) {
            g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
            g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
        }
    });
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 2);
    return texture;
};

// A faceted ball: dark patches round the 12 icosahedron corners, paper elsewhere (vertex colours, one draw call).
const BALL_GEOMETRY = (() => {
    const geometry = new THREE.IcosahedronGeometry(BALL.radius, 3);
    const corners = [];
    const base = new THREE.IcosahedronGeometry(1, 0).getAttribute('position');
    for (let i = 0; i < base.count; i++) {
        const c = new THREE.Vector3().fromBufferAttribute(base, i).normalize();
        if (!corners.some((k) => k.distanceTo(c) < 1e-3)) corners.push(c);
    }
    const position = geometry.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    const dark = new THREE.Color(COLORS.ash);
    const light = new THREE.Color(COLORS.paper);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 3) {
        a.fromBufferAttribute(position, i);
        b.fromBufferAttribute(position, i + 1);
        c.fromBufferAttribute(position, i + 2);
        const centre = a.add(b).add(c).normalize();
        const color = corners.some((k) => k.dot(centre) > 0.95) ? dark : light;
        for (let j = 0; j < 3; j++) color.toArray(colors, (i + j) * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
})();

const tinted = (geometry, hex) => {
    const color = new THREE.Color(hex);
    const count = geometry.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
};

// A simple keeper, arms out along the goal line (no club colours: the kit is the city's window colour).
const KEEPER_GEOMETRY = (() => {
    const kit = COLORS.window;
    const gloves = COLORS.paper;
    return mergeGeometries([
        tinted(new THREE.CapsuleGeometry(0.3, 0.8, 4, 8).translate(0, 1, 0), kit),
        tinted(new THREE.SphereGeometry(0.24, 10, 8).translate(0, 1.98, 0), mixHex(COLORS.mist, COLORS.ash, 0.4)),
        tinted(box(0.16, 0.16, 1.5, 0, 1.45, 0), kit),
        tinted(box(0.2, 0.22, 0.2, 0, 1.45, -0.82), gloves),
        tinted(box(0.2, 0.22, 0.2, 0, 1.45, 0.82), gloves),
    ].map((g) => g.toNonIndexed()));
})();

const HIT_GEOMETRY = new THREE.SphereGeometry(HIT_RADIUS, 12, 8);
const GRASS_GEOMETRY = new THREE.PlaneGeometry(PITCH.length, PITCH.width).rotateX(-Math.PI / 2);

const toPixels = (v, camera, size) => {
    v.project(camera);
    return new THREE.Vector2((v.x + 1) * size.width / 2, (1 - v.y) * size.height / 2);
};

/** Strike offset (−1..1) along the ball's z axis, from where the click landed on screen. */
const strikeOffset = (event, centre, size) => {
    const { camera, pointer } = event;
    const p0 = toPixels(centre.clone(), camera, size);
    const pz = toPixels(centre.clone().add(new THREE.Vector3(0, 0, AIM_RADIUS)), camera, size);
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(AIM_RADIUS);
    const radius = toPixels(centre.clone().add(right), camera, size).distanceTo(p0);
    const axis = pz.sub(p0);
    const click = new THREE.Vector2((pointer.x + 1) * size.width / 2, (1 - pointer.y) * size.height / 2).sub(p0);
    // Looking straight down the z axis, the screen can't show it: use the hit point instead.
    if (axis.length() < radius * 0.2 || radius < 1e-6) return (event.point.z - centre.z) / AIM_RADIUS;
    return click.dot(axis.normalize()) / radius;
};

/** @param {{ plot: object, onGoal: () => void, onContact: () => void, onHover: (on: boolean) => void }} props */
const PitchPlot = ({ plot, onGoal, onContact, onHover }) => {
    const reducedMotion = useReducedMotion();
    const size = useThree((s) => s.size);
    const grass = useMemo(() => grassTexture(), []);
    const net = useMemo(() => netTexture(), []);
    useEffect(() => () => { grass.dispose(); net.dispose(); }, [grass, net]);
    const game = useRef(createPitch());
    const doneAt = useRef(0);
    const ball = useRef(null);
    const keeper = useRef(null);
    const goalTimer = useRef(0);
    const [message, setMessage] = useState('');
    useEffect(() => () => window.clearTimeout(goalTimer.current), []);

    const resolved = (result) => {
        doneAt.current = performance.now();
        setMessage(MESSAGES[result]);
        if (result !== 'goal') return;
        useArcadeStore.getState().find('goal');
        window.clearTimeout(goalTimer.current);
        goalTimer.current = window.setTimeout(onGoal, GOAL_TO_CONTACT_MS);
    };

    const strike = (offset) => {
        const state = game.current;
        if (!kick(state, offset)) return;
        setMessage('');
        if (!reducedMotion) return;
        resolved(simulate(state));
        for (let i = 0; i < 600 && !settled(state); i++) step(state, 1 / 60);
    };

    const axis = useMemo(() => new THREE.Vector3(), []);
    useFrame((_, delta) => {
        const state = game.current;
        if (!(reducedMotion && state.phase === 'ready')) {
            const result = step(state, delta);
            if (result) resolved(result);
        }
        // Back to the spot a moment after the result (a goal rests in the net until then).
        if (state.phase === 'done' && performance.now() - doneAt.current > RESET_MS) {
            game.current = createPitch(state.time);
            ball.current.quaternion.identity();
            setMessage('');
        }
        const { ball: b, keeper: k } = game.current;
        ball.current.position.set(b.x, b.y, b.z);
        const speed = Math.hypot(b.vx, b.vz);
        if (speed > 0 && !reducedMotion) {
            axis.set(b.vz, 0, -b.vx).normalize();
            ball.current.rotateOnWorldAxis(axis, (speed * Math.min(delta, 0.05)) / BALL.radius);
        }
        keeper.current.position.z = k.z;
    });

    const click = (event) => {
        event.stopPropagation();
        if (!isClick(event.delta)) return;
        const centre = new THREE.Vector3(plot.x + OFFSET_X + game.current.ball.x, game.current.ball.y, plot.z + game.current.ball.z);
        strike(strikeOffset(event, centre, size));
    };
    const hover = (on) => (event) => {
        event.stopPropagation();
        onHover(on);
    };

    return (
        <group position={[plot.x + OFFSET_X, 0, plot.z]}>
            <mesh geometry={GRASS_GEOMETRY} position-y={0.03} receiveShadow>
                <meshStandardMaterial map={grass} roughness={0.95} />
            </mesh>
            <mesh geometry={FRAME_GEOMETRY} castShadow>
                <meshStandardMaterial color={COLORS.paper} roughness={0.5} />
            </mesh>
            <mesh geometry={NET_GEOMETRY}>
                <meshStandardMaterial map={net} transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} roughness={0.9} />
            </mesh>
            <mesh ref={keeper} geometry={KEEPER_GEOMETRY} position-x={KEEPER_X} castShadow>
                <meshStandardMaterial vertexColors roughness={0.8} />
            </mesh>
            <mesh ref={ball} name="pitch-ball" geometry={BALL_GEOMETRY} castShadow>
                <meshStandardMaterial vertexColors flatShading roughness={0.6} />
                {/* Invisible, larger tap target (not drawn, still picked). */}
                <mesh geometry={HIT_GEOMETRY} visible={false} onClick={click} onPointerOver={hover(true)} onPointerOut={hover(false)} />
            </mesh>
            <Html position={[0, 0.5, PITCH.width / 2 + 0.8]} center zIndexRange={[8, 0]}>
                <div className="flex flex-col items-center gap-1">
                    <p aria-live="polite" className={message ? 'whitespace-nowrap bg-black/65 px-2 py-1 font-mono text-xs text-window' : 'sr-only'}>{message}</p>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => strike(scoringOffset(game.current))} className={BUTTON_CLASS}>Kick</button>
                        <button type="button" onClick={onContact} className={BUTTON_CLASS}>Contact</button>
                    </div>
                </div>
            </Html>
        </group>
    );
};

export default PitchPlot;
