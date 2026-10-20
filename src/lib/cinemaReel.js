// What the Cinema district shows (P3-08), from owner content only:
// 1. a local reel: the first non-demo video (profile.video) with an MP4/WebM under public/images or public/videos;
// 2. otherwise the owner's video channel (profile.links.youtube, HTTPS, not marked [DEMO]), opened in a new tab;
// 3. otherwise null: the Cinema plot stays a placeholder block.
const SAFE_VIDEO_FILE = /^public\/(?:images|videos)\/(?:[A-Za-z0-9_-]+\.)*[A-Za-z0-9_-]+\.(?:mp4|webm)$/i;

const httpsUrl = (value) => {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url.href : null;
    } catch {
        return null;
    }
};

/** @returns {{ kind: 'file', title: string, src: string } | { kind: 'link', title: string, href: string } | null} */
export const cinemaReel = (profile = {}) => {
    const reel = (profile.video ?? []).find((video) => (
        video.demo !== true && typeof video.file === 'string' && SAFE_VIDEO_FILE.test(video.file)
    ));
    if (reel) return { kind: 'file', title: reel.title, src: `/${reel.file.slice('public/'.length)}` };

    const channel = (profile.demoFields ?? []).includes('links.youtube') ? null : httpsUrl(profile.links?.youtube);
    return channel ? { kind: 'link', title: 'Video work on YouTube', href: channel } : null;
};
