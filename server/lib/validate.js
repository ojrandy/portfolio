// Route input validation with zod. Parsed values go on req.valid (Express 5's req.query is read-only).
// Usage: router.post('/contact', validate({ body: contactSchema }), handler)

const PARTS = ['params', 'query', 'body'];

export const validate = (schemas) => (req, res, next) => {
    const valid = {};
    const issues = [];
    for (const part of PARTS) {
        if (!schemas[part]) continue;
        const result = schemas[part].safeParse(req[part] ?? {});
        if (result.success) {
            valid[part] = result.data;
        } else {
            for (const issue of result.error.issues) {
                issues.push({ path: [part, ...issue.path].join('.'), message: issue.message });
            }
        }
    }
    if (issues.length) {
        res.status(400).json({ error: 'Invalid request', issues });
        return;
    }
    req.valid = valid;
    next();
};
