// Animals (P3B-04): goats and chickens at the edge of town (src/lib/animals.js), one InstancedMesh per kind written
// every frame. Grazing and pecking run in the figure shader. At night the chickens roost and the goats rest.
// No shadows (static shadow map). P3B-06: click a goat and it looks at you and bleats (an egg); click a hen and it
// scurries off. Hit-tested in cityPicking.js, not on the meshes. Reduced motion: they stand still.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { animalPens, animalPose, createAnimals, pokeAnimal, stepAnimals } from '../lib/animals.js';
import { pickAnimal } from '../lib/cityPicking.js';
import { canHover, isClick } from '../lib/picking.js';
import useCityStore from '../store/useCityStore.js';
import useArcadeStore from '../store/useArcadeStore.js';
import { playBleat, playCluck } from './citySound.js';
import { coat } from '../lib/figures.js';
import { buildFigureGeometry, createFigureMaterial } from './figureGeometry.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

const MAX_STEP = 0.1;
const NIGHT = 0.5; // lamps at least this far on
const KINDS = ['goat', 'chicken'];
const noRaycast = () => null;
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const matrix = new THREE.Matrix4();
const color = new THREE.Color();

/** @param {{ layout: object, roles: number, lighting: object, onHover?: (hovered: boolean) => void }} props */
const Animals = ({ layout, roles, lighting, onHover }) => {
    const reducedMotion = useReducedMotion();
    const camera = useThree((s) => s.camera);
    const hitTarget = useRef(null);
    const state = useMemo(() => createAnimals(animalPens(layout, { roles })), [layout, roles]);
    const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, state.animals.filter((a) => a.kind === k).length])), [state]);
    const material = useMemo(() => createFigureMaterial(), []);
    const geometry = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, buildFigureGeometry(k, Math.max(1, counts[k]))])), [counts]);
    const meshes = useRef({});

    // Coats never change: set them once.
    useLayoutEffect(() => {
        for (const kind of KINDS) {
            const mesh = meshes.current[kind];
            state.animals.filter((a) => a.kind === kind).forEach((a, i) => mesh.setColorAt(i, color.set(coat(kind, a.id))));
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
    }, [state]);
    useEffect(() => () => Object.values(geometry).forEach((g) => g.dispose()), [geometry]);
    useEffect(() => () => material.dispose(), [material]);

    useFrame((_, delta) => {
        if (!reducedMotion) stepAnimals(state, Math.min(delta, MAX_STEP), { night: lighting.lamps >= NIGHT });
        const index = { goat: 0, chicken: 0 };
        for (const a of state.animals) {
            const mesh = meshes.current[a.kind];
            const i = index[a.kind]++;
            const pose = animalPose(a);
            position.set(pose.x, 0, pose.z);
            quaternion.setFromAxisAngle(up, pose.rotationY);
            scale.setScalar(Math.max(pose.scale, 1e-3));
            mesh.setMatrixAt(i, matrix.compose(position, quaternion, scale));
            mesh.geometry.attributes.aGait.setXYZ(i, pose.phase, pose.stride, pose.head);
        }
        for (const kind of KINDS) {
            const mesh = meshes.current[kind];
            mesh.count = index[kind];
            mesh.visible = index[kind] > 0;
            mesh.instanceMatrix.needsUpdate = true;
            mesh.geometry.attributes.aGait.needsUpdate = true;
        }
    });

    const raycast = (raycaster, intersects) => {
        const hit = pickAnimal(state.animals, raycaster.ray);
        if (hit) {
            intersects.push({
                distance: hit.distance, point: raycaster.ray.at(hit.distance, new THREE.Vector3()), object: hitTarget.current,
                instanceId: state.animals.indexOf(hit.item),
            });
        }
    };
    const onClick = (e) => {
        e.stopPropagation();
        const animal = state.animals[e.instanceId];
        if (!animal || !isClick(e.delta)) return;
        const kind = pokeAnimal(animal, { x: camera.position.x, z: camera.position.z });
        const at = () => [animal.x, kind === 'goat' ? 0.75 : 0.5, animal.z];
        useCityStore.getState().say(kind === 'goat' ? 'Mèèè!' : 'Bwok bwok!', at);
        if (kind === 'goat') {
            playBleat();
            useArcadeStore.getState().find('goat');
        } else {
            playCluck();
        }
    };

    return (
        <group>
            <group
                ref={hitTarget}
                raycast={raycast}
                onClick={onClick}
                onPointerOver={(e) => { e.stopPropagation(); if (canHover(e.pointerType)) onHover?.(true); }}
                onPointerOut={() => onHover?.(false)}
            />
            {KINDS.map((kind) => (
                <instancedMesh
                    key={`${kind}-${counts[kind]}`}
                    ref={(mesh) => { meshes.current[kind] = mesh; }}
                    args={[geometry[kind], material, Math.max(1, counts[kind])]}
                    frustumCulled={false}
                    raycast={noRaycast}
                    receiveShadow
                />
            ))}
        </group>
    );
};

export default Animals;
