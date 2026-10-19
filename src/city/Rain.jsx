// Rain (P2-04): every drop is a line segment in one LineSegments mesh (1 draw call), animated in the vertex shader.
// Drops fill a box in front of the camera and wrap around it, so rain is everywhere at a fixed cost. Seeded, so the
// drops never jump on a re-render. `lighting.rain` (0..1) sets how many fall; frozen with reduced motion.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createRandom } from '../lib/random.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

const RAIN_DROPS ={ low: 600, medium: 1000, high: 1500 }; // at full rain, per quality level
const RADIUS = 40; // half-width of the box
const HEIGHT = 40;
const AHEAD = 30; // the box centre sits this far in front of the camera
const LENGTH = 0.9;
const SPEED = [16, 24];

const vertexShader = /* glsl */ `
    attribute vec4 aDrop; // x, y, z in 0..1 and the drop's rank (shown when rank < rain)
    attribute float aEnd; // 0 = bottom, 1 = top of the streak
    attribute float aSpeed;
    uniform vec3 uCenter;
    uniform float uTime;
    uniform float uRain;
    varying float vAlpha;
    const float R = ${RADIUS.toFixed(1)};
    const float H = ${HEIGHT.toFixed(1)};
    void main() {
        if (aDrop.w >= uRain) {
            gl_Position = vec4(0.0, 0.0, 2.0, 1.0); // outside the clip volume: not drawn
            return;
        }
        vec2 local = mod(aDrop.xz * 2.0 * R - uCenter.xz, 2.0 * R) - R;
        float y = mod(aDrop.y * H - uTime * aSpeed, H);
        vec3 p = vec3(uCenter.x + local.x + aEnd * 0.12, y + aEnd * ${LENGTH.toFixed(2)}, uCenter.z + local.y);
        vAlpha = 1.0 - smoothstep(R * 0.55, R, length(local));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    uniform vec3 uColor;
    varying float vAlpha;
    void main() {
        gl_FragColor = vec4(uColor, vAlpha * 0.45);
        #include <colorspace_fragment>
    }
`;

const buildGeometry = (count) => {
    const random = createRandom('rain');
    const drop = new Float32Array(count * 2 * 4);
    const end = new Float32Array(count * 2);
    const speed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
        const d = [random(), random(), random(), i / count];
        const s = SPEED[0] + random() * (SPEED[1] - SPEED[0]);
        for (let v = 0; v < 2; v++) {
            drop.set(d, (i * 2 + v) * 4);
            end[i * 2 + v] = v;
            speed[i * 2 + v] = s;
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3)); // unused
    geometry.setAttribute('aDrop', new THREE.BufferAttribute(drop, 4));
    geometry.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    return geometry;
};

const forward = new THREE.Vector3();
const white = new THREE.Color(1, 1, 1);

const syncRain = (uniforms, lighting, camera, delta) => {
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    uniforms.uCenter.value.copy(camera.position).addScaledVector(forward, AHEAD);
    uniforms.uTime.value += delta;
    uniforms.uRain.value = lighting.rain;
    // Pale against the sky by day, faint grey at night; lightning lights the drops up.
    uniforms.uColor.value.copy(lighting.horizon).lerp(white, 0.45 + 0.4 * lighting.flash);
};

/** @param {{ lighting: object, quality: 'low' | 'medium' | 'high' }} props */
const Rain = ({ lighting, quality }) => {
    const reducedMotion = useReducedMotion();
    const ref = useRef(null);
    const geometry = useMemo(() => buildGeometry(RAIN_DROPS[quality] ?? RAIN_DROPS.low), [quality]);
    const uniforms = useMemo(() => ({
        uCenter: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uRain: { value: 0 },
        uColor: { value: new THREE.Color() },
    }), []);
    const args = useMemo(() => [{ uniforms, vertexShader, fragmentShader }], [uniforms]);

    useEffect(() => () => geometry.dispose(), [geometry]);

    useFrame(({ camera }, delta) => {
        ref.current.visible = lighting.rain > 0.001; // no draw call while it isn't raining
        if (ref.current.visible) syncRain(uniforms, lighting, camera, reducedMotion ? 0 : delta);
    });

    return (
        <lineSegments ref={ref} geometry={geometry} frustumCulled={false} renderOrder={2} visible={false}>
            <shaderMaterial args={args} transparent depthWrite={false} fog={false} toneMapped={false} />
        </lineSegments>
    );
};

export default Rain;
