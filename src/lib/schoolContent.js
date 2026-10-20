// What the School district shows (P3-10), from owner content only:
// - lessons: non-demo teaching entries (docs/projects.md section 4); demo fields, TODO(content) dates and
//   non-HTTPS links are left out;
// - line: the owner's own "Teaching" hobby sentence, shown as a quote;
// - board: the short venue name for the chalkboard ("TUIB" from "… Buea (TUIB)").
// Null without lessons or a line: the School plot keeps its placeholder block.
const isTodo = (value) => typeof value === 'string' && value.includes('TODO(content)');

const clean = (value) => (typeof value === 'string' && value.trim() && !isTodo(value) ? value.trim() : null);

const httpsUrl = (value) => {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url.href : null;
    } catch {
        return null;
    }
};

const shortVenue = (venue) => venue?.match(/\(([^)]+)\)\s*$/)?.[1] ?? venue;

/** @returns {{ lessons: object[], line: string | null, board: string | null } | null} */
export const schoolContent = (profile = {}) => {
    const lessons = (profile.teaching ?? [])
        .filter((entry) => entry.demo !== true && clean(entry.title))
        .map((entry) => {
            const field = (name) => ((entry.demoFields ?? []).includes(name) ? null : entry[name]);
            return {
                title: clean(entry.title),
                venue: clean(field('venue')),
                audience: clean(field('audience')),
                date: clean(field('date')),
                link: httpsUrl(field('link')),
            };
        });

    const hobby = (profile.hobbies ?? []).find((h) => h.name === 'Teaching');
    const line = clean(hobby?.text);
    if (!lessons.length && !line) return null;

    // Prefer a venue written in full (it carries the short name in brackets).
    const venues = lessons.map((lesson) => lesson.venue).filter(Boolean);
    const board = shortVenue(venues.find((v) => /\(.+\)\s*$/.test(v)) ?? venues[0] ?? null);
    return { lessons, line, board };
};
