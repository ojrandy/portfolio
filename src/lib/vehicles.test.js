import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY, partBounds, pickVariant, POLICE_BLUE, TAXI_YELLOW, VEHICLE_IDS, VEHICLE_TYPES } from './vehicles.js';
import { buildVehicleGeometry } from '../city/vehicleGeometry.js';
import { STREET } from './layout.js';

const EPS = 1e-9;
const STREET_LANE = STREET / 2;
const HEX = /^#[0-9A-F]{6}$/i;

test('the kit has the eleven planned types', () => {
    assert.deepEqual(VEHICLE_IDS.sort(), [
        'ambulance', 'bananaTruck', 'bus', 'minibus', 'moto', 'pickup', 'police', 'sedan', 'suv', 'taxi', 'timberTruck',
    ]);
});

test('every type fits a street lane and stays short enough to turn', () => {
    for (const type of Object.values(VEHICLE_TYPES)) {
        assert.ok(type.width <= STREET_LANE - 0.4, `${type.id} is ${type.width} wide`);
        assert.ok(type.length <= STREET, `${type.id} is ${type.length} long`);
        assert.ok(type.height > 0.3 && type.height < 1, `${type.id} is ${type.height} tall`);
        assert.ok(Math.abs(type.front + type.back) < 0.1, `${type.id} is centred on its middle`);
    }
});

test('parts are valid, above the ground, and wheels touch it', () => {
    for (const type of Object.values(VEHICLE_TYPES)) {
        assert.ok(type.parts.filter((p) => p.role === 'wheel').length >= 2, type.id);
        for (const part of type.parts) {
            const { min, max } = partBounds(part);
            min.forEach((v, i) => assert.ok(max[i] > v, `${type.id}: empty part`));
            assert.ok(min[1] >= -EPS, `${type.id}: part below the ground`);
            if (part.role === 'wheel') assert.ok(Math.abs(min[1]) < EPS, `${type.id}: wheel off the ground`);
            assert.ok(part.color === BODY || HEX.test(part.color), `${type.id}: colour ${part.color}`);
        }
        assert.ok(type.parts.some((p) => p.color === BODY), `${type.id} has a body to tint`);
    }
});

test('head lights at the front and tail lights at the back of every type', () => {
    for (const type of Object.values(VEHICLE_TYPES)) {
        const { head, tail } = type.lights;
        assert.ok(head.length > 0 && tail.length > 0, type.id);
        for (const p of head) assert.ok(p[2] > type.front - 0.05, `${type.id}: head light not at the front`);
        for (const p of tail) assert.ok(p[2] < type.back + 0.05, `${type.id}: tail light not at the back`);
        assert.ok(Math.abs(head.reduce((s, p) => s + p[0], 0)) < EPS, `${type.id}: head lights not symmetric`);
    }
});

test('variants are hex colours and picked deterministically', () => {
    for (const type of Object.values(VEHICLE_TYPES)) {
        assert.ok(type.variants.length > 0 && type.variants.every((c) => HEX.test(c)), type.id);
        for (let seed = 0; seed < 20; seed++) {
            const c = pickVariant(type.id, seed);
            assert.ok(type.variants.includes(c));
            assert.equal(pickVariant(type.id, seed), c);
        }
    }
    const sedans = new Set(Array.from({ length: 60 }, (_, i) => pickVariant('sedan', i)));
    assert.ok(sedans.size >= 5, 'sedans come in several colours');
    assert.deepEqual(VEHICLE_TYPES.taxi.variants, [TAXI_YELLOW]);
    assert.deepEqual(VEHICLE_TYPES.police.variants, [POLICE_BLUE]);
    assert.equal(VEHICLE_TYPES.police.parts.filter((p) => p.decal === 'police').length, 1, 'one lettered stripe');
});

test('merged geometries are light and carry the tint and decal attributes', () => {
    for (const id of VEHICLE_IDS) {
        const g = buildVehicleGeometry(id);
        const triangles = g.attributes.position.count / 3;
        assert.ok(triangles <= 600, `${id}: ${triangles} triangles`);
        for (const name of ['normal', 'uv', 'color', 'aTint']) assert.ok(g.attributes[name], `${id}: ${name}`);
        const tint = g.attributes.aTint.array;
        assert.ok(tint.some((v) => v === 1) && tint.some((v) => v === 0), `${id}: body and fixed parts`);
        g.dispose();
    }
});
