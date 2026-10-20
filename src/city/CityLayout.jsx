// Roads, block pavements, parks and district plots from layoutCity() (3 draw calls).
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LAYOUT_COLORS } from '../lib/layout.js';
import Part from './InstancedPart.jsx';

// Flat 1 × 1 tile lying on the ground; instances scale it to [width, 1, depth].
const tileGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const boxGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

const ROAD_Y = 0.01;
const DETAIL_Y = 0.02; // parks and lane markings sit just above roads/pavement

const tile = (r, y, color) => ({ position: [r.x, y, r.z], scale: [r.width, 1, r.depth], color });

const NONE = [];

// `built`: districts whose own scene replaces the placeholder block (P3-08: the Cinema plot).
const toInstances = (layout, built) => ({
    // Roads, pavements and district pads never overlap, so they share one height and one mesh.
    surfaces: [
        ...layout.roads.map((r) => tile(r, ROAD_Y, LAYOUT_COLORS[r.kind])),
        ...layout.pavements.map((p) => tile(p, ROAD_Y, LAYOUT_COLORS.pavement)),
        ...layout.districts.map((d) => tile(d, ROAD_Y, d.color)),
    ],
    details: [
        ...layout.parks.map((p) => tile({ ...p, width: p.size, depth: p.size }, DETAIL_Y, LAYOUT_COLORS.park)),
        ...layout.markings.map((m) => tile(m, DETAIL_Y, LAYOUT_COLORS.marking)),
    ],
    placeholders: layout.districts.filter(({ id }) => !built.includes(id)).map(({ placeholder: p }) => ({
        position: [p.x, 0, p.z], scale: [p.width, p.height, p.depth], color: p.color,
    })),
});

// Wet streets in rain (P2-04): darker and shinier as lighting.wet (0..1) rises. No reflections (too slow on phones).
const DRY_ROUGHNESS = 0.95;
const WET_ROUGHNESS = 0.4;
const WET_DARKEN = 0.35;

const syncWet = (material, lighting) => {
    material.roughness = DRY_ROUGHNESS + (WET_ROUGHNESS - DRY_ROUGHNESS) * lighting.wet;
    material.color.setScalar(1 - WET_DARKEN * lighting.wet);
};

/**
 * @param {{ layout: ReturnType<import('../lib/layout.js').layoutCity>, lighting: object, built?: string[] }} props
 *   lighting: live lighting (liveLighting.js); streets follow lighting.wet. built: district ids drawn elsewhere (memoise it)
 */
const CityLayout = ({ layout, lighting, built = NONE }) => {
    const parts = useMemo(() => toInstances(layout, built), [layout, built]);
    const surfaces = useRef(null);

    useFrame(() => surfaces.current && syncWet(surfaces.current, lighting));

    return (
        <group>
            <Part items={parts.surfaces} geometry={tileGeometry} receiveShadow>
                <meshStandardMaterial ref={surfaces} roughness={DRY_ROUGHNESS} />
            </Part>
            <Part items={parts.details} geometry={tileGeometry} receiveShadow>
                <meshStandardMaterial roughness={1} />
            </Part>
            <Part items={parts.placeholders} geometry={boxGeometry} castShadow receiveShadow>
                <meshStandardMaterial roughness={0.8} />
            </Part>
        </group>
    );
};

export default CityLayout;
