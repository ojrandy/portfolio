// Dev-only city preview: the real city plus a HUD (draw calls, camera, data, a time-of-day slider).
// Open /?city with `npm run dev:all`.
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import CityExperience from './CityExperience.jsx';
import { DISTRICT_PLOTS } from '../lib/layout.js';
import { bueaClock, bueaTimeToday, cityLightsAt, parsePreviewOverride, sunState } from '../lib/dayNight.js';

const round = (v) => v.toArray().map((n) => n.toFixed(1)).join(', ');

const Stats = ({ onChange }) => {
    const frame = useRef(0);
    useFrame(({ gl, camera }) => {
        if (frame.current++ % 10 === 0) onChange({ calls: gl.info.render.calls, camera: round(camera.position), now: Date.now() });
    });
    return null;
};

const CityPreview = () => {
    const override = parsePreviewOverride(new URLSearchParams(window.location.search));
    const [stats, setStats] = useState(() => ({ calls: 0, camera: '', now: Date.now() }));
    const [minutes, setMinutes] = useState(override.minutes ?? null); // null = live Buea time
    const weatherOverride = override.weather
        ? { kind: override.weather, label: override.weather === 'thunderstorm' ? 'storm' : override.weather }
        : null;
    const at = minutes == null ? null : bueaTimeToday(minutes, stats.now);
    const sun = sunState(at ?? stats.now);
    const lights = cityLightsAt(sun);

    const debug = ({ status, error, data, layout, focusName }) => ({
        scene: <Stats onChange={setStats} />,
        at,
        weather: weatherOverride,
        overlay: (
            <div className="pointer-events-none absolute left-4 top-16 z-10 rounded bg-black/60 px-3 py-2 font-mono text-xs text-mist">
                <p>City preview (dev only)</p>
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
                        <p>
                            Buea {bueaClock(at ?? stats.now)} · {sun.phase} · sun {sun.elevation.toFixed(1)}° · windows {Math.round(lights.windows * 100)} % · lamps {Math.round(lights.lamps * 100)} % · {minutes == null ? 'live' : 'preview'}
                        </p>
                        <p className="pointer-events-auto flex items-center gap-2">
                            <input type="range" min={0} max={1435} step={5} aria-label="Preview time of day"
                                value={minutes ?? 0} onChange={(e) => setMinutes(Number(e.target.value))} className="w-48" />
                            <button type="button" className="underline" onClick={() => setMinutes(null)}>live</button>
                        </p>
                        <p className="text-mist/70">hover / click buildings · Tab / ⇧Tab + Enter · WASD/arrows move · Q/E rotate · +/− zoom · Esc</p>
                    </>
                )}
            </div>
        ),
    });

    return <CityExperience debug={debug} />;
};

export default CityPreview;
