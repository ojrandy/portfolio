// Key light (sun by day, moon by night) with a static shadow map. The map is redrawn only after a change
// (layout, quality) or once the light has moved more than REDRAW_ANGLE, about once a minute (P2-02), not every frame.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Frames to keep redrawing after a change, so meshes mounted in the same commit are in the map.
const REDRAW_FRAMES = 3;
const REDRAW_ANGLE = (0.3 * Math.PI) / 180;
const DISTANCE = 60; // from the city centre along the light direction

/**
 * @param {{ shadowMap: number, lighting: { lightDirection: THREE.Vector3, lightColor: THREE.Color, lightIntensity: number },
 *           version?: unknown }} props  shadowMap = map size; any `version` change redraws.
 */
const Sun = ({ shadowMap, lighting, version }) => {
    const light = useRef(null);
    const redraw = useRef(REDRAW_FRAMES);
    const drawnDirection = useRef(new THREE.Vector3(0, -1, 0)); // impossible, so the first frame draws
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
        const l = light.current;
        l.color.copy(lighting.lightColor);
        l.intensity = lighting.lightIntensity;
        if (drawnDirection.current.angleTo(lighting.lightDirection) > REDRAW_ANGLE) {
            drawnDirection.current.copy(lighting.lightDirection);
            l.position.copy(lighting.lightDirection).multiplyScalar(DISTANCE);
            redraw.current = Math.max(redraw.current, 1);
        }
        if (redraw.current <= 0) return;
        redraw.current--;
        gl.shadowMap.needsUpdate = true;
    });

    return (
        <directionalLight ref={light} intensity={0} castShadow
            shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} shadow-camera-far={130} />
    );
};

export default Sun;
