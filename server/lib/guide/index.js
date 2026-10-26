// The built-in guide (P4-03, ADR-014 option A): answers visitors' questions from knowledgeFacts() with fixed
// phrases, no model. It finds what a question is about (a project, a skill, a service, an FAQ, or a kind of
// question such as pricing or contact), answers from owner content only, cites projects as [slug], and says it
// doesn't know otherwise. Pure: the same facts and messages always give the same answer.
import { DISTRICT_NAMES } from '../knowledge.js';
import { PIDGIN_APPROVED, phrasesFor } from './phrases.js';
import { detectLanguage, hasPhrase, normalize, sameWord, tokens } from './text.js';

// Kinds of question, with the words that point to them (English, French and Pidgin, normalised).
const INTENTS = {
    injection: ['ignore previous', 'ignore all', 'ignore your', 'ignore the above', 'system prompt', 'your instructions', 'your rules', 'you are now', 'act as', 'pretend', 'jailbreak', 'developer mode', 'debug mode', 'new rules', 'oublie tes', 'ignore tes', 'tes instructions'],
    abuse: ['stupid', 'idiot', 'fuck', 'shit', 'bitch', 'dumb', 'useless', 'connard', 'merde', 'mumu', 'foolish', 'nonsense', 'ashawo'],
    greeting: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'bonjour', 'bonsoir', 'salut', 'coucou', 'how far', 'how body', 'wetin dey'],
    thanks: ['thanks', 'thank you', 'thx', 'merci', 'tenkyu', 'tank you', 'ok thanks'],
    ack: ['ok', 'okay', 'cool', 'great', 'nice', 'alright', 'd accord', 'i see', 'noted', 'e good'],
    about: ['who is', 'who s', 'about ojong', 'about him', 'tell me about ojong', 'introduce', 'qui est', 'parle moi d ojong', 'presente', 'na who', 'who be', 'background', 'bio', 'himself', 'yourself'],
    origin: ['where is he from', 'where does he come from', 'origin', 'village', 'tribe', 'bayangi', 'orocko', 'culture', 'grew up', 'roots', 'd ou vient', 'origine', 'where e come from'],
    location: ['where is he based', 'based', 'location', 'where does he live', 'where is he', 'which country', 'ou habite', 'ou est il', 'where e dey'],
    contact: ['contact', 'reach', 'email', 'e mail', 'mail', 'message him', 'call', 'phone', 'whatsapp', 'get in touch', 'joindre', 'contacter', 'ecrire', 'linkedin', 'how i fit reach'],
    hire: ['hire', 'work with him', 'work together', 'quote', 'build me', 'build for me', 'need a website', 'need an app', 'need a site', 'recruit', 'engager', 'embaucher', 'devis', 'travailler avec', 'collaborate', 'i want a website', 'i want an app'],
    availability: ['available', 'availability', 'open to work', 'freelance', 'full time', 'remote', 'notice period', 'start date', 'disponible', 'disponibilite', 'temps plein', 'teletravail', 'e dey free', 'busy'],
    pricing: ['price', 'cost', 'rate', 'charge', 'how much', 'budget', 'fee', 'fcfa', 'deposit', 'tarif', 'prix', 'combien coute', 'cout', 'na how much', 'expensive', 'cheap', 'payment'],
    services: ['services', 'service', 'what can he do', 'what does he do', 'what does he offer', 'offer', 'market', 'stall', 'prestations', 'que fait il', 'que propose', 'wetin e fit do', 'wetin e dey do', 'help me with'],
    projects: ['projects', 'project', 'portfolio', 'his work', 'built', 'apps', 'websites', 'sites', 'buildings', 'best work', 'featured', 'show me', 'projets', 'realisations', 'travaux', 'build', 'don build', 'wetin e don build', 'what has he made', 'examples'],
    count: ['how many', 'number of', 'combien de', 'how much projects', 'count'],
    experience: ['experience', 'worked', 'jobs', 'job', 'career', 'company', 'companies', 'employer', 'employers', 'roles', 'parcours', 'entreprise', 'poste', 'where e don work', 'work history'],
    education: ['degree', 'education', 'study', 'studied', 'university', 'certification', 'certified', 'certificate', 'diploma', 'hnd', 'cs50', 'master', 'diplome', 'etudes', 'universite', 'formation', 'qualifications'],
    teaching: ['teach', 'teaching', 'teacher', 'lecturer', 'lecture', 'students', 'courses', 'class', 'tuib', 'trustech', 'enseigne', 'enseignant', 'cours', 'etudiants'],
    video: ['video', 'videos', 'editing', 'youtube', 'premiere', 'capcut', 'reel', 'montage', 'cinema'],
    hobbies: ['hobby', 'hobbies', 'free time', 'for fun', 'football', 'gaming', 'games', 'fifa', 'loisirs', 'passe temps', 'passion'],
    tools: ['tools', 'ide', 'vscode', 'editor', 'setup', 'outils', 'webstorm'],
    languages: ['languages does he speak', 'speak', 'spoken', 'langues', 'parle t il', 'parle francais', 'parle anglais', 'language he speak', 'bilingual', 'bilingue'],
    cv: ['cv', 'resume', 'curriculum'],
    testimonials: ['testimonial', 'testimonials', 'reviews', 'review', 'references', 'recommendation', 'what clients say', 'avis', 'temoignages'],
    clients: ['clients', 'client', 'customers', 'who has he worked for', 'worked for', 'clientele'],
    github: ['github', 'repos', 'repositories', 'repository', 'open source', 'commits'],
    city: ['oj city', 'this city', 'this site', 'this website', 'navigate', 'how does this work', 'how do i use', 'explore', 'district', 'districts', 'map', 'taxi', 'drive', 'downtown', 'arcade', 'pitch', 'about house', 'ville', 'quartier', 'comment ca marche', 'easter egg'],
};

// Ties go to the earlier kind.
const PRIORITY = ['injection', 'abuse', 'pricing', 'availability', 'hire', 'contact', 'cv', 'testimonials', 'languages', 'count', 'github', 'education', 'teaching', 'video', 'experience', 'clients', 'hobbies', 'tools', 'services', 'projects', 'origin', 'location', 'about', 'city', 'thanks', 'greeting', 'ack'];

// What a question about one project asks for.
const ASPECTS = {
    stack: ['stack', 'tech', 'technology', 'technologies', 'built with', 'made with', 'framework', 'language', 'techno', 'technologies'],
    links: ['link', 'live', 'url', 'visit', 'see it', 'lien', 'online'],
    github: ['github', 'commits', 'stars', 'repo', 'code', 'source'],
    story: ['problem', 'challenge', 'hardest', 'difficult', 'hard', 'decision', 'result', 'outcome', 'impact', 'why', 'probleme', 'difficile', 'resultat'],
};
const FOLLOW_UP = ['tell me more', 'more about it', 'more details', 'details', 'tell me more about it', 'en savoir plus', 'plus de details', 'and that one', 'about it', 'this project', 'that project', 'ce projet', 'dis moi plus', 'talk more'];

// Common tech names, so a question about one Ojong hasn't used is still recognised (and answered honestly).
const KNOWN_TECH = ['JavaScript', 'TypeScript', 'Python', 'Java', 'Kotlin', 'Swift', 'Dart', 'PHP', 'Ruby', 'Rust', 'Golang', 'C++', 'C#', 'HTML', 'CSS', 'SQL', 'React', 'React Native', 'Next.js', 'Vue', 'Angular', 'Svelte', 'Node.js', 'Express', 'NestJS', 'Django', 'Flask', 'FastAPI', 'Laravel', 'Spring', 'WordPress', 'Flutter', 'Expo', 'Three.js', 'Tailwind CSS', 'Bootstrap', 'Firebase', 'Supabase', 'MongoDB', 'MySQL', 'PostgreSQL', 'Redis', 'Prisma', 'GraphQL', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'Google Cloud', 'Vercel', 'Netlify', 'Hostinger', 'Git', 'Figma', 'Adobe XD', 'Photoshop', 'Premiere Pro', 'CapCut', 'After Effects', 'Linux', 'WebSockets', 'Stripe', 'Gantt'];

// Words too common to identify a project or service on their own.
const COMMON = new Set(['app', 'apps', 'website', 'websites', 'site', 'web', 'the', 'and', 'for', 'with', 'project', 'projects', 'portfolio', 'pro', 'global', 'solution', 'solutions', 'tech', 'development', 'many', 'more', 'other']);
const STOP = new Set(['what', 'whats', 'how', 'do', 'does', 'did', 'you', 'your', 'he', 'his', 'him', 'is', 'are', 'the', 'a', 'an', 'to', 'of', 'in', 'on', 'for', 'with', 'and', 'or', 'it', 'me', 'i', 'can', 'ojong', 'randy', 'about', 'tell', 's', 'de', 'le', 'la', 'les', 'il', 'est', 'vous', 'qui', 'que', 'quoi', 'un', 'une', 'des', 'du', 'e', 'na', 'dey', 'don', 'don t', 't', 'work']);

const MAX_LISTED = 4;

const FUZZY = { fuzzy: true };
const words = (text) => tokens(text);
const phraseTokens = (list) => list.map((p) => tokens(p));
const INTENT_TOKENS = Object.fromEntries(Object.entries(INTENTS).map(([k, v]) => [k, phraseTokens(v)]));
const ASPECT_TOKENS = Object.fromEntries(Object.entries(ASPECTS).map(([k, v]) => [k, phraseTokens(v)]));
const FOLLOW_UP_TOKENS = phraseTokens(FOLLOW_UP);
const INTENT_WORDS = new Set(Object.values(INTENT_TOKENS).flat(2));
// Question words never stand in for a name by typo ("hardest" isn't the project "Harvest").
const KEYWORDS = new Set([...INTENT_WORDS, ...Object.values(ASPECT_TOKENS).flat(2), ...FOLLOW_UP_TOKENS.flat()]);
const matchesName = (ws, phrase) => hasPhrase(ws, phrase) || hasPhrase(ws.map((w) => (KEYWORDS.has(w) ? '' : w)), phrase, FUZZY);

// The longest matching phrase: near-synonyms in one list don't add up.
const score = (ws, phrases) => phrases.reduce((s, p) => (hasPhrase(ws, p) ? Math.max(s, p.length) : s), 0);
const cite = (slug) => `[${slug}]`;

/** Aliases that identify an entity: its full name, its slug, and its name words no other entity uses. */
const aliasIndex = (entities, nameOf, techWords) => {
    const df = new Map();
    const own = entities.map((e) => {
        const ws = new Set([...tokens(nameOf(e)), ...(e.slug ? e.slug.split('-') : [])]);
        for (const w of ws) df.set(w, (df.get(w) ?? 0) + 1);
        return ws;
    });
    return entities.map((e, i) => {
        const full = tokens(nameOf(e));
        const aliases = [{ words: full, weight: full.length + 1 }];
        if (e.slug && e.slug.includes('-')) aliases.push({ words: e.slug.split('-'), weight: full.length + 1 });
        for (const w of own[i]) {
            if (w.length >= 3 && df.get(w) === 1 && !COMMON.has(w) && !INTENT_WORDS.has(w) && !techWords.has(w) && !STOP.has(w) && !/^\d+$/.test(w)) {
                aliases.push({ words: [w], weight: 1 });
            }
        }
        return { entity: e, aliases };
    });
};

/** Name words shared by 2–4 entities ("freight"): asking about one of them gets "which one do you mean?". */
const sharedWords = (entities, nameOf) => {
    const by = new Map();
    for (const e of entities) {
        for (const w of new Set(tokens(nameOf(e)))) {
            if (w.length < 4 || COMMON.has(w) || STOP.has(w) || INTENT_WORDS.has(w)) continue;
            by.set(w, [...(by.get(w) ?? []), e]);
        }
    }
    return new Map([...by].filter(([, list]) => list.length >= 2 && list.length <= MAX_LISTED));
};

const bestMatches = (index, ws) => {
    let best = 0;
    let found = [];
    for (const { entity, aliases } of index) {
        const s = Math.max(0, ...aliases.filter((a) => matchesName(ws, a.words)).map((a) => a.weight));
        if (s === 0) continue;
        if (s > best) {
            best = s;
            found = [entity];
        } else if (s === best) found.push(entity);
    }
    return { score: best, found };
};

/**
 * @param {object} facts  knowledgeFacts() output
 * @returns {{ answer: (messages: { role: 'user' | 'assistant', content: string }[]) => object }}
 */
export const createGuide = (facts) => {
    const all = [...facts.projects, ...facts.repos];
    const slugs = new Set(all.map((p) => p.slug));

    // Tech terms: everything in Ojong's stacks and tools, plus common names (for honest "no" answers).
    const tech = new Map();
    const addTech = (display) => {
        const key = normalize(display);
        if (key && key.length >= 2 && !tech.has(key)) tech.set(key, { key, words: key.split(' '), display });
    };
    for (const p of all) p.stack.forEach(addTech);
    for (const g of facts.tools.groups) g.items.forEach(addTech);
    KNOWN_TECH.forEach(addTech);
    const techWords = new Set([...tech.keys()].filter((k) => !k.includes(' ')));

    const projectIndex = aliasIndex(all, (p) => p.name ?? p.slug, techWords);
    const serviceIndex = aliasIndex(facts.services, (s) => s.name, techWords);
    const shared = sharedWords(all, (p) => p.name ?? p.slug);

    // Where else a tech term can come up, as normalised word lists.
    const mentions = {
        services: facts.services.map((s) => ({ name: s.name, words: tokens(`${s.name} ${s.delivered ?? ''}`) })),
        experience: [tokens(facts.experience.map((e) => [...e.did, e.proudest].join(' ')).join(' '))],
        story: [tokens(facts.origin.join(' '))],
        hobbies: [tokens(facts.hobbies.map((h) => h.text).join(' '))],
        tools: [tokens(facts.tools.summary ?? '')],
    };

    const faqIndex = facts.faq.map((f) => ({ ...f, words: new Set(tokens(f.q).filter((w) => !STOP.has(w) && w.length > 2)) }));
    const faqAbout = (re) => facts.faq.find((f) => re.test(f.q));

    const findTech = (ws) => {
        const hits = [...tech.values()].filter((t) => matchesName(ws, t.words));
        // "react native" wins over "react" when both are in the question.
        return hits.sort((a, b) => b.words.length - a.words.length)[0] ?? null;
    };

    const techEvidence = (term) => {
        // Tagged in the stack, or named in the project's own name or description ("Flutter App", a Dart repo).
        const usedIn = all.filter((p) => p.stack.some((item) => hasPhrase(tokens(item), term.words))
            || hasPhrase(tokens(`${p.name ?? ''} ${p.description ?? ''}`), term.words));
        // Projects with a write-up first, then by GitHub activity.
        usedIn.sort((a, b) => (a.source === b.source ? (b.github?.commits ?? 0) - (a.github?.commits ?? 0) : a.source === 'content' ? -1 : 1));
        const services = mentions.services.filter((s) => hasPhrase(s.words, term.words)).map((s) => s.name);
        const where = ['experience', 'story', 'hobbies', 'tools'].filter((k) => mentions[k].some((ws) => hasPhrase(ws, term.words)));
        const display = all.flatMap((p) => p.stack).find((item) => normalize(item) === term.key) ?? term.display;
        return { usedIn, services, where, display };
    };

    const contactVia = (P) => P.contactVia(facts.contact.email);

    const projectAnswer = (p, aspect, P) => {
        const L = P.labels;
        const head = `${p.name} ${cite(p.slug)}`;
        const cs = p.caseStudy ?? {};
        const gh = p.github ? P.github(p.github) : null;
        const parts = {
            stack: p.stack.length ? [`${L.stack}: ${p.stack.join(', ')}`] : [],
            links: [p.live && `${L.live}: ${p.live}`, p.repo && `${L.repo}: ${p.repo}`].filter(Boolean),
            github: [gh && `${L.github}: ${gh}`, p.repo && `${L.repo}: ${p.repo}`].filter(Boolean),
            story: [
                cs.problem && `${L.problem}: ${cs.problem}`,
                cs.hardestPart && `${L.hardest}: ${cs.hardestPart}`,
                cs.decision && `${L.decision}: ${cs.decision}`,
                cs.result && `${L.result}: ${cs.result}${cs.resultSource ? ` (${L.source}: ${cs.resultSource})` : ''}`,
            ].filter(Boolean),
        };
        if (aspect) {
            // A missing detail still gets what is known: the links and GitHub numbers.
            if (!parts[aspect].length) {
                const known = [...new Set([...parts.links, ...parts.github])];
                return [P.noDetail(head, contactVia(P)), known.map((x) => `- ${x}`).join('\n')].filter(Boolean).join('\n');
            }
            return `${head}\n${parts[aspect].map((x) => `- ${x}`).join('\n')}`;
        }
        const overview = [
            p.status && `${L.status}: ${p.status}`,
            p.builtFor && `${L.builtFor}: ${p.builtFor}`,
            p.role && `${L.role}: ${p.role}`,
            p.dates && `${L.dates}: ${p.dates}`,
            ...parts.stack,
            ...parts.story,
            p.xray && `${L.layers}: ${Object.entries(p.xray).filter(([, v]) => v).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(' · ')}`,
            ...parts.links,
            gh && `${L.github}: ${gh}`,
        ].filter(Boolean);
        return [
            p.description ? `${head}: ${p.description}` : head,
            overview.map((x) => `- ${x}`).join('\n'),
            P.projectFrom(DISTRICT_NAMES[p.district] ?? 'Downtown'),
        ].filter(Boolean).join('\n');
    };

    const answers = {
        injection: (P) => P.injection(),
        abuse: (P) => P.abuse(),
        greeting: (P) => P.greet(),
        thanks: (P) => P.thanks(),
        ack: (P) => P.ack(),
        about: (P) => P.about({ name: facts.name ?? 'Ojong', location: facts.location, bio: facts.bio, degree: facts.degree, years: facts.yearsCoding }),
        origin: (P) => (facts.origin[0] ? P.origin(facts.origin[0]) : null),
        location: (P) => (facts.location ? P.location(facts.location) : null),
        contact: (P) => P.contact(facts.contact),
        hire: (P) => [P.hire(contactVia(P)), facts.availability ? answers.availability(P) : null].filter(Boolean).join(' '),
        availability: (P) => {
            const open = facts.availability ? Object.entries({ freelance: 'freelance', fullTime: 'full-time', contract: 'contract', remote: 'remote' }).filter(([k]) => facts.availability[k]).map(([, v]) => v) : [];
            const faq = faqAbout(/availab|notice|disponib/i);
            return [open.length ? P.openTo(open.join(', ')) : P.availabilityUnknown(), faq ? P.ownAnswer(faq.a) : null].filter(Boolean).join(' ');
        },
        pricing: (P) => {
            const faq = faqAbout(/rate|pric|cost|fee|tarif|prix/i);
            return faq ? P.pricing(faq.a) : P.pricingUnknown();
        },
        // "And many more" is the owner's catch-all stall, not a service to list.
        services: (P) => {
            const names = facts.services.map((s) => s.name).filter((n) => !/many more/i.test(n));
            return names.length ? P.services(names) : null;
        },
        projects: (P) => P.projects({ total: all.length, featured: facts.projects.filter((p) => p.featured).map((p) => `${p.name} ${cite(p.slug)}`) }),
        count: (P) => P.count({ total: all.length, written: facts.projects.length, repos: facts.repos.length }),
        experience: (P) => (facts.experience.length ? [
            P.experience(facts.experience.map((e) => `${e.role}, ${e.company}${[e.dates, e.location].filter(Boolean).length ? ` (${[e.dates, e.location].filter(Boolean).join(' · ')})` : ''}`)),
            facts.experience[0].proudest ? P.proudest(facts.experience[0].proudest) : null,
        ].filter(Boolean).join('\n') : null),
        education: (P) => {
            const story = facts.origin.find((para) => /degree|hnd|cs50|certif|udemy|master/i.test(para));
            return facts.degree || story ? P.education({ degree: facts.degree, story }) : null;
        },
        teaching: (P) => (facts.teaching.length ? P.teaching(facts.teaching.map((t) => `${t.title}${[t.venue, t.audience].filter(Boolean).length ? ` (${[t.venue, t.audience].filter(Boolean).join('; ')})` : ''}`)) : null),
        video: (P) => (facts.video.length
            ? P.video(facts.video.map((v) => [v.title, v.role, v.link].filter(Boolean).join(' · ')))
            : P.videoNone({ youtube: facts.contact.youtube, hobby: facts.hobbies.find((h) => /video/i.test(h.name))?.text })),
        hobbies: (P) => (facts.hobbies.length ? P.hobbies(facts.hobbies.map((h) => `${h.name}: ${h.text}`)) : null),
        tools: (P) => (facts.tools.summary || facts.tools.groups.length ? P.tools({ summary: facts.tools.summary, groups: facts.tools.groups.map((g) => `${g.name}: ${g.items.join(', ')}`) }) : null),
        languages: (P) => (facts.spokenLanguages.length ? P.languages(facts.spokenLanguages) : P.languagesUnknown()),
        cv: (P) => (facts.contact.cv ? P.cv(facts.contact.cv) : P.cvUnknown()),
        testimonials: (P) => (facts.testimonials.length ? P.testimonials(facts.testimonials.map((t) => `"${t.quote}" (${t.name})`)) : P.testimonialsUnknown()),
        clients: (P) => (facts.clients.length ? P.clients(facts.clients) : null),
        github: (P) => (facts.contact.github ? P.githubProfile({ url: facts.contact.github, repos: facts.repos.length }) : null),
        city: (P) => P.city(),
    };

    // Next questions to offer after each kind of answer.
    const NEXT = {
        project: ['contact', 'projects', 'skill'],
        skill: ['projects', 'services', 'contact'],
        service: ['pricing', 'projects', 'contact'],
        pricing: ['services', 'contact', 'projects'],
        contact: ['services', 'pricing', 'projects'],
        hire: ['pricing', 'services', 'projects'],
        unknown: ['projects', 'services', 'contact'],
        default: ['projects', 'services', 'contact'],
        greeting: ['about', 'projects', 'services'],
        about: ['projects', 'experience', 'contact'],
        projects: ['skill', 'services', 'contact'],
        services: ['pricing', 'projects', 'contact'],
    };
    const featured = facts.projects.find((p) => p.featured) ?? facts.projects[0];
    const suggestionsFor = (kind, P) => {
        const keys = NEXT[kind] ?? NEXT.default;
        const list = keys.map((k) => (k === 'projects' && kind === 'projects' && featured ? P.suggestions.project(featured.name) : P.suggestions[k]));
        return [...new Set(list)].slice(0, 3);
    };

    const lastCited = (messages) => {
        for (let i = messages.length - 2; i >= 0; i -= 1) {
            if (messages[i].role !== 'assistant') continue;
            const found = [...new Set([...messages[i].content.matchAll(/\[([a-z0-9-]+)\]/g)].map((m) => m[1]).filter((s) => slugs.has(s)))];
            return found.length === 1 ? all.find((p) => p.slug === found[0]) : null;
        }
        return null;
    };

    const languageOf = (messages) => {
        const users = messages.filter((m) => m.role === 'user');
        const last = detectLanguage(users.at(-1)?.content ?? '');
        if (last !== 'en' || tokens(users.at(-1)?.content).length > 3) return last;
        // A short reply ("ok", "and Flutter?") keeps the language of the conversation so far.
        for (let i = users.length - 2; i >= 0; i -= 1) {
            const lang = detectLanguage(users[i].content);
            if (lang !== 'en') return lang;
        }
        return last;
    };

    /** Decide what the latest question is about. */
    const classify = (messages) => {
        const text = messages.at(-1)?.content ?? '';
        const ws = words(text);
        const intents = Object.fromEntries(Object.entries(INTENT_TOKENS).map(([k, ps]) => [k, score(ws, ps)]));
        const top = PRIORITY.filter((k) => intents[k] > 0).sort((a, b) => intents[b] - intents[a] || PRIORITY.indexOf(a) - PRIORITY.indexOf(b))[0] ?? null;
        const aspect = Object.keys(ASPECT_TOKENS).find((k) => score(ws, ASPECT_TOKENS[k]) > 0) ?? null;
        const strong = (...kinds) => kinds.some((k) => intents[k] > 0);

        if (intents.injection) return { kind: 'injection' };
        if (intents.abuse) return { kind: 'abuse' };

        const mentionsProjectWord = ws.some((w) => ['project', 'projet', 'repo', 'app', 'site', 'website'].includes(w));
        const projects = bestMatches(projectIndex, ws);
        const term = findTech(ws);
        // A project named after a technology ("threejs") only counts when the question says "project".
        const projectHit = projects.found.length && !(term && projects.found.every((p) => normalize(p.name) === term.key || p.slug === term.key.replace(/ /g, '-')) && !mentionsProjectWord);
        if (projectHit && !strong('pricing', 'contact', 'hire')) {
            if (projects.found.length > 1) return { kind: 'ambiguous', options: projects.found.slice(0, MAX_LISTED) };
            return { kind: 'project', project: projects.found[0], aspect };
        }

        const sharedHit = !projectHit && !term && ws.map((w) => shared.get(w)).find(Boolean);
        if (sharedHit && !strong('pricing', 'contact', 'hire', 'services')) return { kind: 'ambiguous', options: sharedHit };

        if (term && !strong('pricing', 'contact', 'hire', 'availability', 'cv', 'languages')) return { kind: 'skill', term };

        const services = bestMatches(serviceIndex, ws);
        if (services.found.length === 1 && (!top || ['services', 'hire', 'video', 'teaching'].includes(top) || services.score > 1)) {
            if (!strong('pricing')) return { kind: 'service', service: services.found[0] };
        }

        const faq = faqIndex
            .map((f) => ({ f, overlap: ws.filter((w) => [...f.words].some((fw) => sameWord(w, fw))).length }))
            .sort((a, b) => b.overlap - a.overlap)[0];
        if (faq && faq.overlap >= 2 && !['pricing', 'availability'].includes(top)) return { kind: 'faq', faq: faq.f };

        const followUp = FOLLOW_UP_TOKENS.some((p) => hasPhrase(ws, p)) || (aspect && !top);
        if (followUp) {
            const last = lastCited(messages);
            if (last) return { kind: 'project', project: last, aspect };
            if (!top || top === 'projects') return { kind: 'whichProject' };
        }

        if (top) return { kind: 'intent', intent: top };
        return { kind: 'unknown' };
    };

    return {
        /**
         * @param {{ role: 'user' | 'assistant', content: string }[]} messages  the conversation, ending with the visitor
         * @returns {{ text: string, lang: 'en' | 'fr' | 'pcm', detected: string, intent: string, citations: string[], suggestions: string[] }}
         */
        answer: (messages) => {
            const detected = languageOf(messages);
            const P = phrasesFor(detected);
            const c = classify(messages);
            let text = null;
            let kind = c.kind;

            if (c.kind === 'project') text = projectAnswer(c.project, c.aspect, P);
            else if (c.kind === 'ambiguous') text = P.ambiguous(c.options.map((p) => `${p.name} ${cite(p.slug)}`));
            else if (c.kind === 'whichProject') text = P.whichProject();
            else if (c.kind === 'skill') {
                const ev = techEvidence(c.term);
                if (ev.usedIn.length) {
                    const listed = ev.usedIn.slice(0, MAX_LISTED);
                    text = [
                        P.skillYes({ term: ev.display, cites: listed.map((p) => `${p.name} ${cite(p.slug)}`), more: ev.usedIn.length - listed.length }),
                        ev.services.length ? P.skillServices(ev.services) : null,
                    ].filter(Boolean).join(' ');
                } else if (ev.services.length || ev.where.length) {
                    text = P.skillMentioned({ term: ev.display, where: [...(ev.services.length ? [P.where.services] : []), ...ev.where.map((w) => P.where[w])] });
                } else text = P.skillNo(ev.display, contactVia(P));
            } else if (c.kind === 'service') {
                const s = c.service;
                text = P.service({ name: s.name, delivered: s.delivered, examples: s.examples.map((slug) => `${all.find((p) => p.slug === slug)?.name ?? slug} ${cite(slug)}`) });
            } else if (c.kind === 'faq') text = P.ownAnswer(c.faq.a);
            else if (c.kind === 'intent') {
                kind = c.intent;
                text = answers[c.intent]?.(P) ?? null;
            } else if (c.kind === 'injection' || c.kind === 'abuse') text = answers[c.kind](P);

            if (!text) {
                kind = 'unknown';
                text = P.unknown(contactVia(P));
            }
            const citations = [...new Set([...text.matchAll(/\[([a-z0-9-]+)\]/g)].map((m) => m[1]).filter((s) => slugs.has(s)))];
            return {
                text,
                lang: detected === 'pcm' && !PIDGIN_APPROVED ? 'en' : detected,
                detected,
                intent: kind,
                citations,
                suggestions: suggestionsFor(kind === 'intent' ? c.intent : kind, P),
            };
        },
    };
};
