// Homepage numbers (P3-04): real counts from /api/city (portfolioStats), each with its source in plain view, so
// they work on touch screens too. Nothing while loading; a plain message if the API fails (never a made-up number).
// A div, not <section>: the template forces every section to 100dvw.
import { portfolioStats } from '../lib/portfolioStats.js';

const AnimatedCounter = ({ projects = [], status }) => {
    if (status === 'loading') return null;
    if (status !== 'ready') {
        return <p id="counter" className="padding-x-lg py-8 text-center text-sm text-mist/60" role="status">Live project numbers are unavailable right now.</p>;
    }

    return (
        <div id="counter" role="region" aria-label="Portfolio numbers" className="padding-x-lg py-10">
            <div className="mx-auto grid grid-cols-1 gap-8 sm:grid-cols-2">
                {portfolioStats(projects).map((stat) => (
                    <div key={stat.key} className="border-l-2 border-window/70 pl-5">
                        <p className="font-mono text-4xl font-semibold text-mist">{stat.value.toLocaleString()}</p>
                        <p className="mt-1 text-sm text-mist/75">{stat.label}</p>
                        <p className="mt-2 text-xs text-mist/50">Source: {stat.source}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AnimatedCounter;
