// Fako (Mount Cameroon) with its mist band (2 draw calls). Shape and placement: src/lib/backdrop.js.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MIST, fakoMesh, mistBand } from '../lib/backdrop.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

const buildGeometry = () => {
    const { positions, colors, indices } = fakoMesh();
    // Vertex colours are sRGB; three.js wants them in linear space.
    const linear = new Float32Array(colors.length);
    const color = new THREE.Color();
    for (let i = 0; i < colors.length; i += 3) {
        color.setRGB(colors[i], colors[i + 1], colors[i + 2], THREE.SRGBColorSpace);
        linear.set([color.r, color.g, color.b], i);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(linear, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
};

const geometry = buildGeometry();
const band = mistBand();
const mistGeometry = new THREE.CylinderGeometry(band.radiusTop, band.radiusBottom, band.bandHeight, 64, 1, true);

const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// Soft top and bottom edges; whole-number wave counts so the seam around the mountain doesn't show.
const fragmentShader = /* glsl */ `
    uniform vec3 color;
    uniform float opacity;
    uniform float time;
    varying vec2 vUv;
    void main() {
        float edge = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
        float x = vUv.x * 6.2831853;
        float wisps = 0.55 + 0.25 * sin(x * 5.0 + time * 0.04 + vUv.y * 3.0) + 0.2 * sin(x * 9.0 - time * 0.025);
        gl_FragColor = vec4(color, opacity * edge * wisps);
        #include <colorspace_fragment>
    }
`;

/**
 * @param {{ placement: { x: number, z: number, rotationY: number }, mistColor: string, mist?: number }} props
 *   mist: density multiplier (1 = Buea's everyday mist; P2-04 raises it for fog).
 */
const Fako = ({ placement, mistColor, mist = 1 }) => {
    const reducedMotion = useReducedMotion();
    const material = useRef(null);
    const uniforms = useMemo(() => ({
        color: { value: new THREE.Color() },
        opacity: { value: 0 },
        time: { value: 0 },
    }), []);

    useLayoutEffect(() => {
        const { uniforms: u } = material.current;
        u.color.value.set(mistColor);
        u.opacity.value = Math.min(1, MIST.opacity * mist);
    }, [mistColor, mist]);

    useFrame((_, delta) => {
        if (!reducedMotion) material.current.uniforms.time.value += delta;
    });

    return (
        <group position={[placement.x, 0, placement.z]} rotation-y={placement.rotationY}>
            <mesh geometry={geometry}>
                <meshStandardMaterial vertexColors flatShading roughness={1} />
            </mesh>
            <mesh geometry={mistGeometry} position-y={band.y} scale={band.scale} renderOrder={1}>
                <shaderMaterial ref={material} args={[{ uniforms, vertexShader, fragmentShader }]}
                    transparent depthWrite={false} side={THREE.DoubleSide} fog={false} toneMapped={false} />
            </mesh>
        </group>
    );
};

export default Fako;
