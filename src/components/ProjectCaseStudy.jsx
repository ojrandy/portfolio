// Case study in the project panel (P3-01): problem → hardest part → decision → result, from projectSummary()
// (owner-written fields only; demo, TODO and unsourced numbers are already removed). Reused by Recruiter mode (P5-01).
const FIELDS = [
    ['problem', 'Problem'],
    ['hardestPart', 'Hardest part'],
    ['decision', 'Decision'],
    ['result', 'Result'],
];

const ProjectCaseStudy = ({ caseStudy, titleId }) => {
    if (!caseStudy) return null;
    const entries = FIELDS.filter(([key]) => caseStudy[key]);
    if (!entries.length) return null;

    return (
        <div role="group" className="mt-5 border-t border-mist/15 pt-4" aria-labelledby={titleId}>
            <h3 id={titleId} className="text-xs uppercase tracking-wider text-mist/60">Case study</h3>
            <div className="mt-3 space-y-4">
                {entries.map(([key, label]) => (
                    <div key={key}>
                        <h4 className="text-sm font-semibold text-mist">{label}</h4>
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-mist/80">{caseStudy[key]}</p>
                        {key === 'result' && caseStudy.resultSource && (
                            <p className="mt-1 text-xs text-mist/55">Source: {caseStudy.resultSource}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

/** Owner-approved image or video (projectSummary().media: HTTPS, or a file under /images or /previews). */
export const ProjectMedia = ({ media, projectName }) => {
    if (!media) return null;
    const isVideo = /\.(?:mp4|webm)(?:[?#]|$)/i.test(media);

    return (
        <div className="mt-5 border-t border-mist/15 pt-4">
            <h3 className="text-xs uppercase tracking-wider text-mist/60">Media</h3>
            {isVideo ? (
                <video aria-label={`${projectName} project video`} className="mt-2 aspect-video w-full rounded-md bg-black/30 object-contain" src={media} controls preload="metadata">
                    Your browser does not support video playback.
                </video>
            ) : (
                <img className="mt-2 aspect-video w-full rounded-md bg-black/30 object-contain" src={media} alt={`${projectName} project media`} loading="lazy" />
            )}
        </div>
    );
};

export default ProjectCaseStudy;