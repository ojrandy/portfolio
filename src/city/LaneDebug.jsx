// Dev-only lane overlay (P3B-01): /?city&lanes in `npm run dev`. Lanes by road kind with a direction arrow,
// turns faint, crosswalks as outlines, and a dot per light at each crossing (north–south / east–west).
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildRoadGraph, signalState } from '../lib/roadGraph.js';
import { COLORS } from '../lib/palette.js';

const Y = 0.08;
const KIND_COLORS = { main: COLORS.window, street: '#7fd1ff', career: COLORS.ember };
const LIGHT_COLORS = { green: new THREE.Color('#3ddc84'), amber: new THREE.Color('#ffb020'), red: new THREE.Color('#ff3b3b') };
const ARROW = 0.35;

const segmentsGeometry = (segments) => {
    const positions = [];
    const colors = [];
    for (const [a, b, color] of segments) {
        const c = new THREE.Color(color);
        positions.push(a.x, Y, a.z, b.x, Y, b.z);
        colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
};

const LaneDebug = ({ layout }) => {
    const graph = useMemo(() => buildRoadGraph(layout), [layout]);

    const lines = useMemo(() => {
        const segments = [];
        for (const lane of graph.lanes) {
            const [a, b] = lane.points;
            const color = KIND_COLORS[lane.kind] ?? COLORS.mist;
            segments.push([a, b, color]);
            // Arrow head at the stop line.
            const dx = (b.x - a.x) / lane.length;
            const dz = (b.z - a.z) / lane.length;
            for (const side of [-1, 1]) {
                segments.push([b, { x: b.x - ARROW * (dx + side * -dz * 0.6), z: b.z - ARROW * (dz + side * dx * 0.6) }, color]);
            }
        }
        for (const link of graph.links) {
            link.points.slice(1).forEach((p, i) => segments.push([link.points[i], p, '#555b66']));
        }
        for (const cw of graph.crosswalks) {
            const [hx, hz] = [cw.width / 2, cw.depth / 2];
            const c = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([x, z]) => ({ x: cw.x + x, z: cw.z + z }));
            c.forEach((p, i) => segments.push([p, c[(i + 1) % 4], COLORS.paper]));
        }
        return segmentsGeometry(segments);
    }, [graph]);

    const lights = useMemo(() => {
        const crossings = graph.nodes.filter((n) => n.control === 'signal');
        const positions = crossings.flatMap((n) => [n.x, Y + 0.5, n.z - n.halfZ, n.x + n.halfX, Y + 0.5, n.z]);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3));
        return { crossings, geometry };
    }, [graph]);

    useFrame(({ clock }) => {
        const color = lights.geometry.getAttribute('color');
        lights.crossings.forEach((node, i) => {
            const state = signalState(node, clock.elapsedTime);
            color.setXYZ(2 * i, ...LIGHT_COLORS[state.ns].toArray());
            color.setXYZ(2 * i + 1, ...LIGHT_COLORS[state.ew].toArray());
        });
        color.needsUpdate = true;
    });

    return (
        <>
            <lineSegments geometry={lines}>
                <lineBasicMaterial vertexColors toneMapped={false} depthTest={false} />
            </lineSegments>
            <points geometry={lights.geometry}>
                <pointsMaterial vertexColors size={0.6} toneMapped={false} depthTest={false} />
            </points>
        </>
    );
};

export default LaneDebug;
