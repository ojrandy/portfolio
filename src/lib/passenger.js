// Passenger view (P3B-06, owner 2026-10-22): on a taxi ride you sit in the front passenger seat and look out through
// the windscreen. Cameroon drives on the right, so the driver sits on the left and you on the right. Pure maths, no
// three.js; CameraRig puts the camera here every frame and TaxiCabin draws the inside of the car around it.
// Vehicle frame (vehicles.js): facing +z, y up; facing +z, a vehicle's right-hand side is −x.
// The saloon model is toy-scaled (its glass is only 0.14 tall next to 0.47-tall people), so on a ride its shell is
// hidden and TaxiCabin draws a roomier cabin around you: doors at x ±0.245, the floor/hood line at 0.26, the roof
// lining at 0.5, the windscreen at z 0.19.
export const SEAT = { x: -0.1, y: 0.38, z: -0.06 }; // your eyes, at the driver's head height
export const DRIVER_SEAT = { x: 0.1, z: -0.07 };
export const CABIN = { halfWidth: 0.245, floor: 0.26, roof: 0.5, back: -0.29, front: 0.19 };
// Wider than the city camera (cars feel cramped at 45°), a near plane that fits inside the car, and how far you can
// turn your head (rad): `yaw` either way, `up` / `down`; with nothing held, the head turns back over `settle` s.
export const PASSENGER = { fov: 70, near: 0.01, yaw: 1.6, up: 0.3, down: 0.45, settle: 1.5, bob: 0.0025 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Keep a head turn ({ yaw, pitch }) within what a seated passenger can do. */
export const clampLook = ({ yaw, pitch }) => ({ yaw: clamp(yaw, -PASSENGER.yaw, PASSENGER.yaw), pitch: clamp(pitch, -PASSENGER.down, PASSENGER.up) });

/** A point in the vehicle's frame → the world, for a vehicle at `pose` ({ x, z, rotationY }). */
export const toWorld = (pose, { x, y = 0, z }) => {
    const [c, s] = [Math.cos(pose.rotationY), Math.sin(pose.rotationY)];
    return { x: pose.x + x * c + z * s, y, z: pose.z - x * s + z * c };
};

/**
 * Where your eyes are and a point to look at, for a taxi at `pose`, a head turn `look` ({ yaw, pitch }; yaw > 0 turns
 * left) and a little up-and-down `bob` (from the road, −1…1). `seat` = where your eyes are (drive mode: the driver's).
 */
export const passengerView = (pose, look = { yaw: 0, pitch: 0 }, bob = 0, seat = SEAT) => {
    const eye = toWorld(pose, { ...seat, y: seat.y + bob * PASSENGER.bob });
    const { yaw, pitch } = clampLook(look);
    const heading = pose.rotationY + yaw;
    const target = {
        x: eye.x + Math.sin(heading) * Math.cos(pitch),
        y: eye.y + Math.sin(pitch),
        z: eye.z + Math.cos(heading) * Math.cos(pitch),
    };
    return { eye, target };
};
