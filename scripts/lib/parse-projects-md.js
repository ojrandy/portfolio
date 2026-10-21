// Parses docs/projects.md into { profile, projects }. Tolerant of small formatting slips
// (missing/extra `**`, `*Dates:**`, `Present-`), strict about anything it can't place:
// unknown fields and unreadable values are reported with their line number, never dropped.
import { TODO, STATUSES, CATEGORIES, DISTRICTS } from '../../content/schema.js';

const DEMO_RE = /^\[DEMO\]\s*/i;
const ANGLE_ONLY_RE = /^<[^<>]*>$/;
const URL_RE = /https?:\/\/[^\s)>\]]+/;
const BULLET_RE = /^([-+]|\*(?!\*)|\d+[.:)])\s*/;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const SECTIONS = [
    ['profile', 'profile'],
    ['experience', 'experience'],
    ['project', 'projects'],
    ['teaching', 'teaching'],
    ['video', 'video'],
    ['testimonial', 'testimonials'],
    ['number', 'stats'],
    ['tool', 'tools'],
    ['faq', 'faq'],
];

// ---------- small helpers ----------

const readValue = (raw = '') => {
    let v = raw.replace(/\*+\s*$/, '').trim();
    const demo = DEMO_RE.test(v);
    if (demo) v = v.replace(DEMO_RE, '').trim();
    return { v, demo };
};

const isNone = (v) => /^(—|–|-|none|n\/a)$/i.test(v);
const isTodo = (v) => v === '' || ANGLE_ONLY_RE.test(v) || v.startsWith(TODO);

const normKey = (key) =>
    key.replace(/\(.*?\)/g, '').replace(/[*]/g, '').replace(/[:?]+\s*$/, '').replace(/\s+/g, ' ').trim().toLowerCase();

export const slugify = (s) =>
    s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const splitField = (text) => {
    let m = text.match(/^\*\*([^*]+?)\*\*\s*:?\s*(.*)$/);
    if (m) return { key: m[1], value: m[2] };
    m = text.match(/^\**\s*([^:*]+?)\s*\**\s*:\s*\**\s*(.*)$/);
    return m ? { key: m[1], value: m[2] } : null;
};

// Splits on commas that are not inside parentheses: "Firebase (Auth, Firestore), Flutter".
const splitList = (v) => {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const ch of v) {
        if (ch === '(') depth += 1;
        if (ch === ')') depth = Math.max(0, depth - 1);
        if (ch === ',' && depth === 0) {
            out.push(cur);
            cur = '';
        } else {
            cur += ch;
        }
    }
    out.push(cur);
    return out.map((s) => s.trim()).filter(Boolean);
};

const setPath = (obj, path, value) => {
    const keys = path.split('.');
    const last = keys.pop();
    keys.reduce((o, k) => o[k], obj)[last] = value;
};

const stripQuotes = (v) => v.replace(/^["“](.*)["”]$/s, '$1').trim();

// ---------- value parsers: (v, ctx) => value; ctx.err(msg) reports and the caller keeps going ----------

const P = {
    text: (v) => (v === '' || ANGLE_ONLY_RE.test(v) ? TODO : v),
    noneable: (v) => (isNone(v) ? null : P.text(v)),
    optional: (v) => (v === '' || isNone(v) ? null : P.text(v)),

    int: (min, max) => (v, ctx) => {
        if (isTodo(v)) return TODO;
        if (!/^\d+$/.test(v) || +v < min || +v > max) {
            ctx.err(`expected a whole number ${min}–${max}, got "${v}"`);
            return TODO;
        }
        return Number(v);
    },

    effort: (v, ctx) => {
        if (isTodo(v) || isNone(v)) return null;
        const n = P.int(1, 10)(v, ctx);
        return n === TODO ? null : n;
    },

    bool: (v, ctx) => {
        if (/^yes\s*\/\s*no$/i.test(v)) {
            ctx.warn('not answered (still "yes / no")');
            return TODO;
        }
        if (/^(yes|y|true)\b/i.test(v)) return true;
        if (/^(no|n|false)\b/i.test(v)) return false;
        if (isTodo(v)) return TODO;
        ctx.err(`expected "yes" or "no", got "${v}"`);
        return TODO;
    },

    featured: (v, ctx) => {
        const b = P.bool(v, ctx);
        return b === TODO ? false : b;
    },

    url: ({ allowPrivate = false, optional = false } = {}) => (v, ctx) => {
        const m = v.match(URL_RE);
        if (m) return m[0].replace(/[.,;]+$/, '');
        if (v === '') return optional ? null : TODO;
        if (isTodo(v)) return TODO;
        if (isNone(v)) return null;
        if (/^private\b/i.test(v)) return allowPrivate ? 'private' : null;
        ctx.err(`expected a URL, "—" or ${TODO}${allowPrivate ? ' or "private"' : ''}, got "${v}"`);
        return TODO;
    },

    list: (v, ctx) => {
        if (isTodo(v)) return TODO;
        const parts = splitList(v);
        const items = parts.filter((s) => !/^(…|\.\.\.)$/.test(s));
        if (items.length !== parts.length) ctx.warn('list ends with "…": add the missing items or remove the "…"');
        return items.length ? items : TODO;
    },

    slug: (v, ctx) => {
        if (isTodo(v)) return TODO;
        const s = slugify(v);
        if (s !== v) ctx.warn(`slug "${v}" converted to "${s}"`);
        return s;
    },

    status: (v, ctx) => {
        if (isTodo(v)) return TODO;
        const s = v.toLowerCase().replace(/[\s_]+/g, '-');
        if (STATUSES.includes(s)) return s;
        ctx.err(`expected one of ${STATUSES.join(', ')}, got "${v}"`);
        return TODO;
    },

    district: (v, ctx) => {
        const s = v.toLowerCase();
        if (DISTRICTS.includes(s)) return s;
        ctx.err(`expected one of ${DISTRICTS.join(', ')}, got "${v}"`);
        return 'downtown';
    },

    category: (v, ctx) => {
        if (isTodo(v)) return TODO;
        const parts = v.split(/[/,]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
        const bad = parts.filter((s) => !CATEGORIES.includes(s));
        if (bad.length) {
            ctx.err(`unknown category "${bad.join(', ')}" (allowed: ${CATEGORIES.join(', ')})`);
            return TODO;
        }
        return parts;
    },

    dates: (v, ctx) => {
        if (isTodo(v) && !v.includes('→')) return { start: TODO, end: TODO };
        const parts = v.split(/\s*(?:→|->|–|—|\bto\b)\s*/i);
        if (parts.length > 2) {
            ctx.err(`expected "start → end", got "${v}"`);
            return { start: TODO, end: TODO };
        }
        const start = parseMonth(parts[0]);
        const end = parts.length === 2 ? parseMonth(parts[1]) : start;
        if (start === undefined || end === undefined) {
            ctx.err(`can't read the date in "${v}" (use YYYY-MM, YYYY, "present" or "1 October 2026")`);
            return { start: TODO, end: TODO };
        }
        if (start === 'present') {
            ctx.err(`start date can't be "present" in "${v}"`);
            return { start: TODO, end };
        }
        if (start !== TODO && end !== TODO && end !== 'present' && end < start) {
            ctx.err(`end date is before start date in "${v}"`);
        }
        return { start, end };
    },
};

// Returns "YYYY-MM" | "YYYY" | "present" | TODO, or undefined if unreadable.
const parseMonth = (raw) => {
    const v = raw.trim().replace(/[\s\-–—]+$/, '').trim();
    if (isTodo(v)) return TODO;
    if (/^(present|now|current|today)$/i.test(v)) return 'present';
    let m = v.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
    if (m) {
        const month = Number(m[2]);
        return month >= 1 && month <= 12 ? `${m[1]}-${String(month).padStart(2, '0')}` : undefined;
    }
    if (/^\d{4}$/.test(v)) return v;
    m = v.match(/^(?:\d{1,2}(?:st|nd|rd|th)?\s+)?([a-z]+)\.?,?\s+(\d{4})$/i);
    if (m) {
        const i = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
        return i === -1 ? undefined : `${m[2]}-${String(i + 1).padStart(2, '0')}`;
    }
    return undefined;
};

// ---------- document structure ----------

const toTree = (lines) => {
    const items = [];
    const paras = [];
    let gap = false; // a blank line since the last paragraph line
    for (const { text, n } of lines) {
        const body = text.trim();
        if (!body) gap = paras.length > 0;
        if (!body || /^-{3,}$/.test(body)) continue;
        const indent = text.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
        if (BULLET_RE.test(body) && !body.startsWith('|')) {
            const item = { n, text: body.replace(BULLET_RE, ''), children: [] };
            if (indent > 0 && items.length) items.at(-1).children.push(item);
            else items.push(item);
        } else {
            paras.push({ n, text: body, gap });
            gap = false;
        }
    }
    return { items, paras };
};

const splitBlocks = (lines) => {
    const preamble = [];
    const blocks = [];
    for (const line of lines) {
        const m = line.text.match(/^###\s+(.+?)\s*$/);
        if (m) blocks.push({ title: m[1], n: line.n, lines: [] });
        else (blocks.length ? blocks.at(-1).lines : preamble).push(line);
    }
    return { preamble, blocks };
};

export const parseProjectsMd = (md, file = 'docs/projects.md') => {
    const errors = [];
    const warnings = [];
    const at = (n, prefix = '') => ({
        err: (msg) => errors.push(`${file}:${n}: ${prefix}${msg}`),
        warn: (msg) => warnings.push(`${file}:${n}: ${prefix}${msg}`),
    });

    // Remove HTML comments but keep line numbers.
    const clean = md.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ''));
    const lines = clean.split(/\r?\n/).map((text, i) => ({ text, n: i + 1 }));

    const sections = {};
    let current = null;
    for (const line of lines) {
        const m = line.text.match(/^##\s+(.+?)\s*$/);
        if (m) {
            const title = m[1].toLowerCase();
            const hit = SECTIONS.find(([kw]) => title.includes(kw));
            if (!hit) {
                at(line.n).err(`unknown section "## ${m[1]}"`);
                current = null;
            } else if (sections[hit[1]]) {
                at(line.n).err(`section "${hit[1]}" appears twice`);
                current = null;
            } else {
                current = { n: line.n, lines: [] };
                sections[hit[1]] = current;
            }
        } else if (current) {
            current.lines.push(line);
        }
    }
    for (const [, id] of SECTIONS) {
        if (!sections[id]) {
            at(1).err(`missing section for "${id}"`);
            sections[id] = { n: 1, lines: [] };
        }
    }

    const warnStray = (paras) => {
        for (const p of paras) {
            if (/^[_>|]/.test(p.text)) continue;
            at(p.n).warn(`ignored text (not a "- **Field:** value" bullet): "${p.text.slice(0, 60)}"`);
        }
    };

    // Generic "- **Field:** value" reader for one record.
    const readFields = (items, spec, record, special = {}) => {
        const seen = new Set();
        for (const item of items) {
            const f = splitField(item.text);
            if (!f) {
                at(item.n).err(`can't read this line as "Field: value": "${item.text}"`);
                continue;
            }
            const key = normKey(f.key);
            const label = f.key.trim().replace(/[:?]+$/, '');
            if (seen.has(key)) at(item.n).err(`"${label}" is written twice in this block`);
            seen.add(key);
            const ctx = at(item.n, `${label}: `);
            if (special[key]) {
                special[key](f.value, item, ctx);
                continue;
            }
            const entry = spec[key];
            if (!entry) {
                at(item.n).err(`unknown field "${label}". Known fields: ${Object.keys({ ...spec, ...special }).join(', ')}`);
                continue;
            }
            if (item.children.length) ctx.err('this field does not take sub-bullets');
            const { v, demo } = readValue(f.value);
            const [path, parse] = entry;
            setPath(record, path, parse(v, ctx));
            if (demo) record.demoFields.push(path);
        }
    };

    // ---------- 1. Profile ----------
    const profile = {
        name: TODO,
        title: TODO,
        location: TODO,
        culture: TODO,
        availability: { freelance: false, fullTime: false, contract: false, remote: false },
        email: TODO,
        links: { github: TODO, githubUsername: TODO, linkedin: TODO, x: null, youtube: null },
        cv: null,
        yearsCoding: TODO,
        languages: TODO,
        degree: TODO,
        bio: TODO,
        origin: TODO,
        services: [],
        hobbies: [],
        motifs: [],
        experience: [],
        teaching: [],
        video: [],
        testimonials: [],
        stats: [],
        tools: { summary: TODO, groups: [] },
        clients: [],
        faq: [],
        github: { accounts: [], hide: [] },
        demoFields: [],
    };
    let githubAccountsSet = false;

    {
        const { preamble, blocks } = splitBlocks(sections.profile.lines);
        const { items, paras } = toTree(preamble);
        warnStray(paras);
        readFields(items, {
            'full name': ['name', P.text],
            'title / one-liner': ['title', P.text],
            location: ['location', P.text],
            culture: ['culture', P.text],
            'available for': ['availability', (v, ctx) => parseAvailability(v, ctx)],
            email: ['email', P.text],
            linkedin: ['links.linkedin', P.url()],
            'x / twitter': ['links.x', P.url({ optional: true })],
            'youtube / video reel': ['links.youtube', P.url({ optional: true })],
            'cv path or link': ['cv', P.optional],
            'years coding': ['yearsCoding', P.text],
            'languages spoken': ['languages', P.list],
            degree: ['degree', P.text],
        }, profile, {
            'github username': (value, item, ctx) => {
                const { v, demo } = readValue(value);
                const url = v.match(/https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]+)/);
                if (url) {
                    profile.links.github = `https://github.com/${url[1]}`;
                    profile.links.githubUsername = url[1];
                } else if (/^[A-Za-z0-9-]+$/.test(v)) {
                    profile.links.github = `https://github.com/${v}`;
                    profile.links.githubUsername = v;
                } else if (!isTodo(v)) {
                    ctx.err(`expected a GitHub username or https://github.com/<username>, got "${v}"`);
                }
                if (demo) profile.demoFields.push('links.github');
            },
            // ADR-012: public repos of these accounts become buildings automatically.
            'github accounts for the city': (value, item, ctx) => {
                githubAccountsSet = true;
                const { v } = readValue(value);
                if (v === '' || isNone(v) || isTodo(v)) return;
                for (const raw of splitList(v)) {
                    const name = raw.replace(/^https?:\/\/(?:www\.)?github\.com\//i, '').replace(/\/+$/, '');
                    if (/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(name)) {
                        if (!profile.github.accounts.some((a) => a.toLowerCase() === name.toLowerCase())) profile.github.accounts.push(name);
                    } else {
                        ctx.err(`expected a GitHub account name or https://github.com/<account>, got "${raw}"`);
                    }
                }
            },
            'hide these repos': (value, item, ctx) => {
                const { v } = readValue(value);
                if (v === '' || isNone(v) || isTodo(v)) return;
                for (const raw of splitList(v)) {
                    const name = raw.replace(/^https?:\/\/(?:www\.)?github\.com\//i, '').replace(/\/+$/, '');
                    if (/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(name)) profile.github.hide.push(name.toLowerCase());
                    else ctx.err(`expected owner/repo or a github.com repo URL, got "${raw}"`);
                }
            },
        });
        // Without the field, scan the main account only.
        if (!githubAccountsSet && profile.links.githubUsername !== TODO) profile.github.accounts.push(profile.links.githubUsername);

        for (const block of blocks) {
            const title = block.title.toLowerCase();
            const { items, paras } = toTree(block.lines);
            // A blank line starts a new paragraph; other line breaks are spaces.
            const paragraph = () => paras
                .filter((p) => !/^_.*_$/.test(p.text)) // _notes for the owner_
                .map((p, i) => (i === 0 ? '' : p.gap ? '\n\n' : ' ') + p.text).join('').trim();
            const bullets = () => items.map((i) => {
                const { v, demo } = readValue(i.text);
                return { v, demo, n: i.n };
            });
            if (title.includes('bio')) {
                profile.bio = P.text(paragraph());
            } else if (title.includes('origin')) {
                profile.origin = P.text(paragraph());
            } else if (title.includes('service')) {
                warnStray(paras);
                profile.services = bullets().map((b) => b.v).filter(Boolean);
            } else if (title.includes('hobb')) {
                warnStray(paras);
                profile.hobbies = bullets().flatMap(({ v, n }) => {
                    const f = splitField(v);
                    if (!f) {
                        at(n).err(`expected "Hobby: description", got "${v}"`);
                        return [];
                    }
                    return [{ name: f.key.trim(), text: P.text(f.value.trim()) }];
                });
            } else if (title.includes('motif')) {
                warnStray(paras);
                profile.motifs = bullets().map((b) => b.v).filter((v) => v && !/^none\b/i.test(v));
            } else {
                at(block.n).err(`unknown profile sub-section "### ${block.title}"`);
            }
        }
    }

    // ---------- 2. Experience ----------
    {
        const { preamble, blocks } = splitBlocks(sections.experience.lines);
        warnStray(toTree(preamble).paras);
        for (const block of blocks) {
            const { items, paras } = toTree(block.lines);
            warnStray(paras);
            const role = {
                role: TODO,
                company: TODO,
                dates: { start: TODO, end: TODO },
                location: TODO,
                did: [],
                proudest: TODO,
                demo: DEMO_RE.test(block.title),
                demoFields: [],
            };
            readFields(items, {
                role: ['role', P.text],
                company: ['company', P.text],
                dates: ['dates', P.dates],
                location: ['location', P.text],
                'proudest result': ['proudest', P.text],
            }, role, {
                'what you did': (value, item) => {
                    const inline = readValue(value).v;
                    if (inline) role.did.push(inline);
                    item.children.forEach((c, i) => {
                        const { v, demo } = readValue(c.text);
                        if (v) role.did.push(v);
                        if (demo) role.demoFields.push(`did.${i}`);
                    });
                },
            });
            profile.experience.push(role);
        }
        const starts = profile.experience.map((r) => r.dates.start).filter((s) => s !== TODO);
        if (starts.some((s, i) => i > 0 && s > starts[i - 1])) {
            at(sections.experience.n).warn('roles are not in newest-first order');
        }
    }

    // ---------- 3. Projects ----------
    const projects = [];
    {
        const { preamble, blocks } = splitBlocks(sections.projects.lines);
        warnStray(toTree(preamble).paras);
        for (const block of blocks) {
            const { items, paras } = toTree(block.lines);
            warnStray(paras);
            const { v: name, demo } = readValue(block.title);
            const p = {
                slug: TODO,
                name: P.text(name),
                district: 'downtown',
                featured: false,
                status: TODO,
                live: TODO,
                repo: TODO,
                builtFor: TODO,
                role: TODO,
                teamSize: TODO,
                dates: { start: TODO, end: TODO },
                stack: TODO,
                category: TODO,
                caseStudy: { problem: TODO, hardestPart: TODO, decision: TODO, result: TODO, resultSource: null },
                xray: { ui: TODO, api: TODO, data: TODO, infra: TODO },
                stats: { effort: null },
                media: TODO,
                iframe: TODO,
                demo,
                demoFields: [],
            };
            readFields(items, {
                slug: ['slug', P.slug],
                name: ['name', P.text],
                district: ['district', P.district],
                featured: ['featured', P.featured],
                status: ['status', P.status],
                'live url': ['live', P.url()],
                'repo url': ['repo', P.url({ allowPrivate: true })],
                'built for': ['builtFor', P.text],
                'your role': ['role', P.text],
                'team size': ['teamSize', P.int(1, 1000)],
                dates: ['dates', P.dates],
                stack: ['stack', P.list],
                category: ['category', P.category],
                problem: ['caseStudy.problem', P.text],
                'hardest part': ['caseStudy.hardestPart', P.text],
                decision: ['caseStudy.decision', P.text],
                effort: ['stats.effort', P.effort],
                media: ['media', P.noneable],
                'can the live site be shown in an iframe': ['iframe', P.bool],
            }, p, {
                result: (value, item, ctx) => {
                    if (item.children.length) ctx.err('write the result on one line, ending with "Source: …"');
                    const { v, demo } = readValue(value);
                    const m = v.match(/^(.*?)[\s.;,]*\bSource:\s*(.*)$/is);
                    const result = P.text((m ? m[1] : v).trim());
                    const source = m ? m[2].trim() : '';
                    p.caseStudy.result = result;
                    if (source) {
                        p.caseStudy.resultSource = P.text(source);
                    } else if (/\d/.test(result) && result !== TODO) {
                        p.caseStudy.resultSource = TODO;
                        ctx.warn('has numbers but no "Source: …"');
                    }
                    if (demo) p.demoFields.push('caseStudy.result');
                },
                'x-ray layers': (value, item, ctx) => {
                    if (readValue(value).v) ctx.err('put each layer on its own sub-bullet ("  - UI: …")');
                    const layers = { ui: 'ui', api: 'api', data: 'data', infra: 'infra', hosting: 'infra', 'infra / hosting': 'infra' };
                    for (const c of item.children) {
                        const f = splitField(c.text);
                        const layer = f && layers[normKey(f.key)];
                        if (!layer) {
                            at(c.n).err(`expected "UI:", "API:", "Data:" or "Infra / hosting:", got "${c.text}"`);
                            continue;
                        }
                        const { v, demo } = readValue(f.value);
                        p.xray[layer] = P.noneable(v);
                        if (demo) p.demoFields.push(`xray.${layer}`);
                    }
                },
            });
            if (p.slug === TODO && p.name !== TODO) p.slug = slugify(p.name);
            projects.push(p);
        }
    }

    // ---------- 4. Teaching / 5. Video: one line per item ----------
    const inlineItems = (section, known, build) => {
        const { items, paras } = toTree(section.lines);
        warnStray(paras);
        for (const item of items) {
            const { v, demo } = readValue(item.text);
            const m = v.match(/^\*\*(.+?)\*\*\s*[:·]?\s*(.*)$/);
            if (!m) {
                at(item.n).err(`expected "**Title** · …", got "${item.text}"`);
                continue;
            }
            const fields = { link: null, free: [] };
            for (const part of m[2] ? m[2].split(/\s+·\s+/) : []) {
                const p = part.trim();
                const kv = p.match(/^([a-z][a-z ]*?)\s*:\s*(.*)$/i);
                if (URL_RE.test(p) && (!kv || /^https?$/i.test(kv[1]))) fields.link = p.match(URL_RE)[0];
                else if (p.startsWith(TODO) && !fields.link) fields.link = TODO;
                else if (kv && known.includes(kv[1].toLowerCase())) fields[kv[1].toLowerCase()] = kv[2].trim();
                else if (kv) at(item.n).err(`unknown key "${kv[1]}" (known: ${known.join(', ')})`);
                else fields.free.push(p);
            }
            build(m[1].trim(), fields, demo, item.n);
        }
    };

    inlineItems(sections.teaching, ['audience', 'date', 'courses', 'link'], (title, f, demo) => {
        profile.teaching.push({
            title,
            venue: f.free[0] ?? null,
            audience: f.audience ?? null,
            courses: f.courses ?? null,
            date: f.date ?? null,
            link: f.link,
            demo,
            demoFields: [],
        });
    });

    inlineItems(sections.video, ['what you did', 'tools', 'link', 'file'], (title, f, demo, n) => {
        if (f.free.length) at(n).err(`don't know where "${f.free.join(' · ')}" goes; use "key: value"`);
        profile.video.push({
            title,
            link: f.link,
            file: f.file ?? null,
            role: f['what you did'] ?? null,
            tools: f.tools ? splitList(f.tools) : [],
            demo,
            demoFields: [],
        });
    });

    // ---------- 6. Testimonials ----------
    {
        const { items, paras } = toTree(sections.testimonials.lines);
        warnStray(paras);
        for (const item of items) {
            const f = splitField(item.text);
            if (!f || normKey(f.key) !== 'quote') {
                at(item.n).err(`each testimonial starts with "- **Quote:** …", got "${item.text}"`);
                continue;
            }
            const { v, demo } = readValue(f.value);
            const t = { quote: P.text(stripQuotes(v)), name: TODO, link: null, permission: false, demo, demoFields: [] };
            for (const c of item.children) {
                const cf = splitField(c.text);
                const key = cf && normKey(cf.key);
                const ctx = at(c.n, cf ? `${cf.key.trim().replace(/:$/, '')}: ` : '');
                const { v: cv, demo: cdemo } = readValue(cf?.value);
                if (key === 'name, role, company') {
                    t.name = P.text(cv);
                    if (cdemo) t.demoFields.push('name');
                } else if (key === 'link') {
                    t.link = P.url({ optional: true })(cv, ctx);
                } else if (key === 'permission confirmed') {
                    const b = P.bool(cv, ctx);
                    t.permission = b === true;
                    if (b === TODO) ctx.warn('treated as "no" until confirmed');
                } else {
                    at(c.n).err(`unknown testimonial field "${c.text}"`);
                }
            }
            profile.testimonials.push(t);
        }
    }

    // ---------- 7. Stats table ----------
    {
        const rows = sections.stats.lines.filter((l) => l.text.trim().startsWith('|'));
        warnStray(toTree(sections.stats.lines.filter((l) => !l.text.trim().startsWith('|'))).paras);
        rows.forEach((row, i) => {
            const cells = row.text.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
            if (i === 0 || cells.every((c) => /^:?-+:?$/.test(c))) return;
            if (cells.length !== 3) {
                at(row.n).err(`stats rows need exactly 3 cells (Stat | Value | Source), found ${cells.length}`);
                return;
            }
            const { v: label, demo } = readValue(cells[0]);
            profile.stats.push({ label: P.text(label), value: P.text(cells[1]), source: P.text(cells[2]), demo, demoFields: [] });
        });
    }

    // ---------- 8. Tools & clients ----------
    {
        const { items, paras } = toTree(sections.tools.lines);
        warnStray(paras);
        for (const item of items) {
            const f = splitField(item.text);
            const key = f && normKey(f.key);
            if (key === 'tools you actually use') {
                profile.tools.summary = P.text(readValue(f.value).v);
                for (const c of item.children) {
                    const { v, demo } = readValue(c.text);
                    const g = splitField(v);
                    if (!g) {
                        at(c.n).err(`expected "Group: tool, tool", got "${c.text}"`);
                        continue;
                    }
                    const list = P.list(g.value.trim(), at(c.n));
                    profile.tools.groups.push({ name: g.key.trim(), items: list === TODO ? [TODO] : list, demo, demoFields: [] });
                }
            } else if (key?.startsWith('clients')) {
                const logoPermission = /^yes\b/i.test(readValue(f.value).v);
                for (const c of item.children) {
                    profile.clients.push({ text: readValue(c.text).v, logoPermission });
                }
            } else {
                at(item.n).err(`unknown line "${item.text}" (expected "Tools you actually use:" or "Clients/companies…:")`);
            }
        }
    }

    // ---------- 9. FAQ ----------
    {
        const { items, paras } = toTree(sections.faq.lines);
        warnStray(paras);
        for (const item of items) {
            const m = item.text.match(/^\*\*Q:\*\*\s*(.+?\?)\s*\*\*\s*(?:A:\s*\**\s*)?(.*?)\s*\**\s*$/s);
            if (!m) {
                at(item.n).err(`expected "**Q:** question? **A:** answer", got "${item.text.slice(0, 60)}"`);
                continue;
            }
            const q = readValue(m[1]);
            const a = readValue(m[2]);
            profile.faq.push({ q: P.text(q.v), a: P.text(a.v), demo: q.demo || a.demo, demoFields: [] });
        }
    }

    return { profile, projects, errors, warnings };
};

const parseAvailability = (v, ctx) => {
    const out = {};
    const YES = '☑|☒|✅|✔|✓|\\[x\\]';
    const NO = '☐|\\[ \\]';
    for (const [key, label] of [['freelance', 'freelance'], ['fullTime', 'full-time'], ['contract', 'contract'], ['remote', 'remote']]) {
        const m = v.match(new RegExp(`${label}\\s*(${YES}|${NO})|(${YES}|${NO})\\s*${label}`, 'i'));
        if (!m) {
            ctx.err(`missing a ☑/☐ box for "${label}"`);
            out[key] = false;
            continue;
        }
        out[key] = !new RegExp(`^(${NO})$`).test(m[1] ?? m[2]);
    }
    return out;
};
