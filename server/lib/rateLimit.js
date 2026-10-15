// Per-IP rate limits (docs/security.md). Relies on `trust proxy` for the real client IP.
import { rateLimit as expressRateLimit } from 'express-rate-limit';

const MINUTE = 60 * 1000;

export const rateLimit = ({ windowMs, limit, message = 'Too many requests, please try again later.' }) =>
    expressRateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: (req, res, next, options) => {
            res.status(options.statusCode).json({ error: message });
        },
    });

export const limits = {
    // Default for every /api route.
    api: () => rateLimit({ windowMs: MINUTE, limit: 60 }),
    // /api/city, /api/buea
    data: () => rateLimit({ windowMs: MINUTE, limit: 60 }),
    // /api/chat: both apply.
    chat: () => [
        rateLimit({ windowMs: MINUTE, limit: 10, message: 'The guide needs a short break. Try again in a minute.' }),
        rateLimit({ windowMs: 24 * 60 * MINUTE, limit: 60, message: 'Daily chat limit reached. Please use the contact form.' }),
    ],
    // /api/contact
    contact: () => rateLimit({ windowMs: 10 * MINUTE, limit: 3, message: 'Too many messages. Please try again later.' }),
};
