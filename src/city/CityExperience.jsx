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
import MarketPlot from './MarketPlot.jsx';
import CareerRoad from './CareerRoad.jsx';
import AboutHouse from './AboutHouse.jsx';
import Traffic from './Traffic.jsx';
import TaxiCabin from './TaxiCabin.jsx';
import Drive from './Drive.jsx';
import Pedestrians from './Pedestrians.jsx';
import Animals from './Animals.jsx';
import StreetProps from './StreetProps.jsx';
import Outskirts from './Outskirts.jsx';
import Shopfronts from './Shopfronts.jsx';
import TrafficLights from './TrafficLights.jsx';
import SpeechBubble from './SpeechBubble.jsx';
import { createLighting } from './liveLighting.js';
import useBuea from '../hooks/useBuea.js';
import useEasterEggs from '../hooks/useEasterEggs.js';
import useDeviceTier, { deviceInfo } from '../hooks/useDeviceTier.js';
import { crowdShare, LEVELS, QUALITY, stepQuality } from '../lib/quality.js';
import { bueaTimeToday, parsePreviewOverride } from '../lib/dayNight.js';
import ProjectPanel from '../components/ProjectPanel.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import StatusLine from '../components/StatusLine.jsx';
import CityProjectList from '../components/CityProjectList.jsx';
import ArcadeHub from '../components/ArcadeHub.jsx';
import SchoolPanel from '../components/SchoolPanel.jsx';
import ContactPanel from '../components/ContactPanel.jsx';
import GuideLauncher from '../components/Guide/GuideLauncher.jsx';
import useGuideStore from '../store/useGuideStore.js';
import { cityGuideActions } from '../lib/guideActions.js';
import MarketPanel from '../components/MarketPanel.jsx';
import CareerPanel from '../components/CareerPanel.jsx';
import AboutPanel from '../components/AboutPanel.jsx';
import EggToast from '../components/EggToast.jsx';
import StreetControls from '../components/StreetControls.jsx';
import useCityData from '../hooks/useCityData.js';
import { toBuildings } from '../lib/buildings.js';
import { layoutCity } from '../lib/layout.js';
import { CAMERA } from '../lib/camera.js';
import { weatherFx } from '../lib/weatherFx.js';
import { xrayLayers as layersForXRay } from '../lib/projectSummary.js';
import { cinemaReel } from '../lib/cinemaReel.js';
import { schoolContent } from '../lib/schoolContent.js';
import { contactLinks } from '../lib/contactLinks.js';
import { marketContent } from '../lib/marketContent.js';
import { careerRoles } from '../lib/careerRoad.js';
import { aboutContent } from '../lib/aboutContent.js';
import { featuredBoards, githubBoard, weatherBoard } from '../lib/billboards.js';
import { cityPlaces } from '../lib/places.js';
import { shopfronts, shopFaces } from '../lib/shopfronts.js';
import { VEHICLE_TYPES } from '../lib/vehicles.js';
import useCityStore from '../store/useCityStore.js';
import useArcadeStore from '../store/useArcadeStore.js';
import profile from '../../content/profile.json';

const FALLBACK_BOUNDS = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };
const params = new URLSearchParams(window.location.search);
const PERF = params.has('perf');
// Perf runs only: ?perf&quality=low|medium|high pins the level and turns the monitor off.
const PINNED = PERF && LEVELS.includes(params.get('quality')) ? params.get('quality') : null;
// ...and ?perf&time=HH:MM pins Buea time (P3B-10), so a run measures the same crowd and lights whenever it's made.
const PERF_MINUTES = PERF ? parsePreviewOverride(params).minutes : null;
const PERF_AT = PERF_MINUTES == null ? null : bueaTimeToday(PERF_MINUTES, Date.now());
const CINEMA_REEL = cinemaReel(profile);
const SCHOOL = schoolContent(profile);
const CONTACT = contactLinks(profile);
const CAREER = careerRoles(profile);
const ABOUT = aboutContent(profile);
// Districts whose own scene replaces the placeholder block: Cinema (with a reel or channel), the Arcade (P3-09) and
// the School (P3-10, with teaching content), the Pitch (P3-11) and the Market (P3B-07, with services).
const BUILT_DISTRICTS = [CINEMA_REEL && 'cinema', 'arcade', SCHOOL && 'school', 'pitch', marketContent(profile) && 'market'].filter(Boolean);
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
 * @param {{ debug?: (state: { status, error, data, layout, focusName }) => { scene?: React.ReactNode, overlay?: React.ReactNode, at?: number | null, traffic?: boolean } }} props
 *   debug.at: a fixed time (epoch ms) for the dev time-of-day preview; debug.traffic false hides the traffic.
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
    const [contact, setContact] = useState(null); // { scored, about } while the contact panel is open
    const [marketOpen, setMarketOpen] = useState(null); // index of the stall whose service panel is open
    const [marketHovered, setMarketHovered] = useState(false);
    const [pitchHovered, setPitchHovered] = useState(false);
    const [careerOpen, setCareerOpen] = useState(null); // index of the sign that opened the career panel
    const [careerHovered, setCareerHovered] = useState(false);
    const [aboutOpen, setAboutOpen] = useState(false);
    const [aboutHovered, setAboutHovered] = useState(false);
    const [boardHovered, setBoardHovered] = useState(false);
    const [streetHovered, setStreetHovered] = useState(null); // 'vehicle' | 'animal' | 'pole' under the mouse
    const hoverStreet = (kind) => (on) => setStreetHovered((h) => (on ? kind : h === kind ? null : h));
    const hubOpen = useArcadeStore((s) => s.hubOpen);
    const tier = useDeviceTier();
    const [touch] = useState(() => deviceInfo().touch);
    const share = crowdShare({ touch, tier });
    const [quality, setQuality] = useState(PINNED ?? tier);
    const viewport = useRef(null);
    const [lighting] = useState(createLighting);
    // Traffic ↔ Pedestrians ↔ Drive: the live traffic, the busy crosswalks, the people, your car, the police car after
    // you and the joystick.
    const [streets] = useState(() => ({ traffic: null, crossing: new Set(), people: [], drive: null, chase: null, driveInput: null }));
    const { data: buea, offsetMs } = useBuea();
    useEasterEggs({ active: drawn, offsetMs });
    const focus = useCityStore((s) => s.focus);
    const hovered = useCityStore((s) => s.hovered);
    const openSlug = useCityStore((s) => s.openSlug);
    const xraySlug = useCityStore((s) => s.xraySlug);
    const following = useCityStore((s) => s.following);
    const ride = useCityStore((s) => s.ride);
    const bubbleText = useCityStore((s) => s.bubble?.text);
    const driving = useCityStore((s) => s.driving);
    const driveNear = useCityStore((s) => s.driveNear);
    const { setHovered, openProject, closeProject, toggleXRay } = useCityStore.getState();

    const layout = useMemo(
        () => (data ? layoutCity(toBuildings(data.projects, { now: fetchedAt })) : null),
        [data, fetchedAt],
    );
    const projects = useMemo(() => new Map((data?.projects ?? []).map((p) => [p.slug, p])), [data]);
    const lots = useMemo(() => new Map((layout?.lots ?? []).map((l) => [l.slug, l])), [layout]);
    const places = useMemo(() => (layout ? cityPlaces(layout, { about: Boolean(ABOUT) }) : []), [layout]);
    const shops = useMemo(() => (layout ? shopfronts(layout) : []), [layout]);
    const shopsBySlug = useMemo(() => shopFaces(shops), [shops]);
    const shopNames = useMemo(() => new Map((data?.projects ?? []).map((p) => [p.slug, p.name])), [data]);
    // P4-04: the guide flies the camera and opens panels (only to places that are built and buildings that exist).
    const guideActions = useMemo(() => cityGuideActions({
        places,
        names: new Map([...projects].filter(([slug]) => lots.has(slug)).map(([slug, p]) => [slug, p.name])),
        store: useCityStore.getState(),
        openContact: () => setContact({ scored: false }),
        navigate: useGuideStore.getState().leaveTo,
    }), [places, projects, lots]);
    const highlighted = useMemo(() => [...new Set([hovered, focus].filter(Boolean))], [hovered, focus]);

    const bounds = layout?.bounds ?? FALLBACK_BOUNDS;
    const cinemaPlot = layout?.districts.find((district) => district.id === 'cinema');
    const arcadePlot = layout?.districts.find((district) => district.id === 'arcade');
    const schoolPlot = layout?.districts.find((district) => district.id === 'school');
    const pitchPlot = layout?.districts.find((district) => district.id === 'pitch');
    const marketPlot = layout?.districts.find((district) => district.id === 'market');
    // Examples link to buildings, so the stalls wait for the city data.
    const market = useMemo(() => marketContent(profile, data?.projects ?? []), [data]);
    const careerRoad = layout?.roads.find((road) => road.kind === 'career');
    const labelSlug = hovered ?? focus;
    const focusName = projects.get(focus)?.name;
    const openProjectData = projects.get(openSlug);
    const openXRayLayers = layersForXRay(openProjectData);
    const xrayActive = Boolean(openSlug && xraySlug === openSlug && openXRayLayers.length > 1);
    const extra = debug?.({ status, error, data, layout, focusName }) ?? (PERF_AT ? { at: PERF_AT } : {});
    const bueaWeather = extra.weather ?? buea?.weather ?? null;
    const { kind, code, cloud, rain } = bueaWeather ?? {};
    const weather = useMemo(() => weatherFx(kind ? { kind, code, cloud, rain } : null), [kind, code, cloud, rain]);
    const featuredProjects = useMemo(() => featuredBoards(data?.projects), [data]);
    const githubNumbers = useMemo(() => githubBoard(data?.projects, data?.statsUpdatedAt), [data]);
    const { tempC, label: weatherLabel, updatedAt: weatherAt } = bueaWeather ?? {};
    const weatherNow = useMemo(() => weatherBoard(Number.isFinite(tempC) ? { tempC, label: weatherLabel, updatedAt: weatherAt } : null), [tempC, weatherLabel, weatherAt]);

    return (
        <div className="fixed inset-0 bg-basalt">
            <meta name="robots" content="noindex" />
            <div
                ref={viewport}
                tabIndex={0}
                role="application"
                aria-roledescription="3D city"
                aria-label="OJ City. Tab visits each building and Enter opens it. Arrow keys or WASD move, Q and E rotate, plus and minus zoom, Escape returns to the start. Take a taxi or drive from the buttons below the city."
                className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-window"
                style={{ cursor: hovered || cinemaHovered || arcadeHovered || schoolHovered || pitchHovered || marketHovered || careerHovered || aboutHovered || boardHovered || streetHovered ? 'pointer' : undefined }}
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
                            {marketPlot && market && (
                                <MarketPlot
                                    plot={marketPlot}
                                    market={market}
                                    lighting={lighting}
                                    offsetMs={offsetMs}
                                    at={extra.at}
                                    share={share}
                                    onOpen={setMarketOpen}
                                    onHover={setMarketHovered}
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
                            <Outskirts layout={layout} lighting={lighting} />
                            <StreetProps
                                layout={layout}
                                roles={CAREER.length}
                                lighting={lighting}
                                featured={featuredProjects}
                                github={githubNumbers}
                                weather={weatherNow}
                                onOpenProject={openProject}
                                onHover={setBoardHovered}
                            />
                            {/* Phones and weak devices get about half the traffic and people. */}
                            <Drive layout={layout} roles={CAREER.length} streets={streets} keyTarget={viewport} policeLines={profile.policeLines} />
                            {extra.traffic !== false && (
                                <Traffic
                                    layout={layout}
                                    lighting={lighting}
                                    offsetMs={offsetMs}
                                    at={extra.at}
                                    share={share}
                                    streets={streets}
                                    places={places}
                                    onHover={hoverStreet('vehicle')}
                                />
                            )}
                            {extra.traffic !== false && <TaxiCabin streets={streets} lines={profile.taxiLines} />}
                            <Pedestrians
                                layout={layout}
                                roles={CAREER.length}
                                lighting={lighting}
                                offsetMs={offsetMs}
                                at={extra.at}
                                share={share}
                                streets={streets}
                            />
                            <TrafficLights layout={layout} streets={streets} onHover={hoverStreet('pole')} />
                            <Animals layout={layout} roles={CAREER.length} lighting={lighting} onHover={hoverStreet('animal')} />
                            <SpeechBubble />
                            <Buildings
                                placed={layout.lots}
                                lighting={lighting}
                                highlighted={highlighted}
                                onHover={setHovered}
                                onSelect={openProject}
                                xraySlug={xrayActive ? openSlug : null}
                                xrayLayers={openXRayLayers}
                                shops={shopsBySlug}
                            />
                            <Shopfronts shops={shops} names={shopNames} lighting={lighting} hidden={xrayActive ? openSlug : null} />
                            {lots.get(labelSlug) && projects.get(labelSlug) && !(xrayActive && labelSlug === openSlug) && (
                                <BuildingLabel lot={lots.get(labelSlug)} project={projects.get(labelSlug)} />
                            )}
                            <CameraRig layout={layout} keyTarget={viewport} places={places} streets={streets} />
                            {!drawn && <FirstFrame onDrawn={() => setDrawn(true)} />}
                        </>
                    )}
                    {PERF && <PerfProbe quality={quality} streets={streets} />}
                    {extra.scene}
                </Canvas>}
            </div>
            <LoadingScreen code data={status} frame={drawn} webgl={webgl} lots={layout?.lots} onRetry={retry} />
            <StatusLine offsetMs={offsetMs} at={extra.at} weather={bueaWeather} />
            <p className="sr-only" aria-live="polite">
                {driving ? `${driving.vehicle === 'taxi' ? 'Driving a taxi' : 'Riding a bendskin'}. W and S or the up and down arrows drive, A and D or left and right steer, Space brakes, H honks${driving.vehicle === 'taxi' ? ', V switches to the driver\'s seat' : ''}, Escape parks.${driveNear && projects.get(driveNear) ? ` Next to ${projects.get(driveNear).name}: press Enter to open it.` : ''}`
                    : ride ? (ride.riding ? `Riding in a taxi to ${places.find((p) => p.id === ride.place)?.name}, in the front passenger seat. Arrow keys look around; Escape gets out.` : 'Finding a taxi.')
                    : following ? `Following the ${VEHICLE_TYPES[following.type]?.label ?? 'vehicle'}. Press Escape to leave.`
                        : focusName ? `${focusName}. Press Enter to open.` : 'Start view, looking up Career Road towards Fako'}
                {bubbleText && ` ${bubbleText}`}
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
            {drawn && (
                <StreetControls places={places} streets={streets} keyTarget={viewport} projectName={(slug) => projects.get(slug)?.name} touch={touch}>
                    {ABOUT && (
                        <button
                            type="button"
                            onClick={() => setAboutOpen(true)}
                            className="border border-mist/25 bg-black/50 px-3 py-1.5 font-mono text-xs text-mist backdrop-blur-[2px] hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-window"
                        >
                            About {ABOUT.name?.split(' ')[0] ?? ''}
                        </button>
                    )}
                </StreetControls>
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
            {marketOpen !== null && market && (
                <MarketPanel
                    key={marketOpen}
                    market={market}
                    selected={marketOpen}
                    onProject={(slug) => { setMarketOpen(null); openProject(slug); }}
                    onQuote={(about) => { setMarketOpen(null); setContact({ scored: false, about }); }}
                    onClose={() => setMarketOpen(null)}
                />
            )}
            {/* P4-05: hidden while a project panel is open (it takes the right side); a chip flies to the project. */}
            {drawn && (
                <GuideLauncher
                    // Phones: below the status line (it wraps to two or three lines there).
                    className="fixed right-4 top-24 sm:top-4"
                    hidden={Boolean(openProjectData)}
                    onCite={openProject}
                    onContact={() => setContact({ scored: false })}
                    actions={guideActions}
                />
            )}
            {contact && <ContactPanel contact={CONTACT} scored={contact.scored} about={contact.about} onClose={() => setContact(null)} />}
            {hubOpen && <ArcadeHub gaming={GAMING} />}
            <EggToast />
            {extra.overlay}
        </div>
    );
};

export default CityExperience;
