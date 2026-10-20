import profile from '../../content/profile.json';
import { toolClientContent } from '../lib/toolClientContent.js';

const LogoSection = () => {
    const { tools, clients } = toolClientContent(profile);
    if (!tools.length && !clients.length) return null;

    return (
        <section aria-labelledby="tools-clients-title" className="border-y border-white/10 py-12 md:py-16">
            <div className="padding-x-lg mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:gap-16">
                <div>
                    <h2 id="tools-clients-title" className="text-sm font-semibold uppercase text-white-50">Tools & clients</h2>
                    {tools.length > 0 && (
                        <div className="mt-5">
                            <h3 className="font-mono text-xs text-white/50">Tools</h3>
                            <ul className="mt-3 flex flex-wrap gap-2">
                                {tools.map((tool) => (
                                    <li key={tool} className="border border-white/15 px-3 py-2 text-sm text-white-50">{tool}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                {clients.length > 0 && (
                    <div>
                        <h3 className="font-mono text-xs text-white/50">Clients & collaborators</h3>
                        <ul className="mt-3 grid gap-x-6 sm:grid-cols-2">
                            {clients.map((client) => (
                                <li key={client} className="border-b border-white/10 py-3 text-sm leading-relaxed text-white-50">{client}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </section>
    );
};

export default LogoSection
