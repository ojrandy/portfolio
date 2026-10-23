// Figure meshes (P3B-04): each kit figure (src/lib/figures.js) merged into one flat-shaded geometry, drawn as one
// InstancedMesh. The vertex shader animates the limbs, so the CPU only writes three numbers per figure a frame:
//   aGait = [phase, stride, head]  legs/arms swing by sin(phase) · stride · swing; head parts bow by `head` radians.
// Colours: instanceColor paints 'top' parts (shirt, coat, canopy), aLower the 'lower' ones (trousers, skirt).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FIGURE_IDS, FIGURES } from '../lib/figures.js';

const TINT = { top: 1, lower: 2 };

const shapeGeometry = (part) => {
    if (part.shape === 'box') return new THREE.BoxGeometry(...part.size);
    if (part.shape === 'blob') return new THREE.IcosahedronGeometry(0.5, 0).scale(...part.size);
    if (part.shape === 'cone') return new THREE.ConeGeometry(part.radius, part.height, part.segments);
    return new THREE.CylinderGeometry(part.radius, part.radius, part.height, part.segments);
};

const partGeometry = (part) => {
    const source = shapeGeometry(part);
    const g = source.index ? source.toNonIndexed() : source;
    g.translate(...part.at);
    const count = g.attributes.position.count;
    const fill = (size, values) => {
        const array = new Float32Array(count * size);
        for (let i = 0; i < count; i++) array.set(values, i * size);
        return new THREE.BufferAttribute(array, size);
    };
    const base = new THREE.Color(part.tint ? '#FFFFFF' : part.color);
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', g.attributes.position);
    out.setAttribute('normal', g.attributes.normal);
    out.setAttribute('color', fill(3, base.toArray()));
    out.setAttribute('aTint', fill(1, [TINT[part.tint] ?? 0]));
    out.setAttribute('aSwing', fill(1, [part.swing ?? 0]));
    out.setAttribute('aHead', fill(1, [part.head ?? 0]));
    out.setAttribute('aPivot', fill(2, part.pivot ?? [0, 0]));
    source.dispose();
    return out;
};

/**
 * A figure's merged geometry with room for `capacity` instances: aLower and aGait (instance attributes read by the
 * figure material). Each mesh owns its geometry; dispose it with the mesh.
 */
export const buildFigureGeometry = (id, capacity) => {
    const parts = FIGURES[id].map(partGeometry);
    const geometry = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    geometry.setAttribute('aLower', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3));
    geometry.setAttribute('aGait', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3));
    geometry.computeBoundingSphere();
    return geometry;
};

/** Ids of the figures in the kit. */
export { FIGURE_IDS };

/** The shared figure material (dispose when done). */
export const createFigureMaterial = () => {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = `attribute float aTint;
attribute float aSwing;
attribute float aHead;
attribute vec2 aPivot;
attribute vec3 aLower;
attribute vec3 aGait;
${shader.vertexShader}`
            .replace('#include <begin_vertex>', `#include <begin_vertex>
float figAngle = aSwing * sin(aGait.x) * aGait.y + aHead * aGait.z;
vec2 figRel = transformed.yz - aPivot;
transformed.yz = aPivot + vec2(figRel.x * cos(figAngle) - figRel.y * sin(figAngle), figRel.x * sin(figAngle) + figRel.y * cos(figAngle));`)
            .replace('#include <color_vertex>', `#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
vColor.xyz = color.xyz * (aTint < 0.5 ? vec3(1.0) : aTint < 1.5 ? instanceColor.xyz : aLower);
#endif`);
    };
    material.customProgramCacheKey = () => 'figure';
    return material;
};
