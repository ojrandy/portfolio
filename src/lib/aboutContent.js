// About / origin story (P3-13), from owner content only (docs/projects.md section 1):
// - name, title, place ("Buea, Cameroon"), roots (culture) and degree, each left out while it is demo or TODO(content);
// - bio, and the origin story split into paragraphs (blank lines in the markdown);
// - districts: the owner's hobbies that have a place in the city, in city order.
// Null without a bio or an origin story: the About house and button are not shown.
const isTodo = (value) => typeof value === 'string' && value.includes('TODO(content)');

const clean = (value) => (typeof value === 'string' && value.trim() && !isTodo(value) ? value.trim() : null);

// Hobby name (section 1 "Hobbies") → where it lives in OJ City.
const DISTRICTS = [
    { hobby: 'Coding', place: 'Downtown', what: 'every building is a project' },
    { hobby: 'Video editing', place: 'Cinema', what: 'video work' },
    { hobby: 'Gaming', place: 'Arcade', what: 'easter eggs and a mini-game' },
    { hobby: 'Teaching', place: 'School', what: 'courses taught' },
    { hobby: 'Football', place: 'Pitch', what: 'score a penalty to get in touch' },
];

/**
 * @returns {{ name: string | null, title: string | null, place: string | null, roots: string | null,
 *   degree: string | null, bio: string | null, origin: string[], districts: { place: string, what: string }[] } | null}
 */
export const aboutContent = (profile = {}) => {
    const field = (name) => ((profile.demoFields ?? []).includes(name) ? null : clean(profile[name]));
    const bio = field('bio');
    const origin = (field('origin') ?? '').split(/\n\s*\n/).map(clean).filter(Boolean);
    if (!bio && origin.length === 0) return null;
    const hobbies = new Set((profile.hobbies ?? []).map((hobby) => hobby.name));
    return {
        name: field('name'),
        title: field('title'),
        place: field('location'),
        roots: field('culture'),
        degree: field('degree'),
        bio,
        origin,
        districts: DISTRICTS.filter((d) => hobbies.has(d.hobby)).map(({ place, what }) => ({ place, what })),
    };
};
