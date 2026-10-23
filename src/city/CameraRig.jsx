// Constrained orbit + fly-to driven by useCityStore (P1-05). Rules in src/lib/camera.js.
// Mouse: drag rotates, right-drag moves, wheel zooms to the cursor. Touch: one finger rotates, pinch zooms (to the
// pinch centre), two-finger drag moves.
// Keyboard (on `keyTarget`, the focusable element around the canvas): arrows/WASD move, Q/E rotate, +/- zoom,
// Tab/Shift+Tab visit buildings, Enter opens the project panel, Esc closes it, then returns to the start view.
// P3B-06: follows a clicked vehicle until Esc, which goes back to the view before. Moving with the keys while
// following stays where you are. On a taxi ride you sit inside the taxi (passenger.js): the camera is your eyes on the
// front passenger seat; drag or the arrows/WASD/Q/E turn your head, Esc gets out; after the ride, the camera flies
// from your seat to the place (places.js).
// P3B-09: in drive mode the camera chases your car (drive.js chaseView), or sits in the driver's seat (taxi); drag
// turns your head there. Esc parks, and the camera goes back to the view from before.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import { CAMERA, FLIGHT, buildingView, flightSmoothTime, homeView, tabOrder, targetBounds } from '../lib/camera.js';
import { placeView } from '../lib/places.js';
import { vehicleById, vehiclePose } from '../lib/traffic.js';
import { clampLook, PASSENGER, passengerView } from '../lib/passenger.js';
import { CHASE, DRIVER_EYE, chaseView } from '../lib/drive.js';
import useCityStore from '../store/useCityStore.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

// Per second; movement scales with zoom so it feels the same close up and far away.
const SPEED = { move: 0.8, rotate: 1.4, zoom: 1.2 };
// Chase view: behind the vehicle, this far from it and this far from straight up (rad).
const FOLLOW = { distance: 9, polar: 1.05, height: CAMERA.minTargetY };
// Head turning in the taxi: radians per pixel dragged, per second with a key held.
const LOOK = { drag: 0.005, keys: 1.4 };

// event.code, so WASD/Q/E keep their physical place on AZERTY keyboards too.
const KEYS = {
    ArrowUp: 'forward', KeyW: 'forward',
    ArrowDown: 'back', KeyS: 'back',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    KeyQ: 'rotateLeft', KeyE: 'rotateRight',
    Equal: 'zoomIn', NumpadAdd: 'zoomIn',
    Minus: 'zoomOut', NumpadSubtract: 'zoomOut',
};

/**
 * @param {{ layout: object, keyTarget: object, places?: object[], streets?: object }} props
 *   places = cityPlaces(); streets.traffic = the live traffic (for the vehicle being followed)
 */
const CameraRig = ({ layout, keyTarget, places = [], streets = null }) => {
    const controls = useRef(null);
    const held = useRef(new Set());
    const placed = useRef(false);
    const camera = useThree((s) => s.camera);
    const getThree = useThree((s) => s.get);
    const reducedMotion = useReducedMotion();
    const focus = useCityStore((s) => s.focus);
    const place = useCityStore((s) => s.place);
    const visit = useCityStore((s) => s.visit);
    const followingId = useCityStore((s) => s.following?.id ?? null);
    const drivingKey = useCityStore((s) => s.driving?.key ?? null);
    const driveBefore = useRef(null); // { position, target, focus, place, visit } when the drive started
    const chaseHeading = useRef(null);
    const before = useRef(null); // { position, target, focus, place, visit } when the follow started
    const stay = useRef(false); // a follow ended by moving with the keys: don't fly back
    const seated = useRef(null); // { fov, near } of the city camera while you sit in a taxi
    const look = useRef({ yaw: 0, pitch: 0, idle: 0 }); // your head turn in the taxi
    const drag = useRef(null); // { x, y } of the pointer while dragging to look around in the taxi
    const gl = useThree((s) => s.gl);

    const lots = useMemo(() => new Map(layout.lots.map((l) => [l.slug, l])), [layout]);

    useEffect(() => {
        useCityStore.getState().setOrder(tabOrder(layout.lots));
    }, [layout]);

    useEffect(() => {
        const { min, max } = targetBounds(layout.reach);
        controls.current.setBoundary(new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)));
    }, [layout]);

    // Fly (or cut, with reduced motion and on the first view) whenever the focus, the place or the city changes.
    useEffect(() => {
        const c = controls.current;
        const lot = focus && lots.get(focus);
        const spot = place && places.find((p) => p.id === place);
        // Screen shape is read, not subscribed to: resizing shouldn't move a camera the visitor has moved.
        const { width, height } = getThree().size;
        const { position, target } = lot ? buildingView(lot, layout.lots)
            : spot ? placeView(spot) : homeView(layout, { aspect: width / height });
        const animate = placed.current && !reducedMotion;
        placed.current = true;
        c.smoothTime = flightSmoothTime(camera.position.distanceTo(new THREE.Vector3(...position)));
        c.setLookAt(...position, ...target, animate).then(() => { c.smoothTime = FLIGHT.restSmoothTime; });
    }, [focus, place, visit, places, lots, layout, reducedMotion, camera, getThree]);

    // Start following: remember the view and swing round behind the vehicle. Stop: go back, unless the camera was
    // sent somewhere else meanwhile (a building, a place) or moved with the keys.
    useEffect(() => {
        const c = controls.current;
        if (followingId !== null) {
            const { focus: f, place: p, visit: n } = useCityStore.getState();
            if (!before.current) {
                before.current = { position: c.getPosition(new THREE.Vector3()), target: c.getTarget(new THREE.Vector3()), focus: f, place: p, visit: n };
            }
            const v = streets?.traffic && vehicleById(streets.traffic, followingId);
            if (v) {
                const pose = vehiclePose(v);
                c.smoothTime = FLIGHT.restSmoothTime;
                c.rotateTo(pose.rotationY + Math.PI, FOLLOW.polar, !reducedMotion);
                c.dollyTo(FOLLOW.distance, !reducedMotion);
                c.moveTo(pose.x, FOLLOW.height, pose.z, !reducedMotion);
            }
            return;
        }
        const saved = before.current;
        before.current = null;
        if (!saved || stay.current) {
            stay.current = false;
            return;
        }
        const { focus: f, place: p, visit: n } = useCityStore.getState();
        if (f === saved.focus && p === saved.place && n === saved.visit) c.setLookAt(...saved.position.toArray(), ...saved.target.toArray(), !reducedMotion);
    }, [followingId, streets, reducedMotion]);

    // Drive mode: remember the view; on park, go back to it (unless the camera was sent somewhere else meanwhile).
    useEffect(() => {
        const c = controls.current;
        if (drivingKey !== null) {
            if (!driveBefore.current) {
                const { focus: f, place: p, visit: n } = useCityStore.getState();
                driveBefore.current = { position: c.getPosition(new THREE.Vector3()), target: c.getTarget(new THREE.Vector3()), focus: f, place: p, visit: n };
            }
            chaseHeading.current = null;
            return;
        }
        const saved = driveBefore.current;
        driveBefore.current = null;
        if (!saved) return;
        const { focus: f, place: p, visit: n } = useCityStore.getState();
        if (f === saved.focus && p === saved.place && n === saved.visit) c.setLookAt(...saved.position.toArray(), ...saved.target.toArray(), !reducedMotion);
    }, [drivingKey, reducedMotion]);

    useEffect(() => {
        const el = keyTarget.current;
        if (!el) return undefined;
        const keys = held.current;
        const onKeyDown = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const store = useCityStore.getState();
            // Driving: the keys drive (Drive.jsx); Esc parks, Tab still visits the buildings (and ends the drive).
            if (store.driving && e.key === 'Escape') {
                e.preventDefault();
                store.stopDrive();
                return;
            }
            if (store.driving && e.key !== 'Tab') return;
            if (e.key === 'Tab') {
                // Past the last (or first) building, let Tab leave the canvas: no keyboard trap.
                if (store.step(e.shiftKey ? -1 : 1)) e.preventDefault();
            } else if (e.key === 'Enter' && store.focus) {
                e.preventDefault();
                store.openProject(store.focus);
            } else if (e.key === 'Escape' && store.following) {
                e.preventDefault();
                store.stopFollowing();
            } else if (e.key === 'Escape' && store.openSlug) {
                // First Esc closes the panel, the next one returns to the start view.
                e.preventDefault();
                store.closeProject();
            } else if (e.key === 'Escape' || e.key === 'Home') {
                e.preventDefault();
                store.goHome();
            } else if (KEYS[e.code]) {
                e.preventDefault();
                keys.add(KEYS[e.code]);
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
    }, [keyTarget]);

    // In the taxi, dragging (mouse or finger) turns your head; it grabs the view, like a panorama.
    useEffect(() => {
        const el = gl.domElement;
        const onDown = (e) => { if (seated.current) drag.current = { x: e.clientX, y: e.clientY }; };
        const onMove = (e) => {
            const d = drag.current;
            if (!d || !seated.current) return;
            const l = look.current;
            Object.assign(l, clampLook({ yaw: l.yaw + (e.clientX - d.x) * LOOK.drag, pitch: l.pitch + (e.clientY - d.y) * LOOK.drag }));
            d.x = e.clientX;
            d.y = e.clientY;
        };
        const onUp = () => { drag.current = null; };
        el.addEventListener('pointerdown', onDown);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            el.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [gl]);

    // In the taxi (or driving): the city camera stands aside (camera-controls updates first each frame; this frame
    // callback then puts the camera at your eyes, or behind your car). Out of it: the camera's lens comes back.
    const enterTaxi = (c, cam, lens = PASSENGER) => {
        if (!seated.current) {
            seated.current = { fov: cam.fov, near: cam.near };
            look.current = { yaw: 0, pitch: 0, idle: 0 };
            c.enabled = false;
        }
        if (cam.fov !== lens.fov || cam.near !== lens.near) {
            cam.fov = lens.fov;
            cam.near = lens.near;
            cam.updateProjectionMatrix();
        }
    };
    // Keep the city camera where you are, so leaving flies on from here.
    const keepControls = (c, eye, target) => {
        const d = CAMERA.minDistance;
        c.setLookAt(eye.x, eye.y, eye.z, eye.x + (target.x - eye.x) * d, eye.y + (target.y - eye.y) * d, eye.z + (target.z - eye.z) * d, false);
    };
    // Let go for a moment and your head turns back to the road.
    const settleLook = (dt, turning) => {
        const l = look.current;
        l.idle = turning ? 0 : l.idle + dt;
        if (l.idle > 0.6) {
            const back = Math.exp((-3 * dt) / PASSENGER.settle);
            l.yaw *= back;
            l.pitch *= back;
        }
        Object.assign(l, clampLook(l));
        return l;
    };
    const leaveTaxi = (c, cam) => {
        if (!seated.current) return;
        cam.fov = seated.current.fov;
        cam.near = seated.current.near;
        cam.updateProjectionMatrix();
        c.enabled = true;
        seated.current = null;
        drag.current = null;
    };

    useFrame((state, delta) => {
        const keys = held.current;
        const c = controls.current;
        const { following, stopFollowing, ride, skipRide, driving } = useCityStore.getState();
        const v = following && streets?.traffic ? vehicleById(streets.traffic, following.id) : null;
        const dt = Math.min(delta, 0.1);
        const axis = (a, b) => (keys.has(a) ? 1 : 0) - (keys.has(b) ? 1 : 0);
        const car = driving && streets?.drive;
        if (car) {
            if (car.seat) {
                // The driver's seat: you look where you drive; drag to look round.
                enterTaxi(c, state.camera, PASSENGER);
                const l = settleLook(dt, Boolean(drag.current));
                const bob = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 14) * Math.min(1, Math.abs(car.v) / 2);
                const { eye, target } = passengerView(car, l, bob, DRIVER_EYE);
                state.camera.position.set(eye.x, eye.y, eye.z);
                state.camera.lookAt(target.x, target.y, target.z);
                keepControls(c, eye, target);
                return;
            }
            enterTaxi(c, state.camera, CHASE);
            // The camera swings round behind the car a little after it turns (straight away with reduced motion).
            const h = chaseHeading.current ?? car.rotationY;
            const turn = Math.atan2(Math.sin(car.rotationY - h), Math.cos(car.rotationY - h));
            chaseHeading.current = reducedMotion ? car.rotationY : h + turn * (1 - Math.exp(-CHASE.follow * dt));
            const { eye, target } = chaseView(car, chaseHeading.current, layout.lots);
            state.camera.position.set(eye.x, eye.y, eye.z);
            state.camera.lookAt(target.x, target.y, target.z);
            keepControls(c, eye, target);
            return;
        }
        if (driving) return; // the car isn't on the road yet
        if (ride?.riding && following) {
            if (!v) {
                skipRide(); // the taxi is gone: straight to the place
                return;
            }
            if (!seated.current) enterTaxi(c, state.camera);
            look.current.yaw += (axis('left', 'right') + axis('rotateLeft', 'rotateRight')) * LOOK.keys * dt;
            look.current.pitch += axis('forward', 'back') * LOOK.keys * dt;
            const l = settleLook(dt, keys.size > 0 || Boolean(drag.current));
            const bob = Math.sin(state.clock.elapsedTime * 14) * Math.min(1, (v.v ?? 0) / 2);
            const { eye, target } = passengerView(vehiclePose(v), l, bob);
            state.camera.position.set(eye.x, eye.y, eye.z);
            state.camera.lookAt(target.x, target.y, target.z);
            keepControls(c, eye, target);
            return;
        }
        leaveTaxi(c, state.camera);
        if (following) {
            if (!v) {
                // It drove off the map.
                stopFollowing();
            } else if (keys.size) {
                stay.current = true;
                stopFollowing();
            } else {
                const pose = vehiclePose(v);
                c.moveTo(pose.x, FOLLOW.height, pose.z, !reducedMotion);
            }
        }
        if (keys.size === 0) return;
        const step = c.distance * SPEED.move * dt;
        c.forward(axis('forward', 'back') * step, false);
        c.truck(axis('right', 'left') * step, 0, false);
        c.rotate(axis('rotateLeft', 'rotateRight') * SPEED.rotate * dt, 0, false);
        c.dolly(axis('zoomIn', 'zoomOut') * c.distance * SPEED.zoom * dt, false);
    });

    return (
        <CameraControls
            ref={controls}
            makeDefault
            dollyToCursor // wheel/pinch zooms towards what's under the pointer, not the downtown target
            minDistance={CAMERA.minDistance}
            maxDistance={CAMERA.maxDistance}
            minPolarAngle={CAMERA.minPolar}
            maxPolarAngle={CAMERA.maxPolar}
        />
    );
};

export default CameraRig;
