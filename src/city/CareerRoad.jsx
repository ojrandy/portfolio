// Career Road (P3-12): a signpost per role along the road into the city, oldest at the entrance (2 draw calls).
// Posts and board bodies are one InstancedMesh; the board fronts are one mesh on a shared canvas atlas (years,
// company, role), lit a little at night. A sign or the "Career" button opens CareerPanel. Content: careerRoles.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import InstancedPart from './InstancedPart.jsx';
import { COLORS, mixHex } from '../lib/palette.js';
import { careerSigns, signParts, SIGN } from '../lib/careerRoad.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const BOARD = mixHex(COLORS.indigo, COLORS.basalt, 0.35);
const POST = mixHex(COLORS.ash, COLORS.mist, 0.2);
const TILE = { width: 600, height: 320 }; // one board front in the atlas (3 × 1.6)
const BUTTON_CLASS = 'whitespace-nowrap border border-white/50 bg-black/65 px-3 py-1.5 font-mono text-xs text-white hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-window';

const fitText = (g, text, x, y, maxWidth, size, weight, family) => {
    let px = size;
    do g.font = `${weight} ${px}px ${family}`; while (g.measureText(text).width > maxWidth && (px -= 2) > 16);
    g.fillText(text, x, y);
};

const atlasTexture = (roles) => {
    const canvas = document.createElement('canvas');
    canvas.width = TILE.width;
    canvas.height = TILE.height * roles.length;
    const g = canvas.getContext('2d');
    g.textAlign = 'center';
    const mid = TILE.width / 2;
    const max = TILE.width - 60;
    roles.forEach((role, i) => {
        const top = i * TILE.height;
        g.fillStyle = BOARD;
        g.fillRect(0, top, TILE.width, TILE.height);
        g.strokeStyle = mixHex(COLORS.mist, BOARD, 0.5);
        g.lineWidth = 6;
        g.strokeRect(10, top + 10, TILE.width - 20, TILE.height - 20);
        g.fillStyle = COLORS.window;
        if (role.years) fitText(g, role.years, mid, top + 92, max, 56, 600, 'ui-monospace, monospace');
        g.fillStyle = COLORS.paper;
        if (role.company) fitText(g, role.company, mid, top + 182, max, 50, 600, 'system-ui, sans-serif');
        g.fillStyle = COLORS.mist;
        if (role.role) fitText(g, role.role, mid, top + 252, max, 36, 400, 'system-ui, sans-serif');
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
};

// All board fronts in one geometry; face 2i and 2i + 1 belong to sign i.
const frontsGeometry = (signs) => {
    const positions = [];
    const uvs = [];
    const normals = [];
    const index = [];
    const z = SIGN.thickness / 2 + 0.005;
    signs.forEach((sign, i) => {
        const cos = Math.cos(sign.rotationY);
        const sin = Math.sin(sign.rotationY);
        const v0 = 1 - (i + 1) / signs.length;
        const v1 = 1 - i / signs.length;
        const corners = [[-1, 0, 0, v0], [1, 0, 1, v0], [1, 1, 1, v1], [-1, 1, 0, v1]];
        for (const [sx, sy, u, v] of corners) {
            const lx = (sx * SIGN.width) / 2;
            positions.push(sign.x + lx * cos + z * sin, SIGN.bottom + sy * SIGN.height, sign.z - lx * sin + z * cos);
            normals.push(sin, 0, cos);
            uvs.push(u, v);
        }
        const k = i * 4;
        index.push(k, k + 1, k + 2, k, k + 2, k + 3);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(index);
    return geometry;
};

/** @param {{ road: object, roles: ReturnType<import('../lib/careerRoad.js').careerRoles>, lighting: object, onOpen: (index: number) => void, onHover: (on: boolean) => void }} props */
const CareerRoad = ({ road, roles, lighting, onOpen, onHover }) => {
    const signs = useMemo(() => careerSigns(roles.length, road), [roles.length, road]);
    const parts = useMemo(
        () => signParts(signs).map((part, i) => ({ ...part, color: i % 3 === 2 ? BOARD : POST })),
        [signs],
    );
    const fronts = useMemo(() => frontsGeometry(signs), [signs]);
    const atlas = useMemo(() => atlasTexture(roles), [roles]);
    useEffect(() => () => fronts.dispose(), [fronts]);
    useEffect(() => () => atlas.dispose(), [atlas]);
    const front = useRef(null);

    // Readable after dark: the fronts glow a little more as the city lights come on.
    useFrame(() => { front.current.emissiveIntensity = 0.15 + 0.45 * lighting.windows; });

    const open = (index) => (event) => {
        event.stopPropagation();
        onOpen(index);
    };
    const hover = (on) => (event) => {
        event.stopPropagation();
        onHover(on);
    };
    const newest = signs[0];

    return (
        <group onPointerOver={hover(true)} onPointerOut={hover(false)}>
            <InstancedPart
                items={parts}
                geometry={BOX}
                castShadow
                receiveShadow
                onClick={(event) => open(Math.floor(event.instanceId / 3))(event)}
            >
                <meshStandardMaterial color="#ffffff" roughness={0.85} />
            </InstancedPart>
            <mesh geometry={fronts} onClick={(event) => open(Math.floor(event.faceIndex / 2))(event)}>
                <meshStandardMaterial ref={front} map={atlas} emissiveMap={atlas} emissive="#ffffff" emissiveIntensity={0.15} roughness={0.8} />
            </mesh>
            {signs.map((sign, i) => (
                <group key={i} name={`career-sign-${i}`} position={[sign.x, SIGN.bottom + SIGN.height / 2, sign.z]} />
            ))}
            {/* Above the newest board: it is in the start view, and the button covers no other sign. */}
            <Html position={[newest.x, SIGN.bottom + SIGN.height + 0.6, newest.z]} center zIndexRange={[8, 0]}>
                <button type="button" onClick={open(0)} className={BUTTON_CLASS}>Career</button>
            </Html>
        </group>
    );
};

export default CareerRoad;
