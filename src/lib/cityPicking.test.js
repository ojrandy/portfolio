import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rayBox, raySphere, pickVehicle, pickAnimal, pickPole, PICK } from './cityPicking.js';
import { VEHICLE_TYPES } from './vehicles.js';

const down = (x, z) => ({ origin: { x, y: 10, z }, direction: { x: 0, y: -1, z: 0 } });
const level = (from, to, y = 0.2) => {
    const len = Math.hypot(to.x - from.x, to.z - from.z);
    return { origin: { x: from.x, y, z: from.z }, direction: { x: (to.x - from.x) / len, y: 0, z: (to.z - from.z) / len } };
};

// A vehicle parked on a straight lane along +x (rotationY π/2), centre (5, 0).
const parked = (id, type, x) => {
    const kit = VEHICLE_TYPES[type];
    const seg = { points: [{ x: 0, z: 0 }, { x: 100, z: 0 }], cum: [0, 100] };
    return { id, type, seg, s: x, length: kit.length, width: kit.width, scale: 1 };
};

test('rayBox: hits a turned box from above and from the side, misses beside it', () => {
    const box = { x: 5, z: 0, rotationY: Math.PI / 2, hw: 0.3, hl: 1, y1: 0.5 };
    assert.ok(Math.abs(rayBox(down(5.9, 0), box) - 9.5) < 1e-9); // along its length (x), inside
    assert.equal(rayBox(down(5, 0.4), box), null); // across (z), outside
    assert.ok(Math.abs(rayBox(level({ x: 0, z: 0 }, { x: 10, z: 0 }), box) - 4) < 1e-9);
    assert.equal(rayBox(level({ x: 0, z: 0 }, { x: 10, z: 0 }, 0.8), box), null); // over the roof
    assert.equal(rayBox(level({ x: 10, z: 0 }, { x: 20, z: 0 }), box), null); // behind the ray
});

test('raySphere: hit distance, miss, and from inside', () => {
    assert.ok(Math.abs(raySphere(down(0, 0), { x: 0, y: 1, z: 0 }, 0.5) - 8.5) < 1e-9);
    assert.equal(raySphere(down(0.6, 0), { x: 0, y: 1, z: 0 }, 0.5), null);
    assert.equal(raySphere({ origin: { x: 0, y: 1, z: 0 }, direction: { x: 1, y: 0, z: 0 } }, { x: 0, y: 1, z: 0 }, 0.5), 0);
});

test('pickVehicle: the nearest one in line, motos are wide enough to click, faded ones are skipped', () => {
    const near = parked(1, 'sedan', 5);
    const far = parked(2, 'bus', 9);
    const ray = level({ x: 0, z: 0 }, { x: 10, z: 0 });
    assert.equal(pickVehicle([far, near], ray).item, near);
    assert.equal(pickVehicle([far, { ...near, scale: 0.2 }], ray).item.id, 2);
    const moto = parked(3, 'moto', 5);
    assert.equal(pickVehicle([moto], down(5, PICK.minHalf - 0.02)).item, moto);
    assert.equal(pickVehicle([moto], down(5, PICK.minHalf + 0.05)), null);
});

test('pickAnimal and pickPole', () => {
    const goat = { kind: 'goat', x: 2, z: 2, scale: 1 };
    const hen = { kind: 'chicken', x: 2.1, z: 2, scale: 1 };
    assert.equal(pickAnimal([hen, goat], down(2, 2)).item, goat); // the goat is taller, hit first from above
    assert.equal(pickAnimal([{ ...hen, scale: 0 }], down(2.1, 2)), null);
    const poles = [{ x: 0, z: 0 }, { x: 3, z: 0 }];
    assert.equal(pickPole(poles, level({ x: -5, z: 0 }, { x: 5, z: 0 }, 1)).item, poles[0]);
    assert.equal(pickPole(poles, down(3, 0.15)).item, poles[1]);
    assert.equal(pickPole(poles, down(1.5, 0)), null);
});
