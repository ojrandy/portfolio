// Outskirts (P3B-08): the houses round the town and the direction sign at the T (3 draw calls: houses and the sign's
// posts in one merged mesh, the lit windows, the sign's two faces). Not clickable, no shadows. Windows light up with
// the city's windows; the sign glows a little at night, like the Career Road signs.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { outskirts, SIGN_POST } from '../lib/outskirts.js';
import { COLORS, mixHex } from '../lib/palette.js';
import { box, mergeParts, panel, panelGeometry, roof } from './propGeometry.js';

const CEMENT = mixHex(COLORS.ash, COLORS.mist, 0.4);
const DOOR = '#5E4128';
const GLASS = mixHex(COLORS.basalt, COLORS.sky, 0.2);
const METAL = mixHex(COLORS.ash, COLORS.mist, 0.25);
const SIGN = mixHex(COLORS.fakoGreen, COLORS.basalt, 0.25);
const WINDOW_OFF = new THREE.Color(GLASS);
const WINDOW_ON = new THREE.Color(COLORS.window);
const noRaycast = () => null;

// Canvas 1024 × 840: the sign's front (read by drivers coming down the road out, heading south: Douala is on their
// left) and its back (read from the town side: Limbe on the left). One place per row with its arrow on its own side
// (P3B-10: on one line the two names ran together from a distance).
const TILE = { w: 1024, h: 420 };
const FACES = { front: ['Douala', 'Limbe'], back: ['Limbe', 'Douala'] };
const tileUvs = (name) => {
    const row = name === 'front' ? 0 : 1;
    return [0, 1 - (row + 1) / 2, 1, 1 - (row + 1) / 2, 1, 1 - row / 2, 0, 1 - row / 2];
};

const signTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = TILE.w;
    canvas.height = TILE.h * 2;
    const g = canvas.getContext('2d');
    Object.values(FACES).forEach(([left, right], row) => {
        const y = row * TILE.h;
        g.fillStyle = SIGN;
        g.fillRect(0, y, TILE.w, TILE.h);
        g.strokeStyle = COLORS.paper;
        g.lineWidth = 10;
        g.strokeRect(18, y + 18, TILE.w - 36, TILE.h - 36);
        g.fillStyle = COLORS.paper;
        g.fillRect(40, y + TILE.h / 2 - 3, TILE.w - 80, 6);
        g.font = '700 120px system-ui, sans-serif';
        g.textBaseline = 'middle';
        g.textAlign = 'left';
        g.fillText(`← ${left}`, 64, y + TILE.h * 0.29);
        g.textAlign = 'right';
        g.fillText(`${right} →`, TILE.w - 64, y + TILE.h * 0.71);
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
};

// One house in its local frame (front +z, the ground at y = 0): walls on a cement plinth, a zinc gable roof, a door
// and windows on the front; some have a veranda, some a low yard wall with a gap for the gate.
const houseKit = (h) => {
    const { width: w, depth: d, wall } = h;
    const front = d / 2 + 0.02;
    const solid = [
        box([w + 0.1, 0.08, d + 0.1], [0, 0.04, 0], CEMENT),
        box([w, wall, d], [0, wall / 2, 0], h.wallColor),
        roof([w + 0.3, 0.3 + d * 0.18, d + 0.4], [0, wall, 0], h.roofColor),
        box([0.3, 0.58, 0.04], [w * 0.14, 0.33, front], DOOR),
    ];
    const windows = [[0.38, 0.3, 0.04], [-w * 0.27, wall * 0.6, front]];
    const panes = [windows, ...(w > 2.4 ? [[[0.34, 0.3, 0.04], [w * 0.38, wall * 0.6, front]]] : [])];
    const lights = [];
    for (const [size, at] of panes) (h.lit ? lights : solid).push(box(size, at, h.lit ? COLORS.window : GLASS));
    if (h.veranda) {
        solid.push(
            box([w * 0.9, 0.08, 0.78], [0, 0.04, d / 2 + 0.39], CEMENT),
            ...[-1, 1].map((s) => box([0.07, wall - 0.04, 0.07], [s * w * 0.4, wall / 2, d / 2 + 0.72], METAL)),
            box([w * 0.95, 0.04, 0.86], [0, wall - 0.03, d / 2 + 0.4], h.roofColor, [0.16, 0, 0]),
        );
    }
    if (h.fence) {
        const z = d / 2 + 0.66;
        const x0 = -w / 2 - 0.3;
        solid.push(
            box([-0.35 - x0, 0.3, 0.08], [(x0 - 0.35) / 2, 0.15, z], CEMENT),
            box([-0.35 - x0, 0.3, 0.08], [-(x0 - 0.35) / 2, 0.15, z], CEMENT),
            ...[-1, 1].map((s) => box([0.08, 0.3, 0.74], [s * (w / 2 + 0.3), 0.15, d / 2 + 0.29], CEMENT)),
        );
    }
    return { solid, lights };
};

const signKit = () => {
    const { width: w, height: h, bottom } = SIGN_POST;
    return {
        solid: [
            ...[-1, 1].map((s) => box([0.1, bottom + h, 0.1], [s * w * 0.36, (bottom + h) / 2, -0.08], METAL)),
            box([w + 0.12, h + 0.12, 0.06], [0, bottom + h / 2, 0], mixHex(SIGN, COLORS.basalt, 0.4)),
        ],
        panels: [panel('front', w, h, [0, bottom + h / 2, 0.035]), panel('back', w, h, [0, bottom + h / 2, -0.035], true)],
    };
};

const placeMatrix = ({ x, z, rotationY }) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, 0, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY),
    new THREE.Vector3(1, 1, 1),
);

const buildGeometry = ({ houses, sign }) => {
    const solid = [];
    const lights = [];
    for (const house of houses) {
        const matrix = placeMatrix(house);
        const kit = houseKit(house);
        for (const part of kit.solid) solid.push({ part, matrix });
        for (const part of kit.lights) lights.push({ part, matrix });
    }
    const signMatrix = placeMatrix(sign);
    const kit = signKit();
    for (const part of kit.solid) solid.push({ part, matrix: signMatrix });
    return {
        solid: mergeParts(solid),
        lights: mergeParts(lights),
        panels: panelGeometry(kit.panels.map((p) => ({ panel: p, matrix: signMatrix })), tileUvs),
    };
};

/** @param {{ layout: object, lighting: object }} props  lighting: live lighting; windows follow lighting.windows */
const Outskirts = ({ layout, lighting }) => {
    const geometry = useMemo(() => buildGeometry(outskirts(layout)), [layout]);
    const texture = useMemo(() => signTexture(), []);
    const windowMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: WINDOW_OFF.clone(), toneMapped: false }), []);
    const signMaterial = useRef(null);

    useEffect(() => () => {
        geometry.solid?.dispose();
        geometry.lights?.dispose();
        geometry.panels.dispose();
    }, [geometry]);
    useEffect(() => () => { texture.dispose(); windowMaterial.dispose(); }, [texture, windowMaterial]);

    useFrame(() => {
        windowMaterial.color.lerpColors(WINDOW_OFF, WINDOW_ON, lighting.windows);
        if (signMaterial.current) signMaterial.current.emissiveIntensity = 0.15 + 0.45 * lighting.windows;
    });

    return (
        <group>
            {geometry.solid && (
                <mesh geometry={geometry.solid} raycast={noRaycast}>
                    <meshStandardMaterial vertexColors flatShading roughness={0.85} />
                </mesh>
            )}
            {geometry.lights && <mesh geometry={geometry.lights} material={windowMaterial} raycast={noRaycast} />}
            <mesh geometry={geometry.panels} raycast={noRaycast}>
                <meshStandardMaterial ref={signMaterial} map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={0.15} roughness={0.8} />
            </mesh>
        </group>
    );
};

export default Outskirts;
