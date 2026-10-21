// Career Road (P3-12): the owner's roles as signposts along the road into the city, from owner content only.
// - roles: non-demo experience entries (docs/projects.md section 2), newest first; demo fields and TODO(content)
//   text are left out, and a role needs a title or a company to be shown;
// - signs: one per role, oldest nearest the entrance, so walking up the road moves forward in time and the newest
//   role stands next to downtown (the present). They sit between the lamps and alternate sides of the road.
import { CAREER_SPACING } from './lamps.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const SIGN = {
    width: 3, // board
    height: 1.6,
    bottom: 1.4, // board's lower edge above the ground
    thickness: 0.12,
    post: 0.14,
    postInset: 0.25, // posts this far inside the board's ends
    roadside: 0.8, // board's inner end this far outside the road's edge (clear of the lamps)
    turn: 0.4, // rad towards the road, so a board faces a visitor walking up it
};

const isTodo = (value) => typeof value === 'string' && value.includes('TODO(content)');

const clean = (value) => (typeof value === 'string' && value.trim() && !isTodo(value) ? value.trim() : null);

// "2021-03" → { year: '2021', label: 'Mar 2021' }; "2025" → year only; "present" → Present.
const parseDate = (value) => {
    const text = clean(value);
    if (!text) return null;
    if (text.toLowerCase() === 'present') return { year: 'Present', label: 'Present', key: Infinity };
    const match = text.match(/^(\d{4})(?:-(\d{2}))?$/);
    if (!match) return null;
    const month = match[2] ? Number(match[2]) : null;
    const label = month >= 1 && month <= 12 ? `${MONTHS[month - 1]} ${match[1]}` : match[1];
    return { year: match[1], label, key: Number(match[1]) * 12 + (month ?? 1) };
};

const span = (a, b, sep) => [a, b].filter(Boolean).join(sep) || null;

/** @returns {{ role, company, location, years, dates, did: string[], proudest }[]} newest first */
export const careerRoles = (profile = {}) => (profile.experience ?? [])
    .filter((entry) => entry.demo !== true)
    .map((entry, order) => {
        const field = (name) => ((entry.demoFields ?? []).includes(name) ? null : entry[name]);
        const dates = field('dates');
        const start = parseDate(dates?.start);
        const end = parseDate(dates?.end);
        return {
            role: clean(field('role')),
            company: clean(field('company')),
            location: clean(field('location')),
            years: start?.year === end?.year ? start?.year ?? null : span(start?.year, end?.year, ' → '),
            dates: span(start?.label, end?.label, ' – '),
            did: (field('did') ?? []).map(clean).filter(Boolean),
            proudest: clean(field('proudest')),
            sortKey: start?.key ?? -order, // undated roles keep the owner's order
        };
    })
    .filter((role) => role.role || role.company)
    .sort((a, b) => b.sortKey - a.sortKey)
    .map(({ sortKey, ...role }) => role); // eslint-disable-line no-unused-vars

/**
 * Sign positions on Career Road. Up to 5 roles use the gaps between the lamps, filled from downtown back towards
 * the entrance (the newest is in the start view); more roles are spread evenly along the road.
 * @param {number} count
 * @param {{ x: number, z: number, width: number, depth: number }} road Career Road from layoutCity()
 * @returns {{ x: number, z: number, rotationY: number, side: -1 | 1 }[]} newest first, like careerRoles()
 */
export const careerSigns = (count, road) => {
    const north = road.z - road.depth / 2;
    const gaps = Math.floor(road.depth / CAREER_SPACING) - 1;
    const offsets = count <= gaps
        ? Array.from({ length: count }, (_, i) => (i + 1) * CAREER_SPACING)
        : Array.from({ length: count }, (_, i) => ((i + 0.5) * road.depth) / count);
    const reach = road.width / 2 + SIGN.roadside + SIGN.width / 2;
    return offsets.map((offset, i) => {
        const side = i % 2 === 0 ? -1 : 1; // the newest on the west (left walking up), then alternating
        return { x: road.x + side * reach, z: north + offset, rotationY: -side * SIGN.turn, side };
    });
};

/** World-space boxes for one InstancedMesh: [post, post, board] per sign. */
export const signParts = (signs) => signs.flatMap((sign) => {
    const cos = Math.cos(sign.rotationY);
    const sin = Math.sin(sign.rotationY);
    const at = (lx, y, lz = 0) => [sign.x + lx * cos + lz * sin, y, sign.z - lx * sin + lz * cos];
    const postX = SIGN.width / 2 - SIGN.postInset;
    const postHeight = SIGN.bottom + SIGN.height - 0.1;
    return [
        ...[-postX, postX].map((lx) => ({
            position: at(lx, postHeight / 2, -SIGN.thickness),
            rotationY: sign.rotationY,
            scale: [SIGN.post, postHeight, SIGN.post],
        })),
        {
            position: at(0, SIGN.bottom + SIGN.height / 2),
            rotationY: sign.rotationY,
            scale: [SIGN.width, SIGN.height, SIGN.thickness],
        },
    ];
});
