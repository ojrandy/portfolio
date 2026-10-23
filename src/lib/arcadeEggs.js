// Arcade district (P3-09): the easter eggs, how they're triggered and how progress is saved.
// Pure; the city wires the triggers (useEasterEggs) and the store keeps what was found (useArcadeStore).
import { sunState } from './dayNight.js';

export const EGGS = [
    { id: 'hub', name: 'Find the Arcade', hint: 'Somewhere south-west of downtown, a cabinet is waiting.', found: 'You found the Arcade.' },
    { id: 'konami', name: 'Cheat code', hint: 'An old cheat code still works here. Up, up…', found: '↑ ↑ ↓ ↓ ← → ← → B A. The marquee stays lit.' },
    { id: 'fako', name: 'Knock on Fako', hint: 'The mountain hides in mist. Knock five times.', found: 'The mist cleared over Fako (Mount Cameroon) for a moment.' },
    { id: 'night', name: 'Night owl', hint: 'Come back when it is dark in Buea.', found: 'You visited after dark. The city follows Buea\'s real time.' },
    { id: 'explorer', name: 'Explorer', hint: 'Open three different projects.', found: 'You opened three projects.' },
    { id: 'runner', name: 'Bug squasher', hint: 'Score 10 in Code runner, right here in the Arcade.', found: 'You scored 10 in Code runner.' },
    { id: 'goal', name: 'Top corner', hint: 'Beat the keeper on the Pitch, south-east of downtown.', found: 'You scored past the keeper on the Pitch.' },
    // City interactions (P3B-06)
    { id: 'taxi', name: 'Taxi!', hint: 'Yellow cars go anywhere in town. Take one.', found: 'You rode a Buea taxi across OJ City.' },
    { id: 'goat', name: 'Goat whisperer', hint: 'Goats graze at the edge of town. Say hello.', found: 'A goat stopped to look at you.' },
    { id: 'police', name: 'Undercover', hint: 'One car in the traffic is rarer than the rest. Follow it a while.', found: 'You followed the police car for 20 seconds.' },
    // Drive mode (P3B-09)
    { id: 'tour', name: 'Tour guide', hint: 'Take the wheel and drive to every district in one go.', found: 'You drove yourself to every district of OJ City.' },
    { id: 'lights', name: 'Model driver', hint: 'Drive through every set of traffic lights in town without running a red.', found: 'Every traffic light in town, and not one red run.' },
    // Police chase (P3B-11)
    { id: 'escape', name: 'Escape artist', hint: 'Run a red while you drive. Then get away.', found: 'You lost the police car.' },
    { id: 'pullover', name: 'Good citizen', hint: 'Run a red while you drive. Then do the right thing.', found: 'You pulled over for the police.' },
];

export const FOLLOW_POLICE_SECONDS = 20;

const IDS = new Set(EGGS.map((egg) => egg.id));

export const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
export const FAKO_KNOCKS = { count: 5, gapMs: 2000 }; // five in a row, no pause longer than 2 s
export const EXPLORER_PROJECTS = 3;
export const STORAGE_KEY = 'oj-city:arcade';

/** Feed it key names (event.key); returns true on the key that completes `sequence`. */
export const sequenceMatcher = (sequence) => {
    let recent = [];
    return (key) => {
        recent = [...recent, String(key).toLowerCase()].slice(-sequence.length);
        if (!recent.every((k, i) => k === sequence[i]) || recent.length < sequence.length) return false;
        recent = [];
        return true;
    };
};

/** Feed it a timestamp per knock; returns true on the `count`th knock in a row (a pause over `gapMs` starts over). */
export const knockCounter = ({ count, gapMs } = FAKO_KNOCKS) => {
    let knocks = 0;
    let last = -Infinity;
    return (ms) => {
        knocks = ms - last <= gapMs ? knocks + 1 : 1;
        last = ms;
        if (knocks < count) return false;
        knocks = 0;
        return true;
    };
};

export const isNightInBuea = (ms) => sunState(ms).phase === 'night';

/** Saved progress → known egg ids, in EGGS order. Anything malformed reads as nothing found. */
export const parseProgress = (raw) => {
    try {
        const saved = JSON.parse(raw);
        if (!Array.isArray(saved?.found)) return [];
        return EGGS.map((egg) => egg.id).filter((id) => saved.found.includes(id));
    } catch {
        return [];
    }
};

export const serializeProgress = (found) => JSON.stringify({ found: found.filter((id) => IDS.has(id)) });
