// Street controls (P3B-06), over the city: bottom left "Take a taxi" (a list of places), the sound toggle and
// whatever the page puts first (About); while the camera follows a vehicle or rides a taxi, a chip
// saying so with Ride / Skip / Stop (bottom right). Esc on the city does the same as Stop.
// P3B-09: "Drive" (a taxi or a bendskin); while driving, a chip with View (taxi), Horn, Open <project> (stopped next
// to a building) and Park, and on touch screens a joystick in place of the bottom-left buttons.
import { useEffect, useRef, useState } from 'react';
import { VEHICLE_TYPES } from '../lib/vehicles.js';
import useCityStore from '../store/useCityStore.js';
import useSoundStore from '../store/useSoundStore.js';

const BUTTON = 'border border-mist/25 bg-black/50 px-3 py-1.5 font-mono text-xs text-mist backdrop-blur-[2px] hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-window';

/** The list of places; picking one calls onPick(id). Esc or a click outside closes it. */
const PlaceMenu = ({ id, places, onPick, onClose }) => {
    const list = useRef(null);
    useEffect(() => {
        list.current?.querySelector('button')?.focus();
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            onClose();
        };
        const onDown = (e) => { if (!list.current?.parentElement?.contains(e.target)) onClose(); };
        window.addEventListener('keydown', onKey, true);
        window.addEventListener('pointerdown', onDown);
        return () => {
            window.removeEventListener('keydown', onKey, true);
            window.removeEventListener('pointerdown', onDown);
        };
    }, [onClose]);

    return (
        <ul id={id} ref={list} className="absolute bottom-full left-0 mb-2 w-44 border border-mist/25 bg-basalt/95 py-1">
            {places.map((place) => (
                <li key={place.id}>
                    <button
                        type="button"
                        onClick={() => onPick(place.id)}
                        className="w-full px-3 py-1.5 text-left font-mono text-xs text-mist hover:bg-mist/10 focus-visible:bg-mist/10 focus-visible:outline-none"
                    >
                        {place.name}
                    </button>
                </li>
            ))}
        </ul>
    );
};

/** A button that opens the place menu above it; `onPick` defaults to taking a taxi there. */
const TaxiButton = ({ label, places, menuId, onPick = (place) => useCityStore.getState().rideTo(place) }) => {
    const [open, setOpen] = useState(false);
    const opener = useRef(null);
    const close = () => {
        setOpen(false);
        opener.current?.focus();
    };
    return (
        <div className="relative">
            <button
                ref={opener}
                type="button"
                aria-expanded={open}
                aria-controls={menuId}
                onClick={() => setOpen((o) => !o)}
                className={BUTTON}
            >
                {label}
            </button>
            {open && (
                <PlaceMenu
                    id={menuId}
                    places={places}
                    onClose={close}
                    onPick={(place) => {
                        setOpen(false);
                        onPick(place);
                    }}
                />
            )}
        </div>
    );
};

const SoundToggle = () => {
    const on = useSoundStore((s) => s.on);
    const toggle = useSoundStore((s) => s.toggle);
    return (
        <button type="button" aria-pressed={on} onClick={toggle} className={BUTTON} title={on ? 'Sound on' : 'Sound off'}>
            <span aria-hidden="true">{on ? '🔊' : '🔇'}</span> Sound
        </button>
    );
};

/** What the camera is doing: following a vehicle or riding a taxi. */
const FollowChip = ({ places }) => {
    const following = useCityStore((s) => s.following);
    const ride = useCityStore((s) => s.ride);
    const { stopFollowing, skipRide } = useCityStore.getState();
    if (!following && !ride) return null;
    const placeName = places.find((p) => p.id === ride?.place)?.name;
    const text = ride ? (ride.riding ? `Taxi to ${placeName}` : 'Finding a taxi…')
        : `Following: ${VEHICLE_TYPES[following.type]?.label ?? 'vehicle'}`;

    return (
        // Bottom right; on phones above the bottom-left buttons.
        <div className="pointer-events-none absolute bottom-14 left-4 right-4 z-10 flex justify-end sm:bottom-4 sm:left-auto">
            <div className="pointer-events-auto flex flex-wrap items-center gap-2 border border-window/40 bg-basalt/90 px-3 py-1.5">
                <span className="font-mono text-xs text-mist">{text}</span>
                <span className="hidden font-mono text-[11px] text-mist/60 sm:inline">{ride?.riding ? '· drag to look around · Esc to get out' : '· Esc to leave'}</span>
                {following?.type === 'taxi' && !ride && (
                    <TaxiButton label="Ride in this taxi" places={places} menuId="ride-this-taxi" />
                )}
                {ride?.riding && <button type="button" onClick={skipRide} className={BUTTON}>Skip</button>}
                <button type="button" onClick={stopFollowing} className={BUTTON}>{ride?.riding ? 'Get out' : 'Stop'}</button>
            </div>
        </div>
    );
};

const DRIVE_CHOICES = [{ id: 'taxi', name: 'Taxi' }, { id: 'moto', name: 'Bendskin' }];
const JOYSTICK = { size: 112, reach: 40, dead: 0.15 };

/** Touch joystick: up drives on, down brakes and backs up, sideways steers. Writes streets.driveInput. */
const Joystick = ({ streets }) => {
    const base = useRef(null);
    const [knob, setKnob] = useState({ x: 0, y: 0 });
    const move = (e) => {
        const box = base.current.getBoundingClientRect();
        let x = e.clientX - (box.left + box.width / 2);
        let y = e.clientY - (box.top + box.height / 2);
        const d = Math.hypot(x, y);
        if (d > JOYSTICK.reach) [x, y] = [(x * JOYSTICK.reach) / d, (y * JOYSTICK.reach) / d];
        setKnob({ x, y });
        const axis = (v) => (Math.abs(v) < JOYSTICK.dead ? 0 : v);
        Object.assign(streets, { driveInput: { ...streets.driveInput, throttle: axis(-y / JOYSTICK.reach), steer: axis(-x / JOYSTICK.reach) } });
    };
    const release = () => {
        setKnob({ x: 0, y: 0 });
        Object.assign(streets, { driveInput: { ...streets.driveInput, throttle: 0, steer: 0 } });
    };
    useEffect(() => () => { Object.assign(streets, { driveInput: { ...streets.driveInput, throttle: 0, steer: 0 } }); }, [streets]);

    return (
        <div
            ref={base}
            aria-hidden="true"
            className="absolute bottom-4 left-4 z-10 touch-none rounded-full border border-mist/30 bg-black/40"
            style={{ width: JOYSTICK.size, height: JOYSTICK.size }}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
            onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e); }}
            onPointerUp={release}
            onPointerCancel={release}
        >
            <div
                className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 rounded-full border border-window/60 bg-window/30"
                style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
            />
        </div>
    );
};

/** While you drive: what you drive, the keys, and View / Horn / Open / Park. */
const DriveChip = ({ streets, projectName, touch }) => {
    const driving = useCityStore((s) => s.driving);
    const near = useCityStore((s) => s.driveNear);
    const chase = useCityStore((s) => s.chase);
    if (!driving) return null;
    const { stopDrive, setDriveView, peekProject } = useCityStore.getState();
    const taxi = driving.vehicle === 'taxi';
    const name = near && projectName(near);
    return (
        // Bottom right; on touch screens beside the joystick.
        <div className={`pointer-events-none absolute bottom-4 right-4 z-10 flex justify-end ${touch ? 'left-36' : 'left-4 sm:left-auto'}`}>
            <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2 border border-window/40 bg-basalt/90 px-3 py-1.5">
                <span className="font-mono text-xs text-mist">{taxi ? 'Driving a taxi' : 'Riding a bendskin'}</span>
                {/* P3B-11: the police car after you. Only the phase is announced (no role="status": that marks the
                    loading screen), not every change of distance. */}
                <span aria-live="polite" className="font-mono text-xs text-ember">
                    {chase && (chase.phase === 'stopped' ? 'Pulled over' : 'Police! Lose them or pull over')}
                </span>
                {chase?.phase === 'chasing' && <span aria-hidden="true" className="font-mono text-xs text-ember/80">{chase.distance} away</span>}
                {!touch && <span className="hidden font-mono text-[11px] text-mist/60 lg:inline">· WASD / arrows · Space brakes · H horn{taxi ? ' · V view' : ''} · Esc to park</span>}
                {name && (
                    <button type="button" onClick={() => peekProject(near)} className={BUTTON}>
                        Open {name}{!touch && <span className="text-mist/60"> (Enter)</span>}
                    </button>
                )}
                {taxi && (
                    <button type="button" onClick={() => setDriveView(driving.view === 'seat' ? 'chase' : 'seat')} className={BUTTON}>
                        {driving.view === 'seat' ? 'Chase view' : "Driver's seat"}
                    </button>
                )}
                <button type="button" onClick={() => { Object.assign(streets, { driveInput: { ...streets.driveInput, horn: true } }); }} className={BUTTON}>Horn</button>
                <button type="button" onClick={stopDrive} className={BUTTON}>Park</button>
            </div>
        </div>
    );
};

/**
 * @param {{ places: object[], streets: object, keyTarget: object, projectName: (slug: string) => string | undefined,
 *   touch?: boolean, children?: React.ReactNode }} props
 *   children = buttons placed first (About); keyTarget = the city's focusable element (it gets the keys when you drive)
 */
const StreetControls = ({ places, streets, keyTarget, projectName, touch = false, children }) => {
    const driving = useCityStore((s) => Boolean(s.driving));
    const drive = (vehicle) => {
        useCityStore.getState().startDrive(vehicle);
        keyTarget.current?.focus();
    };
    return (
        <>
            {driving && touch ? <Joystick streets={streets} /> : (
                <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-end gap-2">
                    {children}
                    {places.length > 0 && <TaxiButton label="Take a taxi" places={places} menuId="take-a-taxi" />}
                    {!driving && <TaxiButton label="Drive" places={DRIVE_CHOICES} menuId="drive" onPick={drive} />}
                    <SoundToggle />
                </div>
            )}
            <FollowChip places={places} />
            <DriveChip streets={streets} projectName={projectName} touch={touch} />
        </>
    );
};

export default StreetControls;
