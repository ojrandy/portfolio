// Renders every building with one InstancedMesh per part (6 draw calls for the whole skyline, plus one per city-kit
// piece). Windows switch on one by one at dusk and off at dawn (P2-03). Footprints in KIT (ART-03) are stacked from
// the Blender kit; the rest, and every building when the kit is off or fails to load, are boxes.
import { Component, useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FACES, FLOOR_HEIGHT, KIT, kitPieces, kitWindowCentres, usesKit } from '../lib/buildings.js';
import { COLORS, mixHex } from '../lib/palette.js';
import { createRandom } from '../lib/random.js';
import { canHover, isClick, slugAt } from '../lib/picking.js';
import useReducedMotion from '../hooks/useReducedMotion.js';
import Part from './InstancedPart.jsx';
import BuildingXRay from './BuildingXRay.jsx';
import { makeSwitchable, withSwitches } from './switchable.js';
import { createKitMaterial, kitGeometries, KIT_URL } from './cityKit.js';

const UNLIT_WINDOW = '#1B1F2A';
const DIM_WINDOW = mixHex(COLORS.window, UNLIT_WINDOW, 0.45);
// By day every window is dark glass with a little of the sky in it; at night unlit windows are UNLIT_WINDOW.
const SKY_IN_GLASS = 0.3;
const ROOF_HEIGHT = 0.12;
const NONE = [];
const NO_SHOPS = new Map();
const NO_FACES = new Set();
const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });

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

// Hovered / focused bodies take on their accent so the building stands out without extra draw calls; kit walls
// warm towards the window colour.
const HIGHLIGHT = 0.4;
const KIT_HIGHLIGHT = 0.4;

/** Bodies in `placed` order (the instance id is the index), highlighted ones tinted. */
const toBodies = (placed, highlighted) => placed.map(({ building: b, x, z }) => ({
    position: [x, 0, z],
    scale: [b.width, b.height, b.depth],
    color: highlighted.includes(b.slug) ? mixHex(b.bodyColor, b.accentColor, HIGHLIGHT) : b.bodyColor,
}));

/** Kit buildings → piece name → instance list, every piece painted with the building's wall paint. */
const toKitPieces = (placed, shops, highlighted) => {
    const out = new Map();
    for (const { building: b, x, z, slug } of placed) {
        const color = highlighted.includes(slug) ? mixHex(b.paintColor, COLORS.window, KIT_HIGHLIGHT) : b.paintColor;
        for (const { piece, y, rotationY } of kitPieces(b, shops.get(slug) ?? NO_FACES)) {
            if (!out.has(piece)) out.set(piece, []);
            out.get(piece).push({ position: [x, y, z], rotationY, color });
        }
    }
    return out;
};

// Where a building's window panes go: box buildings have evenly spaced cells on the wall; kit buildings have the
// pieces' openings, with the pane on the glass (set back on LOD0) and no ground-floor windows (the door floor).
const windowLayout = (b, kit) => {
    if (kit) {
        const height = KIT.lintel - KIT.sillTop;
        return {
            centres: kitWindowCentres(b.width, b.columns),
            half: b.width / 2 + (kit.lod1 ? 0.006 : 0.004 - KIT.inset),
            y: (KIT.sillTop + KIT.lintel) / 2,
            scale: [KIT.windowWidth * 0.96, height * 0.94, 1],
            firstFloor: 1,
            roof: b.height + KIT.roofDeck,
        };
    }
    const cell = b.width / b.columns;
    return {
        centres: Array.from({ length: b.columns }, (_, col) => -b.width / 2 + cell * (col + 0.5)),
        half: b.width / 2 + 0.01,
        y: FLOOR_HEIGHT * 0.55,
        scale: [cell * 0.45, FLOOR_HEIGHT * 0.5, 1],
        firstFloor: 0,
        roof: b.height + ROOF_HEIGHT,
    };
};

/**
 * Building data + grid position → per-part instance lists (bodies and kit pieces are separate). A face with a shop
 * (P3B-08, `shops`: slug → Set of faces) has no ground-floor windows: Shopfronts.jsx draws its shop there.
 * `kit` ({ lod1 }) is set when the kit is drawn; then kit buildings get no box roof.
 */
const toInstances = (placed, shops, kit) => {
    const parts = { roofs: [], windows: [], cranes: [], beacons: [], flags: [] };

    for (const { building: b, x, z, slug } of placed) {
        const shopFaces = shops.get(slug);
        const { width: w, depth: d, height: h, floors, columns } = b;
        const fromKit = Boolean(kit) && usesKit(b);
        const layout = windowLayout(b, fromKit ? kit : null);
        if (!fromKit) parts.roofs.push({ position: [x, h, z], scale: [w * 1.04, ROOF_HEIGHT, d * 1.04], color: b.accentColor });

        // Same index order as litWindows in src/lib/buildings.js: face → floor → column.
        const lit = b.weathered ? DIM_WINDOW : COLORS.window;
        for (let face = 0; face < FACES; face++) {
            const angle = (face * Math.PI) / 2;
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);
            const first = Math.max(layout.firstFloor, shopFaces?.has(face) ? 1 : 0);
            for (let floor = first; floor < floors; floor++) {
                for (let col = 0; col < columns; col++) {
                    const u = layout.centres[col];
                    const index = face * floors * columns + floor * columns + col;
                    parts.windows.push({
                        position: [x + u * cos + layout.half * sin, FLOOR_HEIGHT * floor + layout.y, z - u * sin + layout.half * cos],
                        rotationY: angle,
                        scale: layout.scale,
                        color: b.litWindows[index] ? lit : UNLIT_WINDOW,
                        switchAt: b.windowSwitch[index],
                    });
                }
            }
        }

        const roof = layout.roof;
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

const KitPieces = ({ geometries, pieces }) => {
    const material = useMemo(() => createKitMaterial(), []);
    useEffect(() => () => material.dispose(), [material]);
    return [...pieces].map(([name, items]) => (
        geometries.has(name) && <Part key={name} items={items} geometry={geometries.get(name)} material={material} castShadow receiveShadow />
    ));
};

/**
 * @param {{
 *   placed: { slug: string, building: object, x: number, z: number }[],
 *   lighting: object,  live lighting (liveLighting.js); windows follow lighting.windows
 *   highlighted?: string[],
 *   onHover?: (slug: string | null) => void,
 *   onSelect?: (slug: string) => void,
 *   kit?: null | { lod1: boolean, geometries: Map<string, THREE.BufferGeometry> },
 * }} props
 */
const BuildingsView = ({ placed, lighting, highlighted = NONE, onHover, onSelect, xraySlug = null, xrayLayers = NONE, shops = NO_SHOPS, kit = null }) => {
    const xrayLot = placed.find((lot) => lot.slug === xraySlug) ?? null;
    const showXRay = Boolean(xrayLot && xrayLayers.length > 1);
    const regularPlaced = useMemo(
        () => (showXRay ? placed.filter((lot) => lot.slug !== xraySlug) : placed),
        [placed, showXRay, xraySlug],
    );
    const [boxPlaced, kitPlaced] = useMemo(() => {
        if (!kit) return [regularPlaced, NONE];
        return [regularPlaced.filter((lot) => !usesKit(lot.building)), regularPlaced.filter((lot) => usesKit(lot.building))];
    }, [regularPlaced, kit]);
    const parts = useMemo(() => toInstances(regularPlaced, shops, kit), [regularPlaced, shops, kit]);
    const bodies = useMemo(() => toBodies(boxPlaced, highlighted), [boxPlaced, highlighted]);
    const pieces = useMemo(() => toKitPieces(kitPlaced, shops, highlighted), [kitPlaced, shops, highlighted]);
    // Kit buildings are picked through invisible boxes (no draw calls).
    const pickBoxes = useMemo(() => kitPlaced.map(({ building: b, x, z }) => ({
        position: [x, 0, z], scale: [b.width, b.height + KIT.roofDeck, b.depth],
    })), [kitPlaced]);

    // Only bodies / pick boxes are pickable; the nearest hit wins, so a tall building in front catches the pointer.
    const eventsFor = (list) => ({
        onPointerMove: (e) => {
            e.stopPropagation();
            if (onHover && canHover(e.nativeEvent.pointerType)) onHover(slugAt(list, e.instanceId));
        },
        onPointerOut: () => onHover?.(null),
        onClick: (e) => {
            e.stopPropagation();
            const slug = slugAt(list, e.instanceId);
            if (slug && onSelect && isClick(e.delta)) onSelect(slug);
        },
    });

    return (
        <group>
            <Part items={bodies} geometry={boxGeometry} castShadow receiveShadow {...eventsFor(boxPlaced)}>
                <meshStandardMaterial roughness={0.85} metalness={0.05} />
            </Part>
            {kit && <KitPieces geometries={kit.geometries} pieces={pieces} />}
            <Part items={pickBoxes} geometry={boxGeometry} material={pickMaterial} {...eventsFor(kitPlaced)} />
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

// The kit loads with the 3D chunk; R3F's own Suspense holds the scene until it's ready, so it never pops in.
const KitBuildings = ({ lod1, ...props }) => {
    const { scene } = useGLTF(KIT_URL, false, true);
    const geometries = useMemo(() => kitGeometries(scene, lod1), [scene, lod1]);
    useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
    const kit = useMemo(() => ({ lod1, geometries }), [lod1, geometries]);
    return <BuildingsView {...props} kit={kit} />;
};

// If the kit fails to load (or its pieces are broken), every building is a box (design_system.md "City art").
class KitFallback extends Component {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error) {
        console.warn('City kit unavailable, drawing boxes:', error);
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}

/**
 * Buildings, from the city kit when `kit` is 'lod0' or 'lod1', as boxes when it's null (lowest quality, ART-03).
 * Other props: see BuildingsView.
 */
const Buildings = ({ kit = null, ...props }) => {
    if (!kit) return <BuildingsView {...props} />;
    return (
        <KitFallback fallback={<BuildingsView {...props} />}>
            <KitBuildings lod1={kit === 'lod1'} {...props} />
        </KitFallback>
    );
};

export default Buildings;
