// What the Market shows (P3B-07), from owner content only (docs/projects.md → "Services you offer clients"):
// - stalls: one per non-demo service, in the owner's order: name, what's delivered, example buildings (non-demo
//   projects that are in the city; demo or unknown slugs are left out). No prices: every stall asks for a quote.
// - calls: the owner's Pidgin call-outs for the shoppers.
// Null without services: the Market plot keeps its placeholder block.
export const MAX_STALLS = 18; // 3 rows of 6

const isTodo = (value) => typeof value === 'string' && value.includes('TODO(content)');
const clean = (value) => (typeof value === 'string' && value.trim() && !isTodo(value) ? value.trim() : null);

/**
 * @param {object} profile  content/profile.json
 * @param {{ slug: string, name: string, demo?: boolean }[]} projects  the city's projects (examples link to these)
 * @returns {{ stalls: { index: number, name: string, delivered: string | null, examples: { slug: string, name: string }[] }[], calls: string[] } | null}
 */
export const marketContent = (profile = {}, projects = []) => {
    const known = new Map(projects.filter((p) => p.demo !== true && clean(p.name)).map((p) => [p.slug, clean(p.name)]));
    const stalls = (profile.services ?? [])
        .filter((s) => s.demo !== true && clean(s.name))
        .slice(0, MAX_STALLS)
        .map((s, index) => ({
            index,
            name: clean(s.name),
            delivered: (s.demoFields ?? []).includes('delivered') ? null : clean(s.delivered),
            examples: (s.examples ?? []).filter((slug) => known.has(slug)).map((slug) => ({ slug, name: known.get(slug) })),
        }));
    if (!stalls.length) return null;
    return { stalls, calls: (profile.marketCalls ?? []).map(clean).filter(Boolean) };
};
