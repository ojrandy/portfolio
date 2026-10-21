// The 3D city (Explorer mode): canvas, camera, buildings, loader, project panel and list.
// Lazy-loaded on /?city (unlinked, noindex) until P5-02 makes it the homepage. The dev HUD plugs in through `debug`.
import { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import Buildings from './Buildings.jsx';
import BuildingLabel from './BuildingLabel.jsx';
import CityLayout from './CityLayout.jsx';
import Lamps from './Lamps.jsx';
import Backdrop from './Backdrop.jsx';
import Rain from './Rain.jsx';
import CameraRig from './CameraRig.jsx';
import FirstFrame from './FirstFrame.jsx';
import PerfProbe from './PerfProbe.jsx';
import Sun from './Sun.jsx';
import DayNight from './DayNight.jsx';
import CinemaPlot, { CinemaModal } from './CinemaPlot.jsx';
import ArcadePlot from './ArcadePlot.jsx';
import SchoolPlot from './SchoolPlot.jsx';
import PitchPlot from './PitchPlot.jsx';
import CareerRoad from './CareerRoad.jsx';
import AboutHouse from './AboutHouse.jsx';
import Traffic from './Traffic.jsx';
import { createLighting } from './liveLighting.js';
import useBuea from '../hooks/useBuea.js';
import useEasterEggs from '../hooks/useEasterEggs.js';
import useDeviceTier, { deviceInfo } from '../hooks/useDeviceTier.js';
import { LEVELS, QUALITY, stepQuality } from '../lib/quality.js';
import ProjectPanel from '../components/ProjectPanel.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import StatusLine from '../components/StatusLine.jsx';
import CityProjectList from '../components/CityProjectList.jsx';
import ArcadeHub from '../components/ArcadeHub.jsx';
import SchoolPanel from '../components/SchoolPanel.jsx';
import ContactPanel from '../components/ContactPanel.jsx';
import CareerPanel from '../components/CareerPanel.jsx';
import AboutPanel from '../components/AboutPanel.jsx';
import EggToast from '../components/EggToast.jsx';
import useCityData from '../hooks/useCityData.js';
import { toBuildings } from '../lib/buildings.js';
import { layoutCity } from '../lib/layout.js';
import { CAMERA } from '../lib/camera.js';
import { weatherFx } from '../lib/weatherFx.js';
import { xrayLayers as layersForXRay } from '../lib/projectSummary.js';
import { cinemaReel } from '../lib/cinemaReel.js';
import { schoolContent } from '../lib/schoolContent.js';
import { contactLinks } from '../lib/contactLinks.js';
import { careerRoles } from '../lib/careerRoad.js';
import { aboutContent } from '../lib/aboutContent.js';
import useCityStore from '../store/useCityStore.js';
import useArcadeStore from '../store/useArcadeStore.js';
import profile from '../../content/profile.json';

const FALLBACK_BOUNDS = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };
const params = new URLSearchParams(window.location.search);
const PERF = params.has('perf');
// Perf runs only: ?perf&quality=low|medium|high pins the level and turns the monitor off.
const PINNED = PERF && LEVELS.includes(params.get('quality')) ? params.get('quality') : null;
const CINEMA_REEL = cinemaReel(profile);
const SCHOOL = schoolContent(profile);
const CONTACT = contactLinks(profile);
const CAREER = careerRoles(profile);
const ABOUT = aboutContent(profile);
// Districts whose own scene replaces the placeholder block: Cinema (with a reel or channel), the Arcade (P3-09) and
// the School (P3-10, with teaching content) and the Pitch (P3-11).
const BUILT_DISTRICTS = [CINEMA_REEL && 'cinema', 'arcade', SCHOOL && 'school', 'pitch'].filter(Boolean);
const GAMING = profile.hobbies?.find((hobby) => hobby.name === 'Gaming')?.text;

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
    const [cinemaOpen, setCinemaOpen] = useState(false);
    const [cinemaHovered, setCinemaHovered] = useState(false);
    const [arcadeHovered, setArcadeHovered] = useState(false);
    const [schoolOpen, setSchoolOpen] = useState(false);
    const [schoolHovered, setSchoolHovered] = useState(false);
    const [contact, setContact] = useState(null); // { scored } while the contact panel is open
    const [pitchHovered, setPitchHovered] = useState(false);
    const [careerOpen, setCareerOpen] = useState(null); // index of the sign that opened the career panel
    const [careerHovered, setCareerHovered] = useState(false);
    const [aboutOpen, setAboutOpen] = useState(false);
    const [aboutHovered, setAboutHovered] = useState(false);
    const hubOpen = useArcadeStore((s) => s.hubOpen);
    const tier = useDeviceTier();
    const [touch] = useState(() => deviceInfo().touch);
    const [quality, setQuality] = useState(PINNED ?? tier);
    const viewport = useRef(null);
    const [lighting] = useState(createLighting);
    const { data: buea, offsetMs } = useBuea();
    useEasterEggs({ active: drawn, offsetMs });
    const focus = useCityStore((s) => s.focus);
    const hovered = useCityStore((s) => s.hovered);
    const openSlug = useCityStore((s) => s.openSlug);
    const xraySlug = useCityStore((s) => s.xraySlug);
    const { setHovered, openProject, closeProject, toggleXRay } = useCityStore.getState();

    const layout = useMemo(
        () => (data ? layoutCity(toBuildings(data.projects, { now: fetchedAt })) : null),
        [data, fetchedAt],
    );
    const projects = useMemo(() => new Map((data?.projects ?? []).map((p) => [p.slug, p])), [data]);
    const lots = useMemo(() => new Map((layout?.lots ?? []).map((l) => [l.slug, l])), [layout]);
    const highlighted = useMemo(() => [...new Set([hovered, focus].filter(Boolean))], [hovered, focus]);

    const bounds = layout?.bounds ?? FALLBACK_BOUNDS;
    const cinemaPlot = layout?.districts.find((district) => district.id === 'cinema');
    const arcadePlot = layout?.districts.find((district) => district.id === 'arcade');
    const schoolPlot = layout?.districts.find((district) => district.id === 'school');
    const pitchPlot = layout?.districts.find((district) => district.id === 'pitch');
    const careerRoad = layout?.roads.find((road) => road.kind === 'career');
    const labelSlug = hovered ?? focus;
    const focusName = projects.get(focus)?.name;
    const openProjectData = projects.get(openSlug);
    const openXRayLayers = layersForXRay(openProjectData);
    const xrayActive = Boolean(openSlug && xraySlug === openSlug && openXRayLayers.length > 1);
    const extra = debug?.({ status, error, data, layout, focusName }) ?? {};
    const bueaWeather = extra.weather ?? buea?.weather ?? null;
    const { kind, code, cloud, rain } = bueaWeather ?? {};
    const weather = useMemo(() => weatherFx(kind ? { kind, code, cloud, rain } : null), [kind, code, cloud, rain]);

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
                style={{ cursor: hovered || cinemaHovered || arcadeHovered || schoolHovered || pitchHovered || careerHovered || aboutHovered ? 'pointer' : undefined }}
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
                    <DayNight lighting={lighting} offsetMs={offsetMs} at={extra.at} weather={weather} />
                    <Sun shadowMap={QUALITY[quality].shadowMap} lighting={lighting} version={layout} />
                    <Backdrop bounds={bounds} lighting={lighting} />
                    <Rain lighting={lighting} quality={quality} />
                    {layout && (
                        <>
                            <CityLayout layout={layout} lighting={lighting} built={BUILT_DISTRICTS} />
                            {cinemaPlot && CINEMA_REEL && (
                                <CinemaPlot
                                    plot={cinemaPlot}
                                    reel={CINEMA_REEL}
                                    paused={cinemaOpen}
                                    onOpen={() => setCinemaOpen(true)}
                                    onHover={setCinemaHovered}
                                />
                            )}
                            {arcadePlot && <ArcadePlot plot={arcadePlot} onHover={setArcadeHovered} />}
                            {schoolPlot && SCHOOL && (
                                <SchoolPlot
                                    plot={schoolPlot}
                                    school={SCHOOL}
                                    lighting={lighting}
                                    onOpen={() => setSchoolOpen(true)}
                                    onHover={setSchoolHovered}
                                />
                            )}
                            {pitchPlot && (
                                <PitchPlot
                                    plot={pitchPlot}
                                    onGoal={() => setContact({ scored: true })}
                                    onContact={() => setContact({ scored: false })}
                                    onHover={setPitchHovered}
                                />
                            )}
                            {careerRoad && CAREER.length > 0 && (
                                <CareerRoad
                                    road={careerRoad}
                                    roles={CAREER}
                                    lighting={lighting}
                                    onOpen={setCareerOpen}
                                    onHover={setCareerHovered}
                                />
                            )}
                            {careerRoad && ABOUT && (
                                <AboutHouse
                                    road={careerRoad}
                                    about={ABOUT}
                                    lighting={lighting}
                                    onOpen={() => setAboutOpen(true)}
                                    onHover={setAboutHovered}
                                />
                            )}
                            <Lamps layout={layout} lighting={lighting} />
                            {/* Phones get about half the traffic. */}
                            <Traffic layout={layout} lighting={lighting} offsetMs={offsetMs} at={extra.at} share={touch ? 0.5 : 1} />
                            <Buildings
                                placed={layout.lots}
                                lighting={lighting}
                                highlighted={highlighted}
                                onHover={setHovered}
                                onSelect={openProject}
                                xraySlug={xrayActive ? openSlug : null}
                                xrayLayers={openXRayLayers}
                            />
                            {lots.get(labelSlug) && projects.get(labelSlug) && !(xrayActive && labelSlug === openSlug) && (
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
            <StatusLine offsetMs={offsetMs} at={extra.at} weather={bueaWeather} />
            <p className="sr-only" aria-live="polite">
                {focusName ? `${focusName}. Press Enter to open.` : 'Start view, looking up Career Road towards Fako'}
            </p>

            {data && <CityProjectList projects={data.projects} />}
            {openProjectData && (
                <ProjectPanel
                    key={openSlug}
                    project={openProjectData}
                    onClose={closeProject}
                    xrayActive={xrayActive}
                    onToggleXRay={() => toggleXRay(openSlug)}
                />
            )}
            {cinemaOpen && CINEMA_REEL?.kind === 'file' && <CinemaModal reel={CINEMA_REEL} onClose={() => setCinemaOpen(false)} />}
            {schoolOpen && SCHOOL && <SchoolPanel school={SCHOOL} onClose={() => setSchoolOpen(false)} />}
            {careerOpen !== null && <CareerPanel roles={CAREER} selected={careerOpen} onClose={() => setCareerOpen(null)} />}
            {/* The house is below the desktop start view, so About is also one click away from the screen.
                Bottom left: on phones the house itself shows at the bottom right. */}
            {drawn && ABOUT && (
                <button
                    type="button"
                    onClick={() => setAboutOpen(true)}
                    className="absolute bottom-4 left-4 z-10 border border-mist/25 bg-black/50 px-3 py-1.5 font-mono text-xs text-mist backdrop-blur-[2px] hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-window"
                >
                    About {ABOUT.name?.split(' ')[0] ?? ''}
                </button>
            )}
            {aboutOpen && ABOUT && (
                <AboutPanel
                    about={ABOUT}
                    links={CONTACT.links}
                    onCareer={CAREER.length > 0 ? () => { setAboutOpen(false); setCareerOpen(0); } : undefined}
                    onContact={() => { setAboutOpen(false); setContact({ scored: false }); }}
                    onClose={() => setAboutOpen(false)}
                />
            )}
            {contact && <ContactPanel contact={CONTACT} scored={contact.scored} onClose={() => setContact(null)} />}
            {hubOpen && <ArcadeHub gaming={GAMING} />}
            <EggToast />
            {extra.overlay}
        </div>
    );
};

export default CityExperience;
