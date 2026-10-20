// School panel (P3-10): the owner's teaching, from schoolContent (owner content only, no demo entries).
import Dialog from './Dialog.jsx';

/** @param {{ school: ReturnType<import('../lib/schoolContent.js').schoolContent>, onClose: () => void }} props */
const SchoolPanel = ({ school, onClose }) => (
    <Dialog id="school-title" title="School: teaching" onClose={onClose} className="max-w-lg">
        {school.line && <p className="mb-4 text-sm text-mist/80">Ojong on teaching: “{school.line}”</p>}
        {school.lessons.length > 0 && (
            <ul className="space-y-2">
                {school.lessons.map((lesson) => (
                    <li key={lesson.title} className="border border-mist/15 p-3">
                        <p className="text-sm font-semibold">{lesson.title}</p>
                        {(lesson.venue || lesson.audience) && (
                            <p className="mt-1 text-sm text-mist/70">
                                {[lesson.venue, lesson.audience && `for ${lesson.audience}`].filter(Boolean).join(' · ')}
                            </p>
                        )}
                        {lesson.date && <p className="mt-1 font-mono text-xs text-mist/60">{lesson.date}</p>}
                        {lesson.link && (
                            <a
                                href={lesson.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-block text-xs text-window underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-window"
                            >
                                Course page <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span>
                            </a>
                        )}
                    </li>
                ))}
            </ul>
        )}
    </Dialog>
);

export default SchoolPanel;
