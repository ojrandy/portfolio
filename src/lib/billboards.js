// Billboards (P3B-05, design_system.md → "Interactive city"): what the city's boards say. Real content only:
// featured projects, numbers counted from /api/city with their source, and Buea's weather from /api/buea.
// Placeholder [DEMO] projects and TODO(content) text never reach a board (CLAUDE.md: no fake stats).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const clean = (value) => (typeof value === 'string' && value.trim() && !/TODO\(content\)|\[DEMO\]/.test(value) ? value.trim() : null);

const domainOf = (url) => {
    try {
        const { protocol, hostname } = new URL(url);
        return protocol === 'https:' ? hostname.replace(/^www\./, '') : null;
    } catch {
        return null;
    }
};

// "2026-10-21T05:07:25Z" → "21 Oct 2026" (Buea date, WAT = UTC+1).
const bueaDate = (iso) => {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return null;
    const d = new Date(ms + 60 * 60000);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const plural = (n, word, many = `${word}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? word : many}`;

/** Featured, non-demo projects: { slug, name, stack, site } (site = live domain over HTTPS, or null). */
export const featuredBoards = (projects = []) => projects
    .filter((p) => p.featured && p.demo !== true && clean(p.name))
    .map((p) => ({
        slug: p.slug,
        name: clean(p.name),
        stack: (p.stack ?? []).map(clean).filter(Boolean).slice(0, 3).join(' · ') || null,
        site: domainOf(p.live),
    }));

/** GitHub numbers summed over non-demo projects with GitHub data, or null when there are none. */
export const githubBoard = (projects = [], statsUpdatedAt = null) => {
    const repos = projects.filter((p) => p.demo !== true && p.stats?.source === 'github');
    if (repos.length === 0) return null;
    const sum = (key) => repos.reduce((total, p) => total + (Number.isFinite(p.stats[key]) ? p.stats[key] : 0), 0);
    const updated = bueaDate(statsUpdatedAt);
    return {
        headline: `${plural(sum('commits'), 'commit')} · ${plural(sum('stars'), 'star')}`,
        detail: `across ${plural(repos.length, 'GitHub repository', 'GitHub repositories')}`,
        source: `Source: GitHub API${updated ? ` · updated ${updated}` : ''}`,
    };
};

/** Buea's weather now, or null without a temperature. */
export const weatherBoard = (weather) => {
    if (!weather || !Number.isFinite(weather.tempC)) return null;
    const label = clean(weather.label);
    const time = weather.updatedAt && Number.isFinite(Date.parse(weather.updatedAt))
        ? new Date(Date.parse(weather.updatedAt) + 60 * 60000).toISOString().slice(11, 16)
        : null;
    return {
        headline: `Buea now ${Math.round(weather.tempC)} °C`,
        detail: label ? label.charAt(0).toUpperCase() + label.slice(1) : null,
        source: `Source: Open-Meteo${time ? ` · ${time} WAT` : ''}`,
    };
};
