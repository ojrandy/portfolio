// /?city&perf only: records frame times, renderer counts and quality changes on window.__cityPerf for `npm run perf`.
// screenOf(name): CSS-pixel position of a named object, so browser checks can click it (e.g. the Pitch ball).
// crowd(): where every vehicle and person is (P3B-10: the reduced-motion run checks nobody moves).
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { vehiclePose } from '../lib/traffic.js';
import { personPose } from '../lib/pedestrians.js';

const MAX_FRAMES = 3000;

const PerfProbe = ({ quality, streets }) => {
    const gl = useThree((s) => s.gl);
    const get = useThree((s) => s.get);

    useEffect(() => {
        const perf = { frames: [], changes: [], last: 0, calls: 0, triangles: 0, dpr: 0, reset() { this.frames = []; this.changes = []; } };
        perf.screenOf = (name) => {
            const { scene, camera, size } = get();
            const object = scene.getObjectByName(name);
            if (!object) return null;
            const v = object.getWorldPosition(new THREE.Vector3()).project(camera);
            const rect = gl.domElement.getBoundingClientRect();
            return { x: rect.left + ((v.x + 1) * size.width) / 2, y: rect.top + ((1 - v.y) * size.height) / 2 };
        };
        perf.crowd = () => {
            const at = ({ x, z }) => [Number(x.toFixed(3)), Number(z.toFixed(3))];
            return {
                vehicles: (streets?.traffic?.vehicles ?? []).map((v) => [v.id, ...at(vehiclePose(v))]),
                people: (streets?.people ?? []).map((p) => [p.id, ...at(personPose(p))]),
            };
        };
        window.__cityPerf = perf;
        return () => { delete window.__cityPerf; };
    }, [get, gl, streets]);

    useEffect(() => {
        window.__cityPerf?.changes.push({ at: Math.round(performance.now()), quality });
    }, [quality]);

    useFrame(() => {
        const perf = window.__cityPerf;
        if (!perf) return;
        const now = performance.now();
        if (perf.last && perf.frames.length < MAX_FRAMES) perf.frames.push(now - perf.last);
        perf.last = now;
        perf.calls = gl.info.render.calls;
        perf.triangles = gl.info.render.triangles;
        perf.dpr = gl.getPixelRatio();
        perf.quality = quality;
    });

    return null;
};

export default PerfProbe;
