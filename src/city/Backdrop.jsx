// Sky dome, ground, fog and Fako around the city (4 draw calls). `sky` defaults to night until P2-02.
import { useMemo } from 'react';
import { FOG, GROUND_SIZE, GROUND_Y, SKY_NIGHT, fakoPlacement } from '../lib/backdrop.js';
import { LAYOUT_COLORS } from '../lib/layout.js';
import Sky from './Sky.jsx';
import Fako from './Fako.jsx';

/**
 * @param {{ bounds: { minX: number, maxX: number, minZ: number, maxZ: number },
 *           sky?: { zenith: string, horizon: string, mist: string }, mist?: number }} props
 */
const Backdrop = ({ bounds, sky = SKY_NIGHT, mist = 1 }) => {
    const placement = useMemo(() => fakoPlacement(bounds), [bounds]);

    return (
        <>
            <color attach="background" args={[sky.horizon]} />
            <fog attach="fog" args={[sky.horizon, FOG.near, FOG.far]} />
            <Sky zenith={sky.zenith} horizon={sky.horizon} />
            <mesh rotation-x={-Math.PI / 2} position-y={GROUND_Y} receiveShadow>
                <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
                <meshStandardMaterial color={LAYOUT_COLORS.ground} roughness={1} />
            </mesh>
            <Fako placement={placement} mistColor={sky.mist} mist={mist} />
        </>
    );
};

export default Backdrop;
