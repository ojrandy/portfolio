// Dev-only preview of the city (open /?city with `npm run dev:all`).
import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import Buildings from './Buildings.jsx';
import CityLayout from './CityLayout.jsx';
import Backdrop from './Backdrop.jsx';
import CameraRig from './CameraRig.jsx';
import useCityData from '../hooks/useCityData.js';
import { toBuildings } from '../lib/buildings.js';
import { layoutCity, DISTRICT_PLOTS } from '../lib/layout.js';
import { COLORS } from '../lib/palette.js';
import { CAMERA } from '../lib/camera.js';
import useCityStore from '../store/useCityStore.js';

const FALLBACK_BOUNDS = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };

const round = (v) => v.toArray().map((n) => n.toFixed(1)).join(', ');

const Stats = ({ onChange }) => {
    const frame = useRef(0);
    useFrame(({ gl, camera }) => {
        if (frame.current++ % 10 === 0) onChange({ calls: gl.info.render.calls, camera: round(camera.position) });
    });
    return null;
};

const CityPreview = () => {
    const { status, data, fetchedAt, error } = useCityData();
    const [stats, setStats] = useState({ calls: 0, camera: '' });
    const viewport = useRef(null);
    const focus = useCityStore((s) => s.focus);

    const layout = useMemo(
        () => (data ? layoutCity(toBuildings(data.projects, { now: fetchedAt })) : null),
        [data, fetchedAt],
    );
    const bounds = layout?.bounds ?? FALLBACK_BOUNDS;
    const focusName = focus && data?.projects.find((p) => p.slug === focus)?.name;

    return (
        <div className="fixed inset-0 bg-basalt">
            <div
                ref={viewport}
                tabIndex={0}
                role="application"
                aria-roledescription="3D city"
                aria-label="OJ City. Tab visits each building, arrow keys or WASD move, Q and E rotate, plus and minus zoom, Escape returns to the start."
                className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-window"
            >
                <Canvas dpr={[1, 1.5]} shadows camera={{ position: [0, 24, 78], fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far }}>
                    <ambientLight intensity={0.6} color={COLORS.mist} />
                    <directionalLight position={[15, 25, 10]} intensity={1.4} castShadow
                        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
                        shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} shadow-camera-far={100} />
                    <Backdrop bounds={bounds} />
                    {layout && (
                        <>
                            <CityLayout layout={layout} />
                            <Buildings placed={layout.lots} />
                            <CameraRig layout={layout} keyTarget={viewport} />
                        </>
                    )}
                    <Stats onChange={setStats} />
                </Canvas>
            </div>
            <p className="sr-only" aria-live="polite">{focusName ?? 'Start view, looking up Career Road towards Fako'}</p>

            <div className="pointer-events-none absolute left-4 top-4 rounded bg-black/60 px-3 py-2 font-mono text-xs text-mist">
                <p>City preview (dev only)</p>
                {status === 'loading' && <p>Loading /api/city…</p>}
                {status === 'error' && <p className="text-ember">/api/city failed: {error.message}. Is `npm run dev:server` running?</p>}
                {status === 'ready' && (
                    <>
                        <p>{layout.lots.length} buildings · {layout.parks.length} parks · {layout.tier}×{layout.tier} blocks · {stats.calls} draw calls</p>
                        <p className="flex flex-wrap gap-x-3">
                            {Object.entries(DISTRICT_PLOTS).map(([id, d]) => (
                                <span key={id}><span style={{ color: d.color }}>■</span> {id}</span>
                            ))}
                        </p>
                        <p>stats: {data.statsUpdatedAt ?? 'no GitHub data yet'}</p>
                        <p>focus: {focusName ?? 'start view'} · camera {stats.camera}</p>
                        <p className="text-mist/70">click the city, then Tab / ⇧Tab buildings · WASD/arrows move · Q/E rotate · +/− zoom · Esc home</p>
                    </>
                )}
            </div>
        </div>
    );
};

export default CityPreview;
