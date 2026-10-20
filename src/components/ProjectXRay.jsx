// Project X-Ray in the panel (P3-03): the owner's UI → API → Data → Infra layers. With 2+ layers and motion on, a
// button explodes the building in the city (BuildingXRay); otherwise, and for screen readers, a static ordered list.
const LAYER_COLORS = {
    ui: 'var(--color-sky)',
    api: 'var(--color-ember)',
    data: 'var(--color-window)',
    infra: 'var(--color-fako-green)',
};

const ProjectXRay = ({ layers, active, reducedMotion, onToggle }) => {
    if (!layers.length) return null;

    return (
        <div className="mt-5 border-t border-mist/15 pt-4">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs uppercase tracking-wider text-mist/60">Project X-Ray</h3>
                {!reducedMotion && layers.length > 1 && (
                    <button
                        type="button"
                        aria-pressed={active}
                        onClick={onToggle}
                        className="rounded border border-mist/20 px-2 py-1 text-xs text-mist hover:bg-mist/10 focus-visible:outline-2 focus-visible:outline-window"
                    >
                        {active ? 'Restore building' : 'Explode floors'}
                    </button>
                )}
            </div>
            <ol
                className={`${reducedMotion || layers.length === 1 ? 'mt-3 grid gap-1.5' : 'sr-only'}`}
                aria-label="Project layers from interface to infrastructure"
            >
                {layers.map((layer, index) => (
                    <li
                        key={layer.key}
                        className="flex min-w-0 items-start gap-3 border-l-2 bg-ash/60 px-3 py-2"
                        style={{ borderColor: LAYER_COLORS[layer.key] }}
                    >
                        <span className="w-6 shrink-0 font-mono text-[10px] text-mist/50">0{index + 1}</span>
                        <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-mist">{layer.label}</h4>
                            <p className="mt-0.5 break-words text-xs leading-relaxed text-mist/75">{layer.details}</p>
                        </div>
                    </li>
                ))}
            </ol>
        </div>
    );
};

export default ProjectXRay;
