// City kit (ART-03, docs/architecture.md "Art pipeline"): the Blender pieces in public/models/city-kit.glb as
// geometries ready for instancing, and the one material they share.
import * as THREE from 'three';

export const KIT_URL = '/models/city-kit.glb';

// glTF custom attributes arrive lowercased (_TINT → _tint); GLSL names can't start with an underscore safely.
const RENAME = { _tint: 'aTint', _ao: 'aAO' };
const GET = ['getX', 'getY', 'getZ', 'getW'];

// Meshopt quantization stores positions as normalized integers with the scale on the node; applying the node
// matrix would overflow them, so every attribute is turned back into floats first.
const toFloat = (attr) => {
    const { count, itemSize } = attr;
    const out = new Float32Array(count * itemSize);
    for (let i = 0; i < count; i++) {
        for (let k = 0; k < itemSize; k++) out[i * itemSize + k] = attr[GET[k]](i);
    }
    return new THREE.BufferAttribute(out, itemSize);
};

const pieceGeometry = (mesh) => {
    const g = new THREE.BufferGeometry();
    if (mesh.geometry.index) g.setIndex(mesh.geometry.index.clone());
    for (const [name, attr] of Object.entries(mesh.geometry.attributes)) g.setAttribute(RENAME[name] ?? name, toFloat(attr));
    g.applyMatrix4(mesh.matrixWorld);
    g.computeBoundingSphere();
    return g;
};

/**
 * Piece name → geometry, from the loaded kit scene. `lod1` takes each piece's "<name>_LOD1" sibling instead.
 * @param {THREE.Object3D} scene
 * @param {boolean} lod1
 */
export const kitGeometries = (scene, lod1) => {
    scene.updateMatrixWorld(true);
    const out = new Map();
    scene.traverse((obj) => {
        if (!obj.isMesh || obj.name.endsWith('_LOD1')) return;
        const mesh = lod1 ? scene.getObjectByName(`${obj.name}_LOD1`) : obj;
        if (!mesh) throw new Error(`city kit: ${obj.name} has no LOD1`);
        out.set(obj.name, pieceGeometry(mesh));
    });
    return out;
};

/** The pieces' material: baked colours, the instance colour as wall paint where aTint = 1, darkened by baked AO. */
export const createKitMaterial = () => {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = `attribute float aTint;\nattribute float aAO;\n${shader.vertexShader}`
            .replace('#include <color_vertex>', `#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
vColor.rgb = color.rgb * mix(vec3(1.0), instanceColor.rgb, aTint);
#endif
vColor.rgb *= aAO;`);
    };
    material.customProgramCacheKey = () => 'city-kit';
    return material;
};
