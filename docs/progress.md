# Progress Log — OJ City

Newest entry at the top. One entry per working session.

**Template**
```
## YYYY-MM-DD — <short title>
**Tasks:** P?-?? (status)
**Done:**
- ...
**Decisions:** (link ADRs if any)
**Problems / notes:**
- ...
**Next:**
- ...
```

---

## 2026-10-15 — Camera rig
**Tasks:** P1-05 (done)
**Done:**
- `src/lib/camera.js` (pure): `homeView` (entrance view, Fako in frame; backs down Career Road on narrow screens so downtown fits), `buildingView` (fixed south-west framing, rises/backs off when a taller building is in the way, other sides only as a fallback), `isBlocked`, `tabOrder` (front row first, west → east), `stepFocus` (releases focus past either end), `flightSmoothTime`, `targetBounds`, `CAMERA` limits.
- `src/store/useCityStore.js` (zustand, ADR-002): `focus`, `order`, `flyTo`, `goHome`, `step`. P1-06 clicks and P4-04's `fly_to_project` will use it.
- `src/city/CameraRig.jsx`: drei `CameraControls` with boundary, distance and polar limits; fly 1.2–1.8 s or cut with reduced motion; keyboard on the focusable wrapper (arrows/WASD by physical key, Q/E, +/−, Tab/Shift+Tab, Esc/Home); touch defaults (1 finger rotate, pinch zoom, 2-finger move).
- `/?city` preview: `OrbitControls` replaced by the rig; focusable `role="application"` wrapper with an aria-label and focus ring, `aria-live` building name, HUD focus + camera readout + key hints.
- `zustand` is now a direct dependency (5.0.15, the same copy fiber/drei already use).
- Docs: camera rules in design_system.md, camera/store/rig API in architecture.md.
**Checks:** `npm test` 65/65 (7 new: start view inside the limits with Fako and downtown in frame at every size and at 16:9 / 4:3 / 9:16; every building view at every size inside the limits, above the roofs and unblocked; the tall-building-in-front case; real content; tab order; stepFocus ends; flight timing) · ESLint clean on `src/city`, `src/lib`, `src/store` · `npm run build` passes, rig not in `dist/` · Playwright (Chromium, GPU) on `/?city`: **13 draw calls** (unchanged), ~60 fps, clean console in both modes; Tab flight settles in ~1.5 s, reduced motion cuts in one frame; Q/W/− move the camera; Esc returns; Tab past the last building leaves the canvas; Pixel 7 viewport shows all of downtown + Fako.
**Decisions (plan approved by owner):** Tab cycles buildings only while the city is focused and leaves at the ends; fixed south-west building framing.
**Problems / notes:**
- With a tier-3 city, a 1.8-tall building beside a 12-tall tower can't be seen from the south-west at any angle; that's why the fallback sides exist (real content doesn't need them today).
- On tier 4+ downtowns the portrait start view hits the zoom limit and crops the sides; revisit in P5-07 if the city grows.
- Resizing doesn't re-frame the camera (on purpose, so a visitor's view isn't yanked); the start view uses the screen shape at the time it's applied.
- Software WebGL (SwiftShader) was ~1 fps here, so camera timings were measured with `--use-angle=d3d11` (real GPU).
- Touch gestures were only checked in an emulated Pixel 7 viewport (touch-action, framing), not on a real phone; that's P5-07.
**Next:**
- P1-06 Building interaction (plan first): hover label, click → `flyTo(slug)` + project panel, focusable building list outside the canvas.

---

## 2026-10-15 — Fako backdrop
**Tasks:** P1-04 (done)
**Done:**
- `src/lib/backdrop.js` (pure): `fakoMesh()` builds a seeded low-poly SW–NE ridge with a broad summit, 7 cinder cones, height-based vertex colours and a rim below the ground (about 3k triangles). `fakoPlacement(bounds)` keeps the foot 45 behind the city's north edge. Also `mistBand()`, `SKY_NIGHT`, `FOG`, ground constants.
- `src/city/Fako.jsx`: mountain (flat shading, vertex colours) + mist band shader (soft edges, slow drift, static with reduced motion, `mist` density prop for P2-04). `src/city/Sky.jsx`: gradient dome following the camera (`zenith`/`horizon` for P2-02). `src/city/Backdrop.jsx`: sky + ground + fog + Fako, 4 draw calls.
- `/?city` preview uses `Backdrop` (replaces the temporary ground and basalt fog), camera `far` 2000, and a lower start view so Fako is in frame (the real framing is P1-05's job).
- Docs: backdrop rules in design_system.md, backdrop API in architecture.md.
**Checks:** `npm test` 58/58 (5 new: determinism/valid mesh, every triangle faces up, summit height + rim below ground, clear of the city at every downtown size and inside the ground/sky/fog, mist band shape) · ESLint clean on `src/city`, `src/lib` · `npm run build` passes, and the backdrop is not in `dist/` (dev-only preview) · Playwright (Chromium) on `/?city`: **13 draw calls** (10 + sky, mountain, mist; the new ground replaces the old one), no console errors.
**Decisions (plan approved by owner):** a recognisable ridge rather than a generic cone; the mist drifts slowly and freezes with reduced motion.
**Problems / notes:**
- The new ground plane z-fought with the roads once the far plane moved to 2000; fixed by putting the ground at y = −0.05.
- Fako uses the scene fog for haze, so P2-02 must change the fog colour together with the sky horizon (`Backdrop` already ties them together).
- Only the night palette exists; day/dawn/dusk come in P2-02.
**Next:**
- P1-05 Camera rig (plan first): start at `layout.entrance` with Fako in frame; keep the camera within ~120 of the city (the sky-radius test assumes it).

---

## 2026-10-15 — City layout
**Tasks:** P1-03 (done)
**Done:**
- `src/lib/layout.js` (pure): `layoutCity(buildings)` → lots (by slug), parks, block pavements, roads (streets, main road, Career Road), dashed markings, 4 district plots with placeholder blocks, `entrance` (camera start for P1-05) and `bounds`. Constants and colours in design_system.md.
- Placement (ADR-011, owner chose option A): Downtown in fixed size steps (3/4/5/6/8 blocks per side); up to 3 featured projects on the front-row lots nearest Career Road; everyone else at `hash(slug) % freeLots` with linear probing; empty lots are parks.
- `src/city/CityLayout.jsx`: 3 instanced meshes (surfaces, parks + markings, placeholders). The instancing helper moved from `Buildings.jsx` to `src/city/InstancedPart.jsx` (shared).
- `/?city` preview now uses the real layout (ground sized from bounds, camera looking up Career Road, district legend in the HUD).
- Docs: design_system.md layout rules, architecture.md layout API, ADR-011.
**Checks:** `npm test` 53/53 (7 new: size steps, determinism + input-order independence, no overlaps between lots/parks/roads/plots for 0–60 buildings, featured front row + reserved lots, stability, road/entrance geometry, real content) · ESLint clean on `src/lib`, `src/city` · `npm run build` passes, main chunk unchanged · Playwright (Chromium) on `/?city` with `dev:all`: 28 buildings on a 3 × 3 downtown with 8 parks, **10 draw calls** (6 buildings + 3 layout + ground), no console errors.
**Measured stability:** adding a project moved 0 others; removing one moved 0–2 (6 random sets of 26).
**Problems / notes:**
- All 28 projects are `downtown`. A project in another district would still be placed downtown; district plots get their own content in P3-08 → P3-11.
- With option A a tall building can stand in front of a short one (e.g. a 15-floor building next to the featured lots); P1-05's camera and P1-06's hover need to handle that.
- No district text labels yet (drei `<Text>` loads a font: CSP + draw calls); the HUD legend stands in for now.
- Software WebGL (SwiftShader) screenshots can take >30 s; use a long screenshot timeout.
**Next:**
- P1-04 Fako backdrop + ground + sky dome (plan first). The ground plane in the preview is temporary.

---

## 2026-10-15 — Building generator
**Tasks:** P1-02 (done)
**Done:**
- `src/lib/buildings.js` (pure): `toBuilding(project, { now })` → `{ height, floors, footprint, width, depth, columns, accentColor, bodyColor, litWindowRatio, litWindows, crane, beacon, flag, weathered }`. `now` is injected; nothing reads the clock.
- `src/lib/random.js` (FNV-1a + mulberry32, slug-seeded shuffle; P1-03 will reuse it), `src/lib/palette.js` (tokens, language accents, mix/desaturate), `src/lib/cityData.js` (zod check of `/api/city` in the browser).
- `src/city/Buildings.jsx`: one `InstancedMesh` per part (bodies, roof caps, windows, cranes, flags, beacons), so 6 draw calls for the whole skyline. Crane and flag are merged geometry with vertex colours. The beacon pulses, and stays steady with `prefers-reduced-motion`.
- `src/hooks/useCityData.js`, `src/hooks/useReducedMotion.js`. City tokens added to `@theme` in `index.css`.
- `src/city/CityPreview.jsx`: dev-only `/?city` page (temporary slug-sorted grid, draw-call counter). Gated by `import.meta.env.DEV`, so it's compiled out of production; the template site is untouched.
- `npm test` now also runs `src/**/*.test.js`. Docs: final constants in design_system.md, city frontend section in architecture.md.
**Checks:** `npm test` 46/46 (12 new: PRNG, palette, height clamp/floors, effort scale, footprint, lit-window curve + status fallback + bad dates, crane window, determinism, superset of lit windows, all real projects → valid buildings, response validation) · ESLint clean on new files · `npm run build` passes, main chunk unchanged (preview not in `dist/`) · Playwright (Chromium) on `/?city` with `dev:all`: 28 buildings, **7 draw calls** (6 + ground), no console errors.
**Decisions (plan approved by owner):** effort × 0.7 on the log2 scale (effort 10 ≈ 128 commits); footprint from stack size (GitHub language count as fallback), not repo size; temporary grid + dev-only preview until P1-03.
**Problems / notes:**
- Only 2 projects have a real `live` URL today (sns-glam, oj-city), so there are only 2 beacons. Only 8 have GitHub stats, so most roofs are indigo until `GITHUB_TOKEN` is set and the stub blocks are filled.
- With no GitHub push date, the lit-window ratio comes from the owner's status (documented). It's a display choice, not a number shown to visitors.
**Next:**
- P1-03 City layout (Downtown grid, districts, roads; deterministic placement with `src/lib/random.js`).

## 2026-10-15 — /api/city
**Tasks:** P1-01 (done) · P0-02 (owner content: 14 GitHub repos added as project stubs)
**Done:**
- `server/lib/github.js`: REST client (repo info, `/languages` → shares, commit count from the `Link` header of `commits?per_page=1`). Only `https://github.com/{owner}/{repo}` URLs are accepted and requests always go to api.github.com. zod-checked responses, 8 s timeouts, token optional. 404/private ⇒ `{ available: false }` (never publish private stats); 403/5xx/timeouts throw so older data is kept per repo.
- `server/lib/cache.js`: reusable memory + file cache (`server/.cache/<key>.json`, git-ignored, atomic writes), stale-while-revalidate, one shared in-flight refresh, keeps last good data on failure, 5 min retry back-off, `isUsable` hook for early refresh. Ready for `/api/buea` (P2-01).
- `server/lib/city.js` (`buildCity`, pure): merges content with per-repo GitHub stats on every request; `stats.source` = github | owner | none; `TODO(content)` → null/[]; `"private"` never exposed; no case-study text.
- `server/routes/city.js`: `GET /api/city`, warmed at startup; a cold start waits ≤ 4 s then answers with owner stats; `Cache-Control` 300 s (30 s when there is no GitHub data yet). Registered in `server/index.js`.
- `docs/projects.md`: 14 repo blocks added from the owner's list (repo URL + italic GitHub notes only; everything else `TODO(content)`). Content rebuilt: 28 projects.
- Docs: architecture.md response shape + data refresh; `.env.example` notes (token optional, `GITHUB_USERNAME` unused).
**Checks:** `npm test` 34/34 (12 new: URL parsing/SSRF, language shares, Link-header count, 404/private/empty/rate-limit, partial failure, merge rules, real-content output, cache fresh/stale/dedupe/back-off/restart/isUsable, route up/down) · `content:check` OK · ESLint clean on `server/` · live run without a token: GitHub stats for 7 repos; the other 8 hit the anonymous rate limit (403) and fell back to owner/none without errors.
**Decisions:** commits = all commits on the default branch; projects without GitHub data get no language colour; `/api/city` uses the `/api` default rate limit (60/min, same as the `data` preset) to avoid double counting; the owner's status wins over GitHub's archived flag.
**Problems / notes:**
- One refresh now costs 15 repos × 3 = 45 GitHub calls; the anonymous limit is 60/h, so **`GITHUB_TOKEN` is needed** locally and in hPanel (fine-grained, public repos read-only).
- `polished-portfolio-pro` returned 404 earlier (private/renamed?); `food_app_website` is the Smart Meals website; `afplc-connect` may be the Anointed PLC project; repos under `mazunita237-netizen` / `webspectron` count every author's commits.
**Next:**
- Owner: create the GitHub token; fill in names/status/stack for the 14 new blocks (merge duplicates).
- P1-02 Building generator (plan first).

## 2026-10-14 — Express server
**Tasks:** P0-04 (done)
**Done:**
- `server/app.js` (`createApp`): no X-Powered-By, `trust proxy` 1, helmet + CSP, compression, `/api` (16 KB JSON limit, health exempt from the 60/min default limiter, JSON 404), static `dist/` (hashed `/assets` cached 1 year, `index.html` no-cache), SPA fallback (missing files stay 404; no build gives a clear 503), error handler (413/400 for body errors, generic 500, no details outside `NODE_ENV=development`, never a stack).
- `server/lib/security.js` (CSP from security.md + `LEGACY_CSP` list + Permissions-Policy; HSTS only with `ENABLE_HSTS=1`; `upgrade-insecure-requests` production only), `validate.js` (zod → 400 with field issues, `req.valid`), `rateLimit.js` (JSON 429, draft-8 headers, presets for api/data/chat/contact from security.md). `routes/health.js`. `index.js` (PORT or 3001, request timeouts, graceful shutdown), `dev.js`.
- npm scripts `dev:server`, `dev:all` (concurrently), `start`; `test` now includes `server/**/*.test.js`; `engines.node >=22.9`. Vite proxies `/api` → :3001.
- Deps: express 5.3, helmet 8.3, compression 1.8, express-rate-limit 8.7; dev: concurrently 10, playwright 1.64 (used now for the CSP browser check, later for P3-02 previews; its Chromium is in the user's ms-playwright cache, not the repo).
**Checks:** `npm test` 22/22 (10 server tests: health, headers, HSTS flag, API 404, 413/400, validate, 429, no error leakage, SPA fallback + caching, no-build 503) · `npm run build && npm start`: headers, gzip, deep links and models verified with curl · Playwright (Chromium) load of the production build: **0 CSP violations**, 7 canvases, all sections rendered · `dev:all`: `/api/health` works through the Vite proxy · lint: no new problems.
**Decisions:** option A (template-era CSP allowances in `LEGACY_CSP`, each tagged with the task that removes it; launch checklist requires it empty).
**Problems / notes:**
- The browser test found two things security.md's CSP missed: GLTFLoader fetches embedded textures from `blob:` URLs (added `blob:` to `connect-src` permanently, security.md updated), and githack redirects the HDR to `raw.githubusercontent.com` (added to `LEGACY_CSP`).
- Headless Edge can't be automated on this machine (launch times out); use Playwright's Chromium.
- EmailJS is allowed in the CSP but the contact form wasn't submitted (it would send a real email).
- Remaining console warnings are template issues (GSAP targets not found, SelectiveBloom needs lights), for P0-06.
**Next:**
- P0-05 Hostinger deploy test (owner: hPanel access). Verify `trust proxy`/`req.ip`, then set `ENABLE_HSTS=1` once SSL works.

## 2026-10-14 — Content pipeline (markdown → JSON)
**Tasks:** P0-03 (done)
**Done:**
- `content/schema.js`: zod schemas for projects (slug, district, status, live/repo, stack, category, case study, X-Ray, owner stats/effort, iframe, demo flags) and profile (links, availability, experience, teaching, video, testimonials, stats, tools, clients, FAQ).
- `scripts/lib/parse-projects-md.js` converts `docs/projects.md`. It handles the owner's formatting slips (`*Dates:**`, missing `**`, `Present-`, `2025-`, `1 october 2026`, commas inside brackets in stacks). Unknown fields, unreadable values, duplicate fields and malformed table rows are errors with line numbers.
- `scripts/build-content.js` (`content:build`) writes nothing if anything is invalid. `scripts/validate-content.js` (`content:check`) validates the JSON, applies the rules (unique slugs, max 3 featured, a testimonial with permission needs a real name) and fails if the JSON is stale. `--strict` / `CONTENT_STRICT=1` also fails on `[DEMO]` / `TODO(content)`.
- `prebuild` runs `content:check`, so `npm run build` and the Hostinger build validate content. `npm test`: 12 converter tests.
- `docs/projects.md` layout tidied for the converter (format rules at the top, experience blocks with Role/Company fields, stats rows fixed to 3 cells, helper lines in italics). No owner wording changed.
- zod added as a direct dependency (^4.6.7). ESLint: Node globals for `scripts/`, `content/`, `server/`.
- Docs: ADR-010, `CONTENT_STRICT` in architecture.md + `.env.example`, launch checklist item in security.md, commands in CLAUDE.md.
**Checks:** `npm test` 12/12 pass · `content:check` passes (14 projects, 46 demo items, 48 TODO) · `content:check:strict` fails with 94 items, as expected · `CONTENT_STRICT=1 npm run build` stops before Vite · `npm run build` passes · lint: same 6 template problems as before (P0-06), none in new files.
**Decisions:** ADR-010 (owner chose the re-runnable converter over a one-off conversion; strict only via `CONTENT_STRICT`).
**Format changes made by the converter (not content changes):** slug "Sns Glam" → `sns-glam`; "1 october 2026" → `2026-10`; "2025-" → `2025`; "Present-" → `present`; yes/no → true/false; "Permission confirmed: yes / no" → `false` (not confirmed).
**Problems / notes:**
- Logo permission stored as `true` for all four clients, as the owner wrote. It should still be confirmed by each company (see projects_review.md).
- Clients are stored as the owner's raw sentences (`text`), not clean company names; P3-05 needs names.
- `preview` paths are not in the schema yet; P3-02 adds them when screenshots exist.
**Next:**
- P0-04 Express server (plan first).
- Owner: replace `[DEMO]` / `TODO(content)` over time; run `npm run content:build` after each edit.

## 2026-10-14 — Content review + demo placeholders
**Tasks:** P0-02 (in progress, owner still filling content)
**Done:**
- Editorial review of `docs/projects.md` written to `docs/projects_review.md` (ranked gaps, unsourced numbers, testimonial/logo permissions, wording suggestions).
- Blank fields in `projects.md` filled with `[DEMO]` placeholders. Owner text unchanged except: Experience reordered newest-first with `[DEMO]` role headings, Sns Glam heading set.
- Added demo project blocks for Vital Pulse, Smart Meal, Trek Cameroon (structure only, details `TODO(content)`).
- Follow-up (owner asked for a full demo city): section 3 expanded to 14 projects, all demo blocks fully filled (stack, problem/decision/result, X-Ray, effort, mix of live / in-progress / archived). Teaching (4) and Video (4) demo entries added. `[DEMO]` on a heading now marks the whole block.
- Testimonials: demo slots are templates with `Permission confirmed: no`; no invented quotes.
**Decisions:** `[DEMO]` marker convention; P0-03 must fail a production build if any remain.
**Problems / notes:**
- Sns Glam "100+ users / speed 100%" and the §7 stats table have no sources.
- Logo permission must come from each company, not the owner.
- Culture field says "Bayangi / Orocko" vs CLAUDE.md "Bayangi": owner to confirm.
**Next:**
- Owner: replace `[DEMO]` values, starting with the Vital Pulse / Smart Meal blocks and the one-liner.
- Owner: collect 1–2 attributed testimonials with permission.
- Next build step: P0-03 (content JSON + zod + `[DEMO]` gate), then Phase 1 to see the city.

## 2026-10-02 — Secrets clean-up
**Tasks:** P0-01 (in progress, waiting on the owner to rotate keys)
**Done:**
- `.env` untracked (`git rm --cached`, local file kept). `.gitignore` now ignores `.env` and `.env.*` but not `.env.example`.
- `.env.example` created with every variable name from architecture.md plus the legacy EmailJS names (still used by `Contact.jsx` until P5-03). It has no values.
- Committed as `d6e59c7` on branch `p0-01-secrets-cleanup` (not pushed).
- Checks: `npm run build` passes (main chunk 1,458 kB / 428 kB gzip, way over budget, to be fixed in P1-08). `npm run lint` fails with 5 errors and 1 warning that were already in the template code: `Particles.jsx` (Math.random during render), `NavBar.jsx` (unused `isScrolled`), `TechIcon.jsx` (hook deps). These belong to P0-06.
**Decisions:** none. History is not being rewritten; rotating the key is the fix (security.md).
**Problems / notes:**
- `.env` is in commit `dda41a9`, which is already pushed to `origin/main` (github.com/ojrandy/portfolio), so treat those values as public.
- `WEB_FORM` isn't used anywhere in the code. Its value is UUID-shaped, which looks like a Web3Forms access key.
**Next:**
- Owner: rotate the `WEB_FORM` key (or delete the form) and review EmailJS (see the rotation notes from this session).
- Owner: approve pushing `p0-01-secrets-cleanup` / opening a PR, then tick P0-01 once the key is rotated.
- Owner: fill in `docs/projects.md` (P0-02).

## 2026-10-01 — Brainstorm & planning
**Tasks:** planning (no code changes)
**Done:**
- Audited the current site: it is the JS Mastery 3D portfolio template with placeholder content
  (fake counters "80+ clients / 99% retention", stock logos, generic ability cards, placeholder testimonials).
- Chose the **Living City** concept, named **OJ City**, set at the foot of Fako (Mount Cameroon) like Buea.
- Committed features: GitHub-driven buildings, project previews, Buea time + weather, replace all template
  sections, Ask My Portfolio AI, Explorer/Recruiter modes, Project X-Ray, hobby districts
  (Code, Cinema, Arcade, School, Pitch).
- Hosting: Hostinger Node.js hosting · domain ojongrandy.com.
- Created planning docs: CLAUDE.md, docs/*.md, prompt.md.

**Decisions:** ADR-001 → ADR-009 (see decisions.md)

**Problems / notes:**
- ⚠️ `.env` is committed to git (commit `dda41a9`). It contains `VITE_APP_EMAILJS_*` and `WEB_FORM`.
  `VITE_` values are public by design, but `WEB_FORM` must be rotated if it is a secret. Fix in P0-01.

**Next:**
- Owner fills in `docs/projects.md` (P0-02).
- P0-01 secrets clean-up.
