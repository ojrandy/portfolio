// Pedestrians (P3B-04): steps src/lib/pedestrians.js every frame and writes the people straight into one InstancedMesh
// (no React re-renders), plus one for their umbrellas in the rain. A few more wait at the taxi/bus stops in the day.
// Shares `streets` with Traffic: people ask the live traffic before crossing, and drivers see the busy crosswalks.
// No shadows (static shadow map), no pointer hits. Reduced motion: everyone stands still.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { roadGraphFor } from '../lib/roadGraph.js';
import { bueaMinutes, crosswalkClear } from '../lib/traffic.js';
import {
    buildWalkGraph, createPedestrians, MAX_PEOPLE, peopleDensity, peopleTarget, personPose, stepPedestrians, stopWaiters, UMBRELLA_RAIN,
} from '../lib/pedestrians.js';
import { streetProps } from '../lib/streetProps.js';
import { outfit } from '../lib/figures.js';
import { buildFigureGeometry, createFigureMaterial } from './figureGeometry.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

const MAX_STEP = 0.1;
const STOP_BUSY = 0.3; // people wait at the stops while the pavements are at least this busy
const noRaycast = () => null;
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const matrix = new THREE.Matrix4();

/**
 * @param {{ layout: object, roles: number, lighting: object, offsetMs?: number, at?: number | null, share?: number, streets?: object }} props
 *   share = fraction of MAX_PEOPLE for this device (phones 0.5); streets = { traffic, crossing } shared with Traffic
 */
const Pedestrians = ({ layout, roles, lighting, offsetMs = 0, at = null, share = 1, streets = null }) => {
    const reducedMotion = useReducedMotion();
    const max = Math.max(1, Math.round(MAX_PEOPLE * share));
    const waiters = useMemo(() => stopWaiters(streetProps(layout, { roles }).stops), [layout, roles]);
    const capacity = max + waiters.length;
    const material = useMemo(() => createFigureMaterial(), []);
    const geometry = useMemo(() => ({ person: buildFigureGeometry('person', capacity), umbrella: buildFigureGeometry('umbrella', capacity) }), [capacity]);
    const people = useRef(null);
    const umbrellas = useRef(null);
    const crowd = useRef(null);
    const outfits = useRef(new Map()); // id → colours; cleared now and then, as people come and go

    useLayoutEffect(() => {
        for (const mesh of [people.current, umbrellas.current]) {
            mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
            mesh.count = 0;
        }
    }, [capacity]);
    useEffect(() => () => Object.values(geometry).forEach((g) => g.dispose()), [geometry]);
    useEffect(() => () => material.dispose(), [material]);
    useEffect(() => () => { if (streets) Object.assign(streets, { crossing: new Set(), people: [] }); }, [streets]);

    useFrame((_, delta) => {
        const minutes = bueaMinutes(at ?? Date.now() + offsetMs);
        const rain = lighting.rain ?? 0;
        const target = peopleTarget(minutes, max, rain);
        let state = crowd.current;
        if (!state || state.layout !== layout || state.max !== max) {
            state = createPedestrians(buildWalkGraph(layout, roadGraphFor(layout)), { count: target });
            Object.assign(state, { layout, max });
            crowd.current = state;
        }
        const traffic = streets?.traffic;
        if (!reducedMotion) {
            stepPedestrians(state, Math.min(delta, MAX_STEP), {
                target,
                clock: traffic ? traffic.t : state.t,
                clear: traffic ? (id, look) => crosswalkClear(traffic, id, { look }) : null,
            });
        }
        if (streets) {
            streets.crossing = state.crossing;
            streets.people = state.people; // drive mode: your car stops for them
        }

        const umbrella = rain > UMBRELLA_RAIN;
        const body = people.current;
        const shade = umbrellas.current;
        const lower = body.geometry.attributes.aLower;
        const gait = body.geometry.attributes.aGait;
        if (outfits.current.size > 400) outfits.current.clear();
        let n = 0;
        const put = (id, x, z, rotationY, s, phase, stride) => {
            position.set(x, 0, z);
            quaternion.setFromAxisAngle(up, rotationY);
            scale.setScalar(Math.max(s, 1e-3));
            matrix.compose(position, quaternion, scale);
            body.setMatrixAt(n, matrix);
            shade.setMatrixAt(n, matrix);
            let clothes = outfits.current.get(id);
            if (!clothes) {
                const o = outfit(id);
                clothes = { top: new THREE.Color(o.top), lower: new THREE.Color(o.lower), umbrella: new THREE.Color(o.umbrella) };
                outfits.current.set(id, clothes);
            }
            body.setColorAt(n, clothes.top);
            lower.setXYZ(n, clothes.lower.r, clothes.lower.g, clothes.lower.b);
            gait.setXYZ(n, phase, stride, 0);
            shade.setColorAt(n, clothes.umbrella);
            n++;
        };
        for (const p of state.people) {
            const pose = personPose(p);
            put(p.seed, pose.x, pose.z, pose.rotationY, pose.scale, pose.phase, reducedMotion ? 0 : pose.stride);
        }
        if (peopleDensity(minutes) >= STOP_BUSY) for (const w of waiters) put(w.id, w.x, w.z, w.rotationY, 1, 0, 0);

        body.count = n;
        shade.count = umbrella ? n : 0;
        shade.visible = umbrella && n > 0;
        for (const mesh of [body, shade]) {
            mesh.instanceMatrix.needsUpdate = true;
            mesh.instanceColor.needsUpdate = true;
        }
        lower.needsUpdate = true;
        gait.needsUpdate = true;
    });

    return (
        <group>
            <instancedMesh key={`people-${capacity}`} ref={people} args={[geometry.person, material, capacity]} frustumCulled={false} raycast={noRaycast} receiveShadow />
            <instancedMesh key={`umbrellas-${capacity}`} ref={umbrellas} args={[geometry.umbrella, material, capacity]} frustumCulled={false} raycast={noRaycast} />
        </group>
    );
};

export default Pedestrians;
