// Arcade district (P3-09): a giant arcade cabinet on the SW plot (4 draw calls), turned towards Career Road.
// The cabinet or its "Easter eggs" button opens the hub (ArcadeHub). The screen shows how many eggs this visitor
// has found; the marquee lights up once the cheat code is found and flashes when it's entered.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, mixHex } from '../lib/palette.js';
import { EGGS } from '../lib/arcadeEggs.js';
import useArcadeStore from '../store/useArcadeStore.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

const PLATFORM_GEOMETRY = new THREE.BoxGeometry(7, 0.4, 7);
const BODY_GEOMETRY = new THREE.BoxGeometry(3.4, 6, 2.4);
const SCREEN_GEOMETRY = new THREE.PlaneGeometry(2.8, 2.1);
const MARQUEE_GEOMETRY = new THREE.BoxGeometry(3.6, 0.9, 0.5);
const FACING = Math.PI / 4; // front (+z) towards the south-east: Career Road and the start view
const MARQUEE = { off: 0.1, on: 1.2, flash: 2.4 };
const BUTTON_CLASS = 'whitespace-nowrap border border-white/50 bg-black/65 px-3 py-1.5 font-mono text-xs text-white hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-window';

// The screen, redrawn when the count changes: title, eggs found, and "press start" (or "all found").
const screenTexture = (found) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const g = canvas.getContext('2d');
    g.fillStyle = mixHex(COLORS.basalt, COLORS.indigo, 0.35);
    g.fillRect(0, 0, 512, 384);
    g.textAlign = 'center';
    g.fillStyle = COLORS.window;
    g.font = '700 56px ui-monospace, monospace';
    g.fillText('OJ ARCADE', 256, 120);
    g.fillStyle = COLORS.paper;
    g.font = '32px ui-monospace, monospace';
    g.fillText(`EGGS ${found} / ${EGGS.length}`, 256, 210);
    g.fillStyle = COLORS.ember;
    g.font = '24px ui-monospace, monospace';
    g.fillText(found === EGGS.length ? 'ALL FOUND!' : 'PRESS START', 256, 300);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
};

/** @param {{ plot: object, onHover: (on: boolean) => void }} props */
const ArcadePlot = ({ plot, onHover }) => {
    const reducedMotion = useReducedMotion();
    const foundCount = useArcadeStore((s) => s.found.length);
    const openHub = useArcadeStore((s) => s.openHub);
    const texture = useMemo(() => screenTexture(foundCount), [foundCount]);
    useEffect(() => () => texture.dispose(), [texture]);
    const marquee = useRef(null);

    useFrame(({ clock }) => {
        const { found, marqueeFlashUntil } = useArcadeStore.getState();
        const base = found.includes('konami') ? MARQUEE.on : MARQUEE.off;
        const flashing = performance.now() < marqueeFlashUntil;
        // Reduced motion: a steady bright marquee instead of the flashing.
        const flash = reducedMotion ? 1 : 0.5 + 0.5 * Math.sin(clock.elapsedTime * 14);
        marquee.current.emissiveIntensity = flashing ? MARQUEE.on + (MARQUEE.flash - MARQUEE.on) * flash : base;
    });

    const open = (event) => {
        event.stopPropagation();
        openHub();
    };
    const hover = (on) => (event) => {
        event.stopPropagation();
        onHover(on);
    };

    return (
        <group position={[plot.x, 0, plot.z]} rotation-y={FACING}>
            <mesh geometry={PLATFORM_GEOMETRY} position-y={0.2} receiveShadow>
                <meshStandardMaterial color={mixHex(COLORS.basalt, COLORS.ember, 0.2)} roughness={0.85} />
            </mesh>
            <group onClick={open} onPointerOver={hover(true)} onPointerOut={hover(false)}>
                <mesh geometry={BODY_GEOMETRY} position-y={3.4} castShadow receiveShadow>
                    <meshStandardMaterial color={mixHex(COLORS.basalt, COLORS.indigo, 0.5)} roughness={0.6} />
                </mesh>
                <mesh geometry={SCREEN_GEOMETRY} position={[0, 3.9, 1.21]}>
                    <meshBasicMaterial map={texture} toneMapped={false} />
                </mesh>
                <mesh geometry={MARQUEE_GEOMETRY} position={[0, 6.0, 1.1]} castShadow>
                    <meshStandardMaterial ref={marquee} color={COLORS.ember} emissive={COLORS.ember} emissiveIntensity={MARQUEE.off} roughness={0.5} />
                </mesh>
            </group>
            <Html position={[0, 1.4, 1.3]} center zIndexRange={[8, 0]}>
                <button type="button" onClick={open} className={BUTTON_CLASS}>Easter eggs</button>
            </Html>
        </group>
    );
};

export default ArcadePlot;
