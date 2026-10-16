// Sky dome, ground, fog and Fako around the city (4 draw calls). Colours come from DayNight (P2-02), which also
// sets the background and keeps the fog in the horizon colour.
import { useMemo } from 'react';
import { FOG, GROUND_SIZE, GROUND_Y, fakoPlacement } from '../lib/backdrop.js';
import { LAYOUT_COLORS } from '../lib/layout.js';
import Sky from './Sky.jsx';
import Fako from './Fako.jsx';

/**
 * @param {{ bounds: { minX: number, maxX: number, minZ: number, maxZ: number },
 *           lighting: { zenith, horizon, mist }, mist?: number }} props  lighting: live THREE.Colors
 */
const Backdrop = ({ bounds, lighting, mist = 1 }) => {
    const placement = useMemo(() => fakoPlacement(bounds), [bounds]);

    return (
        <>
            <fog attach="fog" args={[lighting.horizon, FOG.near, FOG.far]} />
            <Sky lighting={lighting} />
            <mesh rotation-x={-Math.PI / 2} position-y={GROUND_Y} receiveShadow>
                <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
                <meshStandardMaterial color={LAYOUT_COLORS.ground} roughness={1} />
            </mesh>
            <Fako placement={placement} mistColor={lighting.mist} mist={mist} />
        </>
    );
};

export default Backdrop;
