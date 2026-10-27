// Guide actions (P4-04): what the page may do after an answer, worked out from the question, never from model text.
// The page checks every action again and runs only what it supports. auto: the visitor asked for it ("show me",
// "take me to", "open"), so the page runs it right away; otherwise the page offers it as a button.
//   fly_to_project {slug} · open_case_study {slug} · go_to {place} · open_contact · switch_mode {mode: 'city' | 'site'}
import { hasPhrase, tokens } from './text.js';

// Place ids match src/lib/places.js.
export const PLACE_IDS = ['downtown', 'market', 'cinema', 'arcade', 'school', 'pitch', 'about'];

const NAV = ['show me', 'take me', 'bring me', 'fly me', 'let me see', 'lets go', 'let s go', 'head to', 'navigate to', 'i want to see', 'can i see',
    'montre moi', 'montrez moi', 'emmene moi', 'emmenez moi', 'amene moi', 'amenez moi', 'conduis moi', 'aller au', 'aller a', 'je veux voir',
    'carry me', 'make i see', 'i wan see', 'take me go'];
// Only at the start: "open Vital Pulse" and "go to the market", not "is he open to work?" or "did he go to school?".
const NAV_START = ['open', 'show', 'visit', 'go to', 'fly to', 'head to', 'please open', 'please show', 'ouvre', 'ouvrez', 'ouvrir', 'montre', 'montrez', 'visiter', 'allez au', 'va au'];
const OPEN = ['open', 'case study', 'details', 'panel', 'ouvre', 'ouvrez', 'ouvrir', 'etude de cas', 'open am'];
const CONTACT = ['contact', 'contact form', 'formulaire', 'formulaire de contact', 'get in touch', 'contacter'];
const SWITCH = ['switch', 'change', 'go back', 'back to', 'passer', 'revenir'];

const PLACES = {
    downtown: ['downtown', 'centre ville', 'city centre', 'city center'],
    market: ['market', 'marketplace', 'stall', 'stalls', 'marche'],
    cinema: ['cinema', 'cinéma'],
    arcade: ['arcade'],
    school: ['school', 'ecole', 'classroom'],
    pitch: ['pitch', 'football pitch', 'terrain'],
    about: ['about house', 'his house', 'maison', 'maison about'],
};
const MODES = {
    city: ['3d', 'city mode', 'explorer mode', 'oj city', 'the city', '3d city', 'ville 3d', 'mode ville'],
    site: ['simple version', 'text version', 'simple site', 'recruiter mode', 'one page', 'without 3d', 'no 3d', 'version simple', 'mode recruteur', 'sans 3d'],
};

const toTokens = (list) => list.map((p) => tokens(p));
const T = {
    nav: toTokens(NAV),
    start: toTokens(NAV_START),
    open: toTokens(OPEN),
    contact: toTokens(CONTACT),
    switch: toTokens(SWITCH),
    places: Object.entries(PLACES).map(([id, ps]) => [id, toTokens(ps)]),
    modes: Object.entries(MODES).map(([id, ps]) => [id, toTokens(ps)]),
};
const any = (ws, list) => list.some((p) => hasPhrase(ws, p));
const firstOf = (ws, groups) => groups.find(([, ps]) => any(ws, ps))?.[0] ?? null;

/** Did the visitor ask the guide to take them somewhere or open something? */
export const asksToGo = (text) => {
    const ws = tokens(text);
    const starts = T.start.some((p) => p.every((w, i) => ws[i] === w));
    return any(ws, T.nav) || (starts && !(ws[0] === 'open' && ws[1] === 'to'));
};

// Answers that point to a district get a button for it.
const OFFER = { services: 'market', service: 'market', video: 'cinema', teaching: 'school', about: 'about', origin: 'about', hobbies: 'arcade' };

/**
 * @param {string} text  the visitor's latest question
 * @param {{ kind: string, intent?: string, project?: { slug: string } }} c  what the guide decided it is about
 * @returns {{ type: string, slug?: string, place?: string, mode?: string, auto: boolean }[]}  at most one auto action
 */
export const actionsFor = (text, c) => {
    if (c.kind === 'injection' || c.kind === 'abuse') return [];
    const ws = tokens(text);
    const nav = asksToGo(text);
    const kind = c.kind === 'intent' ? c.intent : c.kind;
    const place = firstOf(ws, T.places);
    const mode = firstOf(ws, T.modes);

    // "the city centre" is a place, not the 3D mode.
    if (mode && !place && (nav || any(ws, T.switch))) return [{ type: 'switch_mode', mode, auto: true }];
    if (nav && (kind === 'contact' || kind === 'hire' || any(ws, T.contact))) return [{ type: 'open_contact', auto: true }];
    if (c.kind === 'project') {
        if (!nav) return [];
        return [{ type: any(ws, T.open) ? 'open_case_study' : 'fly_to_project', slug: c.project.slug, auto: true }];
    }
    if (nav && place) return [{ type: 'go_to', place, auto: true }];
    if (nav && kind === 'projects') return [{ type: 'go_to', place: 'downtown', auto: true }];

    const offers = [];
    const offered = place ?? OFFER[kind];
    if (offered) offers.push({ type: 'go_to', place: offered, auto: false });
    if (kind === 'city') offers.push({ type: 'switch_mode', mode: 'city', auto: false });
    return offers;
};
