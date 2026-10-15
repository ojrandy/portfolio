# Architecture — OJ City

## Overview
One Node.js process on Hostinger serves both the built frontend and the API. All third-party keys stay on the server.

```
                    ojongrandy.com (Hostinger Node.js app, SSL)
                                  │
                    ┌─────────────┴──────────────┐
                    │   Express (server/index.js) │
                    │  helmet · compression · CSP │
                    ├──────────────┬──────────────┤
   static  dist/ ◄──┤              │  /api/*      │
   (React + R3F)    │              ▼              │
                    │   ┌────────────────────┐    │
                    │   │ cache (memory+file)│    │
                    │   └─────────┬──────────┘    │
                    └─────────────┼───────────────┘
            ┌─────────────┬───────┴───────┬──────────────┬─────────────┐
            ▼             ▼               ▼              ▼             ▼
       GitHub API    Open-Meteo     Claude API     Hostinger SMTP  Cloudflare
       (token)       (no key)       (API key)      (nodemailer)    Turnstile
```

## Target folder structure
```
/
├─ CLAUDE.md · prompt.md · README.md
├─ docs/                     planning docs (this folder)
├─ content/                  source of truth for site content
│  ├─ projects.json          generated from docs/projects.md (P0-03)
│  ├─ profile.json           bio, links, hobbies, testimonials
│  └─ schema.js              zod schemas (shared by scripts + server)
├─ scripts/
│  ├─ validate-content.js
│  ├─ capture-previews.js    Playwright → public/previews/
│  └─ build-knowledge.js     content → server/knowledge/knowledge.md for the AI
├─ server/
│  ├─ index.js               Express app: static + /api, listens on process.env.PORT
│  ├─ routes/ city.js · buea.js · chat.js · contact.js · health.js
│  ├─ lib/ cache.js · github.js · weather.js · anthropic.js · mailer.js · rateLimit.js · validate.js
│  ├─ prompts/system.md      AI system prompt
│  └─ knowledge/knowledge.md generated
├─ public/ models/ · previews/ · images/ · cv/
└─ src/
   ├─ main.jsx · App.jsx     mode router (Explorer / Recruiter)
   ├─ city/                  Scene, Buildings, Districts, Fako, Sky, Weather, Lights, CameraRig, Roads
   ├─ features/
   │  ├─ chat/               Ask My Portfolio UI + tool handlers
   │  ├─ xray/               Project X-Ray
   │  ├─ preview/            hover previews
   │  ├─ caseStudy/          case study panel
   │  └─ palette/            Ctrl+K command palette
   ├─ recruiter/             Recruiter mode page + sections
   ├─ components/            shared UI (Button, TitleHeader, GlowCard…)
   ├─ hooks/                 useCityData, useBuea, useDeviceTier, useReducedMotion
   ├─ store/                 small global state (zustand): mode, selected project, camera target
   └─ lib/                   building rules, colour maps, time-of-day maths
```

## API endpoints
All responses are JSON unless noted. All inputs are validated with zod. All endpoints are rate-limited.

| Method | Path | Purpose | Cache |
|---|---|---|---|
| GET | `/api/health` | uptime check | none |
| GET | `/api/city` | projects + GitHub stats → building data | 6 h, stale-while-revalidate, file-persisted |
| GET | `/api/buea` | `{ localTime, tz, sunrise, sunset, weather: { code, tempC, cloud, rain, wind } }` | 15 min |
| POST | `/api/chat` | `{ messages: [{role, content}] }` → **SSE stream** of text + tool calls | none |
| POST | `/api/contact` | `{ name, email, message, turnstileToken, website(honeypot) }` | none |

### `/api/city` response (shape)
```json
{
  "generatedAt": "ISO date",
  "statsUpdatedAt": "ISO date of the last good GitHub fetch, or null",
  "projects": [{
    "slug": "sns-glam", "name": "…", "district": "downtown", "featured": true,
    "status": "live | in-progress | archived | null",
    "category": ["web"], "stack": ["React", "Node"],
    "live": "https://… | null", "repo": "https://github.com/… | null",
    "primaryLanguage": "TypeScript | null",
    "effort": 9,
    "stats": { "source": "github | owner | none", "commits": 48, "stars": 1, "lastPush": "ISO", "languages": { "TypeScript": 0.98 } },
    "preview": null,
    "demo": false
  }]
}
```
- `stats.source` says where a building's numbers come from: `github` (public repo), `owner` (effort 1–10 from content; GitHub fields are null), `none` (no data: minimum building).
- `TODO(content)` values become `null` (or `[]`); `repo` is never `"private"` and is dropped when GitHub says the repo is missing/private. Case-study text is not included (P3-01).
- `commits` = all commits on the default branch (any author).
- Implementation: `server/lib/github.js` (REST: repo, languages, commit count via the `Link` header), `server/lib/cache.js`, `server/lib/city.js` (pure merge), `server/routes/city.js`.

## AI chat design
- **Knowledge:** the full content is small, so the whole `knowledge.md` goes in the system prompt with **prompt caching**. No vector DB/RAG.
- **Model:** `ANTHROPIC_MODEL` env var (start with a current Sonnet; switch to Haiku if cost matters).
- **Tools** (executed in the browser, not the server): `fly_to_project(slug)`, `open_case_study(slug)`, `open_contact()`, `switch_mode(mode)`.
- **Limits:** max 12 messages per conversation, 600 chars per user message, max output tokens capped, per-IP rate limit, daily global budget counter; when the budget runs out, the chat shows "the guide is resting, here's the contact form".

## Data refresh
- GitHub: fetched at server start and again after 6 h (stale-while-revalidate: old data is served while one background refresh runs). Stats are cached per repo; content is merged on every request, so a content deploy shows up immediately and a repo added to content triggers an early refresh. The last good copy is kept on disk (`server/.cache/github-stats.json`, git-ignored) so a GitHub outage or restart never breaks the city. A repo that fails keeps its previous stats; failed refreshes retry after 5 min. A cold start waits at most 4 s before answering with owner stats.
- Previews: captured locally with `npm run previews` (Playwright) and committed as optimised `.webp`/`.webm`. No runtime screenshot API.

## Environment variables
| Name | Where | Notes |
|---|---|---|
| `PORT` | server | provided by Hostinger |
| `NODE_ENV` | server | `production` on Hostinger |
| `GITHUB_TOKEN` | server | fine-grained, **read-only public repos**; optional (unauthenticated = 60 req/h, one refresh uses 3 per repo) |
| `GITHUB_USERNAME` | server | optional, currently unused (repo URLs in content name the owner) |
| `ANTHROPIC_API_KEY` | server | secret |
| `ANTHROPIC_MODEL` | server | |
| `CHAT_DAILY_BUDGET_USD` | server | hard stop |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | server | Hostinger email (`contact@ojongrandy.com`) |
| `CONTACT_TO` | server | where messages are delivered |
| `TURNSTILE_SECRET` | server | secret |
| `VITE_TURNSTILE_SITE_KEY` | client | public by design |
| `BUEA_LAT` / `BUEA_LON` / `BUEA_TZ` | server | `4.1527` / `9.2410` / `Africa/Douala` |
| `CONTENT_STRICT` | build | `1` at launch: the build fails on any `TODO(content)` / `[DEMO]` (ADR-010) |
| `ENABLE_HSTS` | server | `1` only after SSL is confirmed on the domain (P0-05) |

The server runs in production mode unless `NODE_ENV=development` (secure by default: no error details).
`trust proxy` is 1 (Hostinger's proxy); verify `req.ip` is the visitor's IP in P0-05.

## Content pipeline (ADR-010)
`docs/projects.md` → `npm run content:build` → `content/profile.json` + `content/projects.json` (validated by `content/schema.js`).
`npm run content:check` runs before every `npm run build` and fails on invalid data or stale JSON.
`npm test` covers the converter (`scripts/content.test.js`).

## Local development
- `npm run dev`: Vite on :5173, proxies `/api` to :3001
- `npm run dev:server`: Express on :3001 with `--watch`
- `npm run dev:all`: both together
- `npm run build && npm start`: production-like run
- `http://localhost:5173/?city` (with `dev:all`): dev-only city preview (`src/city/CityPreview.jsx`, compiled out of production): layout + buildings + backdrop + camera rig, draw-call counter, focused building and camera position

## City frontend (P1-02)
- `src/lib/buildings.js`: pure building rules (`toBuilding(project, { now })`), constants in design_system.md. Tested in `src/lib/buildings.test.js` (part of `npm test`).
- `src/lib/random.js` (slug-seeded PRNG), `src/lib/palette.js` (colour tokens + language accents), `src/lib/cityData.js` (zod check of `/api/city` in the browser).
- `src/hooks/useCityData.js`, `src/hooks/useReducedMotion.js`; `src/city/Buildings.jsx` renders all buildings as 6 instanced meshes.
- `src/lib/layout.js` (P1-03): `layoutCity(buildings)` → `{ tier, downtown, lots: [{ slug, building, x, z }], parks, pavements, roads, markings, districts, entrance, bounds }`. Pure; rules in design_system.md, tested in `src/lib/layout.test.js`. Camera rig and interaction (P1-05/06) look up building positions in `lots` by slug.
- `src/city/CityLayout.jsx` renders roads, pavements, parks and district plots (3 instanced meshes); `src/city/InstancedPart.jsx` is the shared one-InstancedMesh-per-part helper.
- `src/lib/backdrop.js` (P1-04): `fakoMesh()` (local mesh data, sRGB vertex colours), `fakoPlacement(bounds)`, `mistBand()`, `SKY_NIGHT`, `FOG`. Pure, tested in `src/lib/backdrop.test.js`. `src/city/Backdrop.jsx` (`{ bounds, sky?, mist? }`) sets the scene background and fog and renders `Sky.jsx`, the ground and `Fako.jsx` (4 draw calls). Phase 2 drives `sky` (P2-02) and `mist` (P2-04). The canvas camera needs `far` ≥ 2000.
- `src/lib/camera.js` (P1-05): `CAMERA` (fov/near/far + limits), `homeView(layout, { aspect })`, `buildingView(lot, lots)`, `isBlocked()`, `tabOrder(lots)`, `stepFocus(order, focus, dir)`, `flightSmoothTime(distance)`, `targetBounds(bounds)`. Views are `{ position, target }` arrays. Pure, tested in `src/lib/camera.test.js`; rules in design_system.md.
- `src/store/useCityStore.js` (zustand, ADR-002): `{ focus, hovered, openSlug, order, setOrder, flyTo(slug), goHome(), step(dir), setHovered(slug), openProject(slug), closeProject() }`. `focus` is a building slug or `null` (start view); `openProject` flies there and opens the panel. A new `order` drops slugs that no longer exist. Anything that moves the camera to a building calls these actions: the rig's keyboard now, building clicks (P1-06) and the AI's `fly_to_project` tool (P4-04) later.
- `src/city/CameraRig.jsx` (`{ layout, keyTarget }`, inside the Canvas): drei `CameraControls` (camera-controls) with the limits, flies or cuts to the store's focus, and listens for keys on `keyTarget`, the focusable element around the canvas (`tabIndex=0`, `role="application"`, an `aria-label` with the controls, a visible focus ring). Pair it with an `aria-live` region naming the focused building (see the preview). No draw calls. Enter opens the focused building's panel; Esc closes an open panel before going home.
- Building interaction (P1-06): `Buildings.jsx` takes `{ placed, highlighted, onHover, onSelect }` (pass a memoised `highlighted` array). `src/lib/picking.js` (instance id → slug, click tolerance, hover pointer types) and `src/lib/projectSummary.js` (label + panel text: status words, stats with source, https-only links) are pure and tested in `src/lib/projectSummary.test.js`. `src/city/BuildingLabel.jsx` (`{ lot, project }`, inside the Canvas). `src/components/ProjectPanel.jsx` (`{ project, onClose }`, an `<aside role="dialog">`; not `<section>`, which the template forces to `100dvw`) and `src/components/CityProjectList.jsx` (`{ projects }`) live outside the Canvas.
- Line endings: `.gitattributes` forces LF on every checkout (`content:check` and its test compare generated JSON byte for byte).

## Deployment (Hostinger Node.js hosting)
> Confirm each step in hPanel during P0-05; Hostinger's UI changes over time.
1. hPanel → Websites → add a **Node.js app**; connect the GitHub repo (or upload).
2. Build command `npm ci && npm run build`; start command / entry file `npm start` → `server/index.js`.
3. Node version: current LTS. Set all server env vars in hPanel (never in the repo).
4. Point `ojongrandy.com` to the app; enable SSL; force HTTPS; redirect `www` → apex.
5. Create mailbox `contact@ojongrandy.com` for SMTP.
6. Verify `/api/health`, then smoke-test every endpoint.
