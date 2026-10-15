// Constrained orbit + fly-to driven by useCityStore (P1-05). Rules in src/lib/camera.js.
// Mouse: drag rotates, right-drag moves, wheel zooms. Touch: one finger rotates, pinch zooms, two-finger drag moves.
// Keyboard (on `keyTarget`, the focusable element around the canvas): arrows/WASD move, Q/E rotate, +/- zoom,
// Tab/Shift+Tab visit buildings, Esc/Home return to the start view.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import { CAMERA, FLIGHT, buildingView, flightSmoothTime, homeView, tabOrder, targetBounds } from '../lib/camera.js';
import useCityStore from '../store/useCityStore.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

// Per second; movement scales with zoom so it feels the same close up and far away.
const SPEED = { move: 0.8, rotate: 1.4, zoom: 1.2 };

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

const CameraRig = ({ layout, keyTarget }) => {
    const controls = useRef(null);
    const held = useRef(new Set());
    const placed = useRef(false);
    const camera = useThree((s) => s.camera);
    const getThree = useThree((s) => s.get);
    const reducedMotion = useReducedMotion();
    const focus = useCityStore((s) => s.focus);

    const lots = useMemo(() => new Map(layout.lots.map((l) => [l.slug, l])), [layout]);

    useEffect(() => {
        useCityStore.getState().setOrder(tabOrder(layout.lots));
    }, [layout]);

    useEffect(() => {
        const { min, max } = targetBounds(layout.bounds);
        controls.current.setBoundary(new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)));
    }, [layout]);

    // Fly (or cut, with reduced motion and on the first view) whenever the focus or the city changes.
    useEffect(() => {
        const c = controls.current;
        const lot = focus && lots.get(focus);
        // Screen shape is read, not subscribed to: resizing shouldn't move a camera the visitor has moved.
        const { width, height } = getThree().size;
        const { position, target } = lot ? buildingView(lot, layout.lots) : homeView(layout, { aspect: width / height });
        const animate = placed.current && !reducedMotion;
        placed.current = true;
        c.smoothTime = flightSmoothTime(camera.position.distanceTo(new THREE.Vector3(...position)));
        c.setLookAt(...position, ...target, animate).then(() => { c.smoothTime = FLIGHT.restSmoothTime; });
    }, [focus, lots, layout, reducedMotion, camera, getThree]);

    useEffect(() => {
        const el = keyTarget.current;
        if (!el) return undefined;
        const keys = held.current;
        const onKeyDown = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const store = useCityStore.getState();
            if (e.key === 'Tab') {
                // Past the last (or first) building, let Tab leave the canvas: no keyboard trap.
                if (store.step(e.shiftKey ? -1 : 1)) e.preventDefault();
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

    useFrame((_, delta) => {
        const keys = held.current;
        if (keys.size === 0) return;
        const c = controls.current;
        const dt = Math.min(delta, 0.1);
        const step = c.distance * SPEED.move * dt;
        const axis = (a, b) => (keys.has(a) ? 1 : 0) - (keys.has(b) ? 1 : 0);
        c.forward(axis('forward', 'back') * step, false);
        c.truck(axis('right', 'left') * step, 0, false);
        c.rotate(axis('rotateLeft', 'rotateRight') * SPEED.rotate * dt, 0, false);
        c.dolly(axis('zoomIn', 'zoomOut') * c.distance * SPEED.zoom * dt, false);
    });

    return (
        <CameraControls
            ref={controls}
            makeDefault
            minDistance={CAMERA.minDistance}
            maxDistance={CAMERA.maxDistance}
            minPolarAngle={CAMERA.minPolar}
            maxPolarAngle={CAMERA.maxPolar}
        />
    );
};

export default CameraRig;
