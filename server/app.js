// Express app: security headers → compression → /api → static dist/ → SPA fallback → errors.
// Kept separate from listen() so tests can start it on a random port.
import express from 'express';
import compression from 'compression';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { securityHeaders } from './lib/security.js';
import { limits } from './lib/rateLimit.js';
import healthRouter from './routes/health.js';

const DEFAULT_DIST = fileURLToPath(new URL('../dist', import.meta.url));
const ASSETS_DIR = `${path.sep}assets${path.sep}`;

const BODY_ERRORS = {
    'entity.too.large': 'Request body too large',
    'entity.parse.failed': 'Invalid JSON',
};

const errorHandler = (production) => (err, req, res, next) => {
    if (res.headersSent) {
        next(err);
        return;
    }
    let status = err.status ?? err.statusCode ?? 500;
    if (status < 400 || status > 599) status = 500;
    // Log without request bodies or IPs (docs/security.md rule 6).
    if (status >= 500) console.error(`[error] ${req.method} ${req.path}:`, err);
    const body = { error: BODY_ERRORS[err.type] ?? (status < 500 && err.expose ? err.message : 'Something went wrong') };
    if (!production && status >= 500) body.detail = err.message;
    res.status(status).json(body);
};

export const createApp = ({ distDir = DEFAULT_DIST, env = process.env, routes = [] } = {}) => {
    // Secure by default: only an explicit NODE_ENV=development shows error details.
    const production = env.NODE_ENV !== 'development';
    const app = express();

    app.disable('x-powered-by');
    // Hostinger runs the app behind one proxy; req.ip must be the visitor's IP for rate limits.
    app.set('trust proxy', 1);
    app.use(securityHeaders({ production, hsts: env.ENABLE_HSTS === '1' }));
    app.use(compression());

    const api = express.Router();
    api.use(express.json({ limit: '16kb' }));
    api.use(healthRouter); // before the limiter so uptime monitors are never blocked
    api.use(limits.api());
    for (const router of routes) api.use(router);
    api.use((req, res) => res.status(404).json({ error: 'Not found' }));
    app.use('/api', api);

    app.use(express.static(distDir, {
        index: false,
        setHeaders: (res, filePath) => {
            // Vite fingerprints everything in dist/assets/, so it can be cached forever.
            res.set('Cache-Control', filePath.includes(ASSETS_DIR) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
        },
    }));

    const indexHtml = path.join(distDir, 'index.html');
    app.get('/{*splat}', (req, res, next) => {
        // A missing file (/assets/x.js, /models/y.glb) is a 404, not the HTML page.
        if (path.extname(req.path)) {
            next();
            return;
        }
        if (!existsSync(indexHtml)) {
            res.status(503).type('text').send('Frontend not built. Run `npm run build`, or use `npm run dev` for development.');
            return;
        }
        res.set('Cache-Control', 'no-cache');
        res.sendFile(indexHtml);
    });

    app.use((req, res) => res.status(404).type('text').send('Not found'));
    app.use(errorHandler(production));

    return app;
};
