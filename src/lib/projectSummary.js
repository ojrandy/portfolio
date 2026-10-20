// /api/city project → the text shown on a building's label and project panel (P1-06).
// Only real values: anything missing is left out, every number says where it came from.

export const STATUS_LABELS = { live: 'Live', 'in-progress': 'In progress', archived: 'Archived' };

const SOURCES = { github: 'GitHub', owner: 'Owner estimate' };
const TODO = 'TODO(content)';

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** https links only; anything else (http, javascript:, garbage) is dropped. */
export const safeUrl = (url) => {
    if (typeof url !== 'string') return null;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' ? parsed.href : null;
    } catch {
        return null;
    }
};

/** Public project media: HTTPS URLs or image/video files under public/images or public/previews. */
export const safeMedia = (media) => {
    if (typeof media !== 'string') return null;
    const value = media.trim();
    const external = safeUrl(value);
    if (external) return external;

    const path = value.startsWith('public/') ? `/${value.slice('public/'.length)}` : value;
    let decoded;
    try {
        decoded = decodeURIComponent(path);
    } catch {
        return null;
    }
    const parts = decoded.split('/');
    if (!decoded.startsWith('/images/') && !decoded.startsWith('/previews/')) return null;
    if (decoded.includes('\\')) return null;
    if (parts.slice(1).some((part) => part === '.' || part === '..' || !part)) return null;
    if (!/\.(?:avif|gif|jpe?g|mp4|png|webm|webp)$/i.test(decoded)) return null;
    return path;
};

const cleanText = (value) => (
    typeof value === 'string' && value.trim() && !value.includes(TODO) ? value.trim() : null
);

const caseStudySummary = (project) => {
    if (project.demo || project.source === 'github' || !project.caseStudy) return null;
    const problem = cleanText(project.caseStudy.problem);
    const hardestPart = cleanText(project.caseStudy.hardestPart);
    const decision = cleanText(project.caseStudy.decision);
    let result = cleanText(project.caseStudy.result);
    const resultSource = cleanText(project.caseStudy.resultSource);
    if (result && /\d/.test(result) && !resultSource) result = null;
    if (!problem && !hardestPart && !decision && !result) return null;
    return { problem, hardestPart, decision, result, resultSource: result ? resultSource : null };
};

/** First `max` stack items plus how many were left out. */
export const shortStack = (stack, max = 3) => ({ shown: stack.slice(0, max), more: Math.max(0, stack.length - max) });

/** Hover label: name + up to 3 stack items. */
export const labelText = (project) => {
    const { shown, more } = shortStack(project.stack ?? []);
    const stack = shown.join(' · ') + (more ? ` +${more} more` : '');
    return { name: project.name, stack: stack || null };
};

/** [{ label, value }] for the panel, plus the source; empty when there are no numbers. */
export const projectStats = (project) => {
    const { stats, effort } = project;
    const items = [];
    if (stats.source === 'github') {
        if (stats.commits !== null) items.push({ label: 'Commits', value: String(stats.commits) });
        if (stats.stars !== null) items.push({ label: 'Stars', value: String(stats.stars) });
        if (stats.lastPush) {
            const date = new Date(stats.lastPush);
            if (!Number.isNaN(date.getTime())) items.push({ label: 'Last push', value: date.toISOString().slice(0, 10) });
        }
        const languages = Object.entries(stats.languages ?? {})
            .filter(([, share]) => share >= 0.05)
            .slice(0, 3)
            .map(([name, share]) => `${name} ${Math.round(share * 100)} %`);
        if (languages.length) items.push({ label: 'Languages', value: languages.join(' · ') });
    } else if (stats.source === 'owner' && effort !== null) {
        items.push({ label: 'Effort', value: `${effort}/10` });
    }
    return { items, source: items.length ? SOURCES[stats.source] : null };
};

/** Everything the project panel shows. */
export const projectSummary = (project) => {
    const live = safeUrl(project.live);
    const links = [
        { label: 'Live site', href: live },
        { label: 'Code', href: safeUrl(project.repo) },
    ].filter((l) => l.href);
    return {
        slug: project.slug,
        name: project.name,
        status: STATUS_LABELS[project.status] ?? null,
        district: capitalise(project.district),
        featured: project.featured,
        stack: project.stack ?? [],
        links,
        stats: projectStats(project),
        description: typeof project.description === 'string' && project.description.trim() ? project.description.trim() : null,
        caseStudy: caseStudySummary(project),
        media: project.demo ? null : safeMedia(project.media),
        preview: project.demo ? null : safeMedia(project.preview),
        live,
        iframe: !project.demo && project.iframe === true && Boolean(live),
        fromGitHub: project.source === 'github',
        demo: project.demo === true,
    };
};
