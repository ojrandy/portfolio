// Drive mode (P3B-09): steps your car (src/lib/drive.js) every frame from the keys or the touch joystick and shares
// it with the traffic (which draws it and stops for it) and the camera (chase view or the driver's seat).
// Keys (on `keyTarget`, the city's focusable element): WASD / arrows drive, Space brakes, H honks, V switches view
// (taxi), Enter opens the building you are stopped next to; Esc parks (CameraRig). Also the two drive eggs, the
// "Red light!" and "Turn back" bubbles, and the engine hum (Sound on only). Draws nothing itself.
// P3B-11: running a red brings a police car after you (src/lib/chase.js): a police car in the traffic close by, or a
// new one. It goes out as streets.chase (Traffic draws it, the traffic stops for it); the siren plays while it
// chases (Sound on only). Lose it or pull over (two eggs). Not with reduced motion: then a red is only "Red light!".
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { roadGraphFor } from '../lib/roadGraph.js';
import { footprint, takeVehicle, vehiclePose } from '../lib/traffic.js';
import { personPose } from '../lib/pedestrians.js';
import { carFootprint, createCar, createTrip, driveWorld, nearBuilding, stepCar, trackTrip } from '../lib/drive.js';
import { CHASE_RULES, createChase, stepChase } from '../lib/chase.js';
import { honkText, VEHICLE_TYPES } from '../lib/vehicles.js';
import { playHorn, startEngine, startSiren } from './citySound.js';
import useReducedMotion from '../hooks/useReducedMotion.js';
import useCityStore from '../store/useCityStore.js';
import useArcadeStore from '../store/useArcadeStore.js';
import useSoundStore from '../store/useSoundStore.js';

const MAX_STEP = 0.1;
const BUMP_EVERY = 2; // s between honks from the same vehicle you bump into
const EDGE_EVERY = 4;
const SAY_AFTER = 1.2; // s into the chase (after "Red light!") before the officer calls out
// Until the owner writes the officer's lines (docs/projects.md "Police lines (Pidgin)"); owner-approved stand-ins.
const POLICE_SAYS = { chase: 'Pull over!', pullOver: 'Red means stop. Drive safe!' };
const KEYS = {
    ArrowUp: 'forward', KeyW: 'forward',
    ArrowDown: 'back', KeyS: 'back',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'brake',
};

/**
 * @param {{ layout: object, roles?: number, streets: object, keyTarget: object, policeLines?: object }} props
 *   streets: traffic and people come in; `drive` (your car) and `chase` (the police car after you) go out;
 *   `driveInput` ({ throttle, steer, horn }) comes in from the on-screen controls (horn: a one-shot flag, cleared
 *   here); policeLines = profile.policeLines (owner content)
 */
const Drive = ({ layout, roles = 0, streets, keyTarget, policeLines = null }) => {
    const reducedMotion = useReducedMotion();
    const drivingKey = useCityStore((s) => s.driving?.key ?? null);
    const chasing = useCityStore((s) => s.chase?.phase === 'chasing');
    const soundOn = useSoundStore((s) => s.on);
    const world = useMemo(() => driveWorld(layout, { roles, graph: roadGraphFor(layout) }), [layout, roles]);
    const held = useRef(new Set());
    const car = useRef(null); // { key, car, trip, clock, bumped: Map(id → s), edgeAt, chase }
    const engine = useRef(null);
    const siren = useRef(null);
    const said = useRef({ chase: 0, pullOver: 0 }); // the officer's lines, in turn
    const line = (kind) => {
        const lines = policeLines?.[kind] ?? [];
        return lines.length ? lines[said.current[kind]++ % lines.length] : POLICE_SAYS[kind];
    };

    useEffect(() => {
        const el = keyTarget.current;
        if (!el || drivingKey === null) return undefined;
        const keys = held.current;
        const onKeyDown = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const store = useCityStore.getState();
            if (KEYS[e.code]) {
                e.preventDefault();
                keys.add(KEYS[e.code]);
            } else if (e.code === 'KeyH' && !e.repeat) {
                Object.assign(streets, { driveInput: { ...streets.driveInput, horn: true } });
            } else if (e.code === 'KeyV' && store.driving?.vehicle === 'taxi') {
                store.setDriveView(store.driving.view === 'seat' ? 'chase' : 'seat');
            } else if (e.key === 'Enter' && store.driveNear) {
                e.preventDefault();
                keys.clear();
                store.peekProject(store.driveNear);
            }
        };
        const onKeyUp = (e) => keys.delete(KEYS[e.code]);
        const onBlur = () => keys.clear();
        el.addEventListener('keydown', onKeyDown);
        el.addEventListener('keyup', onKeyUp);
        el.addEventListener('blur', onBlur);
        return () => {
            el.removeEventListener('keydown', onKeyDown);
            el.removeEventListener('keyup', onKeyUp);
            el.removeEventListener('blur', onBlur);
            keys.clear();
        };
    }, [keyTarget, drivingKey, streets]);

    useEffect(() => {
        if (drivingKey === null || !soundOn) return undefined;
        engine.current = startEngine();
        return () => {
            engine.current?.stop();
            engine.current = null;
        };
    }, [drivingKey, soundOn]);

    useEffect(() => {
        if (!chasing || !soundOn) return undefined;
        siren.current = startSiren();
        return () => {
            siren.current?.stop();
            siren.current = null;
        };
    }, [chasing, soundOn]);

    useEffect(() => () => {
        Object.assign(streets, { drive: null, chase: null });
        useCityStore.getState().setChase(null);
    }, [streets]);

    useFrame((_, delta) => {
        const store = useCityStore.getState();
        const { driving } = store;
        if (!driving) {
            car.current = null;
            Object.assign(streets, { drive: null, chase: null });
            store.setChase(null);
            return;
        }
        const dt = Math.min(delta, MAX_STEP);
        const others = {
            vehicles: (streets.traffic?.vehicles ?? []).filter((v) => v.scale > 0.3).map((v) => ({ id: v.id, foot: footprint(v) })),
            people: (streets.people ?? []).filter((p) => p.scale > 0.3).map(personPose),
        };
        let d = car.current;
        if (!d || d.key !== driving.key || d.car.type !== driving.vehicle) {
            const made = createCar(world, driving.vehicle, others);
            if (!made) return; // Career Road is jammed: try again next frame
            d = { key: driving.key, car: made, trip: createTrip(), clock: 0, bumped: new Map(), edgeAt: -Infinity };
            car.current = d;
        }
        d.clock += dt;

        const keys = held.current;
        const pad = streets.driveInput ?? { throttle: 0, steer: 0 };
        if (pad.horn) {
            Object.assign(streets, { driveInput: { ...pad, horn: false } });
            playHorn(d.car.type);
            store.say(honkText(d.car.type), carTop(streets));
        }
        const axis = (a, b) => (keys.has(a) ? 1 : 0) - (keys.has(b) ? 1 : 0);
        const input = {
            throttle: Math.max(-1, Math.min(1, axis('forward', 'back') + (pad.throttle ?? 0))),
            steer: Math.max(-1, Math.min(1, axis('left', 'right') + (pad.steer ?? 0))),
            brake: keys.has('brake'),
        };
        // You can't drive through the police car either.
        const cop = d.chase?.car;
        const blocking = cop ? { ...others, vehicles: [...others.vehicles, { id: 'police', foot: carFootprint(cop) }] } : others;
        const hit = stepCar(world, d.car, input, dt, blocking);
        const c = d.car;
        Object.assign(streets, { drive: {
            type: c.type, x: c.x, z: c.z, rotationY: c.rotationY, v: c.v, steer: c.steer, braking: c.braking,
            foot: carFootprint(c), seat: driving.view === 'seat' && c.type === 'taxi',
        } });
        engine.current?.set(Math.abs(c.v));

        // Bumped into someone: they honk at you. The end of the map: turn back.
        if (hit?.vehicle !== undefined && d.clock - (d.bumped.get(hit.vehicle) ?? -Infinity) > BUMP_EVERY) {
            d.bumped.set(hit.vehicle, d.clock);
            const v = streets.traffic?.vehicles.find((o) => o.id === hit.vehicle);
            if (v) {
                playHorn(v.type);
                store.say(honkText(v.type), () => {
                    const o = streets.traffic?.vehicles.find((w) => w.id === v.id);
                    if (!o) return null;
                    const f = footprint(o);
                    return [f.x, VEHICLE_TYPES[o.type].height + 0.5, f.z];
                });
            }
        } else if (hit === 'edge' && d.clock - d.edgeAt > EDGE_EVERY) {
            d.edgeAt = d.clock;
            store.say('End of OJ City. Turn back!', carTop(streets), 2500);
        }

        const progress = trackTrip(world, d.trip, c, streets.traffic?.t ?? d.clock);
        if (window.__cityPerf?.redRun) {
            // /?city&perf browser checks only (PerfProbe): __cityPerf.redRun = true counts as running a red.
            window.__cityPerf.redRun = false;
            progress.ranRed = true;
        }
        if (progress.ranRed) {
            store.say('Red light!', carTop(streets), 2000);
            if (!d.chase && !reducedMotion && streets.traffic) d.chase = startChase(world, streets.traffic, c, others);
        }
        if (progress.tour) useArcadeStore.getState().find('tour');
        if (progress.lights) useArcadeStore.getState().find('lights');
        store.setDriveNear(nearBuilding(world, c));

        if (d.chase) {
            const chase = d.chase;
            const event = stepChase(world, chase, you(c), dt, others);
            if (!chase.said && chase.t >= SAY_AFTER) {
                chase.said = true;
                store.say(line('chase'), copTop(streets), 2500);
            }
            if (event === 'caught') {
                store.say(line('pullOver'), copTop(streets), 3000);
                useArcadeStore.getState().find('pullover');
            } else if (event === 'lost') {
                store.say('You lost them.', carTop(streets), 2500);
                useArcadeStore.getState().find('escape');
            } else if (event === 'gone') {
                d.chase = null;
            }
        }
        const p = d.chase?.car;
        Object.assign(streets, { chase: p ? {
            type: 'police', x: p.x, z: p.z, rotationY: p.rotationY, scale: p.scale, braking: p.braking, foot: carFootprint(p),
            siren: d.chase.phase === 'chasing',
        } : null });
        const distance = p ? Math.hypot(p.x - c.x, p.z - c.z) : 0;
        store.setChase(p && d.chase.phase !== 'leaving' ? { phase: d.chase.phase, distance: Math.round(distance) } : null);
        siren.current?.set(distance);
    });

    return null;
};

/** Over your car, for speech bubbles. */
const carTop = (streets) => () => {
    const car = streets.drive;
    return car ? [car.x, VEHICLE_TYPES[car.type].height + 0.5, car.z] : null;
};

/** Over the police car. */
const copTop = (streets) => () => {
    const car = streets.chase;
    return car ? [car.x, VEHICLE_TYPES.police.height + 0.5, car.z] : null;
};

/** Your car as chase.js sees it. */
const you = (c) => ({ x: c.x, z: c.z, rotationY: c.rotationY, v: c.v, foot: carFootprint(c) });

/** A chase after your car `c`: the nearest police car in the traffic within reach turns round, else a new one. */
const startChase = (world, traffic, c, others) => {
    const near = traffic.vehicles.filter((v) => v.type === 'police' && v.scale >= 1)
        .map((v) => ({ v, pose: vehiclePose(v) }))
        .map((o) => ({ ...o, d: Math.hypot(o.pose.x - c.x, o.pose.z - c.z) }))
        .filter((o) => o.d <= CHASE_RULES.takeOver)
        .sort((a, b) => a.d - b.d)[0];
    if (near) takeVehicle(traffic, near.v.id);
    const left = near ? { ...others, vehicles: others.vehicles.filter((o) => o.id !== near.v.id) } : others;
    return createChase(world, you(c), { police: near ? { ...near.pose, v: near.v.v } : null, others: left });
};

export default Drive;
