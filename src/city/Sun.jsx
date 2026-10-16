// Key light with a static shadow map: the city and the light don't move, so the shadow pass runs only
// for a few frames after something changes (layout, quality), not every frame. P2-02 will redraw it as the sun moves.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

// Frames to keep redrawing after a change, so meshes mounted in the same commit are in the map.
const REDRAW_FRAMES = 3;

/** @param {{ shadowMap: number, version?: unknown }} props  shadowMap = map size; any `version` change redraws. */
const Sun = ({ shadowMap, version }) => {
    const light = useRef(null);
    const redraw = useRef(REDRAW_FRAMES);
    const getThree = useThree((s) => s.get);

    useLayoutEffect(() => {
        const { shadowMap: map } = getThree().gl;
        map.autoUpdate = false;
        return () => { map.autoUpdate = true; };
    }, [getThree]);

    // A new map size needs a new render target.
    useLayoutEffect(() => {
        const { shadow } = light.current;
        if (shadow.mapSize.x === shadowMap) return;
        shadow.mapSize.set(shadowMap, shadowMap);
        shadow.map?.dispose();
        shadow.map = null;
    }, [shadowMap]);

    useEffect(() => {
        redraw.current = REDRAW_FRAMES;
    }, [shadowMap, version]);

    useFrame(({ gl }) => {
        if (redraw.current <= 0) return;
        redraw.current--;
        gl.shadowMap.needsUpdate = true;
    });

    return (
        <directionalLight ref={light} position={[15, 25, 10]} intensity={1.4} castShadow
            shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} shadow-camera-far={100} />
    );
};

export default Sun;
