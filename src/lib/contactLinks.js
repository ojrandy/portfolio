// Contact panel (P3-11): how to reach the owner, from owner content only. The form arrives with P5-03.
// - email: the public address, only if it looks like one (no TODO(content));
// - links: LinkedIn, GitHub and X when set, HTTPS only.
const EMAIL = /^[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}$/i;

const LINKS = [
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'github', label: 'GitHub' },
    { key: 'x', label: 'X' },
];

const httpsUrl = (value) => {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url.href : null;
    } catch {
        return null;
    }
};

/** @returns {{ email: string | null, links: { label: string, href: string }[] }} */
export const contactLinks = (profile = {}) => {
    const email = typeof profile.email === 'string' && EMAIL.test(profile.email.trim()) ? profile.email.trim() : null;
    const links = LINKS
        .map(({ key, label }) => ({ label, href: httpsUrl(profile.links?.[key]) }))
        .filter((link) => link.href);
    return { email, links };
};
