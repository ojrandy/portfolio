// Sky dome: a vertical gradient that follows the camera (1 draw call). Colours come from DayNight (P2-02).
// Weather (P2-04): a drifting cloud layer (cover = lighting.cloud) and the lightning flash, in the same shader.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SKY_RADIUS } from '../lib/backdrop.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

const vertexShader = /* glsl */ `
    varying vec3 vDir;
    void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// Below the horizon stays the horizon colour, which is also the fog colour, so the ground blends in.
// Clouds: value-noise fbm on a flat ceiling (direction / height), faded out towards the horizon so they meet the fog.
const fragmentShader = /* glsl */ `
    uniform vec3 zenith;
    uniform vec3 horizon;
    uniform float cloud;
    uniform float flash;
    uniform float time;
    varying vec3 vDir;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
    }

    void main() {
        vec3 dir = normalize(vDir);
        float h = max(dir.y, 0.0);
        vec3 color = mix(horizon, zenith, pow(h, 0.5));
        if (cloud > 0.01 && h > 0.0) {
            vec2 p = dir.xz / (h + 0.12) * 1.6 + vec2(time * 0.012, time * 0.004);
            float n = fbm(p);
            float cover = smoothstep(0.95 - cloud * 0.8, 1.13 - cloud * 0.8, n) * smoothstep(0.0, 0.25, h);
            // Lit from above: lighter tops by day; at night they stay close to the sky.
            vec3 shade = mix(horizon, zenith, 0.2) * (0.95 + 0.55 * n);
            color = mix(color, shade, cover * min(1.0, 0.65 + cloud));
        }
        color = mix(color, vec3(0.78, 0.82, 0.95), flash * 0.5);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
    }
`;

const geometry = new THREE.SphereGeometry(SKY_RADIUS, 32, 16);

const syncSky = (uniforms, lighting, delta) => {
    uniforms.cloud.value = lighting.cloud;
    uniforms.flash.value = lighting.flash;
    uniforms.time.value += delta;
};

/** @param {{ lighting: object }} props  live lighting (liveLighting.js); colours are used as the uniforms */
const Sky = ({ lighting }) => {
    const ref = useRef(null);
    const reducedMotion = useReducedMotion();
    const uniforms = useMemo(() => ({
        zenith: { value: lighting.zenith },
        horizon: { value: lighting.horizon },
        cloud: { value: 0 },
        flash: { value: 0 },
        time: { value: 0 },
    }), [lighting]);
    // Memoised args: a new args object makes R3F rebuild the material, which frees and recompiles its shader.
    const args = useMemo(() => [{ uniforms, vertexShader, fragmentShader }], [uniforms]);

    useFrame(({ camera }, delta) => {
        ref.current?.position.copy(camera.position);
        syncSky(uniforms, lighting, reducedMotion ? 0 : delta);
    });

    return (
        <mesh ref={ref} geometry={geometry} renderOrder={-1} frustumCulled={false}>
            <shaderMaterial args={args}
                side={THREE.BackSide} depthWrite={false} fog={false} toneMapped={false} />
        </mesh>
    );
};

export default Sky;
