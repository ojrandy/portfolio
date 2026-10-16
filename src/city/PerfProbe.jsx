// /?city&perf only: records frame times, renderer counts and quality changes on window.__cityPerf for `npm run perf`.
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

const MAX_FRAMES = 3000;

const PerfProbe = ({ quality }) => {
    const gl = useThree((s) => s.gl);

    useEffect(() => {
        const perf = { frames: [], changes: [], last: 0, calls: 0, triangles: 0, dpr: 0, reset() { this.frames = []; this.changes = []; } };
        window.__cityPerf = perf;
        return () => { delete window.__cityPerf; };
    }, []);

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
