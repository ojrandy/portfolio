// Traffic lights (P3B-06): a pole on every arm of every crossing (roadGraph.js signalPoles) showing the live lights,
// with a crossing button. A click presses it: the green showing ends (amber, then all red as usual), at most once a
// cycle per crossing (pressSignal). The lights run on the traffic's clock. 2 draw calls; poles cast no shadows.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pressSignal, roadGraphFor, signalPoles, signalState } from '../lib/roadGraph.js';
import { pickPole } from '../lib/cityPicking.js';
import { canHover, isClick } from '../lib/picking.js';
import { COLORS, mixHex } from '../lib/palette.js';
import { TAXI_YELLOW } from '../lib/vehicles.js';
import useCityStore from '../store/useCityStore.js';
import { playButton } from './citySound.js';

const POLE_HEIGHT = 1.45;
const HEAD = { y: 1.5, width: 0.16, height: 0.44, depth: 0.12 };
const LAMP = { size: 0.085, step: 0.14, out: HEAD.depth / 2 + 0.01 };
const ORDER = ['red', 'amber', 'green']; // top to bottom
const SIGNAL_COLORS = { red: '#E8402A', amber: '#F2A31B', green: '#3CC46A' };
const OFF = 0.18; // an unlit lamp: this much of its colour on basalt
const SAY = {
    changing: 'Beep! The lights change now.',
    busy: 'Beep. They are already changing.',
    wait: 'Pressed already. Patience!',
};

const coloured = (geometry, hex) => {
    const g = geometry.toNonIndexed();
    const c = new THREE.Color(hex);
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => [c.r, c.g, c.b]).flat(), 3));
    return g;
};

// One pole: post, lamp head facing +z (the arriving traffic), the crossing button on the pavement side.
const poleGeometry = () => {
    const parts = [
        coloured(new THREE.CylinderGeometry(0.03, 0.04, POLE_HEIGHT, 6).translate(0, POLE_HEIGHT / 2, 0), mixHex(COLORS.ash, COLORS.mist, 0.2)),
        coloured(new THREE.BoxGeometry(HEAD.width, HEAD.height, HEAD.depth).translate(0, HEAD.y, 0), COLORS.basalt),
        coloured(new THREE.BoxGeometry(0.07, 0.1, 0.06).translate(0, 0.55, -0.06), TAXI_YELLOW),
    ];
    const merged = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    return merged;
};

const noRaycast = () => null;
const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const one = new THREE.Vector3(1, 1, 1);
const position = new THREE.Vector3();
const local = new THREE.Vector3();

/** @param {{ layout: object, streets?: object, onHover?: (hovered: boolean) => void }} props */
const TrafficLights = ({ layout, streets = null, onHover }) => {
    const graph = roadGraphFor(layout);
    const poles = useMemo(() => signalPoles(graph), [graph]);
    const nodes = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
    const geometry = useMemo(() => ({ pole: poleGeometry(), lamp: new THREE.BoxGeometry(LAMP.size, LAMP.size, 0.02) }), []);
    const materials = useMemo(() => ({
        pole: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, flatShading: true }),
        lamp: new THREE.MeshBasicMaterial({ toneMapped: false }),
    }), []);
    const colors = useMemo(() => Object.fromEntries(ORDER.map((k) => [k, {
        on: new THREE.Color(SIGNAL_COLORS[k]),
        off: new THREE.Color(mixHex(COLORS.basalt, SIGNAL_COLORS[k], OFF)),
    }])), []);
    const poleMesh = useRef(null);
    const lampMesh = useRef(null);
    const hitTarget = useRef(null);
    const clock = useRef(0);
    const shown = useRef([]); // light per pole last written

    useEffect(() => () => { Object.values(geometry).forEach((g) => g.dispose()); Object.values(materials).forEach((m) => m.dispose()); }, [geometry, materials]);

    useLayoutEffect(() => {
        if (!poles.length) return;
        poles.forEach((p, i) => {
            quaternion.setFromAxisAngle(up, p.rotationY);
            poleMesh.current.setMatrixAt(i, matrix.compose(position.set(p.x, 0, p.z), quaternion, one));
            ORDER.forEach((_, k) => {
                local.set(0, HEAD.y + LAMP.step * (1 - k), LAMP.out).applyQuaternion(quaternion);
                lampMesh.current.setMatrixAt(i * 3 + k, matrix.compose(position.set(p.x + local.x, local.y, p.z + local.z), quaternion, one));
            });
        });
        poleMesh.current.instanceMatrix.needsUpdate = true;
        lampMesh.current.instanceMatrix.needsUpdate = true;
        shown.current = [];
    }, [poles]);

    const now = () => streets?.traffic?.t ?? clock.current;

    useFrame((_, delta) => {
        clock.current += Math.min(delta, 0.1);
        const t = now();
        let changed = false;
        poles.forEach((p, i) => {
            const light = signalState(nodes.get(p.node), t)[p.phase];
            if (shown.current[i] === light) return;
            shown.current[i] = light;
            ORDER.forEach((k, j) => lampMesh.current.setColorAt(i * 3 + j, k === light ? colors[k].on : colors[k].off));
            changed = true;
        });
        if (changed) lampMesh.current.instanceColor.needsUpdate = true;
    });

    const raycast = (raycaster, intersects) => {
        const hit = pickPole(poles, raycaster.ray);
        if (hit) {
            intersects.push({
                distance: hit.distance, point: raycaster.ray.at(hit.distance, new THREE.Vector3()), object: hitTarget.current,
                instanceId: poles.indexOf(hit.item),
            });
        }
    };
    const onClick = (e) => {
        e.stopPropagation();
        const pole = poles[e.instanceId];
        if (!pole || !isClick(e.delta)) return;
        const result = pressSignal(nodes.get(pole.node), now());
        useCityStore.getState().say(SAY[result], () => [pole.x, POLE_HEIGHT + 0.6, pole.z]);
        playButton();
    };

    if (poles.length === 0) return null;
    return (
        <group>
            <group
                ref={hitTarget}
                raycast={raycast}
                onClick={onClick}
                onPointerOver={(e) => { e.stopPropagation(); if (canHover(e.pointerType)) onHover?.(true); }}
                onPointerOut={() => onHover?.(false)}
            />
            <instancedMesh key={`p-${poles.length}`} ref={poleMesh} args={[geometry.pole, materials.pole, poles.length]} raycast={noRaycast} frustumCulled={false} receiveShadow />
            <instancedMesh key={`l-${poles.length}`} ref={lampMesh} args={[geometry.lamp, materials.lamp, poles.length * 3]} raycast={noRaycast} frustumCulled={false} />
        </group>
    );
};

export default TrafficLights;
