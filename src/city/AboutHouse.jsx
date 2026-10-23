// About house (P3-13): a small house beside Career Road at the entrance, where the owner's story starts, before the
// oldest career sign (3 draw calls). East of the road, facing it and turned a little towards the entrance.
// The front is drawn once: a sign reading "About" and the owner's name, a door and two windows lit with the city.
// The house or its "About" button opens AboutPanel. Content: aboutContent (owner content only).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, mixHex } from '../lib/palette.js';
import { ABOUT_HOUSE, aboutHouseSpot } from '../lib/aboutContent.js';

const SIZE = { width: 4.4, height: 2.8, depth: 3.6, roof: 1.5 };
// Placed by aboutHouseSpot: east of the road (turned walls stay ~1 clear of the lamps), 7 north of the entrance;
// the front (+z) turned to face the road (west), then a little towards the entrance.
const FACING = ABOUT_HOUSE.facing;
const BODY_GEOMETRY = new THREE.BoxGeometry(SIZE.width, SIZE.height, SIZE.depth).translate(0, SIZE.height / 2, 0);
const FRONT_GEOMETRY = new THREE.PlaneGeometry(SIZE.width, SIZE.height).translate(0, SIZE.height / 2, SIZE.depth / 2 + 0.01);
const ROOF_GEOMETRY = (() => {
    const w = SIZE.width / 2 + 0.25;
    const shape = new THREE.Shape([new THREE.Vector2(-w, 0), new THREE.Vector2(w, 0), new THREE.Vector2(0, SIZE.roof)]);
    const depth = SIZE.depth + 0.5;
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, SIZE.height, -depth / 2);
})();
const WALL = mixHex(COLORS.paper, COLORS.window, 0.2);
const SIGN = mixHex(COLORS.indigo, COLORS.basalt, 0.35);
const BUTTON_CLASS = 'whitespace-nowrap border border-white/50 bg-black/65 px-3 py-1.5 font-mono text-xs text-white hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-window';

// Canvas 1024 × 652 ↔ the 4.4 × 2.8 front: sign across the top, door in the middle, a window either side.
const W = 1024;
const H = 652;
const WINDOWS = [{ x: 110, y: 330, w: 170, h: 150 }, { x: 744, y: 330, w: 170, h: 150 }];

const canvasTexture = (paint) => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    paint(canvas.getContext('2d'));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
};

const frontTextures = (name) => ({
    map: canvasTexture((g) => {
        g.fillStyle = WALL;
        g.fillRect(0, 0, W, H);
        g.fillStyle = SIGN;
        g.fillRect(212, 40, 600, 190);
        g.strokeStyle = mixHex(COLORS.mist, SIGN, 0.5);
        g.lineWidth = 6;
        g.strokeRect(224, 52, 576, 166);
        g.textAlign = 'center';
        g.fillStyle = COLORS.paper;
        g.font = '600 80px system-ui, sans-serif';
        g.fillText('About', 512, 140);
        if (name) {
            g.fillStyle = COLORS.window;
            g.font = '38px ui-monospace, monospace';
            g.fillText(name, 512, 196);
        }
        g.fillStyle = mixHex(COLORS.basalt, COLORS.sky, 0.25);
        for (const w of WINDOWS) g.fillRect(w.x, w.y, w.w, w.h);
        g.fillStyle = COLORS.indigo;
        g.fillRect(432, 290, 160, H - 290); // door
        g.fillStyle = COLORS.window;
        g.fillRect(566, 470, 10, 10);
    }),
    emissive: canvasTexture((g) => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, W, H);
        g.fillStyle = COLORS.window;
        for (const w of WINDOWS) g.fillRect(w.x, w.y, w.w, w.h);
    }),
});

/**
 * @param {{ road: object, about: ReturnType<import('../lib/aboutContent.js').aboutContent>, lighting: object,
 *   onOpen: () => void, onHover: (on: boolean) => void }} props
 */
const AboutHouse = ({ road, about, lighting, onOpen, onHover }) => {
    const textures = useMemo(() => frontTextures(about.name), [about.name]);
    useEffect(() => () => { textures.map.dispose(); textures.emissive.dispose(); }, [textures]);
    const front = useRef(null);

    useFrame(() => { front.current.emissiveIntensity = lighting.windows; });

    const open = (event) => {
        event.stopPropagation();
        onOpen();
    };
    const hover = (on) => (event) => {
        event.stopPropagation();
        onHover(on);
    };
    const spot = aboutHouseSpot(road);
    const position = [spot.x, 0, spot.z];

    return (
        <group name="about-house" position={position} rotation-y={FACING}>
            <group onClick={open} onPointerOver={hover(true)} onPointerOut={hover(false)}>
                <mesh geometry={BODY_GEOMETRY} castShadow receiveShadow>
                    <meshStandardMaterial color={WALL} roughness={0.9} />
                </mesh>
                <mesh geometry={FRONT_GEOMETRY} receiveShadow>
                    <meshStandardMaterial ref={front} map={textures.map} emissiveMap={textures.emissive} emissive="#ffffff" emissiveIntensity={0} roughness={0.85} />
                </mesh>
                <mesh geometry={ROOF_GEOMETRY} castShadow>
                    <meshStandardMaterial color={mixHex(COLORS.indigo, COLORS.basalt, 0.4)} roughness={0.8} />
                </mesh>
            </group>
            <Html position={[0, SIZE.height + SIZE.roof + 0.5, 0]} center zIndexRange={[8, 0]}>
                <button type="button" onClick={open} className={BUTTON_CLASS}>About</button>
            </Html>
        </group>
    );
};

export default AboutHouse;
