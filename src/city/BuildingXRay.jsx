// X-Ray in the city (P3-03): replaces the open building with one coloured, labelled floor per layer, which GSAP
// lifts apart (placed directly with reduced motion). Mounted only while active: one draw call per layer.
import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import * as THREE from 'three';
import { FLOOR_HEIGHT } from '../lib/buildings.js';
import { COLORS } from '../lib/palette.js';
import useReducedMotion from '../hooks/useReducedMotion.js';

const FLOOR_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const FLOOR_COLORS = { ui: COLORS.sky, api: COLORS.ember, data: COLORS.window, infra: COLORS.fakoGreen };
const EXPLODE_GAP = 0.7;

const BuildingXRay = ({ lot, layers }) => {
    const root = useRef(null);
    const reducedMotion = useReducedMotion();
    const { building } = lot;
    const floorHeight = Math.max(0.16, Math.min(FLOOR_HEIGHT * 0.7, building.height / layers.length * 0.55));
    const floorStep = layers.length > 1 ? Math.max(floorHeight + 0.08, (building.height - floorHeight) / (layers.length - 1)) : 0;
    const floorPositions = layers.map((_, index) => index * floorStep);

    useGSAP(() => {
        if (!root.current) return;
        const floors = root.current.children.filter((child) => child.userData.xrayFloor);
        if (reducedMotion) {
            floors.forEach((floor, index) => { floor.position.y = floorPositions[index]; });
            return;
        }
        gsap.fromTo(
            floors.map((floor) => floor.position),
            { y: (index) => floorPositions[index] },
            {
                y: (index) => floorPositions[index] + index * EXPLODE_GAP,
                duration: 0.65,
                stagger: 0.08,
                ease: 'power2.out',
            },
        );
    }, { dependencies: [lot.slug, layers.map((layer) => layer.key).join('|'), reducedMotion], scope: root });

    return (
        <group ref={root} position={[lot.x, 0, lot.z]}>
            {layers.map((layer, index) => (
                <group key={layer.key} userData={{ xrayFloor: true }} position={[0, floorPositions[index], 0]}>
                    <mesh geometry={FLOOR_GEOMETRY} scale={[building.width * 1.06, floorHeight, building.depth * 1.06]} castShadow receiveShadow>
                        <meshStandardMaterial color={FLOOR_COLORS[layer.key]} roughness={0.62} metalness={0.08} />
                    </mesh>
                    <Html position={[building.width / 2 + 0.55, floorHeight / 2, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
                        <div className="w-44 rounded border-l-2 bg-basalt/95 px-2.5 py-1.5 text-mist ring-1 ring-mist/10" style={{ borderColor: FLOOR_COLORS[layer.key] }}>
                            <p className="font-mono text-[10px] uppercase text-mist/60">{layer.label}</p>
                            <p className="mt-0.5 whitespace-normal text-xs leading-snug">{layer.details}</p>
                        </div>
                    </Html>
                </group>
            ))}
        </group>
    );
};

export default BuildingXRay;
