// Every building as a button outside the canvas (P1-06), in the same order as Tab in the city.
// Hidden until it gets keyboard focus (like a skip link); always available to screen readers.
// Focusing a button flies the camera there; pressing it opens the project panel.
import useCityStore from '../store/useCityStore.js';
import { STATUS_LABELS } from '../lib/projectSummary.js';

const CityProjectList = ({ projects }) => {
    const order = useCityStore((s) => s.order);
    const focus = useCityStore((s) => s.focus);
    const flyTo = useCityStore((s) => s.flyTo);
    const openProject = useCityStore((s) => s.openProject);
    const bySlug = new Map(projects.map((p) => [p.slug, p]));

    return (
        <nav
            aria-label="Projects in OJ City"
            className="sr-only focus-within:not-sr-only focus-within:fixed focus-within:bottom-4 focus-within:left-4 focus-within:z-20 focus-within:max-h-[50vh] focus-within:w-72 focus-within:overflow-y-auto focus-within:rounded-xl focus-within:bg-basalt/95 focus-within:p-3 focus-within:text-mist focus-within:shadow-2xl"
        >
            <h2 className="px-2 pb-1 font-mono text-xs uppercase tracking-wider text-mist/60">Projects</h2>
            <ul>
                {order.map((slug) => {
                    const p = bySlug.get(slug);
                    if (!p) return null;
                    return (
                        <li key={slug}>
                            <button
                                type="button"
                                onFocus={() => flyTo(slug)}
                                onClick={() => openProject(slug)}
                                aria-current={focus === slug ? 'true' : undefined}
                                className="w-full rounded-md px-2 py-1 text-left text-sm hover:bg-mist/10 focus-visible:bg-mist/10 focus-visible:outline-2 focus-visible:outline-window"
                            >
                                {p.name}
                                {STATUS_LABELS[p.status] && <span className="text-mist/60"> · {STATUS_LABELS[p.status]}</span>}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
};

export default CityProjectList;
