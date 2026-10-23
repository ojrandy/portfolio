// Traffic (P3B-03): steps src/lib/traffic.js every frame and writes the vehicles straight into one InstancedMesh per
// type (no React re-renders), plus two meshes of glow sprites for head and tail lights at night (no real lights).
// Vehicles don't cast shadows (the shadow map is drawn once, see Sun.jsx).
// P3B-06: a click on a vehicle follows it and it honks (hit-tested in cityPicking.js, not on the meshes). Taxi rides
// asked for in the city store (rideTo) are carried out here as quick trips (never longer than RIDE.max s): the nearest
// taxi picks you up, jumps to the drop-off while the camera glides after it and pulls up. Following the police car
// long enough finds an egg.
// P3B-09: the car you drive (Drive.jsx, streets.drive) is one more instance of its type; drivers stop for it.
// P3B-11: so is the police car after you (streets.chase), with its roof lights flashing red and blue while it chases
// (one more glow mesh, drawn only then).
// Reduced motion: the vehicles stay parked where they are, and a ride cuts straight to the place.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { roadGraphFor } from '../lib/roadGraph.js';
import {
    bookTaxi, bueaMinutes, createTraffic, endRide, MAX_VEHICLES, RIDE, stepTraffic, targetCount, vehicleById, vehiclePose,
} from '../lib/traffic.js';
import { pickVehicle } from '../lib/cityPicking.js';
import { canHover, isClick } from '../lib/picking.js';
import { FOLLOW_POLICE_SECONDS } from '../lib/arcadeEggs.js';
import { honkText, pickVariant, SIREN_RED, VEHICLE_IDS, VEHICLE_TYPES } from '../lib/vehicles.js';
import { COLORS } from '../lib/palette.js';
import { createVehicleMaterials, disposeVehicleMaterials, vehicleGeometries, vehicleMaterialFor } from './vehicleGeometry.js';
import useReducedMotion from '../hooks/useReducedMotion.js';
import useCityStore from '../store/useCityStore.js';
import useArcadeStore from '../store/useArcadeStore.js';
import { playHorn } from './citySound.js';

const MAX_STEP = 0.1; // a long frame (tab switch) never moves anyone more than this many seconds
const HEAD = { size: 0.6, out: 0.03 };
const TAIL = { size: 0.36, out: -0.03, braking: 1, cruising: 0.5 };
// The police light bar (vehicles.js: blue on the left, red on the right, 0.45 up); 5 flashes a second, side to side.
// Bright enough to see by day; brighter at night.
const BEACON = { size: 0.55, y: 0.48, x: 0.075, rate: 5, day: 0.6, colors: [new THREE.Color(COLORS.sky), new THREE.Color(SIREN_RED)] };
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

// The police car's roof lights while it chases you: instanceColor = the colour, already times its brightness.
const beaconMaterial = () => new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
            vUv = uv - 0.5;
            vColor = instanceColor;
            vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            centre.xy += position.xy * ${BEACON.size.toFixed(2)};
            centre.z += 0.05;
            gl_Position = projectionMatrix * centre;
        }`,
    fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
            float fall = max(0.0, 1.0 - length(vUv) * 2.0);
            gl_FragColor = vec4(vColor * fall * fall, 1.0);
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

const hitPoint = new THREE.Vector3();
const STEP_OUT = 1.2; // seconds in the taxi at the drop-off before you step out
const bubbleAt = (state, id) => () => {
    const v = vehicleById(state, id);
    if (!v) return null;
    const pose = vehiclePose(v);
    return [pose.x, VEHICLE_TYPES[v.type].height + 0.5, pose.z];
};

const withInstanceColor = (mesh, capacity, fill = 1) => {
    if (mesh && !mesh.instanceColor) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(fill), 3);
};

/**
 * @param {{ layout: object, lighting: object, offsetMs?: number, at?: number | null, share?: number, streets?: object }} props
 *   at = fixed time (dev preview); share = fraction of MAX_VEHICLES for this device (phones 0.5);
 *   streets = { traffic, crossing } shared with Pedestrians: the traffic state goes out, the busy crosswalks come in;
 *   places = cityPlaces() (ride destinations); onHover(bool) = a vehicle is under the mouse
 */
const Traffic = ({ layout, lighting, offsetMs = 0, at = null, share = 1, streets = null, places = [], onHover }) => {
    const reducedMotion = useReducedMotion();
    const getThree = useThree((s) => s.get);
    const hitTarget = useRef(null);
    const geometries = vehicleGeometries();
    const materials = useMemo(() => createVehicleMaterials(), []);
    const level = useMemo(() => ({ value: 0 }), []);
    const glow = useMemo(() => ({ head: glowMaterial(COLORS.paper, level), tail: glowMaterial(COLORS.ember, level) }), [level]);
    const max = Math.max(1, Math.round(MAX_VEHICLES * share));
    const capacity = max + 2; // + the car you drive and the police car after you
    const beacon = useMemo(() => beaconMaterial(), []);
    const meshes = useRef({});
    const heads = useRef(null);
    const tails = useRef(null);
    const beacons = useRef(null);
    const traffic = useRef(null);
    const colors = useRef(new WeakMap());
    const ride = useRef(null); // { id, place, target, since (sim s), started (wall ms), jumped } while a taxi is on a ride
    const police = useRef({ id: null, seconds: 0 });
    const yours = useRef(null); // { type, color } of the car you drive
    const copColor = useRef(null); // the police car after you

    useLayoutEffect(() => {
        for (const mesh of Object.values(meshes.current)) {
            withInstanceColor(mesh, capacity);
            if (mesh) mesh.count = 0;
        }
        withInstanceColor(heads.current, capacity * 2, 0);
        withInstanceColor(tails.current, capacity * 2, 0);
        heads.current.count = 0;
        tails.current.count = 0;
        withInstanceColor(beacons.current, 2, 0);
        beacons.current.visible = false;
    }, [capacity]);

    useEffect(() => () => {
        disposeVehicleMaterials(materials);
        Object.values(glow).forEach((m) => m.dispose());
        beacon.dispose();
    }, [materials, glow, beacon]);
    useEffect(() => () => { if (streets) streets.traffic = null; }, [streets]);

    useFrame(({ clock }, delta) => {
        const minutes = bueaMinutes(at ?? Date.now() + offsetMs);
        let state = traffic.current;
        if (!state || state.layout !== layout || state.max !== max) {
            state = createTraffic(roadGraphFor(layout), { count: targetCount(minutes, max), rain: lighting.rain });
            Object.assign(state, { layout, max });
            traffic.current = state;
        }
        if (streets) streets.traffic = state;
        if (!reducedMotion) {
            stepTraffic(state, Math.min(delta, MAX_STEP), {
                target: targetCount(minutes, max), rain: lighting.rain, crossing: streets?.crossing,
                player: [streets?.drive?.foot, streets?.chase?.foot],
            });
        }
        level.value = lighting.lamps;
        try {
            carryOutRides(state, delta);
        } catch (error) {
            // A ride must never hang: whatever went wrong, end it at the place.
            console.error('Taxi ride failed', error);
            const wanted = useCityStore.getState().ride;
            ride.current = null;
            if (wanted) useCityStore.getState().arrive(wanted.place);
        }

        const counts = Object.fromEntries(VEHICLE_IDS.map((id) => [id, 0]));
        let glows = 0;
        // shell = body scale (0 hides it); shown = how bright its lights are.
        const draw = (type, pose, color, shell, shown, braking) => {
            const mesh = meshes.current[type];
            const i = counts[type]++;
            const cos = Math.cos(pose.rotationY);
            const sin = Math.sin(pose.rotationY);
            position.set(pose.x, 0, pose.z);
            quaternion.setFromAxisAngle(up, pose.rotationY);
            scale.setScalar(Math.max(shell, 1e-3));
            mesh.setMatrixAt(i, matrix.compose(position, quaternion, scale));
            mesh.setColorAt(i, color);

            // Lights: local points turned with the vehicle; a little in front of the lamp so the body doesn't hide them.
            const { head, tail } = LIGHTS[type];
            const put = (target, [lx, ly, lz], out, brightness, size) => {
                const z = lz + out;
                matrix.makeTranslation(pose.x + lx * cos + z * sin, ly * Math.max(shell, shown), pose.z - lx * sin + z * cos);
                target.setMatrixAt(glows, matrix);
                target.instanceColor.setXYZ(glows, brightness * shown, size, 0);
            };
            for (let k = 0; k < Math.max(head.length, tail.length); k++) {
                if (head[k]) put(heads.current, head[k], HEAD.out, 1, HEAD.size);
                else heads.current.instanceColor.setXYZ(glows, 0, 0, 0);
                if (tail[k]) put(tails.current, tail[k], TAIL.out, braking ? TAIL.braking : TAIL.cruising, TAIL.size);
                else tails.current.instanceColor.setXYZ(glows, 0, 0, 0);
                glows++;
            }
        };
        for (const v of state.vehicles) {
            let color = colors.current.get(v);
            if (!color) colors.current.set(v, (color = new THREE.Color(pickVariant(v.type, v.seed))));
            // The taxi you ride in: its toy-scale shell and its own glows (they'd flare across the windscreen) are
            // hidden; TaxiCabin draws the inside around you.
            const riding = v.id === ride.current?.id;
            draw(v.type, vehiclePose(v), color, riding ? 0 : v.scale, riding ? 0 : v.scale, v.braking);
        }
        const mine = streets?.drive;
        if (mine) {
            if (!yours.current || yours.current.type !== mine.type) yours.current = { type: mine.type, color: new THREE.Color(pickVariant(mine.type, 'you')) };
            // From the driver's seat, the same as riding: the cabin is drawn instead.
            draw(mine.type, mine, yours.current.color, mine.seat ? 0 : 1, mine.seat ? 0 : 1, mine.braking);
        }
        const cop = streets?.chase;
        if (cop) {
            copColor.current ??= new THREE.Color(pickVariant('police', 'chase'));
            draw('police', cop, copColor.current, cop.scale, cop.scale, cop.braking);
        }
        // Roof lights: one side then the other.
        const flashing = Boolean(cop?.siren);
        beacons.current.visible = flashing;
        if (flashing) {
            const on = Math.floor(clock.elapsedTime * BEACON.rate) % 2;
            const bright = Math.max(BEACON.day, level.value);
            const cos = Math.cos(cop.rotationY);
            const sin = Math.sin(cop.rotationY);
            [-1, 1].forEach((side, i) => {
                const lx = side * BEACON.x;
                beacons.current.setMatrixAt(i, matrix.makeTranslation(cop.x + lx * cos, BEACON.y * cop.scale, cop.z - lx * sin));
                const c = BEACON.colors[i];
                const b = (i === on ? 1 : 0.08) * bright;
                beacons.current.instanceColor.setXYZ(i, c.r * b, c.g * b, c.b * b);
            });
            beacons.current.count = 2;
            beacons.current.instanceMatrix.needsUpdate = true;
            beacons.current.instanceColor.needsUpdate = true;
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

    // Rides: start the one asked for, notice arrivals, and let the taxi go when the ride ends some other way.
    const carryOutRides = (state, delta) => {
        const store = useCityStore.getState();
        const wanted = store.ride;
        const finish = (place) => {
            ride.current = null;
            store.arrive(place);
            useArcadeStore.getState().find('taxi');
        };
        if (wanted && !wanted.riding) {
            const spot = places.find((p) => p.id === wanted.place);
            let taxi = null;
            if (spot && !reducedMotion) {
                const followed = store.following?.type === 'taxi' ? vehicleById(state, store.following.id) : null;
                taxi = bookTaxi(state, { from: controlsTarget(), point: spot.point, place: spot.id, prefer: followed });
            }
            if (taxi) {
                ride.current = { id: taxi.id, place: wanted.place, started: performance.now() };
                store.rideStarted(taxi);
            } else if (!spot || reducedMotion) {
                finish(wanted.place); // reduced motion (or an unknown place): straight there
            }
            // Otherwise no taxi can go yet: try again next frame (the store's watchdog takes you there after 1.5 s).
        }
        if (ride.current && !ride.current.started) {
            finish(ride.current.place); // a ride left over from older code (hot reload): end it at the place
            return;
        }
        for (const event of state.events.splice(0)) {
            if (event.id === ride.current?.id) ride.current.arrivedAt = state.t;
        }
        // Pulled up: a moment at the stop (the driver may say something), then you step out.
        if (ride.current?.arrivedAt != null && state.t - ride.current.arrivedAt >= STEP_OUT) {
            finish(ride.current.place);
        }
        if (ride.current && useCityStore.getState().ride?.id !== ride.current.id) {
            // Stopped (Esc / Stop): the taxi just drives on.
            endRide(state, ride.current.id);
            ride.current = null;
        } else if (ride.current && performance.now() - ride.current.started > RIDE.max * 1000) {
            endRide(state, ride.current.id);
            finish(ride.current.place);
        }

        const following = useCityStore.getState().following;
        const p = police.current;
        if (following?.type === 'police') {
            p.seconds = p.id === following.id ? p.seconds + Math.min(delta, MAX_STEP) : 0;
            p.id = following.id;
            if (p.seconds >= FOLLOW_POLICE_SECONDS) useArcadeStore.getState().find('police');
        } else {
            p.id = null;
        }
    };

    // Where the camera looks: the nearest taxi to there answers the hail.
    const controlsTarget = () => {
        const controls = getThree().controls;
        const t = controls?.getTarget ? controls.getTarget(hitPoint) : hitPoint.set(0, 0, 0);
        return { x: t.x, z: t.z };
    };

    const raycast = (raycaster, intersects) => {
        const state = traffic.current;
        if (!state) return;
        const hit = pickVehicle(state.vehicles, raycaster.ray);
        if (hit) intersects.push({ distance: hit.distance, point: raycaster.ray.at(hit.distance, new THREE.Vector3()), object: hitTarget.current, instanceId: hit.item.id });
    };
    const onClick = (e) => {
        e.stopPropagation();
        const state = traffic.current;
        const v = state && vehicleById(state, e.instanceId);
        if (!v || !isClick(e.delta)) return;
        const store = useCityStore.getState();
        // On a ride (or driving) you stay in your seat: other vehicles just honk back.
        if (!store.ride?.riding && !store.driving && store.following?.id !== v.id) store.follow(v);
        store.say(honkText(v.type), bubbleAt(state, v.id));
        playHorn(v.type);
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
            {VEHICLE_IDS.map((id) => (
                <instancedMesh
                    key={`${id}-${capacity}`}
                    ref={(mesh) => { meshes.current[id] = mesh; }}
                    args={[geometries[id], vehicleMaterialFor(materials, id), capacity]}
                    frustumCulled={false}
                    raycast={noRaycast}
                    receiveShadow
                />
            ))}
            <instancedMesh key={`head-${capacity}`} ref={heads} args={[spriteGeometry, glow.head, capacity * 2]} frustumCulled={false} raycast={noRaycast} renderOrder={2} />
            <instancedMesh key={`tail-${capacity}`} ref={tails} args={[spriteGeometry, glow.tail, capacity * 2]} frustumCulled={false} raycast={noRaycast} renderOrder={2} />
            <instancedMesh key={`beacon-${capacity}`} ref={beacons} args={[spriteGeometry, beacon, 2]} frustumCulled={false} raycast={noRaycast} renderOrder={2} />
        </group>
    );
};

export default Traffic;
