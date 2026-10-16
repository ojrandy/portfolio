// The 3D city (Explorer mode): canvas, camera, buildings, loader, project panel and list.
// Lazy-loaded on /?city (unlinked, noindex) until P5-02 makes it the homepage. The dev HUD plugs in through `debug`.
import { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import Buildings from './Buildings.jsx';
import BuildingLabel from './BuildingLabel.jsx';
import CityLayout from './CityLayout.jsx';
import Backdrop from './Backdrop.jsx';
import CameraRig from './CameraRig.jsx';
import FirstFrame from './FirstFrame.jsx';
import PerfProbe from './PerfProbe.jsx';
import Sun from './Sun.jsx';
import DayNight from './DayNight.jsx';
import { createLighting } from './liveLighting.js';
import useBuea from '../hooks/useBuea.js';
import useDeviceTier from '../hooks/useDeviceTier.js';
import { LEVELS, QUALITY, stepQuality } from '../lib/quality.js';
import ProjectPanel from '../components/ProjectPanel.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import CityProjectList from '../components/CityProjectList.jsx';
import useCityData from '../hooks/useCityData.js';
import { toBuildings } from '../lib/buildings.js';
import { layoutCity } from '../lib/layout.js';
import { CAMERA } from '../lib/camera.js';
import useCityStore from '../store/useCityStore.js';

const FALLBACK_BOUNDS = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };
const params = new URLSearchParams(window.location.search);
const PERF = params.has('perf');
// Perf runs only: ?perf&quality=low|medium|high pins the level and turns the monitor off.
const PINNED = PERF && LEVELS.includes(params.get('quality')) ? params.get('quality') : null;

const hasWebGL = () => {
    try {
        const canvas = document.createElement('canvas');
        return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
        return false;
    }
};

/**
 * @param {{ debug?: (state: { status, error, data, layout, focusName }) => { scene?: React.ReactNode, overlay?: React.ReactNode, at?: number | null } }} props
 *   debug.at: a fixed time (epoch ms) for the dev time-of-day preview.
 */
const CityExperience = ({ debug }) => {
    const { status, data, fetchedAt, error, retry } = useCityData();
    const [webgl] = useState(hasWebGL);
    const [drawn, setDrawn] = useState(false);
    const tier = useDeviceTier();
    const [quality, setQuality] = useState(PINNED ?? tier);
    const viewport = useRef(null);
    const [lighting] = useState(createLighting);
    const { offsetMs } = useBuea();
    const focus = useCityStore((s) => s.focus);
    const hovered = useCityStore((s) => s.hovered);
    const openSlug = useCityStore((s) => s.openSlug);
    const { setHovered, openProject, closeProject } = useCityStore.getState();

    const layout = useMemo(
        () => (data ? layoutCity(toBuildings(data.projects, { now: fetchedAt })) : null),
        [data, fetchedAt],
    );
    const projects = useMemo(() => new Map((data?.projects ?? []).map((p) => [p.slug, p])), [data]);
    const lots = useMemo(() => new Map((layout?.lots ?? []).map((l) => [l.slug, l])), [layout]);
    const highlighted = useMemo(() => [...new Set([hovered, focus].filter(Boolean))], [hovered, focus]);

    const bounds = layout?.bounds ?? FALLBACK_BOUNDS;
    const labelSlug = hovered ?? focus;
    const focusName = projects.get(focus)?.name;
    const openProjectData = projects.get(openSlug);
    const extra = debug?.({ status, error, data, layout, focusName }) ?? {};

    return (
        <div className="fixed inset-0 bg-basalt">
            <meta name="robots" content="noindex" />
            <div
                ref={viewport}
                tabIndex={0}
                role="application"
                aria-roledescription="3D city"
                aria-label="OJ City. Tab visits each building and Enter opens it. Arrow keys or WASD move, Q and E rotate, plus and minus zoom, Escape returns to the start."
                className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-window"
                style={{ cursor: hovered ? 'pointer' : undefined }}
                aria-busy={!drawn}
            >
                {webgl && <Canvas dpr={[1, QUALITY[quality].dpr]} shadows camera={{ position: [0, 24, 78], fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far }}>
                    {/* Safety net only: step down after ~5 s mostly under 40 fps, never back up. Each change resizes
                        the canvas and redraws the shadow map, so switching back and forth costs more than it saves.
                        Mounted after the first draw, so loading hitches don't read as a slow device. */}
                    {drawn && !PINNED && (
                        <PerformanceMonitor
                            ms={500}
                            iterations={10}
                            bounds={() => [40, Infinity]}
                            onDecline={() => setQuality((q) => stepQuality(q, -1))}
                        />
                    )}
                    <DayNight lighting={lighting} offsetMs={offsetMs} at={extra.at} />
                    <Sun shadowMap={QUALITY[quality].shadowMap} lighting={lighting} version={layout} />
                    <Backdrop bounds={bounds} lighting={lighting} />
                    {layout && (
                        <>
                            <CityLayout layout={layout} />
                            <Buildings placed={layout.lots} highlighted={highlighted} onHover={setHovered} onSelect={openProject} />
                            {lots.get(labelSlug) && projects.get(labelSlug) && (
                                <BuildingLabel lot={lots.get(labelSlug)} project={projects.get(labelSlug)} />
                            )}
                            <CameraRig layout={layout} keyTarget={viewport} />
                            {!drawn && <FirstFrame onDrawn={() => setDrawn(true)} />}
                        </>
                    )}
                    {PERF && <PerfProbe quality={quality} />}
                    {extra.scene}
                </Canvas>}
            </div>
            <LoadingScreen code data={status} frame={drawn} webgl={webgl} lots={layout?.lots} onRetry={retry} />
            <p className="sr-only" aria-live="polite">
                {focusName ? `${focusName}. Press Enter to open.` : 'Start view, looking up Career Road towards Fako'}
            </p>

            {data && <CityProjectList projects={data.projects} />}
            {openProjectData && <ProjectPanel key={openSlug} project={openProjectData} onClose={closeProject} />}
            {extra.overlay}
        </div>
    );
};

export default CityExperience;
