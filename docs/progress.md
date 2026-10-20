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

## 2026-10-20 — Project X-Ray audited
**Tasks:** P3-03 (in progress: code done and verified; waits on real content with 2+ layers)
**Audit:** the 2026-10-16 work is sound. `/api/city` publishes only owner-written, non-demo layers; the panel has a static ordered list (reduced motion, one layer, screen readers) and an Explode/Restore button; `BuildingXRay` swaps the building for one coloured, labelled floor per layer and lifts them apart with GSAP. Fixes: the building's hover label covered the top floor's label (now hidden while exploded); header comments and indentation. A test that pinned Sns Glam's current layers was removed (it would fail as soon as real layers are added); the general rule test covers it.
**Checks:** production build with four layers injected into the `/api/city` response in the browser (test data only, content untouched): Explode → four labelled floors lift apart, `aria-pressed` true, Restore puts the building back; reduced motion → no button, the four layers listed; no page errors.
**Next (content):** add real `UI`, `API` and `Data` layers for a project in `docs/projects.md` (Sns Glam has only `Infra: Hostinger` published) to finish P3-03.

---

## 2026-10-20 — Previews audited and fixed
**Tasks:** P3-02 (done; the 2026-10-16 work, audited)
**Audit:** capture script and hover thumbnail are sound (non-demo HTTPS sites only, Cloudflare challenge pages never saved). Problems fixed:
- The live-preview iframe was inside the links row (`flex`), squeezed beside the Live site / Code buttons.
- Its sandbox lacked `allow-same-origin`, so the embedded site ran without its own cookies/storage: Sns Glam showed Cloudflare's "Checking your browser" forever and threw `cjs is not defined`. Added; safe because the site is a different origin.
- It loaded a whole third-party site every time the panel opened. Now `LivePreview.jsx` shows the screenshot (also for touch screens, which have no hover card) and loads the live site only on "Load live site here".
- Demo projects could still get `preview`/`iframe`/CSP origins; now excluded on the server, the client and in `previewFrameOrigins`.
**Checks:** server tests for demo exclusion and HTTPS-only iframes; production build: panel shows the screenshot and no iframe until the button, then the real Sns Glam site renders below the links (310×174); no page errors from this page (the remaining 403s are Cloudflare refusing the automated browser inside the iframe).

---

## 2026-10-20 — Case study panel audited
**Tasks:** P3-01 (done; the 2026-10-16 work, audited)
**Audit:** the rules are right and applied on both server and client: whole-demo projects, `[DEMO]` fields, `TODO(content)` and numeric results without a source are never published; GitHub-only projects get no case study; media is HTTPS or a file under `/images` or `/previews`. Fixes: the real-content test pinned the owner's exact Sns Glam wording (it would fail when the text is edited) and is now two tests: a rule check over all real content (nothing demo/TODO published, every published number has a source) and a fixture test of each rule; header comments; `role="group"` for the case-study block.
**Content notes for the owner (not changed):** Sns Glam's published "Hardest part" and "Decision" read "the toughest bug or decision was getting the best design and blend the colors" and "I use an Online Pallete the get the best color combination"; worth rewriting in `docs/projects.md`. Its result ("users: 100+, speed 100%") stays hidden until it has a source.
**Checks:** `npm test` all pass; production build: Sns Glam panel shows Hardest part + Decision only, no TODO/demo text.

---

## 2026-10-19 — Debug override verified
**Tasks:** P2-06 (done; the earlier 2026-10-16 "Debug override" work, audited and tidied)
**Audit:** works as specified and stays dev-only. `parsePreviewOverride` was rewritten without nested IIFEs (same behaviour; a `Map`, so `?weather=constructor` can't hit an object key) and its test gained edge cases.
**Done:**
- `src/lib/dayNight.js`: `parsePreviewOverride(URLSearchParams)` → `{ minutes, weather }`.
- `src/city/CityPreview.jsx`: the HUD slider starts at `?time=`, and `?weather=` drives the scene (through `weatherFx`, P2-04) and the status line.
- `src/city/CityExperience.jsx`: the dev weather wins over /api/buea's.
- architecture.md: Debug override note.
**Checks:**
- `npm test`: all pass (override edge cases: empty, 23:59, 9:05, out of range, bad formats, `constructor`/`__proto__`, padded `Storm`). ESLint clean on the changed files. `npm run build` passes.
- Dev `/?city&time=21:00&weather=rain`: rainy night, HUD at 21:00 "preview", status line "21:00 · rain", no page errors.
- Production `/?city&time=03:00&weather=storm`: ignored (real time shown, no storm).
**Next:** audit P3-01 → P3-08 one task at a time.

---

## 2026-10-19 — Status line fixed
**Tasks:** P2-05 (done; fixes the earlier 2026-10-16 "Status line" work)
**Audit of the earlier version:** the time was `/api/buea`'s `localTime`, fetched every 15 min, so it could be 14 minutes behind and showed `It's --:-- in Buea` whenever the API was down; the whole city re-rendered to change it; it sat under the dev HUD on `/?city` in dev.
**Done:**
- `src/lib/dayNight.js`: `bueaClock(ms)` ("HH:MM" in Buea) and `msToNextMinute(ms)`; the dev HUD reuses `bueaClock` instead of its own copy.
- `src/components/StatusLine.jsx`: time from the device clock + the server offset (`useBuea`), re-rendering only itself on each minute; the dev preview's fixed time still pins it.
- `src/city/CityPreview.jsx`: the dev HUD moved below the status line.
- architecture.md: Status line note.
**Checks:**
- `npm test`: all pass (new: Buea clock across midnight, minute boundary, status line with the fallback weather). ESLint clean on the changed files. `npm run build` passes.
- Production, page clock at 17:59:30: with /api/buea blocked → "It's 17:59 in Buea", 31 s later "It's 18:00"; with the device 10 min slow and /api/buea up (light rain) → "18:09 · light rain", then "18:10".
- Dev `/?city&time=21:00&weather=rain`: status line 16–52 px, HUD from 64 px (no overlap), rain shows, no page errors.
**Next:** commit P2-06 (debug override, verified working), then audit P3-01 → P3-08.

---

## 2026-10-19 — Weather FX rebuilt
**Tasks:** P2-04 (done; replaces the earlier 2026-10-16 "Weather FX" work, which failed the audit)
**Audit of the earlier version:** rain was one mesh per drop (154 draw calls in rain, 181 in a storm, budget 100); the sky stayed bright blue in a thunderstorm; clouds were 6 translucent spheres; lightning was a hidden, constantly pulsing plane; `Math.random()` ran during render (drops jumped on re-render, 5 lint errors); no softer light, no city fog, no wet roads; docs not updated.
**Done:**
- `src/lib/weatherFx.js` (pure): `weatherFx()` maps /api/buea weather to cloud/rain/fog/storm/gloom (code, measured cloud % and rain mm); `applyWeather()` greys and darkens the sky, softens the sun, closes the fog in, thickens the Fako mist and wets the streets; `lightningAt()` is a seeded strike schedule (8–20 s apart, ≤ 3 flashes/s). `lightingAt(sun, fx)` applies it; city lights switch on up to 5° earlier under a dark sky.
- `liveLighting.js` / `DayNight.jsx`: weather eases with day/night; DayNight sets the fog distances and the lightning flash (none with reduced motion).
- `Sky.jsx`: clouds in the sky shader (0 draw calls) + flash. `Fako.jsx`: mist density from `lighting`. `Rain.jsx`: one GPU-animated line mesh around the camera (1 draw call), count by quality, frozen with reduced motion. `CityLayout.jsx`: wet streets. `Backdrop.jsx` back to its 4 meshes.
- `npm run perf -- --weather=cloudy|fog|rain|storm`.
- Docs: design_system.md (Weather → Implementation, lights earlier under cloud, draw calls), architecture.md.
**Checks:**
- `npm test`: all pass (7 new weather tests; Copilot's loose `weatherFxAt` test removed with the function). ESLint clean on `src/city`, `src/lib`, `scripts`. `npm run build` passes.
- Draw calls (production, faked /api/buea, day and night): clear/partly/overcast/fog 18, rain/storm 19.
- `npm run perf -- --weather=storm`: desktop PASS (60 / 59 fps, 19 calls), phone PASS (60 / 59.6 fps, 17 calls).
- Screenshots at 15:00 and 21:00 in clear, partly cloudy, overcast, fog, rain and storm. Lightning stepped with a paused page clock over 22 s of a night storm: a double flash at 6.2/6.4 s, the next strike 15.7 s later, sky brightness 51 → 176. With reduced motion: no flash and steady rain.
**Next:** P2-05 status line fixes (time from the browser clock, ticking each minute; dev HUD overlap).

---

## 2026-10-19 — City lights re-verified
**Tasks:** P2-03 (done; re-checked because the work was never committed and later sessions edited the same files)
**Done:**
- Audited the P2-03 code against design_system.md → City lights: `cityLightsAt` ramps, `liveLighting.js` easing, `switchable.js`, window switch points in `buildings.js`, `Windows` in `Buildings.jsx`, `lamps.js` + `Lamps.jsx`, and their wiring in `CityExperience.jsx` / `DayNight.jsx`. Matches the spec; later edits (X-Ray, weather, Cinema) did not break it. No code changes needed.
**Checks:**
- `npm test`: 130/130 pass. ESLint: every P2-03 file clean.
- `npm run build` passes. `npm run perf`: desktop PASS (60 / 59 fps, 18 draw calls), phone PASS (59.9 / 60 fps, 16 draw calls).
- Production screenshots (Playwright clock, `/api/buea` blocked) at 06:00, 06:20, 12:00, 17:50, 18:05, 18:20, 18:35, 21:00: noon all off; 17:50 windows coming on, lamps off; 18:05–18:20 lamps one by one; 21:00 all on; 06:20 lamps already off, last windows on. No page errors.
**Problems / notes (outside P2-03):**
- ESLint errors in `src/city/Backdrop.jsx` (P2-04: `Math.random` during render, unused `index`, missing `fx.cloud` dependency) plus old template files (`Particles.jsx`, `NavBar.jsx`, `TechIcon.jsx`).
- Status line (P2-05) shows `It's --:-- in Buea` whenever `/api/buea` is unavailable, although the time is known in the browser.
- Status line and the dev HUD both sit at the top-left and overlap on `/?city` in dev.
**Next:**
- Audit P2-04 → P3 work from the other sessions the same way before continuing P3.

---

## 2026-10-16 — Project X-Ray
**Tasks:** P3-03 (done)
**Done:**
- `server/lib/city.js`: `/api/city` now returns only owner-authored X-Ray layers; whole-project demos, field-marked demo values, TODOs and GitHub-discovered projects have no layers.
- `src/lib/projectSummary.js` and `src/lib/cityData.js`: added ordered UI → API → Data → Infra summary mapping and response validation.
- `src/components/ProjectXRay.jsx`: added the accessible static diagram for reduced-motion users and one-layer projects, plus the explode/restore control when multiple layers are available.
- `src/city/BuildingXRay.jsx`, `src/city/Buildings.jsx`, `src/store/useCityStore.js` and `src/city/CityExperience.jsx`: selecting X-Ray replaces only the active building's instanced parts with colored, labeled floors animated by GSAP; closing/switching projects resets the state.
- `docs/architecture.md` and `docs/design_system.md`: documented the data contract, filtering, and interaction.
**Checks:**
- `npm test`: 124/124 pass.
- Targeted ESLint and editor diagnostics: clean.
- `npm run build`: succeeds; existing chunk-size and dependency annotation warnings remain.
- Browser check: Sns Glam opens with the real Infra → Hostinger layer, shows no explode control for a single layer, includes its opted-in iframe, and has no page errors.
**Problems / notes:**
- Sns Glam is currently the only publishable project with X-Ray content, and it has one layer. The multi-floor GSAP presentation is implemented but cannot be exercised with current owner content; add real UI/API/Data layers in `docs/projects.md` to enable it.
**Status correction:**
- P3-03 remains in progress until a project has at least two verified X-Ray layers and the 3D floor separation can be demonstrated. The panel can be inspected by opening Sns Glam, where only `Infra: Hostinger` is currently publishable.
**Next:**
- P3-04 replace counters with sourced real numbers.

---

## 2026-10-16 — Hover previews
**Tasks:** P3-02 (done)
**Done:**
- `scripts/capture-previews.js` and `npm run previews`: capture non-demo, HTTPS live projects from generated content at 1280×800, converting browser PNGs to WebP with Chromium's native encoder. Cloudflare browser-check pages are allowed to resolve and are rejected if still present; individual failures are reported without discarding successful captures.
- `server/lib/city.js`: `/api/city` advertises a preview only when the HTTPS-backed content project has its generated WebP. GitHub-discovered projects have no preview. `iframe` is exposed only when the content field is `yes`.
- `src/city/BuildingLabel.jsx`: renders the static thumbnail on hover/focus. `src/components/ProjectPanel.jsx`: live preview iframe is rendered only for opted-in projects.
- `server/lib/security.js` and `server/app.js`: CSP `frame-src` derives exact HTTPS origins from validated opted-in content; no wildcard origins.
- Captured `public/previews/sns-glam.webp`. The OJ City entry is skipped because its whole content block is marked `[DEMO]`. Optional video loops were not added.
- `docs/architecture.md` documents the preview API fields and workflow.
**Checks:**
- `npm run previews`: 1/1 eligible project captured; WebP is 1280×800 and 55 KB.
- `npm test`: 122/122 pass.
- Targeted ESLint and editor diagnostics: clean; `npm run build` succeeds.
- Express serves the preview with HTTP 200 and `image/webp`; `/api/city` returns `/previews/sns-glam.webp`; CSP includes only the Sns Glam iframe origin plus Cloudflare Turnstile.
**Problems / notes:**
- The integrated browser tab remained paused on the 3D loading screen while hidden, so the hover card and iframe were not visually verified there. The captured asset, API path, static serving, CSP, and UI build are verified.
**Next:**
- P3-03 Project X-Ray (plan first).

---

## 2026-10-16 — Case study panel
**Tasks:** P3-01 (done)
**Done:**
- `server/lib/city.js`: `/api/city` now includes owner-authored case-study fields and media, omitting whole-project demos, field-marked demos, TODOs, and numeric results without a source. GitHub-discovered projects receive no invented case study.
- `src/lib/projectSummary.js` and `src/lib/cityData.js`: validate and shape case-study data; media is limited to HTTPS or image/video files under `public/images/` and `public/previews/`.
- `src/components/ProjectCaseStudy.jsx` and `src/components/ProjectPanel.jsx`: replaced the placeholder with the problem → hardest part → decision → result narrative, source attribution, stack, links, and optional media. The narrative is reusable for the future Recruiter Mode view.
- `docs/architecture.md`: documented the expanded `/api/city` contract and content filtering.
**Checks:**
- `npm test`: 118/118 pass.
- Targeted ESLint and editor diagnostics: clean.
- `npm run build`: succeeds; existing chunk-size and dependency annotation warnings remain.
- Browser smoke test opened Sns Glam from the accessible project list: available narrative fields appeared, demo/problem and unsourced result copy were absent, and no page errors occurred.
**Problems / notes:**
- Current content has no approved, non-demo media asset, so the media renderer is wired but no media is shown yet.
- Recruiter Mode does not exist yet; the shared case-study component is ready for its P5-01 integration.
**Next:**
- P3-02 preview capture script.

---

## 2026-10-16 — Debug override
**Tasks:** P2-06 (done)
**Done:**
- `src/lib/dayNight.js`: added `parsePreviewOverride()` for dev-only `?time=HH:MM&weather=...` parsing and validation, including `storm` → `thunderstorm` mapping.
- `src/city/CityPreview.jsx`: the dev HUD now reads the query override and wires it into the city preview, while preserving the live Buea values when the params are absent.
- `src/city/CityExperience.jsx`: the city scene uses the preview override for the displayed time and weather effect during development only.
- Follow-up: moved the debug callback below `layout` and `focusName` initialization to fix a temporal-dead-zone runtime error on `/?city`.
**Checks:**
- `node --test src/lib/dayNight.test.js` passes; the override regression is included in the day/night suite.
- Browser smoke test at `/?city&time=21:00&weather=rain`: city mounted, override status displayed, and no page errors after reload.
**Next:**
- Continue with P3-01 case study panel work.

---

## 2026-10-16 — Status line
**Tasks:** P2-05 (done)
**Done:**
- `src/lib/dayNight.js`: `statusLine()` formats the live Buea sentence with time, weather label and the owner line in the exact planned style.
- `src/city/CityExperience.jsx`: the city now renders the live status line as an overlay, using the current `/api/buea` data when available and falling back cleanly when the weather is missing.
- Tests cover the exact sentence format and the fallback path.
**Checks:**
- `npm test`: targeted status-line regression and the surrounding day/night/weather checks pass.
**Next:**
- P2-06 debug override.

---

## 2026-10-16 — Weather FX
**Tasks:** P2-04 (done)
**Done:**
- `src/lib/dayNight.js`: `weatherFxAt()` translates the live WMO weather kind/code into mist, cloud, rain and lightning levels with a small, testable map.
- `src/city/CityExperience.jsx` and `src/city/Backdrop.jsx`: the city now reads `/api/buea` weather and uses it to lift the Fako mist band, add cloud layers, animate rain particles, and trigger a brief thunder flash during storm conditions.
- The scene keeps the existing day/night transitions and lamp/window logic intact while layering the weather effects on top.
**Checks:**
- `npm test`: 114/114 pass, including the new weather FX regression.
- `npm run build`: production build succeeds.
**Decisions:**
- Weather FX follows the live WMO mapping already defined in the design doc instead of inventing a new local weather model.
- Clouds and rain remain lightweight and subtle so they work without overwhelming the phone performance budget.
**Problems / notes:**
- The effect is deliberately gentle: a few cloud clusters and a modest rain pass keep the city readable while still showing Buea conditions.

---

## 2026-10-16 — City lights
**Tasks:** P2-03 (done)
**Done:**
- `cityLightsAt()` in `src/lib/dayNight.js`: window and lamp levels (0..1) by sun elevation (windows +6° → −4°, lamps +2° → −6°), part of `lightingAt()` and eased with the rest of the live lighting (`liveLighting.js`: `windows`, `lamps`).
- `src/city/switchable.js`: per-instance `aSwitch` attribute + `onBeforeCompile` patch, so each window/lamp switches on at its own level with no extra draw calls.
- Windows: `toBuilding` now also returns `windowSwitch` (seeded switch-on point per lit window; unlit = never). By day all windows are dark glass with 30 % of the horizon colour; at night the lit set is unchanged (push recency).
- Street lamps: `src/lib/lamps.js` (placement from the layout: block pavements, Career Road, main road; 99 lamps today) and `src/city/Lamps.jsx` (post, head, ground pool; 3 draw calls; no real lights).
- Dev HUD shows the windows/lamps levels next to the sun.
- Docs: design_system.md (City lights section, draw-call count).
**Checks:** `npm test` 113/113 (6 new: lights off by day / on at night / windows lead lamps at dusk and lamps go first at dawn, smooth minute to minute all day, window switch points seeded + unlit never on, lamp placement on the real city and a tier-5 city never on a road/lot/plot, unique spots, seeded spread) · ESLint clean on `src/` · `npm run build` passes; city chunk 58 KB gzip (was 55) · `npm run perf`: desktop and phone PASS, 60 fps idle, 58.5–59 fps flight, **16 draw calls** (was 13), 21k triangles · screenshots (Playwright clock, `/api/buea` blocked) at 06:00, 06:30, 12:00, 17:55, 18:10, 18:20, 18:35, 21:00: noon glass + lamps off, 17:55 windows coming on with lamps off, 18:20 lamps part-way on, 21:00 all on; no console errors besides the blocked request.
**Decisions (owner):** all recommendations: no bloom for now (phone budget), plain modern lamp post, weather doesn't move the switch-on yet (P2-04).
**Problems / notes:**
- The `react-hooks/immutability` lint rule rejects writing to memoised uniform objects inside `useFrame`; the writes live in small module functions (`syncWindows`, `syncLamps`), the same pattern as `easeLighting`.
- Initial JS is still 421 KB gzip (template; P0-06).
**Next:** P2-04 weather FX.

---

## 2026-10-16 — Day/night
**Tasks:** P2-02 (done); P2-01 committed first (`c351f34`)
**Done:**
- `shared/solar.js` (new folder for pure code used by both server and browser): `solarTimes` moved from `server/lib/weather.js` (re-exported there, unchanged) + new `solarPosition(ms, lat, lon)`.
- `src/lib/dayNight.js`: phases by sun elevation, morning/evening keyframes from the design_system table (all colours mixed from palette tokens), `lightingAt()` → sky, fog, mist, sun/moon light and ambient. Night keeps the P1-04 sky exactly.
- `src/hooks/useBuea.js` (offset from the server clock, refreshed every 15 min), `src/city/DayNight.jsx` + `liveLighting.js` (update every minute, ease each frame, no React re-renders), `Sun.jsx` follows the light and redraws shadows after > 0.3° of movement. Sky and Fako use the live colours directly as uniforms; Backdrop no longer sets the background.
- Dev HUD: Buea time · phase · sun elevation + a time-of-day slider (`debug().at`).
- `npm run perf` now mounts `/api/buea` with Open-Meteo stubbed out (it was a console 404 → FAIL).
- Docs: final rules in design_system.md (Time of day → Implementation), API in architecture.md.
**Checks:** `npm test` 107/107 (9 new: sun on the horizon at Open-Meteo's sunrise/sunset, Buea sun path and 77° noon, phases by time, night = P1-04 sky, dawn ≠ dusk, light limits + moon swap in the dark, no minute-to-minute jumps all day, keyframe continuity, Buea date) · ESLint clean on changed files · `npm run build` passes; city chunk 55 KB gzip (was 53) · `npm run perf`: desktop and phone PASS, 60 fps idle, ~59 fps flight, **13 draw calls** (unchanged) · screenshots at 02:00, 05:50, 06:10, 06:40, 09:00, 12:10, 17:20, 17:55, 18:12, 18:35, 21:00 (Playwright fake clock) · device clock 02:00 + `/api/buea` 12:10 → noon scene, refetched after 15 min · dev HUD slider → 18:10 dusk; no console errors.
**Decisions (owner):** plan approved with the recommendations: real sun height but the shadow light capped at 60°; plain fixed moonlight (no real moon phase).
**Problems / notes:**
- The plan said "the sun is on the horizon at /api/buea's sunrise/sunset". It is computed in the browser instead (agrees within ~1 min, tested against the captured Open-Meteo response), so the city never waits for the API and doesn't change if it fails. The API corrects the clock only.
- First tuning had the city almost black around sunrise/sunset (a sun at the horizon lights only west faces). Fixed with more ambient light in every phase and a 6° minimum height for the shadow light.
- Windows still glow at noon: switching them by phase is P2-03.
- Owner follow-up: the day should be a bright day. New token `--sky` `#4C9BE8` (palette.js, index.css, design_system.md): day zenith = sky, horizon sky + 60 % paper; morning and golden hour lean on it; day light 2.4 → 2.8, ambient 1.0 → 1.15. Test: noon zenith is blue over a pale horizon. Screenshots 09:00, 12:10, 17:20 checked.
**Next:** P2-03 city lights (windows off by day, lamps on one by one at dusk, using `sunState().phase`).

---

## 2026-10-16 — /api/buea
**Tasks:** P2-01 (done); content fix for Smart Meal (own commit)
**Done:**
- `server/lib/weather.js`: Open-Meteo client (fixed URL, 4 s timeout, zod-checked response, unknown WMO codes rejected), WMO code → `{ kind, label }` table (28 codes), NOAA sunrise/sunset (`solarTimes`), time-zone helpers, `weatherConfig(env)` (`BUEA_LAT` / `BUEA_LON` / `BUEA_TZ`, validated), and pure `bueaState({ now, place, upstream })`.
- `server/routes/buea.js` → `GET /api/buea`, wired into `server/index.js` and warmed at start. Weather cached 15 min on disk; time computed per request; `Cache-Control: max-age=60`.
- Fallbacks: weather older than 2 h or missing → marked `source: "fallback"` (code 0, `label: null`, numbers null), so nothing claims it is clear when we don't know. Sun times not covered by Open-Meteo → computed (`sun.source: "computed"`).
- Docs: `/api/buea` shape and rules in architecture.md.
- Smart Meal block corrected from its repo (`pubspec.yaml`, README): Flutter mobile app with Riverpod, go_router, Supabase, FCM, Google Sign-In; category mobile; X-Ray UI/data/infra; no iframe. API layer left `TODO(content)`; the rest stays demo.
**Checks:** `npm test` 98/98 (10 new: WMO table, time helpers, real-response parsing, computed sun within 2 min of Open-Meteo, config validation, fresh/stale/no-data states, night/next sunrise, client errors, route end to end incl. fallback) · ESLint clean on `server/` · live `npm start`: `/api/buea` → 12:45, overcast, 25.1 °C, sunrise 06:07, sunset 18:09 (Open-Meteo).
**Decisions (owner):** plan approved as proposed (2 h cut-off for cached weather, marked fallback). Smart Meal fix committed separately.
**Notes:** Open-Meteo snaps Buea to a grid point (lat 4.112, lon 9.250, 868 m), which is fine for city weather. Snow codes are mapped for completeness only.
**Next:** P2-02 day/night (browser `useBuea` hook + sky/sun/ambient from this endpoint).

---

## 2026-10-16 — GitHub auto-discovery
**Tasks:** P1-09 (new, owner-requested; done)
**Done:**
- `server/lib/github.js`: `listRepos(account)` (paged `GET /users/{account}/repos`, github.com URLs only, invalid names rejected) and `discover(accounts, previous)` (a failing account keeps its last list; all failing throws).
- `server/lib/city.js`: `selectRepos` (skips private, forks, empty, profile-README repo, `.github`, hidden), `repoStatus`, `languageStack` (≥ 5 %, minus build tooling and Flutter runner code), `prettyName`, and `buildCity(projects, { stats, listing }, { hide, now })`, which adds a building per discovered repo. Content blocks win for the same repo. Same name on two accounts → `owner-repo` slug. New response fields `description` and `source`.
- `server/routes/city.js`: one cached refresh = list accounts → stats for content + selected repos. New cache file `github-city.json`. Early refresh when the accounts change or a repo has no stats.
- `projects.md` profile fields **GitHub accounts for the city** (`ojrandy, mazunita237-netizen, webspectron`) and **Hide these repos** (none yet) → `profile.json` `github: { accounts, hide }`; parser + schema + tests.
- Panel: "From GitHub" badge, the repo description, and a case-study note for auto buildings.
- ADR-012; architecture.md (API shape, refresh rules).
**Real run (token in `.env`):** 35 public repos listed (ojrandy 26, mazunita237-netizen 6, webspectron 3); 6 skipped (5 empty + the `ojrandy` profile repo). **42 buildings** (28 content + 14 from GitHub), 30 with GitHub stats, none private/missing. Downtown moved up to the next size step (ADR-011 reshuffle).
**Checks:** `npm test` 88/88 (8 new: listing/paging, discover fallback, filters, status/name, stack, merge + slugs + hide, route end to end, panel summary) · ESLint clean on changed files · `npm run build` passes · `npm run perf` with 42 buildings: **13 draw calls**, 16k triangles; desktop 60 fps idle + flight (3 of 4 runs; one first-run dip to 53 fps), phone emulation 60 fps · panel screenshot of an auto building (Sdl Global) · no console errors.
**Decisions (owner):** scan all three accounts; all public repos minus a hide list; keep the existing stub blocks for now.
**Owner follow-up (same session):**
- Duplicates fixed: [DEMO] Smart Meal → repo `ojrandy/smart_meal`, [DEMO] Vital Pulse → repo `ojrandy/vitalpulse-mobile` (were "private"; the blocks now get GitHub numbers, demo text kept as the owner asked). `mazunita237-netizen/iot-sentinel-F-B` hidden: a one-commit earlier upload of IoT Sentinel (`iot-sentinelf` block).
- Practice repos stay in the city (owner's choice). Not duplicates, so kept as separate buildings: `food_recipe` / `food_recipe2`, `travel_app` / `travel_app_react`.
- Old `server/.cache/github-stats.json` deleted.
- Result: **39 buildings** (28 content + 11 from GitHub), 29 with GitHub stats.
- Heads-up: the Smart Meal demo text says Next.js, but the repo is a Flutter/Dart app. Fix it when you replace the [DEMO] block.
**Next:** P0-06, or Phase 2 (P2-01).

---

## 2026-10-16 — Performance pass
**Tasks:** P1-08 (done)
**Done:**
- `/?city` in production: `src/city/CityExperience.jsx` (the city without the dev HUD) is lazy-loaded on `?city` in every build; `CityPreview.jsx` is now that plus the HUD (dev only). Unlinked, with `noindex` sent as both an `X-Robots-Tag` header (server, tested) and a `<meta>`.
- Adaptive quality: `src/lib/quality.js` (levels change DPR + shadow-map size only), `useDeviceTier` (first guess from cores/memory/touch), drei `PerformanceMonitor` as a step-down-only safety net.
- `src/city/Sun.jsx`: static shadow map, redrawn only when the layout or quality changes.
- **Bug fixed:** sky and mist `shaderMaterial`s were rebuilt (shader freed and recompiled) on every hover or focus change, because their `args` object was new on each render. Now memoised. This was the main cause of a ~250 ms hitch on the first flight.
- Removed the blurred `box-shadow` (label, panel) and `backdrop-blur` (label, panel) over the canvas. The label's first shadow alone cost a ~150 ms frame (Chrome compiling its raster shaders).
- `npm run perf` (`scripts/perf.mjs`) + `src/city/PerfProbe.jsx` (`?perf` only).
- Docs: performance rules in design_system.md; perf script, new components and the R3F `args` gotcha in architecture.md.
**Measurements** (`npm run perf --repeat=2`, Chromium, real GPU, production build):

| | before | after |
|---|---|---|
| Desktop 1280×800 idle | 60 fps | 60 fps (p95 18 ms) |
| Desktop first flight | 47–50 fps, worst frame ~250–420 ms | 58–60 fps, worst 19–76 ms |
| Phone emulation (Pixel 7, 4× CPU) idle | 56 fps at DPR 1.5, p95 47 ms | 60 fps at DPR 1 (low), p95 18 ms |
| Phone emulation flight | 54 fps, p95 44 ms | 58–59 fps, p95 18 ms |
| Draw calls / triangles | 13 / 13.7k | 13 / 13.8k |
| City chunk | not built (dev-only) | 53 KB gzip, lazy |
| Initial JS | 421 KB gzip | 421 KB gzip (template, P0-06) |

Phone numbers vary run to run (the emulation shares this machine's CPU); the phone GPU can't be emulated, so a real Android test is still P5-07.
**Checks:** `npm test` 80/80 (3 new quality tests + the noindex header) · ESLint clean on changed files (`npm run lint` still reports 5 errors + 1 warning in untouched template files: `Particles.jsx`, `NavBar.jsx`, `TechIcon.jsx`, all for P0-06) · `npm run build` passes · screenshots at high and low quality (shadows present at both), hover label, open panel; `meta robots` in head; no console errors.
**Decisions:** owner approved the plan and `/?city` in production (unlinked + noindex). Quality never steps back up, and levels never toggle shadows (both measured to cost more than they save).
**Problems / notes:**
- Tried and dropped: drei `<Preload all>` (compiles offscreen shader variants, not the on-screen ones), and a full-scene warm-up render (no effect once the `args` bug was fixed).
- Desktop starts at "medium" on this machine (4 cores reported). The ~55 ms worst frame left on the very first flight is Chrome's one-off first paint of the label in a fresh browser profile; returning visitors don't get it.
- GitHub returned 403 for every repo during this session (rate limit). The server kept the last good stats. `npm run perf` no longer calls GitHub; adding a `GITHUB_TOKEN` to `.env` would raise the limit from 60 to 5,000 requests per hour.
- Initial JS budget: needs P0-06 (template removal), and the city becoming the homepage needs P5-02.
**Next:**
- P0-06 (restructure + remove the template) to meet the initial JS budget, or Phase 2 (P2-01 `/api/buea`).

---

## 2026-10-15 — Loading screen
**Tasks:** P1-07 (done)
**Done:**
- `src/lib/loading.js` (pure): `STEPS`, `loadingState()` (3 real steps counted in order: 3D code → `/api/city` → first frame with the buildings; webgl/data errors), `skyline(lots)` (front elevation of the real city). Timing constants.
- `src/components/LoadingScreen.jsx`: Fako ridge + ground line, the real skyline rising west → east once the data arrives (GSAP), step label + 3 dots, "Try again" on a failed fetch, a plain no-WebGL message. Hidden if ready within 300 ms of navigation; fade-out waits for the rise to finish. Used both as the `Suspense` fallback in `App.jsx` and inside `CityPreview`, so it's one screen throughout (the fade-in plays once).
- `src/city/FirstFrame.jsx`: fires after the frame that drew the buildings (mounted with them, so a sky-only frame doesn't count).
- `useCityData()` gains `retry()`. `CityPreview`: WebGL check, `aria-busy` until drawn, HUD "Loading /api/city" line removed.
- Docs: loader rules in design_system.md, API in architecture.md.
**Checks:** `npm test` 77/77 (4 new: step order, frame-before-data doesn't count, errors, skyline geometry + real city) · ESLint clean on changed files · `npm run build` passes, loader not in `dist/` · Playwright (Chromium, GPU) on `/?city` with `/api/city` delayed 1.5 s: labels in order, overlay gone, `aria-busy=false`, **13 draw calls** (unchanged); reduced motion: no fade; `/api/city` 500 → message + Try again → city loads; Pixel 7 size checked; console clean apart from the deliberate 500.
**Decisions (owner):** skyline loader instead of a cultural motif until one is confirmed (ADR-009 still applies); the fade waits for the rise (≤ 0.9 s) so fast devices see the skyline too.
**Problems / notes:**
- No percentage on purpose: there are no assets to count, so a % would be invented.
- The loader only covers the time after the main JS runs. A shell in `index.html` for the very first paint belongs with P1-08 (lazy 3D chunk).
- In front elevation, buildings in the same column overlap, so the 3 × 3 city reads as ~7 slabs. Fine for a loader.
- The C: drive (system temp) is full; shell output and Playwright needed `TEMP` pointed at D:. Worth freeing space.
**Next:**
- P1-08 performance pass.

---

## 2026-10-15 — Building interaction
**Tasks:** P1-06 (done)
**Done:**
- Hover (mouse/pen): accent highlight via instance colour, pointer cursor, floating label (name + up to 3 stack items, "+n more"). Click/tap: fly + open the panel; drags over 4 px are ignored. Tab flies + labels, Enter opens, Esc closes then goes home.
- `src/components/ProjectPanel.jsx`: placeholder panel with only real data (status, stack, numbers labelled "from GitHub" / "from Owner estimate", missing ones hidden, demo badge, https-only links, empty case-study box for P3-01). Right-hand sheet on desktop, bottom sheet on phones, GSAP fade-in (off with reduced motion), non-modal dialog with focus in/out.
- `src/components/CityProjectList.jsx`: every building as a button outside the canvas in Tab order, hidden until focused (skip-link style).
- `src/lib/projectSummary.js`, `src/lib/picking.js` (pure); store gains `hovered`, `openSlug`, `setHovered`, `openProject`, `closeProject`; `Buildings.jsx` gets `highlighted`/`onHover`/`onSelect`; `src/city/BuildingLabel.jsx` (drei `<Html>`).
- `.gitattributes` (`* text=auto eol=lf`): the `main` checkout had turned every file into CRLF (`core.autocrlf=true`), which broke the byte-for-byte content test. Working copies were converted back to LF; no content changed.
- Docs: interaction rules in design_system.md, API in architecture.md.
**Checks:** `npm test` 73/73 (8 new: https-only links, label shortening, stats + sources + missing values, owner estimate, status/demo, every real project, picking, store actions) · ESLint clean on changed files · `npm run build` passes, P1-06 code not in `dist/` · Playwright (Chromium, GPU) on `/?city`: hover label + pointer, drag doesn't open, click flies + opens with focus on the heading, Esc closes with focus back on the city, Tab + Enter, list Tab/Enter with focus back on the button, Pixel 7 tap opens the bottom sheet; **13 draw calls** (unchanged), clean console.
**Decisions (plan approved by owner):** project list hidden until focused; right sheet / bottom sheet; Tab flies + labels, Enter opens.
**Problems / notes:**
- **Local `.env` was deleted by the fast-forward of `main` last session** (old `main` still tracked it; the P0-01 commit untracks it). It was restored from history (same content) and stays git-ignored. Anyone else with an old checkout will see the same when they pull: keep a backup of `.env` first.
- The template's global `section { width: 100dvw }` overrides Tailwind classes; the panel is an `<aside>` for that reason (P0-06 should remove the rule with the template).
- GSAP `autoAlpha` sets `visibility: hidden`, which stops focus moving into the panel; the panel animates `opacity` only.
- On phones the bottom sheet covers the lower half, so the flown-to building sits in the upper half; consider offsetting the camera in P5-07.
- Owner asked for demo stacks: 13 of the 14 GitHub stub projects now have a `[DEMO]` stack read from their own repo (`package.json` / `pubspec.yaml` / firmware includes), with an italic source note in `docs/projects.md`. `coretexcore` stays blank: its repo only has a README. More stack items make some footprints bigger (logistics apps are now large buildings); all camera tests still pass.
- The panel's "Demo content" badge only covers whole-block demos; field-level `[DEMO]` values (like these stacks) aren't marked in the UI. The strict launch gate still catches them.
**Next:**
- P1-07 Loading screen (plan first; check approved motifs, ADR-009) or P1-08 performance pass.

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
