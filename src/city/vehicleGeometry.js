// Vehicle meshes (P3B-02): each type's parts merged into one flat-shaded geometry with vertex colours, so a type is
// one InstancedMesh. `aTint` = 1 on body parts: only they take the instance colour (glass, tyres and lamps keep theirs).
// `uv` points every vertex at the white corner of a decal texture, except decal faces (the police lettering).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BODY, POLICE_BLUE, VEHICLE_IDS, VEHICLE_TYPES } from '../lib/vehicles.js';

// Decal textures keep u < DECAL_U0 white; the lettering fills u DECAL_U0..1.
export const DECAL_U0 = 0.125;
const WHITE_UV = [DECAL_U0 / 2, 0.5];
const AXIS_ROTATION = { x: (g) => g.rotateZ(Math.PI / 2), y: (g) => g, z: (g) => g.rotateX(Math.PI / 2) };

const shapeGeometry = (part) => {
    if (part.shape === 'box') return new THREE.BoxGeometry(...part.size);
    if (part.shape === 'blob') return new THREE.IcosahedronGeometry(0.5, 0).scale(...part.size);
    return AXIS_ROTATION[part.axis](new THREE.CylinderGeometry(part.radius, part.radius, part.length, part.segments));
};

const partGeometry = (part) => {
    const source = shapeGeometry(part);
    const g = source.index ? source.toNonIndexed() : source;
    g.translate(...part.at);
    const count = g.attributes.position.count;
    const normals = g.attributes.normal;
    const axis = part.axis === 'x' ? 0 : part.axis === 'z' ? 2 : 1;

    const colors = new Float32Array(count * 3);
    const base = new THREE.Color(part.color === BODY ? '#FFFFFF' : part.color);
    const ends = part.ends ? new THREE.Color(part.ends) : null;
    for (let i = 0; i < count; i++) {
        const capFace = ends && Math.abs(normals.getComponent(i, axis)) > 0.9;
        (capFace ? ends : base).toArray(colors, i * 3);
    }

    // BoxGeometry faces come in the order +x, −x, +y, −y, +z, −z (6 vertices each once non-indexed):
    // a decal maps onto the two side faces, read the right way round from outside.
    const uvs = new Float32Array(count * 2);
    const sourceUv = g.attributes.uv;
    for (let i = 0; i < count; i++) {
        const onDecal = part.decal && i < 12;
        uvs[i * 2] = onDecal ? DECAL_U0 + sourceUv.getX(i) * (1 - DECAL_U0) : WHITE_UV[0];
        uvs[i * 2 + 1] = onDecal ? sourceUv.getY(i) : WHITE_UV[1];
    }

    const out = new THREE.BufferGeometry();
    out.setAttribute('position', g.attributes.position);
    out.setAttribute('normal', normals);
    out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    out.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(count).fill(part.color === BODY ? 1 : 0), 1));
    source.dispose();
    return out;
};

/** One merged, non-indexed geometry for a vehicle type. */
export const buildVehicleGeometry = (typeId) => {
    const parts = VEHICLE_TYPES[typeId].parts.map(partGeometry);
    const geometry = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    geometry.computeBoundingSphere();
    return geometry;
};

/** Patch a material so the instance colour only paints body vertices (aTint). `key` must be unique per material setup. */
export const makeTintable = (material, key) => {
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = `attribute float aTint;\n${shader.vertexShader}`
            .replace('#include <color_vertex>', `#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
vColor.xyz = color.xyz * mix(vec3(1.0), instanceColor.xyz, aTint);
#endif`);
    };
    material.customProgramCacheKey = () => key;
    return material;
};

let geometries = null;
/** Every type's merged geometry, built once and shared (the showroom and the traffic use the same ones). */
export const vehicleGeometries = () => {
    geometries ??= Object.fromEntries(VEHICLE_IDS.map((id) => [id, buildVehicleGeometry(id)]));
    return geometries;
};

// White left strip, then the lettering on white (it is multiplied by the stripe's paper colour).
const decalTexture = (text, ink) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = ink;
    ctx.font = '800 54px system-ui, sans-serif';
    ctx.letterSpacing = '22px';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const left = canvas.width * DECAL_U0;
    // The police stripe (0.84 × 0.09) is shorter for its height than the canvas region (896 × 64): narrow the letters to match.
    ctx.setTransform(0.67, 0, 0, 1, (left + canvas.width) / 2, canvas.height / 2 + 2);
    ctx.fillText(text, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
};

/** The two vehicle materials (plain, and police with its lettering); dispose with disposeVehicleMaterials. */
export const createVehicleMaterials = () => {
    const plain = makeTintable(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6 }), 'vehicle');
    const police = makeTintable(new THREE.MeshStandardMaterial({
        vertexColors: true, flatShading: true, roughness: 0.6, map: decalTexture('POLICE', POLICE_BLUE),
    }), 'vehicle-decal');
    return { plain, police };
};

export const disposeVehicleMaterials = (materials) => {
    materials.police.map.dispose();
    Object.values(materials).forEach((m) => m.dispose());
};

export const vehicleMaterialFor = (materials, id) => (VEHICLE_TYPES[id].parts.some((p) => p.decal === 'police') ? materials.police : materials.plain);
