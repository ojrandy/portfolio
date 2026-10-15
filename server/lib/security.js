// Security headers: helmet + the starting CSP from docs/security.md.
import helmet from 'helmet';

// Template-era allowances (ADR / P0-04 option A). Each one names the task that removes it.
// docs/security.md launch checklist: this list must be empty at launch.
export const LEGACY_CSP = {
    scriptSrc: [
        "'wasm-unsafe-eval'", // Draco decoder (WebAssembly) for compressed .glb models → P0-06/P1
    ],
    connectSrc: [
        'https://api.emailjs.com', // Contact.jsx (EmailJS) → P5-03
        'https://raw.githack.com', // drei <Environment preset="city"> HDR → P0-06/P1
        'https://raw.githubusercontent.com', // …which githack redirects to → P0-06/P1
        'https://www.gstatic.com', // drei useGLTF Draco decoder → P0-06/P1
    ],
};

// Own project domains allowed in live-preview iframes (P3-02).
const PREVIEW_FRAMES = [];

export const cspDirectives = ({ production }) => ({
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", 'https://challenges.cloudflare.com', ...LEGACY_CSP.scriptSrc],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'blob:'],
    mediaSrc: ["'self'", 'blob:'],
    // blob: three.js GLTFLoader fetches textures embedded in .glb files as blob: URLs.
    connectSrc: ["'self'", 'blob:', ...LEGACY_CSP.connectSrc],
    workerSrc: ["'self'", 'blob:'],
    frameSrc: ['https://challenges.cloudflare.com', ...PREVIEW_FRAMES],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    objectSrc: ["'none'"],
    // Off locally so `npm start` works on http://localhost.
    upgradeInsecureRequests: production ? [] : null,
});

export const securityHeaders = ({ production, hsts }) => [
    helmet({
        contentSecurityPolicy: { useDefaults: false, directives: cspDirectives({ production }) },
        // Only after SSL is confirmed on Hostinger (P0-05): ENABLE_HSTS=1.
        strictTransportSecurity: hsts ? { maxAge: 31536000, includeSubDomains: true } : false,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        // R3F loads same-origin models/textures only; COEP would block nothing useful today.
        crossOriginEmbedderPolicy: false,
    }),
    (req, res, next) => {
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
        next();
    },
];
