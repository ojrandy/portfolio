// Homepage numbers (P3-04): counted from /api/city, so every number is real and checkable. Placeholder [DEMO]
// projects are never counted (CLAUDE.md: no fake stats); each number says where it comes from.
export const portfolioStats = (projects = []) => {
    const real = projects.filter((project) => project.demo !== true);
    return [
        {
            key: 'city-projects',
            label: 'Projects in OJ City',
            value: real.length,
            source: "Ojong's project list plus his public GitHub repositories; placeholder entries not counted",
        },
        {
            key: 'github-projects',
            label: 'Projects with GitHub data',
            value: real.filter((project) => project.stats?.source === 'github').length,
            source: 'Commits, stars and languages read from the GitHub API',
        },
    ];
};
