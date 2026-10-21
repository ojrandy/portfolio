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
├─ shared/                  pure code used by both server and browser (solar.js: sun times + position)
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
| GET | `/api/city` | content projects + public repos discovered on GitHub + GitHub stats → building data (ADR-012) | 6 h, stale-while-revalidate, file-persisted |
| GET | `/api/buea` | Buea local time, sunrise/sunset, current weather (shape below, P2-01) | weather 15 min (file-persisted); time per request |
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
    "description": "the repo's GitHub description | null",
    "source": "content | github",
    "preview": "/previews/<slug>.webp | null",
    "caseStudy": { "problem": "… | null", "hardestPart": "… | null", "decision": "… | null", "result": "… | null", "resultSource": "… | null" },
    "xray": { "ui": "… | null", "api": "… | null", "data": "… | null", "infra": "… | null" } | null,
    "media": "/previews/project.webp | https://… | null",
    "iframe": false,
    "demo": false
  }]
}
```
- `stats.source` says where a building's numbers come from: `github` (public repo), `owner` (effort 1–10 from content; GitHub fields are null), `none` (no data: minimum building).
- `TODO(content)` values become `null` (or `[]`); `repo` is never `"private"` and is dropped when GitHub says the repo is missing/private. Case-study fields come only from owner content: whole `[DEMO]` projects and field-marked demo/TODO text are omitted, and numeric results require a source. GitHub-discovered projects have no case study or media. Media renders only from HTTPS URLs or files under `public/images/` and `public/previews/`.
- `xray` contains only owner-authored UI/API/Data/Infra layers; whole-project demos, field-marked demo layers and TODOs are omitted. It is `null` when no publishable layers remain. GitHub-discovered projects have no X-Ray data.
- `preview` is the local `/previews/<slug>.webp` only when a non-demo content project has an HTTPS live URL and that generated file exists. `iframe` is true only for non-demo owner content explicitly marked `yes` with an HTTPS live URL; those origins alone are added to CSP `frame-src` (read from `content/projects.json` when the server starts, so restart after changing them).
- `commits` = all commits on the default branch (any author).
- `source: "github"` = discovered on one of the profile's GitHub accounts with no block in `projects.md` (rules in ADR-012): `featured` false, district downtown, `effort` null, `category` [], `stack` from GitHub languages, `status` derived, no case study. `source: "content"` = a `projects.md` block; its `description` is the GitHub description when the repo is public.
- Implementation: `server/lib/github.js` (REST: `listRepos(account)` / `discover(accounts, previous)` via `GET /users/{account}/repos`, paged; `repoStats` = repo, languages, commit count via the `Link` header), `server/lib/cache.js`, `server/lib/city.js` (pure: `selectRepos`, `repoStatus`, `languageStack`, `prettyName`, `buildCity(projects, { stats, listing }, { hide, now })`), `server/routes/city.js`. Accounts and the hide list come from `content/profile.json` → `github: { accounts, hide }` (profile fields "GitHub accounts for the city" and "Hide these repos" in `projects.md`; without the first, only the GitHub username is scanned).

### `/api/buea` response (shape)
```json
{
  "now": "2026-10-16T11:45:27.382Z",
  "tz": "Africa/Douala", "utcOffsetMinutes": 60,
  "localDate": "2026-10-16", "localTime": "12:45",
  "isDay": true,
  "sun": { "sunrise": "2026-10-16T06:07:00+01:00", "sunset": "2026-10-16T18:09:00+01:00",
           "nextSunrise": "2026-10-17T06:07:00+01:00", "source": "open-meteo | computed" },
  "weather": { "code": 3, "kind": "cloudy", "label": "overcast", "tempC": 25.1, "cloud": 86, "rain": 0, "wind": 7.7,
               "source": "open-meteo | fallback", "updatedAt": "ISO of the Open-Meteo fetch | null" }
}
```
- `weather.kind`: clear · cloudy · fog · drizzle · rain · showers · thunderstorm · snow (WMO code table in `server/lib/weather.js`, matching the weather table in design_system.md). `label` is the plain-words description for the status line. `cloud` %, `rain` mm, `wind` km/h.
- **Fallback:** weather older than 2 h, or no weather at all, is `{ code: 0, kind: "clear", label: null, all numbers null, source: "fallback" }`. That's for drawing the scene only; the status line (P2-05) must not state weather when `source` is `fallback`.
- `sun.source: "computed"`: Open-Meteo's sunrise/sunset don't cover today (outage), so they are calculated with the NOAA equations (within ~1 min of Open-Meteo for Buea). `nextSunrise` is today's sunrise before dawn, tomorrow's after it.
- Time is computed on every request from the server clock and `BUEA_TZ`; `Cache-Control: public, max-age=60`. Query parameters are ignored.
- Implementation: `server/lib/weather.js` (Open-Meteo client with a 4 s timeout and zod check, WMO table, `solarTimes`, `localParts`, pure `bueaState`), `server/routes/buea.js` (cache key `buea-weather`, 15 min TTL, 2 min retry after a failure, a cold start waits ≤ 4.5 s). Tests: `server/buea.test.js` with a real captured response in `server/fixtures/open-meteo-buea.json`.

## AI chat design
- **Knowledge:** the full content is small, so the whole `knowledge.md` goes in the system prompt with **prompt caching**. No vector DB/RAG.
- **Model:** `ANTHROPIC_MODEL` env var (start with a current Sonnet; switch to Haiku if cost matters).
- **Tools** (executed in the browser, not the server): `fly_to_project(slug)`, `open_case_study(slug)`, `open_contact()`, `switch_mode(mode)`.
- **Limits:** max 12 messages per conversation, 600 chars per user message, max output tokens capped, per-IP rate limit, daily global budget counter; when the budget runs out, the chat shows "the guide is resting, here's the contact form".

## Data refresh
- GitHub: fetched at server start and again after 6 h (stale-while-revalidate: old data is served while one background refresh runs). One refresh lists the accounts' repos, then fetches stats for content repos + selected discovered repos (~2–3 requests per repo; needs `GITHUB_TOKEN`). Content and the hide list are applied on every request, so a content deploy shows up immediately; a changed account list, or a repo added to content / un-hidden without stats, triggers an early refresh. A failing account keeps its previous repo list. The last good copy is kept on disk (`server/.cache/github-city.json`, git-ignored; the older `github-stats.json` is no longer read and can be deleted) so a GitHub outage or restart never breaks the city. A repo that fails keeps its previous stats; failed refreshes retry after 5 min. A cold start waits at most 4 s before answering with owner stats.
- Previews: `npm run previews` captures non-demo HTTPS live projects from `content/projects.json` at 1280×800 to `public/previews/*.webp` with Playwright and Chromium's WebP encoder. Anti-bot challenge pages are never saved. The still is shown in the building hover label and in the project panel (`src/components/LivePreview.jsx`; touch screens have no hover). With `iframe: yes`, a "Load live site here" button swaps it for the real site, loaded only on request, in an iframe sandboxed to `allow-forms allow-same-origin allow-scripts` (same-origin = the site's own origin, so its cookies and Cloudflare's browser check work; it can't reach this page). No runtime screenshot API or video loops.
- Cinema (P3-08, `src/lib/cinemaReel.js`, `src/city/CinemaPlot.jsx`): section 5 of `docs/projects.md` also accepts `file: public/images/<name>.mp4` or `public/videos/<name>.webm`. `cinemaReel(profile)` picks the first non-demo local reel; the screen plays it as a muted looping texture (paused with reduced motion and while the player is open) and "Play reel" opens an accessible modal (controls, starts muted, Escape/Close, focus kept inside and restored). Without a local reel it uses the owner's `links.youtube` (HTTPS, not `[DEMO]`): the screen shows a drawn "Video work" card and a "Watch on YouTube ↗" link opens the channel in a new tab; nothing is fetched from YouTube, so the CSP is unchanged. With neither, the plot keeps its placeholder block (`CityLayout`'s `built` prop lists districts drawn elsewhere). The player and the Arcade hub share `src/components/Dialog.jsx`.
- School (P3-10, `src/lib/schoolContent.js` + tests, `src/city/SchoolPlot.jsx`, `src/components/SchoolPanel.jsx`): `schoolContent(profile)` returns the non-demo teaching entries from section 4 of `docs/projects.md` (demo fields, `TODO(content)` dates and non-HTTPS links left out), the owner's "Teaching" hobby line, and the short venue name for the chalkboard ("TUIB" from "… (TUIB)"); null without either, and the plot keeps its placeholder. The panel uses the shared `Dialog`; course links open in a new tab.
- Pitch (P3-11, `src/lib/pitchKick.js` + tests, `src/city/PitchPlot.jsx`, `src/lib/contactLinks.js` + tests, `src/components/ContactPanel.jsx`): `pitchKick.js` is the pure penalty (ball, friction, hop, keeper reaction, goal/save/post/wide; `simulate` runs a kick to its result for reduced motion, `scoringOffset` plans the always-scoring keyboard kick). `PitchPlot` steps it in `useFrame` and reports a goal through `onGoal`; `CityExperience` opens `ContactPanel` (`contactLinks(profile)`: a valid public email and HTTPS LinkedIn/GitHub/X only). The goal egg is `goal` in `arcadeEggs.js`.
- Career Road (P3-12, `src/lib/careerRoad.js` + tests, `src/city/CareerRoad.jsx`, `src/components/CareerPanel.jsx`): `careerRoles(profile)` → non-demo roles, newest first, `{ role, company, location, years, dates, did, proudest }` (demo fields / TODO text → null). `careerSigns(count, road)` places the signs on the `career` road from `layoutCity()`; `signParts(signs)` gives the world-space boxes (2 posts + board per sign) for one `InstancedPart`. `CareerRoad` draws the fronts as one merged mesh on a canvas atlas (face `2i`, `2i + 1` → sign `i`) and adds empty `career-sign-<i>` groups for `screenOf`. `CityExperience` opens `CareerPanel` at the clicked sign. Recruiter mode (P5) can reuse `careerRoles` + `CareerPanel`.
- Arcade (P3-09, `src/lib/arcadeEggs.js`, `src/store/useArcadeStore.js`, `src/hooks/useEasterEggs.js`, `src/city/ArcadePlot.jsx`, `src/components/ArcadeHub.jsx`, `EggToast.jsx`): six eggs. Hub (open the cabinet), cheat code (↑↑↓↓←→←→BA, a window keydown listener that ignores form fields), Fako (5 clicks on the mountain in a row, ≤ 2 s apart; `Fako.jsx`), Night owl (sun below −10° in Buea at the server-corrected time, checked each minute), Explorer (3 different project panels in one visit), Bug squasher (score 10 in Code runner). Progress is saved in `localStorage` under `oj-city:arcade` (ids only, parsed defensively, try/catch so private windows still work); nothing is sent to the server. The toast is an always-mounted `aria-live` region **without** `role="status"` (perf.mjs reads `[role=status]` as the loading screen); it sits above dialogs (`z-[60]`) so a find during the game shows.
- Code runner (P3-09b, `src/lib/codeRunner.js` + tests, `src/components/CodeRunner.jsx`): the Arcade mini-game, a separate lazy chunk (~2.4 KB gzip) loaded when "Play" is pressed in the hub. Rules are pure and seeded (`createGame`, `jump`, `step` with dt clamped to 50 ms; a test bot clears 60 s on several seeds, so every gap is jumpable). The component draws on a 2D canvas (8:3, DPR ≤ 1.5) and handles input on its focusable stage (Space/↑/W/tap jump, P pause); messages and buttons are HTML over the canvas. Best score in `localStorage` under `oj-city:runner-best`, saved as it rises; "Start over" in the hub clears it too.

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
- `npm run dev:server`: Express on :3001 with `--watch-path=server --watch-path=content` (restarts after `npm run content:build`)
- `npm run dev:all`: both together
- `npm run build && npm start`: production-like run
- `/?city`: the 3D city (`src/city/CityExperience.jsx`, its own lazy chunk). In production it is unlinked and `noindex` (`X-Robots-Tag` header + `<meta name="robots">`) until P5-02 makes it the homepage. In dev (`dev:all`, :5173) `src/city/CityPreview.jsx` wraps it with a HUD: draw calls, focused building, camera position, Buea time/phase/sun elevation and a time-of-day slider ("live" returns to real time).
- `npm run build && npm run perf`: performance check (`scripts/perf.mjs`, P1-08). Serves `dist/` with the Express app in-process (GitHub and Open-Meteo stubbed out, so it never spends the rate limit or calls the network), opens `/?city&perf` in Chromium as a 1280×800 desktop (DPR 1.5) and an emulated Pixel 7 (4× CPU throttle; the phone GPU isn't emulated), and prints idle + flight fps, p95/worst frame, draw calls, triangles and chunk sizes against the budget. Exits 1 on a miss. Flags: `--quality=low|medium|high` (pin), `--only=desktop|phone`, `--repeat=N`, `--json`; `PERF_PORT` (default 4173).

## City frontend (P1-02)
- `src/lib/buildings.js`: pure building rules (`toBuilding(project, { now })`), constants in design_system.md. Tested in `src/lib/buildings.test.js` (part of `npm test`).
- `src/lib/random.js` (slug-seeded PRNG), `src/lib/palette.js` (colour tokens + language accents), `src/lib/cityData.js` (zod check of `/api/city` in the browser).
- `src/hooks/useCityData.js`, `src/hooks/useReducedMotion.js`; `src/city/Buildings.jsx` renders all buildings as 6 instanced meshes.
- `src/lib/layout.js` (P1-03): `layoutCity(buildings)` → `{ tier, downtown, lots: [{ slug, building, x, z }], parks, pavements, roads, markings, districts, entrance, bounds }`. Pure; rules in design_system.md, tested in `src/lib/layout.test.js`. Camera rig and interaction (P1-05/06) look up building positions in `lots` by slug.
- `src/city/CityLayout.jsx` renders roads, pavements, parks and district plots (3 instanced meshes); `src/city/InstancedPart.jsx` is the shared one-InstancedMesh-per-part helper.
- `src/lib/backdrop.js` (P1-04): `fakoMesh()` (local mesh data, sRGB vertex colours), `fakoPlacement(bounds)`, `mistBand()`, `SKY_NIGHT`, `FOG`. Pure, tested in `src/lib/backdrop.test.js`. `src/city/Backdrop.jsx` (`{ bounds, lighting }`) adds the fog and renders `Sky.jsx`, the ground and `Fako.jsx` (`{ placement, lighting }`) (4 draw calls); colours, cloud, flash and mist density come from the live `lighting` object (P2-02, P2-04). The canvas camera needs `far` ≥ 2000.
- `src/lib/camera.js` (P1-05): `CAMERA` (fov/near/far + limits), `homeView(layout, { aspect })`, `buildingView(lot, lots)`, `isBlocked()`, `tabOrder(lots)`, `stepFocus(order, focus, dir)`, `flightSmoothTime(distance)`, `targetBounds(bounds)`. Views are `{ position, target }` arrays. Pure, tested in `src/lib/camera.test.js`; rules in design_system.md.
- `src/store/useCityStore.js` (zustand, ADR-002): `{ focus, hovered, openSlug, order, setOrder, flyTo(slug), goHome(), step(dir), setHovered(slug), openProject(slug), closeProject() }`. `focus` is a building slug or `null` (start view); `openProject` flies there and opens the panel. A new `order` drops slugs that no longer exist. Anything that moves the camera to a building calls these actions: the rig's keyboard now, building clicks (P1-06) and the AI's `fly_to_project` tool (P4-04) later.
- `src/city/CameraRig.jsx` (`{ layout, keyTarget }`, inside the Canvas): drei `CameraControls` (camera-controls) with the limits, flies or cuts to the store's focus, and listens for keys on `keyTarget`, the focusable element around the canvas (`tabIndex=0`, `role="application"`, an `aria-label` with the controls, a visible focus ring). Pair it with an `aria-live` region naming the focused building (see the preview). No draw calls. Enter opens the focused building's panel; Esc closes an open panel before going home.
- Building interaction (P1-06): `Buildings.jsx` takes `{ placed, highlighted, onHover, onSelect }` (pass a memoised `highlighted` array). `src/lib/picking.js` (instance id → slug, click tolerance, hover pointer types) and `src/lib/projectSummary.js` (label + panel text: status words, stats with source, safe links and owner X-Ray layers) are pure and tested in `src/lib/projectSummary.test.js`. `src/city/BuildingLabel.jsx` (`{ lot, project }`, inside the Canvas). `src/components/ProjectPanel.jsx` (`{ project, onClose }`, an `<aside role="dialog">`; not `<section>`, which the template forces to `100dvw`) and `src/components/CityProjectList.jsx` (`{ projects }`) live outside the Canvas. `ProjectXRay.jsx` is the reduced-motion/static diagram; `BuildingXRay.jsx` animates the selected building's labeled layers.
- Loading screen (P1-07): `src/lib/loading.js` (pure, tested in `src/lib/loading.test.js`): `STEPS`, `loadingState({ code, data, frame, webgl })` → `{ completed, total, label, error, done }` (steps count in order), `skyline(lots)` → `{ bars, width, height }`. `src/components/LoadingScreen.jsx` (`{ code, data, frame, webgl, lots, onRetry }`, all optional) is both the `Suspense` fallback while the 3D code downloads and the overlay inside the city. `src/city/FirstFrame.jsx` (`{ onDrawn }`, inside the Canvas) fires once its scene has been drawn; mount it next to the buildings, not before the data arrives. `useCityData()` now also returns `retry()`.
- Performance (P1-08): `CityExperience.jsx` (`{ debug? }`; `debug(state)` returns `{ scene, overlay }`, used by the dev HUD) owns the Canvas. `src/lib/quality.js` (pure, tested): `LEVELS`, `QUALITY` (`{ dpr, shadowMap }` per level), `initialQuality({ cores, memoryGb, touch })`, `stepQuality(level, dir)`. `src/hooks/useDeviceTier.js` returns the first-guess level (P5-02 reuses it). drei `PerformanceMonitor` only steps down. `src/city/Sun.jsx` (`{ shadowMap, lighting, version }`) is the key light with a static shadow map: `gl.shadowMap.autoUpdate` is off and the map is redrawn for 3 frames when `version` or the size changes, and for 1 frame once the light has moved more than 0.3° (P2-02). `src/city/PerfProbe.jsx` (only with `?perf`) exposes frame times and renderer counts on `window.__cityPerf`, plus `screenOf(name)` (CSS-pixel position of a named object, e.g. `pitch-ball`, for browser checks); `?perf&quality=<level>` pins the level.
- Day/night (P2-02): `shared/solar.js` (pure, tested in `shared/solar.test.js`): `solarTimes(date, lat, lon)` (also the /api/buea fallback; `server/lib/weather.js` re-exports it) and `solarPosition(ms, lat, lon)` → `{ elevation, azimuth, rising }` (NOAA). `src/lib/dayNight.js` (pure, tested): `KEYFRAMES`, `PHASES`, `sunState(ms)` → `{ elevation, azimuth, rising, phase }` (night · dawn · day · dusk; P2-03/P2-05 reuse it), `lightingAt(sunState)` → `{ zenith, horizon, mist, light: { color, intensity, direction, body }, ambient }` (sRGB hex), `skyDirection()`, `bueaTimeToday(minutes, nowMs)`. `src/hooks/useBuea.js` → `{ data, offsetMs }` (/api/buea every 15 min; `offsetMs` = server − device clock, 0 if it fails). `src/city/liveLighting.js`: `createLighting()` (THREE.Colors used directly as Sky/Fako uniforms), `toTarget()`, `easeLighting()`. `src/city/DayNight.jsx` (`{ lighting, offsetMs, at? }`, inside the Canvas) recomputes the target every minute, eases `lighting` each frame (useFrame priority −1), owns the ambient light and sets the background and fog colour. `debug()` may return `at` (fixed epoch ms): the dev HUD time slider and `?time=` (P2-06) use it.
- Weather FX (P2-04): `src/lib/weatherFx.js` (pure, tested in `src/lib/weatherFx.test.js`): `weatherFx(bueaWeather)` → `{ cloud, rain, fog, storm, gloom }` (`CLEAR` when missing), `applyWeather(lit, fx)` (used by `lightingAt(sunState, fx)`, which adds `fog: { near, far }` and `weather: { mistDensity, wet, rain, cloud, storm }`), `lightningAt(seconds)`. `CityExperience` memoises `weatherFx(buea.weather)` and passes it to `DayNight` (`weather` prop); `liveLighting` eases the new fields, and DayNight sets the fog distances and the lightning `flash` each frame. Readers: `Sky.jsx` (clouds, flash), `Fako.jsx` (mist density), `CityLayout.jsx` (`{ layout, lighting }`, wet streets), `Rain.jsx` (`{ lighting, quality }`). `npm run perf -- --weather=cloudy|fog|rain|storm` stubs `/api/buea`'s weather.
- Status line (P2-05): `src/components/StatusLine.jsx` (`{ offsetMs, at?, weather? }`, outside the Canvas) shows `statusLine({ localTime, weather })` from `src/lib/dayNight.js` ("It's 23:40 in Buea · light rain · Ojong is probably shipping something"; a weather without `label`, like the /api/buea fallback, is left out). The time is `bueaClock(Date.now() + offsetMs)`, so it is right when /api/buea is down and corrects a wrong device clock when it is up; it re-renders itself on each minute (`msToNextMinute`), nothing else does. `at` (dev preview) pins it. Top-left; the dev HUD sits below it.
- Debug override (P2-06, dev only): `/?city&time=HH:MM&weather=clear|cloudy|fog|rain|storm`. `parsePreviewOverride(URLSearchParams)` in `src/lib/dayNight.js` (pure, tested) → `{ minutes, weather }` (null when missing or invalid); `CityPreview.jsx` starts the HUD time slider at `minutes` and returns `weather: { kind, label }` from `debug()`, which `CityExperience` uses instead of /api/buea's weather for the scene and the status line. `CityPreview` is only loaded in dev (`import.meta.env.DEV` in `App.jsx`), so production ignores the params.
- R3F gotcha: pass `args` for `shaderMaterial` (or any object with object args) through `useMemo`. A new args object on re-render makes R3F rebuild the material, which frees and recompiles its shader. Sky and mist did this on every hover/focus change until P1-08.
- Line endings: `.gitattributes` forces LF on every checkout (`content:check` and its test compare generated JSON byte for byte).

## Deployment (Hostinger Node.js hosting)
> Confirm each step in hPanel during P0-05; Hostinger's UI changes over time.
1. hPanel → Websites → add a **Node.js app**; connect the GitHub repo (or upload).
2. Build command `npm ci && npm run build`; start command / entry file `npm start` → `server/index.js`.
3. Node version: current LTS. Set all server env vars in hPanel (never in the repo).
4. Point `ojongrandy.com` to the app; enable SSL; force HTTPS; redirect `www` → apex.
5. Create mailbox `contact@ojongrandy.com` for SMTP.
6. Verify `/api/health`, then smoke-test every endpoint.
