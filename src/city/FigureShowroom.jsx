// Dev-only figure showroom (P3B-04): /?city&figures in `npm run dev`. On the main road east of Career Road: a row of
// people in every top colour (half mid-stride, half with umbrellas), then goats and chickens in every coat, grazing.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GOAT_COATS, HEN_COATS, LOWERS, TOPS, UMBRELLAS } from '../lib/figures.js';
import { buildFigureGeometry, createFigureMaterial } from './figureGeometry.js';

const KINDS = ['person', 'umbrella', 'goat', 'chicken'];

const FigureShowroom = ({ layout }) => {
    const rows = useMemo(() => {
        const main = layout.roads.find((r) => r.kind === 'main');
        const career = layout.roads.find((r) => r.kind === 'career');
        const x0 = career.x + career.width / 2 + 1;
        const z = main.z + main.depth / 4;
        const people = TOPS.map((top, i) => ({
            x: x0 + i * 0.5, z, rotationY: 0, top, lower: LOWERS[i % LOWERS.length], gait: [Math.PI / 2, i % 2 ? 0.5 : 0, 0],
        }));
        const umbrellas = people.filter((_, i) => i % 2 === 0).map((p, i) => ({ ...p, top: UMBRELLAS[i % UMBRELLAS.length] }));
        const goats = GOAT_COATS.map((top, i) => ({ x: x0 + i * 0.7, z: z - 1, rotationY: Math.PI / 2, top, gait: [0, 0, i % 2 ? 0.9 : 0] }));
        const chickens = HEN_COATS.map((top, i) => ({ x: x0 + 3 + i * 0.4, z: z - 1, rotationY: -0.5, top, gait: [0, 0, i % 2 ? 0.8 : 0] }));
        return { person: people, umbrella: umbrellas, goat: goats, chicken: chickens };
    }, [layout]);
    const material = useMemo(() => createFigureMaterial(), []);
    const geometry = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, buildFigureGeometry(k, rows[k].length)])), [rows]);
    const meshes = useRef({});

    useLayoutEffect(() => {
        const matrix = new THREE.Matrix4();
        const color = new THREE.Color();
        for (const kind of KINDS) {
            const mesh = meshes.current[kind];
            rows[kind].forEach((f, i) => {
                mesh.setMatrixAt(i, matrix.makeRotationY(f.rotationY).setPosition(f.x, 0, f.z));
                mesh.setColorAt(i, color.set(f.top));
                color.set(f.lower ?? f.top);
                mesh.geometry.attributes.aLower.setXYZ(i, color.r, color.g, color.b);
                mesh.geometry.attributes.aGait.setXYZ(i, ...f.gait);
            });
            mesh.instanceMatrix.needsUpdate = true;
        }
    }, [rows]);
    useEffect(() => () => {
        Object.values(geometry).forEach((g) => g.dispose());
        material.dispose();
    }, [geometry, material]);

    return KINDS.map((kind) => (
        <instancedMesh key={kind} ref={(m) => { meshes.current[kind] = m; }} args={[geometry[kind], material, rows[kind].length]} frustumCulled={false} />
    ));
};

export default FigureShowroom;
