// Renders every building with one InstancedMesh per part (6 draw calls for the whole skyline).
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FACES, FLOOR_HEIGHT } from '../lib/buildings.js';
import { COLORS, mixHex } from '../lib/palette.js';
import { createRandom } from '../lib/random.js';
import useReducedMotion from '../hooks/useReducedMotion.js';
import Part from './InstancedPart.jsx';

const UNLIT_WINDOW = '#1B1F2A';
const DIM_WINDOW = mixHex(COLORS.window, UNLIT_WINDOW, 0.45);
const ROOF_HEIGHT = 0.12;

const withColor = (geometry, hex) => {
    const c = new THREE.Color(hex);
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) c.toArray(colors, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
};

// Shared geometries (origin at the base, so y = 0 sits on the ground or roof).
const boxGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const windowGeometry = new THREE.PlaneGeometry(1, 1);
const beaconGeometry = new THREE.SphereGeometry(0.2, 12, 8).translate(0, 0.35, 0);
const craneGeometry = mergeGeometries([
    withColor(new THREE.BoxGeometry(0.08, 1.6, 0.08).translate(0, 0.8, 0), COLORS.window), // mast
    withColor(new THREE.BoxGeometry(1.5, 0.07, 0.07).translate(0.35, 1.6, 0), COLORS.window), // jib
    withColor(new THREE.BoxGeometry(0.22, 0.18, 0.18).translate(-0.3, 1.5, 0), COLORS.ash), // counterweight
    withColor(new THREE.BoxGeometry(0.02, 0.6, 0.02).translate(0.95, 1.3, 0), COLORS.mist), // cable
]);
const flagGeometry = mergeGeometries([
    withColor(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6).translate(0, 0.45, 0), COLORS.mist), // pole
    withColor(new THREE.BoxGeometry(0.42, 0.26, 0.015).translate(0.21, 0.75, 0), COLORS.ember), // cloth
]);

/** Building data + grid position → per-part instance lists. */
const toInstances = (placed) => {
    const parts = { bodies: [], roofs: [], windows: [], cranes: [], beacons: [], flags: [] };

    for (const { building: b, x, z } of placed) {
        const { width: w, depth: d, height: h, floors, columns } = b;
        parts.bodies.push({ position: [x, 0, z], scale: [w, h, d], color: b.bodyColor });
        parts.roofs.push({ position: [x, h, z], scale: [w * 1.04, ROOF_HEIGHT, d * 1.04], color: b.accentColor });

        // Same index order as litWindows in src/lib/buildings.js: face → floor → column.
        const half = w / 2 + 0.01;
        const cell = w / columns;
        const lit = b.weathered ? DIM_WINDOW : COLORS.window;
        for (let face = 0; face < FACES; face++) {
            const angle = (face * Math.PI) / 2;
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);
            for (let floor = 0; floor < floors; floor++) {
                for (let col = 0; col < columns; col++) {
                    const u = -w / 2 + cell * (col + 0.5);
                    const index = face * floors * columns + floor * columns + col;
                    parts.windows.push({
                        position: [x + u * cos + half * sin, FLOOR_HEIGHT * (floor + 0.55), z - u * sin + half * cos],
                        rotationY: angle,
                        scale: [cell * 0.45, FLOOR_HEIGHT * 0.5, 1],
                        color: b.litWindows[index] ? lit : UNLIT_WINDOW,
                    });
                }
            }
        }

        const roof = h + ROOF_HEIGHT;
        if (b.crane) {
            const turn = createRandom(`${b.slug}:crane`)() * Math.PI * 2;
            parts.cranes.push({ position: [x + w * 0.22, roof, z - d * 0.22], rotationY: turn });
        }
        if (b.beacon) parts.beacons.push({ position: [x, roof, z] });
        if (b.flag) parts.flags.push({ position: [x - w * 0.32, roof, z + d * 0.32] });
    }
    return parts;
};

const Beacons = ({ items }) => {
    const material = useRef(null);
    const reducedMotion = useReducedMotion();

    useFrame(({ clock }) => {
        if (!material.current) return;
        material.current.emissiveIntensity = reducedMotion ? 2 : 2 + Math.sin(clock.elapsedTime * 2.2) * 1.2;
    });

    return (
        <Part items={items} geometry={beaconGeometry}>
            <meshStandardMaterial ref={material} color={COLORS.ember} emissive={COLORS.ember} emissiveIntensity={2} toneMapped={false} />
        </Part>
    );
};

/** @param {{ placed: { building: object, x: number, z: number }[] }} props */
const Buildings = ({ placed }) => {
    const parts = useMemo(() => toInstances(placed), [placed]);

    return (
        <group>
            <Part items={parts.bodies} geometry={boxGeometry} castShadow receiveShadow>
                <meshStandardMaterial roughness={0.85} metalness={0.05} />
            </Part>
            <Part items={parts.roofs} geometry={boxGeometry}>
                <meshStandardMaterial roughness={0.6} />
            </Part>
            <Part items={parts.windows} geometry={windowGeometry}>
                <meshBasicMaterial toneMapped={false} />
            </Part>
            <Part items={parts.cranes} geometry={craneGeometry}>
                <meshStandardMaterial vertexColors roughness={0.7} />
            </Part>
            <Part items={parts.flags} geometry={flagGeometry}>
                <meshStandardMaterial vertexColors roughness={0.8} side={THREE.DoubleSide} />
            </Part>
            <Beacons items={parts.beacons} />
        </group>
    );
};

export default Buildings;
