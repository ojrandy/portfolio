// Dev-only city preview: the real city plus a HUD (draw calls, camera, data). Open /?city with `npm run dev:all`.
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import CityExperience from './CityExperience.jsx';
import { DISTRICT_PLOTS } from '../lib/layout.js';

const round = (v) => v.toArray().map((n) => n.toFixed(1)).join(', ');

const Stats = ({ onChange }) => {
    const frame = useRef(0);
    useFrame(({ gl, camera }) => {
        if (frame.current++ % 10 === 0) onChange({ calls: gl.info.render.calls, camera: round(camera.position) });
    });
    return null;
};

const CityPreview = () => {
    const [stats, setStats] = useState({ calls: 0, camera: '' });

    const debug = ({ status, error, data, layout, focusName }) => ({
        scene: <Stats onChange={setStats} />,
        overlay: (
            <div className="pointer-events-none absolute left-4 top-4 z-10 rounded bg-black/60 px-3 py-2 font-mono text-xs text-mist">
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
                        <p className="text-mist/70">hover / click buildings · Tab / ⇧Tab + Enter · WASD/arrows move · Q/E rotate · +/− zoom · Esc</p>
                    </>
                )}
            </div>
        ),
    });

    return <CityExperience debug={debug} />;
};

export default CityPreview;
