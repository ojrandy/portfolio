// Client-side check of the /api/city response (shape in docs/architecture.md).
// Only the fields the city uses are checked; extra fields pass through.
import { z } from 'zod';

const statsSchema = z.object({
    source: z.enum(['github', 'owner', 'none']),
    commits: z.number().int().min(0).nullable(),
    stars: z.number().int().min(0).nullable(),
    lastPush: z.string().nullable(),
    languages: z.record(z.string(), z.number()).nullable(),
});

const projectSchema = z.looseObject({
    slug: z.string().min(1),
    name: z.string(),
    district: z.string(),
    featured: z.boolean(),
    status: z.enum(['live', 'in-progress', 'archived']).nullable(),
    stack: z.array(z.string()),
    live: z.string().nullable(),
    repo: z.string().nullable(),
    primaryLanguage: z.string().nullable(),
    effort: z.number().int().min(1).max(10).nullable(),
    stats: statsSchema,
    // ADR-012: 'github' = discovered on GitHub, no owner-written entry; description is the repo's own.
    description: z.string().nullable().default(null),
    source: z.enum(['content', 'github']).default('content'),
    caseStudy: z.object({
        problem: z.string().nullable(),
        hardestPart: z.string().nullable(),
        decision: z.string().nullable(),
        result: z.string().nullable(),
        resultSource: z.string().nullable(),
    }).nullable().default(null),
    media: z.string().nullable().default(null),
    preview: z.string().nullable().default(null),
    iframe: z.boolean().default(false),
    xray: z.object({
        ui: z.string().nullable(),
        api: z.string().nullable(),
        data: z.string().nullable(),
        infra: z.string().nullable(),
    }).nullable().default(null),
});

export const cityResponseSchema = z.looseObject({
    generatedAt: z.string(),
    statsUpdatedAt: z.string().nullable(),
    projects: z.array(projectSchema),
});

export const parseCityResponse = (json) => cityResponseSchema.parse(json);
