// Day/night controller (P2-02): recomputes Buea's lighting every minute and eases the live values towards it
// (~2 s; instant with reduced motion). Owns the ambient light, background and fog colour; Sky, Fako and Sun
// read the same `lighting` object. Never adds or removes lights, which would recompile every material.
// Weather (P2-04) changes the target the same way, plus the fog distances; lightning is a short ambient flash.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { lightingAt, sunState } from '../lib/dayNight.js';
import { CLEAR, lightningAt } from '../lib/weatherFx.js';
import { easeLighting, toTarget } from './liveLighting.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

const UPDATE_MS = 60 * 1000;
const EASE_SECONDS = 0.6; // time constant; ~95 % of the way after 3 × this
const FLASH_AMBIENT = 2.5; // extra ambient intensity at the peak of a lightning flash

const setFlash = (lighting, value) => { lighting.flash = value; };

/**
 * @param {{ lighting: object, offsetMs?: number, at?: number | null, weather?: object }} props
 *   at = fixed time (dev preview); weather = weatherFx() levels (memoise it)
 */
const DayNight = ({ lighting, offsetMs = 0, at = null, weather = CLEAR }) => {
    const reducedMotion = useReducedMotion();
    const ambient = useRef(null);
    const target = useRef(null);
    const snap = useRef(true); // the first frame is a cut, never a fade from night
    const getThree = useThree((s) => s.get);

    useEffect(() => {
        const update = () => { target.current = toTarget(lightingAt(sunState(at ?? Date.now() + offsetMs), weather), target.current ?? undefined); };
        update();
        if (at != null) return undefined;
        const id = setInterval(update, UPDATE_MS);
        return () => clearInterval(id);
    }, [offsetMs, at, weather]);

    useLayoutEffect(() => {
        const { scene } = getThree();
        const previous = scene.background;
        scene.background = lighting.horizon;
        return () => { scene.background = previous; };
    }, [getThree, lighting]);

    useFrame(({ scene, clock }, delta) => {
        if (!target.current) return;
        const t = snap.current || reducedMotion ? 1 : 1 - Math.exp(-delta / EASE_SECONDS);
        snap.current = false;
        easeLighting(lighting, target.current, t);
        setFlash(lighting, lighting.storm && !reducedMotion ? lightningAt(clock.elapsedTime) : 0);
        if (scene.fog) {
            scene.fog.color.copy(lighting.horizon);
            scene.fog.near = lighting.fogNear;
            scene.fog.far = lighting.fogFar;
        }
        ambient.current.color.copy(lighting.ambientColor);
        ambient.current.intensity = lighting.ambientIntensity + FLASH_AMBIENT * lighting.flash;
    }, -1); // before the components that read `lighting`

    return <ambientLight ref={ambient} intensity={0} />;
};

export default DayNight;
