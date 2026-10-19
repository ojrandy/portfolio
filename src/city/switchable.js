// City lights (P2-03): lets each instance of a built-in material switch on at its own level, with no extra draw calls.
// The geometry carries a per-instance `aSwitch` (the level at which that instance turns on); `uLevel` is the city's
// current level (0..1). In the fragment shader `vOn` (0..1) says how far this instance is on, and `vLocal` is its
// uv − 0.5 (for round falloffs).
import * as THREE from 'three';

// Level range over which one light fades in. Small, so lights come on one by one as the level rises.
const FADE = 0.04;

/** A copy of `geometry` with a per-instance aSwitch attribute (values in instance order). */
export const withSwitches = (geometry, values) => {
    const g = geometry.clone();
    g.setAttribute('aSwitch', new THREE.InstancedBufferAttribute(Float32Array.from(values), 1));
    return g;
};

/**
 * Patch `material` in place. `uniforms` (shared { value } objects, must include uLevel) are added to the shader;
 * `declarations` is GLSL placed before main() and `fragment` runs right after the base colour is set (diffuseColor).
 * `key` must be unique per patch, so three.js doesn't reuse another material's program.
 */
export const makeSwitchable = (material, { key, uniforms, declarations = '', fragment }) => {
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = `attribute float aSwitch;\nuniform float uLevel;\nvarying float vOn;\nvarying vec2 vLocal;\n${shader.vertexShader}`
            .replace('#include <begin_vertex>', `#include <begin_vertex>\nvOn = smoothstep(aSwitch, aSwitch + ${FADE.toFixed(3)}, uLevel);\nvLocal = uv - 0.5;`);
        shader.fragmentShader = `varying float vOn;\nvarying vec2 vLocal;\n${declarations}\n${shader.fragmentShader}`
            .replace('#include <color_fragment>', `#include <color_fragment>\n${fragment}`);
    };
    material.customProgramCacheKey = () => key;
    return material;
};
