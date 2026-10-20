// Preview in the project panel (P3-02): the captured screenshot, so touch screens (no hover card) see it too. For
// owner-approved sites (`live`: HTTPS, allowed by the CSP's frame-src) a button loads the real site in a sandboxed
// iframe, only on request: a whole third-party site is too heavy to load every time the panel opens.
import { useState } from 'react';

/** @param {{ name: string, preview: string | null, live: string | null }} props */
const LivePreview = ({ name, preview, live }) => {
    const [loaded, setLoaded] = useState(false);
    if (!preview && !live) return null;

    return (
        <div className="mt-5 border-t border-mist/15 pt-4">
            <h3 className="text-xs uppercase tracking-wider text-mist/60">{loaded ? 'Live site' : 'Preview'}</h3>
            {loaded ? (
                // allow-same-origin lets the site use its own cookies and storage (its own origin, not this page's);
                // without it many sites, and Cloudflare's browser check, never finish loading.
                <iframe
                    className="mt-2 aspect-video w-full rounded-md border border-mist/15 bg-black"
                    src={live}
                    title={`${name} live site`}
                    referrerPolicy="strict-origin-when-cross-origin"
                    sandbox="allow-forms allow-same-origin allow-scripts"
                />
            ) : (
                preview && <img className="mt-2 aspect-video w-full rounded-md border border-mist/15 bg-black/30 object-cover object-top" src={preview} alt={`Screenshot of the ${name} website`} loading="lazy" />
            )}
            {live && !loaded && (
                <button
                    type="button"
                    onClick={() => setLoaded(true)}
                    className="mt-2 rounded-md bg-mist/10 px-3 py-1.5 text-sm hover:bg-mist/20 focus-visible:outline-2 focus-visible:outline-window"
                >
                    Load live site here
                </button>
            )}
        </div>
    );
};

export default LivePreview;
