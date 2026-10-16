// Sky dome: a vertical gradient that follows the camera (1 draw call). P2-02 drives the colours.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SKY_RADIUS } from '../lib/backdrop.js';

const vertexShader = /* glsl */ `
    varying vec3 vDir;
    void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// Below the horizon stays the horizon colour, which is also the fog colour, so the ground blends in.
const fragmentShader = /* glsl */ `
    uniform vec3 zenith;
    uniform vec3 horizon;
    varying vec3 vDir;
    void main() {
        float h = max(normalize(vDir).y, 0.0);
        gl_FragColor = vec4(mix(horizon, zenith, pow(h, 0.5)), 1.0);
        #include <colorspace_fragment>
    }
`;

const geometry = new THREE.SphereGeometry(SKY_RADIUS, 32, 16);

/** @param {{ zenith: string, horizon: string }} props */
const Sky = ({ zenith, horizon }) => {
    const ref = useRef(null);
    const material = useRef(null);
    // Memoised args: a new args object makes R3F rebuild the material, which frees and recompiles its shader.
    const args = useMemo(() => [{
        uniforms: { zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
        vertexShader,
        fragmentShader,
    }], []);

    useLayoutEffect(() => {
        material.current.uniforms.zenith.value.set(zenith);
        material.current.uniforms.horizon.value.set(horizon);
    }, [zenith, horizon]);

    useFrame(({ camera }) => ref.current?.position.copy(camera.position));

    return (
        <mesh ref={ref} geometry={geometry} renderOrder={-1} frustumCulled={false}>
            <shaderMaterial ref={material} args={args}
                side={THREE.BackSide} depthWrite={false} fog={false} toneMapped={false} />
        </mesh>
    );
};

export default Sky;
