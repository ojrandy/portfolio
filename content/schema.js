// Content schemas, shared by scripts/ and server/. The JSON files are generated from
// docs/projects.md by `npm run content:build` (ADR-010); never edit them by hand.
import { z } from 'zod';

export const TODO = 'TODO(content)';

export const DISTRICTS = ['downtown', 'cinema', 'arcade', 'school', 'pitch'];
export const STATUSES = ['live', 'in-progress', 'archived'];
export const CATEGORIES = ['web', 'mobile', '3d', 'desktop', 'design', 'video', 'infra'];

const todo = z.literal(TODO);
const orTodo = (schema) => z.union([schema, todo]);

// Free text. A missing value is the string TODO(content), which this also accepts.
const text = z.string().trim().min(1);
const url = z.url({ protocol: /^https?$/ });
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase-with-dashes');
const month = z.string().regex(/^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/, 'expected YYYY-MM or YYYY');

const dates = z.strictObject({
    start: orTodo(month),
    end: z.union([month, z.literal('present'), todo]),
});

// `demo`: the whole record is placeholder. `demoFields`: only these fields are.
const demoMeta = {
    demo: z.boolean(),
    demoFields: z.array(z.string()),
};

export const projectSchema = z.strictObject({
    slug,
    name: text,
    district: z.enum(DISTRICTS),
    featured: z.boolean(),
    status: orTodo(z.enum(STATUSES)),
    live: z.union([url, z.null(), todo]),
    repo: z.union([url, z.literal('private'), z.null(), todo]),
    builtFor: text,
    role: text,
    teamSize: orTodo(z.int().min(1)),
    dates,
    stack: orTodo(z.array(text).min(1)),
    category: orTodo(z.array(z.enum(CATEGORIES)).min(1)),
    caseStudy: z.strictObject({
        problem: text,
        hardestPart: text,
        decision: text,
        result: text,
        // Required (TODO allowed) when the result contains a number; null otherwise.
        resultSource: z.union([text, z.null()]),
    }),
    // null = this layer doesn't exist (e.g. a static site has no API).
    xray: z.strictObject({
        ui: z.union([text, z.null()]),
        api: z.union([text, z.null()]),
        data: z.union([text, z.null()]),
        infra: z.union([text, z.null()]),
    }),
    // Owner-supplied stats. GitHub stats (commits, stars, lastPush, languages) are merged in by /api/city.
    stats: z.strictObject({
        effort: z.union([z.int().min(1).max(10), z.null()]),
    }),
    media: z.union([text, z.null()]),
    iframe: orTodo(z.boolean()),
    ...demoMeta,
});

const experienceSchema = z.strictObject({
    role: text,
    company: text,
    dates,
    location: text,
    did: z.array(text),
    proudest: text,
    ...demoMeta,
});

const teachingSchema = z.strictObject({
    title: text,
    venue: z.union([text, z.null()]),
    audience: z.union([text, z.null()]),
    courses: z.union([text, z.null()]),
    date: z.union([text, z.null()]),
    link: z.union([url, z.null(), todo]),
    ...demoMeta,
});

const videoSchema = z.strictObject({
    title: text,
    link: z.union([url, z.null(), todo]),
    role: z.union([text, z.null()]),
    tools: z.array(text),
    ...demoMeta,
});

const testimonialSchema = z.strictObject({
    quote: text,
    name: text,
    link: z.union([url, z.null(), todo]),
    // Only `true` may ever be rendered.
    permission: z.boolean(),
    ...demoMeta,
});

const statSchema = z.strictObject({
    label: text,
    value: text,
    source: text,
    ...demoMeta,
});

export const profileSchema = z.strictObject({
    name: text,
    title: text,
    location: text,
    culture: text,
    availability: z.strictObject({
        freelance: z.boolean(),
        fullTime: z.boolean(),
        contract: z.boolean(),
        remote: z.boolean(),
    }),
    email: orTodo(z.email()),
    links: z.strictObject({
        github: orTodo(url),
        githubUsername: text,
        linkedin: z.union([url, z.null(), todo]),
        x: z.union([url, z.null(), todo]),
        youtube: z.union([url, z.null(), todo]),
    }),
    cv: z.union([text, z.null()]),
    yearsCoding: text,
    languages: orTodo(z.array(text).min(1)),
    degree: text,
    bio: text,
    origin: text,
    services: z.array(text),
    hobbies: z.array(z.strictObject({ name: text, text })),
    motifs: z.array(text),
    experience: z.array(experienceSchema),
    teaching: z.array(teachingSchema),
    video: z.array(videoSchema),
    testimonials: z.array(testimonialSchema),
    stats: z.array(statSchema),
    tools: z.strictObject({
        summary: text,
        groups: z.array(z.strictObject({ name: text, items: z.array(text).min(1), ...demoMeta })),
    }),
    clients: z.array(z.strictObject({ text, logoPermission: z.boolean() })),
    faq: z.array(z.strictObject({ q: text, a: text, ...demoMeta })),
    demoFields: z.array(z.string()),
});

const generated = z.string();

export const projectsFileSchema = z.strictObject({
    $generated: generated,
    projects: z.array(projectSchema),
});

export const profileFileSchema = profileSchema.extend({ $generated: generated });
