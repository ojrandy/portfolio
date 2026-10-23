// Inside the taxi you ride in (P3B-06, owner 2026-10-22): hood, dashboard, steering wheel, pillars, doors, roof lining,
// mirror and the driver, built in code in the flat city style and drawn only during a ride (1 draw call). The camera
// sits on the front passenger seat (passenger.js, CameraRig). The taxi's toy-scale shell is hidden meanwhile
// (Traffic.jsx), so this cabin is roomier than the model, with a wide windscreen onto the city. Also the engine hum (Sound on only) and
// the driver's lines from owner content (silent without them). Plain colours, no brands or motifs (ADR-009).
// P3B-09: driving a taxi from the driver's seat draws the same cabin without the driver, and a steering wheel (with
// spokes, so you can see it turn) that turns as you steer: 2 draw calls, only in that view.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS, mixHex } from '../lib/palette.js';
import { TAXI_YELLOW } from '../lib/vehicles.js';
import { vehicleById, vehiclePose } from '../lib/traffic.js';
import { CABIN, DRIVER_SEAT, toWorld } from '../lib/passenger.js';
import { box, mergeParts } from './propGeometry.js';
import { startEngine } from './citySound.js';
import useCityStore from '../store/useCityStore.js';
import useSoundStore from '../store/useSoundStore.js';

const DASH = mixHex(COLORS.basalt, COLORS.ash, 0.4);
const TRIM = mixHex(COLORS.ash, COLORS.mist, 0.2);
const SEAT_COLOR = mixHex(COLORS.basalt, '#4A3A2E', 0.5);
const SKIN = '#6B4430';
const HAIR = '#1E1A18';
const SHIRT = mixHex(COLORS.paper, COLORS.sky, 0.35);
const LINING = mixHex(COLORS.mist, COLORS.paper, 0.4);
const DOOR = mixHex(COLORS.ash, COLORS.basalt, 0.3);
const LINE_MS = 3000;
const STEER_TURN = 1.6; // wheel rotation (rad) at full lock
const noRaycast = () => null;

// Vehicle frame: facing +z, the driver on the left (+x), you on the right (−x). The cabin (passenger.js CABIN): doors at
// x ±0.245, the hood / sill line at 0.26–0.30, the roof lining at 0.5, the windscreen from the dashboard (z 0.19).
const { x: dx, z: dz } = DRIVER_SEAT;
const W = CABIN.halfWidth;
// Steering wheel: a ring in front of the driver, its top leaning towards the windscreen.
const WHEEL = { x: dx, y: 0.33, z: 0.085, r: 0.05, tube: 0.008, lean: 0.35 };
// The wheel you turn yourself (drive mode): lower and nearer the dashboard, below your line of sight.
const DRIVE_WHEEL = { y: 0.29, z: 0.11 };

// The ring (a torus) with the same attributes as the box parts, so it merges with them. In place in front of the
// driver, or (`centred`) round the origin in the xy plane with three spokes, for the wheel you turn yourself.
const wheelGeometry = (centred = false) => {
    const torus = new THREE.TorusGeometry(WHEEL.r, WHEEL.tube, 6, 20);
    let g = torus.toNonIndexed();
    torus.dispose();
    g.deleteAttribute('uv');
    const color = new THREE.Color(DASH);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (centred) {
        const spokes = mergeParts([
            box([2 * WHEEL.r, 0.01, 0.006], [0, 0, 0], DASH),
            box([0.01, WHEEL.r, 0.006], [0, -WHEEL.r / 2, 0], DASH),
            box([0.02, 0.02, 0.012], [0, 0, 0], mixHex(DASH, COLORS.basalt, 0.5)),
        ].map((part) => ({ part, matrix: identity })));
        const both = mergeGeometries([g, spokes]);
        g.dispose();
        spokes.dispose();
        return both;
    }
    g.rotateX(-WHEEL.lean);
    g.translate(WHEEL.x, WHEEL.y, WHEEL.z);
    return g;
};

const buildCabin = (driver) => {
    const parts = mergeParts([...SHELL_PARTS, ...(driver ? DRIVER_PARTS : [])].map((part) => ({ part, matrix: identity })));
    if (!driver) return parts;
    const wheel = wheelGeometry();
    const merged = mergeGeometries([parts, wheel]);
    parts.dispose();
    wheel.dispose();
    return merged;
};

const identity = new THREE.Matrix4();
const SHELL_PARTS = [
    box([0.5, 0.025, 0.32], [0, 0.262, 0.35], TAXI_YELLOW, [0.06, 0, 0]), // the hood ahead
    box([2 * W, 0.06, 0.1], [0, 0.27, 0.15], DASH), // dashboard
    box([2 * W, 0.01, 0.05], [0, 0.302, 0.18], mixHex(DASH, COLORS.basalt, 0.5)), // its top, under the windscreen
    box([0.07, 0.03, 0.004], [dx, 0.285, 0.098], COLORS.window), // the driver's dials
    box([0.012, 0.012, 0.08], [WHEEL.x, 0.31, 0.12], DASH, [-0.6, 0, 0]), // column
    ...[-1, 1].flatMap((side) => [
        box([0.022, 0.24, 0.022], [side * (W - 0.007), 0.4, 0.15], TRIM, [-0.45, 0, 0]), // windscreen pillars
        box([0.022, 0.24, 0.025], [side * (W - 0.005), 0.38, -0.2], TRIM), // door pillars
        box([0.014, 0.2, 0.44], [side * W, 0.2, -0.05], DOOR), // doors
        box([0.02, 0.012, 0.44], [side * (W - 0.005), 0.303, -0.05], TAXI_YELLOW), // window sills
    ]),
    box([2 * W, 0.035, 0.05], [0, 0.49, 0.1], TRIM), // the roof's front edge
    box([2 * W, 0.012, 0.42], [0, 0.505, -0.11], LINING), // roof lining
    box([2 * W, 0.01, 0.48], [0, 0.11, -0.05], DASH), // floor
    box([0.07, 0.022, 0.008], [0, 0.465, 0.12], DASH), // rear-view mirror
    box([0.006, 0.03, 0.006], [0, 0.485, 0.125], DASH),
];
// The driver, seated, hands on the wheel (rides only; driving, that's you).
const DRIVER_PARTS = [
    box([0.14, 0.2, 0.03], [dx, 0.28, dz - 0.08], SEAT_COLOR), // seat back
    box([0.02, 0.02, 0.012], [WHEEL.x, WHEEL.y, WHEEL.z], DASH), // hub
    box([0.12, 0.13, 0.08], [dx, 0.31, dz], SHIRT), // body
    ...[-1, 1].flatMap((side) => [
        box([0.026, 0.026, 0.16], [dx + side * 0.055, 0.345, dz + 0.08], SHIRT, [0.18, 0, 0]), // arms
        box([0.024, 0.024, 0.024], [dx + side * 0.045, 0.335, WHEEL.z - 0.005], SKIN), // hands
    ]),
    box([0.03, 0.02, 0.03], [dx, 0.385, dz], SKIN), // neck
    box([0.065, 0.07, 0.065], [dx, 0.425, dz + 0.002], SKIN), // head
    box([0.068, 0.015, 0.068], [dx, 0.462, dz], HAIR),
];


/**
 * @param {{ streets: { traffic: object | null }, lines: { pickup: string[], arrival: string[] } }} props
 *   streets.traffic = the live traffic (Traffic.jsx); lines = profile.taxiLines (owner content)
 */
const TaxiCabin = ({ streets, lines }) => {
    const rideId = useCityStore((s) => (s.ride?.riding ? s.ride.id : null));
    const driveSeat = useCityStore((s) => s.driving?.vehicle === 'taxi' && s.driving.view === 'seat');
    const geometry = useMemo(() => buildCabin(true), []);
    const shell = useMemo(() => buildCabin(false), []);
    const wheel = useMemo(() => wheelGeometry(true), []);
    const group = useRef(null);
    const steering = useRef(null);
    const engine = useRef(null);
    const said = useRef({ ride: null, arrived: false, count: 0 });
    const soundOn = useSoundStore((s) => s.on);
    const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 }), []);
    useEffect(() => () => material.dispose(), [material]);

    useEffect(() => () => [geometry, shell, wheel].forEach((x) => x.dispose()), [geometry, shell, wheel]);

    // The engine runs while you ride (and Sound is on).
    useEffect(() => {
        if (rideId === null || !soundOn) return undefined;
        engine.current = startEngine();
        return () => {
            engine.current?.stop();
            engine.current = null;
        };
    }, [rideId, soundOn]);

    const say = (list) => {
        if (!list?.length) return;
        const s = said.current;
        const text = list[s.count++ % list.length];
        const id = rideId;
        useCityStore.getState().say(text, () => {
            const v = streets?.traffic && vehicleById(streets.traffic, id);
            // Over the dashboard on the driver's side, where you can see it from your seat.
            return v ? Object.values(toWorld(vehiclePose(v), { x: 0.03, y: 0.43, z: 0.14 })) : null;
        }, LINE_MS);
    };

    useFrame(() => {
        const g = group.current;
        const mine = driveSeat ? streets?.drive : null;
        if (mine) {
            g.visible = true;
            g.position.set(mine.x, 0, mine.z);
            g.rotation.set(0, mine.rotationY, 0);
            steering.current.rotation.z = -mine.steer * STEER_TURN; // left (steer > 0) turns the top of the wheel left
            return;
        }
        const v = rideId !== null && streets?.traffic ? vehicleById(streets.traffic, rideId) : null;
        g.visible = Boolean(v);
        if (!v) return;
        const pose = vehiclePose(v);
        g.position.set(pose.x, 0, pose.z);
        g.rotation.set(0, pose.rotationY, 0);
        engine.current?.set(v.v ?? 0);
        const s = said.current;
        if (s.ride !== rideId) {
            s.ride = rideId;
            s.arrived = false;
            say(lines?.pickup);
        }
        if (!s.arrived && v.ride?.arrivedAt != null) {
            s.arrived = true;
            say(lines?.arrival);
        }
    });

    return (
        <group ref={group} visible={false}>
            <mesh geometry={driveSeat ? shell : geometry} raycast={noRaycast} material={material} />
            <group position={[WHEEL.x, DRIVE_WHEEL.y, DRIVE_WHEEL.z]} rotation={[-WHEEL.lean, 0, 0]} visible={driveSeat}>
                <mesh ref={steering} geometry={wheel} raycast={noRaycast} material={material} />
            </group>
        </group>
    );
};

export default TaxiCabin;
