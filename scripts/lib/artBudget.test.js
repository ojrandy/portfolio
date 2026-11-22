import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Document } from '@gltf-transform/core';
import { ART_BUDGET, REQUIRED_ATTRIBUTES, checkKit, summarizeKit } from './artBudget.js';

const piece = (name, triangles, attributes = REQUIRED_ATTRIBUTES) => ({ name, triangles, attributes });
const goodKit = () => ({ pieces: [piece('floor_mid_plain_w3', 1200), piece('floor_mid_plain_w3_LOD1', 120)], bytes: 40_000 });

test('a kit within budget passes', () => {
    assert.deepEqual(checkKit(goodKit()), []);
});

test('triangle budgets differ for LOD0 and LOD1', () => {
    const kit = { pieces: [piece('roof_flat_w2', ART_BUDGET.lod0Triangles + 1), piece('roof_flat_w2_LOD1', ART_BUDGET.lod1Triangles + 1)], bytes: 1 };
    const problems = checkKit(kit);
    assert.equal(problems.length, 2);
    assert.match(problems[0], /roof_flat_w2: 1501 triangles, budget 1500/);
    assert.match(problems[1], /roof_flat_w2_LOD1: 301 triangles, budget 300/);
});

test('file size, missing attributes, missing LODs and bad names fail', () => {
    assert.match(checkKit({ ...goodKit(), bytes: ART_BUDGET.kitBytes + 1 })[0], /kit file is 600\.0 KB, budget 600 KB/);
    assert.match(checkKit({ pieces: [piece('a', 10, ['POSITION', 'NORMAL']), piece('a_LOD1', 5)], bytes: 1 })[0], /a: missing COLOR_0, _TINT, _AO/);
    assert.match(checkKit({ pieces: [piece('lonely', 10)], bytes: 1 })[0], /lonely: no "lonely_LOD1"/);
    assert.match(checkKit({ pieces: [piece('orphan_LOD1', 10)], bytes: 1 })[0], /orphan_LOD1: no LOD0 piece "orphan"/);
    assert.ok(checkKit({ pieces: [piece('Bad-Name', 10), piece('Bad-Name_LOD1', 5)], bytes: 1 }).some((p) => /lower_snake_case/.test(p)));
    assert.deepEqual(checkKit({ pieces: [], bytes: 1 }), ['the kit has no pieces']);
});

test('summarizeKit counts indexed and non-indexed triangles and lists the attributes every primitive has', () => {
    const doc = new Document();
    const buffer = doc.createBuffer();
    const acc = (type, n, size) => doc.createAccessor().setType(type).setArray(new Float32Array(n * size)).setBuffer(buffer);
    const prim = (attrs, indices) => {
        const p = doc.createPrimitive();
        for (const [name, type, size] of attrs) p.setAttribute(name, acc(type, 6, size));
        if (indices) p.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(indices)).setBuffer(buffer));
        return p;
    };
    const full = [['POSITION', 'VEC3', 3], ['NORMAL', 'VEC3', 3], ['COLOR_0', 'VEC4', 4], ['_TINT', 'SCALAR', 1], ['_AO', 'SCALAR', 1]];
    const scene = doc.createScene();
    scene.addChild(doc.createNode('b_piece').setMesh(doc.createMesh().addPrimitive(prim(full, [0, 1, 2, 3, 4, 5, 0, 2, 4]))));
    scene.addChild(doc.createNode('a_piece').setMesh(doc.createMesh().addPrimitive(prim(full)).addPrimitive(prim(full.slice(0, 2)))));
    scene.addChild(doc.createNode('empty'));

    assert.deepEqual(summarizeKit(doc), [
        { name: 'a_piece', triangles: 4, attributes: ['POSITION', 'NORMAL'] },
        { name: 'b_piece', triangles: 3, attributes: REQUIRED_ATTRIBUTES },
    ]);
});
