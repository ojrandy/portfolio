// Street lamps (P2-03): posts, heads and a pool of light on the ground (3 draw calls for every lamp).
// No real lights: ~100 point lights would be far too slow on a phone. Heads and pools switch on one by one as
// `lighting.lamps` rises at dusk (each at its seeded level) and go off the same way at dawn.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { lampSpots } from '../lib/lamps.js';
import { COLORS, mixHex } from '../lib/palette.js';
import { makeSwitchable, withSwitches } from './switchable.js';
import Part from './InstancedPart.jsx';

const POST_HEIGHT = 1.3;
const POOL_SIZE = 3.2;
const POOL_Y = 0.03; // above roads, parks and markings
const POOL_OPACITY = 0.4;

const postGeometry = new THREE.CylinderGeometry(0.035, 0.05, POST_HEIGHT, 6).translate(0, POST_HEIGHT / 2, 0);
const headGeometry = new THREE.BoxGeometry(0.22, 0.1, 0.22).translate(0, POST_HEIGHT + 0.05, 0);
const poolGeometry = new THREE.PlaneGeometry(POOL_SIZE, POOL_SIZE).rotateX(-Math.PI / 2);

const createMaterials = (level) => ({
    post: new THREE.MeshStandardMaterial({ color: mixHex(COLORS.ash, COLORS.mist, 0.2), roughness: 0.7 }),
    head: makeSwitchable(new THREE.MeshBasicMaterial({ color: COLORS.window, toneMapped: false }), {
        key: 'lamp-head',
        uniforms: { uLevel: level, uOff: { value: new THREE.Color(mixHex(COLORS.ash, COLORS.mist, 0.35)) } },
        declarations: 'uniform vec3 uOff;',
        fragment: 'diffuseColor.rgb = mix(uOff, diffuseColor.rgb, vOn);',
    }),
    // Additive and unfogged, so far-away pools don't add the fog colour on top of the ground.
    pool: makeSwitchable(new THREE.MeshBasicMaterial({
        color: COLORS.window, transparent: true, opacity: POOL_OPACITY, depthWrite: false, fog: false,
        blending: THREE.AdditiveBlending, toneMapped: false,
    }), {
        key: 'lamp-pool',
        uniforms: { uLevel: level },
        fragment: 'float fall = max(0.0, 1.0 - length(vLocal) * 2.0);\ndiffuseColor.a *= vOn * fall * fall;',
    }),
});

const syncLamps = (level, lighting) => { level.value = lighting.lamps; };

/** @param {{ layout: object, lighting: object }} props */
const Lamps = ({ layout, lighting }) => {
    const spots = useMemo(() => lampSpots(layout), [layout]);
    const level = useMemo(() => ({ value: 0 }), []);
    const materials = useMemo(() => createMaterials(level), [level]);
    const items = useMemo(() => spots.map(({ x, z }) => ({ position: [x, 0, z] })), [spots]);
    const pools = useMemo(() => spots.map(({ x, z }) => ({ position: [x, POOL_Y, z] })), [spots]);
    const geometries = useMemo(() => {
        const switches = spots.map((s) => s.switchAt);
        return { head: withSwitches(headGeometry, switches), pool: withSwitches(poolGeometry, switches) };
    }, [spots]);

    useEffect(() => () => { geometries.head.dispose(); geometries.pool.dispose(); }, [geometries]);
    useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

    useFrame(() => syncLamps(level, lighting));

    return (
        <group>
            <Part items={items} geometry={postGeometry} material={materials.post} />
            <Part items={items} geometry={geometries.head} material={materials.head} />
            <Part items={pools} geometry={geometries.pool} material={materials.pool} renderOrder={1} />
        </group>
    );
};

export default Lamps;
