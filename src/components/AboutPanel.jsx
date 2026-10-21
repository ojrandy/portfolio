// About panel (P3-13): who the owner is and the origin story, from aboutContent (owner content only).
// Opened from the About house at the entrance or the "About" button; leads on to the career and contact panels.
import Dialog from './Dialog.jsx';

const ACTION_CLASS = 'border border-mist/25 px-3 py-1.5 text-sm hover:bg-mist/10 focus-visible:outline-2 focus-visible:outline-window';

/**
 * @param {{ about: ReturnType<import('../lib/aboutContent.js').aboutContent>, links: { label: string, href: string }[],
 *   onCareer?: () => void, onContact: () => void, onClose: () => void }} props
 */
const AboutPanel = ({ about, links, onCareer, onContact, onClose }) => {
    const facts = [
        ['Based in', about.place],
        ['Roots', about.roots],
        ['Degree', about.degree],
    ].filter(([, value]) => value);

    return (
        <Dialog id="about-title" title={`About ${about.name ?? 'the owner'}`} onClose={onClose} className="max-w-xl">
            {about.title && <p className="text-sm font-semibold">{about.title}</p>}
            {about.bio && <p className="mt-2 text-sm leading-relaxed text-mist/90">{about.bio}</p>}

            {facts.length > 0 && (
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-y border-mist/15 py-3 text-sm">
                    {facts.map(([label, value]) => (
                        <div key={label} className="contents">
                            <dt className="font-mono text-xs leading-5 text-mist/60">{label}</dt>
                            <dd className="text-mist/90">{value}</dd>
                        </div>
                    ))}
                </dl>
            )}

            {about.origin.length > 0 && (
                <>
                    <h3 className="mt-5 font-mono text-xs uppercase tracking-wider text-window">Origin story</h3>
                    <div className="mt-2 space-y-3 text-sm leading-relaxed text-mist/85">
                        {about.origin.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                    </div>
                </>
            )}

            {about.districts.length > 0 && (
                <>
                    <h3 className="mt-5 font-mono text-xs uppercase tracking-wider text-window">Around the city</h3>
                    <ul className="mt-2 space-y-1 text-sm text-mist/85">
                        {about.districts.map((district) => (
                            <li key={district.place}>
                                <span className="font-semibold text-mist">{district.place}</span>: {district.what}
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
                {onCareer && <button type="button" onClick={onCareer} className={ACTION_CLASS}>Career</button>}
                <button type="button" onClick={onContact} className={ACTION_CLASS}>Contact</button>
                {links.map((link) => (
                    <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className={ACTION_CLASS}>
                        {link.label} <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span>
                    </a>
                ))}
            </div>
        </Dialog>
    );
};

export default AboutPanel;
