// What each page does with the guide's actions (P4-04). A host is { label(action), run(action) }: label is the
// button text, or null when the page can't do it (then the action is neither shown nor run). The panel runs the
// visitor's own requests (auto) itself and offers the rest as buttons. Pure apart from the functions passed in.

const MODE_URL = { city: '/?city', site: '/' };
const MODE_LABEL = { city: 'Open OJ City (3D)', site: 'Simple version' };

/**
 * The city: the camera flies (CameraRig cuts instead with reduced motion), panels open.
 * @param {{ places: { id: string, name: string }[], names: Map<string, string>, store: { flyTo: Function, openProject: Function, arrive: Function },
 *   openContact: () => void, navigate: (url: string) => void }} deps
 */
export const cityGuideActions = ({ places, names, store, openContact, navigate }) => {
    const placeName = (id) => places.find((p) => p.id === id)?.name ?? null;
    return {
        label: (a) => {
            if (a.type === 'fly_to_project') return names.has(a.slug) ? `Show ${names.get(a.slug)}` : null;
            if (a.type === 'open_case_study') return names.has(a.slug) ? `Open ${names.get(a.slug)}` : null;
            if (a.type === 'go_to') return placeName(a.place) ? `Go to the ${placeName(a.place)}` : null;
            if (a.type === 'open_contact') return 'Open contact form';
            if (a.type === 'switch_mode') return a.mode === 'site' ? MODE_LABEL.site : null;
            return null;
        },
        run: (a) => {
            if (a.type === 'fly_to_project') store.flyTo(a.slug);
            else if (a.type === 'open_case_study') store.openProject(a.slug);
            else if (a.type === 'go_to') store.arrive(a.place);
            else if (a.type === 'open_contact') openContact();
            else if (a.type === 'switch_mode') navigate(MODE_URL[a.mode]);
        },
    };
};

/**
 * The one-page site: sections instead of places; no project panels yet (P5-02).
 * @param {{ scrollTo: (id: string) => boolean, navigate: (url: string) => void }} deps  scrollTo returns false when the section is missing
 */
export const siteGuideActions = ({ scrollTo, navigate, hasSection = () => true }) => {
    const SECTION = { downtown: 'work' };
    return {
        label: (a) => {
            if (a.type === 'go_to' && SECTION[a.place] && hasSection(SECTION[a.place])) return 'Go to his work';
            if (a.type === 'open_contact' && hasSection('contact')) return 'Open contact form';
            if (a.type === 'switch_mode') return a.mode === 'city' ? MODE_LABEL.city : null;
            return null;
        },
        run: (a) => {
            if (a.type === 'go_to') scrollTo(SECTION[a.place]);
            else if (a.type === 'open_contact') scrollTo('contact');
            else if (a.type === 'switch_mode') navigate(MODE_URL[a.mode]);
        },
    };
};
