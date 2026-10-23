import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CABIN, clampLook, DRIVER_SEAT, PASSENGER, passengerView, SEAT, toWorld } from './passenger.js';
import { VEHICLE_TYPES } from './vehicles.js';

const EPS = 1e-9;
const toLocal = (pose, p) => {
    const [c, s] = [Math.cos(pose.rotationY), Math.sin(pose.rotationY)];
    const [dx, dz] = [p.x - pose.x, p.z - pose.z];
    return { x: dx * c - dz * s, y: p.y, z: dx * s + dz * c };
};

test('your eyes are inside the taxi cabin, on the right-hand front seat, whichever way the taxi faces', () => {
    const taxi = VEHICLE_TYPES.taxi;
    for (const rotationY of [0, 0.7, Math.PI / 2, Math.PI, -2.1]) {
        const pose = { x: 12, z: -7, rotationY };
        for (const bob of [-1, 0, 1]) {
            const { eye } = passengerView(pose, { yaw: 0, pitch: 0 }, bob);
            const local = toLocal(pose, eye);
            assert.ok(Math.abs(local.x - SEAT.x) < EPS && Math.abs(local.z - SEAT.z) < EPS, 'same seat in every heading');
            assert.ok(Math.abs(local.x) < CABIN.halfWidth - PASSENGER.near && local.z > CABIN.back && local.z < CABIN.front - PASSENGER.near);
            assert.ok(local.y > CABIN.floor && local.y < CABIN.roof - PASSENGER.near, 'below the roof lining, above the floor');
            assert.ok(local.z + taxi.length / 2 > 0 && local.z < taxi.length / 2);
        }
    }
    // Facing +z, the right-hand side is −x: you sit right, the driver left (driving on the right).
    assert.ok(SEAT.x < 0 && DRIVER_SEAT.x > 0);
    assert.deepEqual(toWorld({ x: 0, z: 0, rotationY: 0 }, { x: 1, y: 2, z: 3 }), { x: 1, y: 2, z: 3 });
});

test('you look ahead out of the windscreen, and can turn your head only so far', () => {
    const pose = { x: 0, z: 0, rotationY: Math.PI / 2 }; // facing +x
    const { eye, target } = passengerView(pose);
    assert.ok(target.x - eye.x > 0.99 && Math.abs(target.z - eye.z) < EPS && Math.abs(target.y - eye.y) < EPS);
    const left = passengerView(pose, { yaw: 0.5, pitch: 0 });
    assert.ok(left.target.z - left.eye.z < 0, 'yaw > 0 turns left (facing +x, left is −z)');
    assert.deepEqual(clampLook({ yaw: 9, pitch: -9 }), { yaw: PASSENGER.yaw, pitch: -PASSENGER.down });
    assert.deepEqual(clampLook({ yaw: -9, pitch: 9 }), { yaw: -PASSENGER.yaw, pitch: PASSENGER.up });
});
