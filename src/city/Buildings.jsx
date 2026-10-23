// Renders every building with one InstancedMesh per part (6 draw calls for the whole skyline).
// Windows switch on one by one at dusk and off at dawn (P2-03).
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FACES, FLOOR_HEIGHT } from '../lib/buildings.js';
import { COLORS, mixHex } from '../lib/palette.js';
import { createRandom } from '../lib/random.js';
import { canHover, isClick, slugAt } from '../lib/picking.js';
import useReducedMotion from '../hooks/useReducedMotion.js';
import Part from './InstancedPart.jsx';
import BuildingXRay from './BuildingXRay.jsx';
import { makeSwitchable, withSwitches } from './switchable.js';

const UNLIT_WINDOW = '#1B1F2A';
const DIM_WINDOW = mixHex(COLORS.window, UNLIT_WINDOW, 0.45);
// By day every window is dark glass with a little of the sky in it; at night unlit windows are UNLIT_WINDOW.
const SKY_IN_GLASS = 0.3;
const ROOF_HEIGHT = 0.12;
const NONE = [];
const NO_SHOPS = new Map();

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

// Hovered / focused bodies take on their accent so the building stands out without extra draw calls.
const HIGHLIGHT = 0.4;

/** Bodies in `placed` order (the instance id is the index), highlighted ones tinted. */
const toBodies = (placed, highlighted) => placed.map(({ building: b, x, z }) => ({
    position: [x, 0, z],
    scale: [b.width, b.height, b.depth],
    color: highlighted.includes(b.slug) ? mixHex(b.bodyColor, b.accentColor, HIGHLIGHT) : b.bodyColor,
}));

/**
 * Building data + grid position → per-part instance lists (bodies are separate, see toBodies). A face with a shop
 * (P3B-08, `shops`: slug → Set of faces) has no ground-floor windows: Shopfronts.jsx draws its shop there.
 */
const toInstances = (placed, shops) => {
    const parts = { roofs: [], windows: [], cranes: [], beacons: [], flags: [] };

    for (const { building: b, x, z, slug } of placed) {
        const shopFaces = shops.get(slug);
        const { width: w, depth: d, height: h, floors, columns } = b;
        parts.roofs.push({ position: [x, h, z], scale: [w * 1.04, ROOF_HEIGHT, d * 1.04], color: b.accentColor });

        // Same index order as litWindows in src/lib/buildings.js: face → floor → column.
        const half = w / 2 + 0.01;
        const cell = w / columns;
        const lit = b.weathered ? DIM_WINDOW : COLORS.window;
        for (let face = 0; face < FACES; face++) {
            const angle = (face * Math.PI) / 2;
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);
            for (let floor = shopFaces?.has(face) ? 1 : 0; floor < floors; floor++) {
                for (let col = 0; col < columns; col++) {
                    const u = -w / 2 + cell * (col + 0.5);
                    const index = face * floors * columns + floor * columns + col;
                    parts.windows.push({
                        position: [x + u * cos + half * sin, FLOOR_HEIGHT * (floor + 0.55), z - u * sin + half * cos],
                        rotationY: angle,
                        scale: [cell * 0.45, FLOOR_HEIGHT * 0.5, 1],
                        color: b.litWindows[index] ? lit : UNLIT_WINDOW,
                        switchAt: b.windowSwitch[index],
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

// A window shows its own colour once `lighting.windows` passes its switch-on point, and uDark until then.
const createWindowMaterial = (uniforms) => makeSwitchable(new THREE.MeshBasicMaterial({ toneMapped: false }), {
    key: 'city-windows',
    uniforms,
    declarations: 'uniform vec3 uDark;',
    fragment: 'diffuseColor.rgb = mix(uDark, diffuseColor.rgb, vOn);',
});

const unlitColor = new THREE.Color(UNLIT_WINDOW);

const syncWindows = (uniforms, lighting) => {
    uniforms.uLevel.value = lighting.windows;
    uniforms.uDark.value.copy(unlitColor).lerp(lighting.horizon, SKY_IN_GLASS * (1 - lighting.windows));
};

const Windows = ({ items, lighting }) => {
    const uniforms = useMemo(() => ({ uLevel: { value: 0 }, uDark: { value: unlitColor.clone() } }), []);
    const material = useMemo(() => createWindowMaterial(uniforms), [uniforms]);
    const geometry = useMemo(() => withSwitches(windowGeometry, items.map((w) => w.switchAt)), [items]);

    useEffect(() => () => geometry.dispose(), [geometry]);
    useEffect(() => () => material.dispose(), [material]);

    useFrame(() => syncWindows(uniforms, lighting));

    return <Part items={items} geometry={geometry} material={material} />;
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

/**
 * @param {{
 *   placed: { slug: string, building: object, x: number, z: number }[],
 *   lighting: object,  live lighting (liveLighting.js); windows follow lighting.windows
 *   highlighted?: string[],
 *   onHover?: (slug: string | null) => void,
 *   onSelect?: (slug: string) => void,
 * }} props
 */
const Buildings = ({ placed, lighting, highlighted = NONE, onHover, onSelect, xraySlug = null, xrayLayers = NONE, shops = NO_SHOPS }) => {
    const xrayLot = placed.find((lot) => lot.slug === xraySlug) ?? null;
    const showXRay = Boolean(xrayLot && xrayLayers.length > 1);
    const regularPlaced = useMemo(
        () => (showXRay ? placed.filter((lot) => lot.slug !== xraySlug) : placed),
        [placed, showXRay, xraySlug],
    );
    const parts = useMemo(() => toInstances(regularPlaced, shops), [regularPlaced, shops]);
    const bodies = useMemo(() => toBodies(regularPlaced, highlighted), [regularPlaced, highlighted]);

    // Only the bodies are pickable; the nearest hit wins, so a tall building in front catches the pointer.
    const events = {
        onPointerMove: (e) => {
            e.stopPropagation();
            if (onHover && canHover(e.nativeEvent.pointerType)) onHover(slugAt(regularPlaced, e.instanceId));
        },
        onPointerOut: () => onHover?.(null),
        onClick: (e) => {
            e.stopPropagation();
            const slug = slugAt(regularPlaced, e.instanceId);
            if (slug && onSelect && isClick(e.delta)) onSelect(slug);
        },
    };

    return (
        <group>
            <Part items={bodies} geometry={boxGeometry} castShadow receiveShadow {...events}>
                <meshStandardMaterial roughness={0.85} metalness={0.05} />
            </Part>
            <Part items={parts.roofs} geometry={boxGeometry}>
                <meshStandardMaterial roughness={0.6} />
            </Part>
            <Windows items={parts.windows} lighting={lighting} />
            <Part items={parts.cranes} geometry={craneGeometry}>
                <meshStandardMaterial vertexColors roughness={0.7} />
            </Part>
            <Part items={parts.flags} geometry={flagGeometry}>
                <meshStandardMaterial vertexColors roughness={0.8} side={THREE.DoubleSide} />
            </Part>
            <Beacons items={parts.beacons} />
            {showXRay && <BuildingXRay lot={xrayLot} layers={xrayLayers} />}
        </group>
    );
};

export default Buildings;
