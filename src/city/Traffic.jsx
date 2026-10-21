// Traffic (P3B-03): steps src/lib/traffic.js every frame and writes the vehicles straight into one InstancedMesh per
// type (no React re-renders), plus two meshes of glow sprites for head and tail lights at night (no real lights).
// Vehicles don't cast shadows (the shadow map is drawn once, see Sun.jsx) and ignore the pointer.
// Reduced motion: the vehicles stay parked where they are.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildRoadGraph } from '../lib/roadGraph.js';
import { bueaMinutes, createTraffic, MAX_VEHICLES, stepTraffic, targetCount, vehiclePose } from '../lib/traffic.js';
import { pickVariant, VEHICLE_IDS, VEHICLE_TYPES } from '../lib/vehicles.js';
import { COLORS } from '../lib/palette.js';
import { createVehicleMaterials, disposeVehicleMaterials, vehicleGeometries, vehicleMaterialFor } from './vehicleGeometry.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

const MAX_STEP = 0.1; // a long frame (tab switch) never moves anyone more than this many seconds
const HEAD = { size: 0.6, out: 0.03 };
const TAIL = { size: 0.36, out: -0.03, braking: 1, cruising: 0.5 };
const noRaycast = () => null;

const spriteGeometry = new THREE.PlaneGeometry(1, 1);

// Additive camera-facing sprite: instanceColor.r = brightness, .g = size; `uLevel` = how dark it is (lighting.lamps).
const glowMaterial = (color, level) => new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uLevel: level },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vGlow;
        void main() {
            vUv = uv - 0.5;
            vGlow = instanceColor.r;
            vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            centre.xy += position.xy * instanceColor.g;
            centre.z += 0.05;
            gl_Position = projectionMatrix * centre;
        }`,
    fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uLevel;
        varying vec2 vUv;
        varying float vGlow;
        void main() {
            float fall = max(0.0, 1.0 - length(vUv) * 2.0);
            gl_FragColor = vec4(uColor * fall * fall * vGlow * uLevel, 1.0);
        }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
});

const LIGHTS = Object.fromEntries(VEHICLE_IDS.map((id) => [id, VEHICLE_TYPES[id].lights]));
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const matrix = new THREE.Matrix4();

const withInstanceColor = (mesh, capacity, fill = 1) => {
    if (mesh && !mesh.instanceColor) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(fill), 3);
};

/**
 * @param {{ layout: object, lighting: object, offsetMs?: number, at?: number | null, share?: number }} props
 *   at = fixed time (dev preview); share = fraction of MAX_VEHICLES for this device (phones 0.5)
 */
const Traffic = ({ layout, lighting, offsetMs = 0, at = null, share = 1 }) => {
    const reducedMotion = useReducedMotion();
    const geometries = vehicleGeometries();
    const materials = useMemo(() => createVehicleMaterials(), []);
    const level = useMemo(() => ({ value: 0 }), []);
    const glow = useMemo(() => ({ head: glowMaterial(COLORS.paper, level), tail: glowMaterial(COLORS.ember, level) }), [level]);
    const max = Math.max(1, Math.round(MAX_VEHICLES * share));
    const meshes = useRef({});
    const heads = useRef(null);
    const tails = useRef(null);
    const traffic = useRef(null);
    const colors = useRef(new WeakMap());

    useLayoutEffect(() => {
        for (const mesh of Object.values(meshes.current)) {
            withInstanceColor(mesh, max);
            if (mesh) mesh.count = 0;
        }
        withInstanceColor(heads.current, max * 2, 0);
        withInstanceColor(tails.current, max * 2, 0);
        heads.current.count = 0;
        tails.current.count = 0;
    }, [max]);

    useEffect(() => () => {
        disposeVehicleMaterials(materials);
        Object.values(glow).forEach((m) => m.dispose());
    }, [materials, glow]);

    useFrame((_, delta) => {
        const minutes = bueaMinutes(at ?? Date.now() + offsetMs);
        let state = traffic.current;
        if (!state || state.layout !== layout || state.max !== max) {
            state = createTraffic(buildRoadGraph(layout), { count: targetCount(minutes, max), rain: lighting.rain });
            Object.assign(state, { layout, max });
            traffic.current = state;
        }
        if (!reducedMotion) stepTraffic(state, Math.min(delta, MAX_STEP), { target: targetCount(minutes, max), rain: lighting.rain });
        level.value = lighting.lamps;

        const counts = Object.fromEntries(VEHICLE_IDS.map((id) => [id, 0]));
        let glows = 0;
        for (const v of state.vehicles) {
            const mesh = meshes.current[v.type];
            const i = counts[v.type]++;
            const pose = vehiclePose(v);
            const cos = Math.cos(pose.rotationY);
            const sin = Math.sin(pose.rotationY);
            position.set(pose.x, 0, pose.z);
            quaternion.setFromAxisAngle(up, pose.rotationY);
            scale.setScalar(Math.max(v.scale, 1e-3));
            mesh.setMatrixAt(i, matrix.compose(position, quaternion, scale));
            let color = colors.current.get(v);
            if (!color) colors.current.set(v, (color = new THREE.Color(pickVariant(v.type, v.seed))));
            mesh.setColorAt(i, color);

            // Lights: local points turned with the vehicle; a little in front of the lamp so the body doesn't hide them.
            const { head, tail } = LIGHTS[v.type];
            const put = (target, [lx, ly, lz], out, brightness, size) => {
                const z = lz + out;
                matrix.makeTranslation(pose.x + lx * cos + z * sin, ly * v.scale, pose.z - lx * sin + z * cos);
                target.setMatrixAt(glows, matrix);
                target.instanceColor.setXYZ(glows, brightness * v.scale, size, 0);
            };
            for (let k = 0; k < Math.max(head.length, tail.length); k++) {
                if (head[k]) put(heads.current, head[k], HEAD.out, 1, HEAD.size);
                else heads.current.instanceColor.setXYZ(glows, 0, 0, 0);
                if (tail[k]) put(tails.current, tail[k], TAIL.out, v.braking ? TAIL.braking : TAIL.cruising, TAIL.size);
                else tails.current.instanceColor.setXYZ(glows, 0, 0, 0);
                glows++;
            }
        }
        for (const id of VEHICLE_IDS) {
            const mesh = meshes.current[id];
            mesh.count = counts[id];
            mesh.visible = counts[id] > 0;
            mesh.instanceMatrix.needsUpdate = true;
            mesh.instanceColor.needsUpdate = true;
        }
        const lit = level.value > 0.01 && glows > 0;
        for (const target of [heads.current, tails.current]) {
            target.count = glows;
            target.visible = lit;
            target.instanceMatrix.needsUpdate = true;
            target.instanceColor.needsUpdate = true;
        }
    });

    return (
        <group>
            {VEHICLE_IDS.map((id) => (
                <instancedMesh
                    key={`${id}-${max}`}
                    ref={(mesh) => { meshes.current[id] = mesh; }}
                    args={[geometries[id], vehicleMaterialFor(materials, id), max]}
                    frustumCulled={false}
                    raycast={noRaycast}
                    receiveShadow
                />
            ))}
            <instancedMesh key={`head-${max}`} ref={heads} args={[spriteGeometry, glow.head, max * 2]} frustumCulled={false} raycast={noRaycast} renderOrder={2} />
            <instancedMesh key={`tail-${max}`} ref={tails} args={[spriteGeometry, glow.tail, max * 2]} frustumCulled={false} raycast={noRaycast} renderOrder={2} />
        </group>
    );
};

export default Traffic;
