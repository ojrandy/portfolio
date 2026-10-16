// Day/night controller (P2-02): recomputes Buea's lighting every minute and eases the live values towards it
// (~2 s; instant with reduced motion). Owns the ambient light, background and fog colour; Sky, Fako and Sun
// read the same `lighting` object. Never adds or removes lights, which would recompile every material.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { lightingAt, sunState } from '../lib/dayNight.js';
import { easeLighting, toTarget } from './liveLighting.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

const UPDATE_MS = 60 * 1000;
const EASE_SECONDS = 0.6; // time constant; ~95 % of the way after 3 × this

/** @param {{ lighting: object, offsetMs?: number, at?: number | null }} props  at = fixed time (dev preview) */
const DayNight = ({ lighting, offsetMs = 0, at = null }) => {
    const reducedMotion = useReducedMotion();
    const ambient = useRef(null);
    const target = useRef(null);
    const snap = useRef(true); // the first frame is a cut, never a fade from night
    const getThree = useThree((s) => s.get);

    useEffect(() => {
        const update = () => { target.current = toTarget(lightingAt(sunState(at ?? Date.now() + offsetMs)), target.current ?? undefined); };
        update();
        if (at != null) return undefined;
        const id = setInterval(update, UPDATE_MS);
        return () => clearInterval(id);
    }, [offsetMs, at]);

    useLayoutEffect(() => {
        const { scene } = getThree();
        const previous = scene.background;
        scene.background = lighting.horizon;
        return () => { scene.background = previous; };
    }, [getThree, lighting]);

    useFrame(({ scene }, delta) => {
        if (!target.current) return;
        const t = snap.current || reducedMotion ? 1 : 1 - Math.exp(-delta / EASE_SECONDS);
        snap.current = false;
        easeLighting(lighting, target.current, t);
        scene.fog?.color.copy(lighting.horizon);
        ambient.current.color.copy(lighting.ambientColor);
        ambient.current.intensity = lighting.ambientIntensity;
    }, -1); // before the components that read `lighting`

    return <ambientLight ref={ambient} intensity={0} />;
};

export default DayNight;
