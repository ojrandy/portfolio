# Project Tracker — OJ City

Status: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` dropped
Each task ID matches a prompt in `/prompt.md`. Commit messages start with the task ID.

**Target:** ~6 weeks · **Launch domain:** ojongrandy.com · **Host:** Hostinger Node.js

| Phase | Name | Weeks | Status |
|---|---|---|---|
| 0 | Foundations | 1 | [ ] |
| 1 | The City | 1–2 | [~] |
| 2 | Live Buea | 2 | [x] |
| 3 | Content, Districts & X-Ray | 3 | [~] |
| 3-B | Interactive City | 3–4 | [~] |
| 4 | Ask My Portfolio (AI) | 4 | [ ] |
| 5 | Recruiter Mode & Polish | 5 | [ ] |
| 6 | Hardening & Launch | 6 | [ ] |

---

## Phase 0 — Foundations
- [~] **P0-01** Secrets clean-up: untrack `.env`, add it to `.gitignore`, create `.env.example`, rotate `WEB_FORM` if it is a secret
- [~] **P0-02** *(owner)* Fill in `docs/projects.md` with every project, bio, links, media, testimonials
- [x] **P0-03** Convert `docs/projects.md` → `content/projects.json` + `content/profile.json` with a zod schema and validation script; production build fails if any `[DEMO]` value remains
- [x] **P0-04** Add Express server (`server/`): serves `dist/`, `/api/health`, helmet, compression; dev proxy from Vite
- [ ] **P0-05** Hostinger deploy test: Node.js app connected to GitHub, env vars in hPanel, domain `ojongrandy.com`, SSL on
- [ ] **P0-06** Restructure folders (see architecture.md), remove unused template sections/assets, ESLint + Prettier clean

**Done when:** a "hello OJ City" page is live on https://ojongrandy.com with `/api/health` returning 200, and no secrets are in git.

## Phase 1 — The City
- [x] **P1-01** `/api/city` endpoint: merge `content/projects.json` with GitHub stats (commits, languages, stars, last push), cached 6h
- [x] **P1-02** Building generator: data → height/footprint/colour/lit windows/crane/beacon (rules in design_system.md)
- [x] **P1-03** City layout: Downtown grid + district plots + roads; deterministic placement (same data ⇒ same city)
- [x] **P1-04** Fako (Mount Cameroon) backdrop + ground + sky dome
- [x] **P1-05** Camera rig: constrained orbit, fly-to-building, keyboard navigation, touch gestures
- [x] **P1-06** Building interaction: hover label, click → project panel (placeholder content)
- [x] **P1-07** Loading screen (progress + Bayangi-inspired loader once ADR-009 motifs are confirmed). Done with a skyline loader; a confirmed motif can replace it later.
- [x] **P1-08** Performance pass: instancing, merged geometry, DPR clamp, draw-call count, lazy-load 3D chunk. The 3D chunk is lazy (53 KB gzip). Initial JS is still 421 KB because of the template; P0-06 fixes it.

- [x] **P1-09** GitHub auto-discovery: every public repo of the owner's accounts becomes a building; `projects.md` adds to and overrides them (ADR-012)

**Done when:** the city builds itself from real data and hits the performance budget.
*Status (2026-10-16):* all tasks done and fps/draw-call budgets met (`npm run perf`). The initial JS budget (< 200 KB gzip) is still missed because of the old template, so this waits on P0-06.

## Phase 2 — Live Buea
- [x] **P2-01** `/api/buea`: Buea local time + Open-Meteo weather, cached 15 min, safe fallback
- [x] **P2-02** Day/night cycle: sun position, sky colours, ambient keyed to Buea time
- [x] **P2-03** City lights: street lamps + window glow at dusk/night
- [x] **P2-04** Weather FX: mist/fog over Fako, rain, clouds, thunder flash (mapped from WMO codes)
- [x] **P2-05** Status line: "It's 23:40 in Buea · light rain · Ojong is probably shipping something"
- [x] **P2-06** Debug override: `?time=21:00&weather=rain` (dev only)

**Done when:** opening the site at different times or in different weather shows a visibly different, correct Buea.

## Phase 3 — Content, Districts & X-Ray
- [x] **P3-01** Case study panel: problem → hardest part → decision → result, links, stack, media
- [x] **P3-02** Preview capture script (Playwright) → `public/previews/*.webp` + short loops; hover preview on buildings
- [~] **P3-03** Project X-Ray: building splits into floors UI → API → Data → Infra, each labelled from content (code done and verified with test layers; waits on ≥2 real layers in `docs/projects.md`)
- [x] **P3-04** Replace counters with real numbers (GitHub + owner-supplied, each with a source)
- [x] **P3-05** Replace logo marquee with real tools/clients (or remove)
- [x] **P3-06** Replace ability cards with featured case studies (placeholder cards removed; awaiting complete featured case-study content)
- [x] **P3-07** Replace testimonials with real, attributed quotes (or one strong quote; section removed until permission is confirmed)
- [x] **P3-08** Cinema district: rooftop screen with video-editing reel (links to the YouTube channel; plays a local reel once one is added to `docs/projects.md` section 5)
- [x] **P3-09** Arcade district: easter eggs hub (cabinet, hub, 5 eggs: Arcade, cheat code, Fako, Night owl, Explorer; mini-game split out to P3-09b)
- [x] **P3-09b** Arcade mini-game: "Code runner" (endless runner through Buea streets dodging bugs; keyboard + touch, lazy-loaded, reduced-motion aware)
- [x] **P3-10** School district: teaching, tutorials, mentoring (school building + Lessons panel with the four confirmed TUIB courses; tutorials/mentoring: none yet, add lines to section 4)
- [x] **P3-11** Pitch district: kickable football; goal opens contact (penalty vs a simple keeper, strike where you click; Kick button always scores; contact panel with email + links, form in P5-03; 7th egg "Top corner")
- [x] **P3-12** Experience/career shown as the road into the city (timeline) (signpost per role, oldest at the entrance; sign or "Career" button → career panel)
- [x] **P3-13** About / origin story: Buea, Bayangi roots, why code

## Phase 3-B — Interactive City
A real, busy Buea-style city, not just buildings (ADR-013). Rules in design_system.md "Interactive city".
- [x] **P3B-01** Road and lane graph from the layout: lanes, directions, junctions, crosswalks, traffic-light points (+ tests) (`roadGraph.js`, 7 tests, dev `?lanes` overlay)
- [x] **P3B-02** Vehicle kit, built in code (flat-shaded): sedan, SUV, pickup, yellow taxi, bendskin moto-taxi, Hiace minibus, bus, timber/banana truck, police car, ambulance; one instanced mesh per type, colour variants (`vehicles.js`, 11 types, 6 tests, dev `?vehicles` showroom)
- [x] **P3B-03** Traffic: lane following, spacing, give way, traffic lights at downtown crossings; density by Buea time (rush hours, quiet nights); headlights/tail-lights at night (glow sprites); rain slows traffic, fewer motos (`traffic.js`, 7 tests, `Traffic.jsx`)
- [x] **P3B-04** Pedestrians (pavements, crosswalks, umbrellas in rain) and animals (goats, chickens on the edge of town) (`pedestrians.js` 8 tests, `animals.js` + `figures.js` 3 tests, traffic gives way at crosswalks +1 test, `Pedestrians.jsx`, `Animals.jsx`, 4 draw calls, dev `?figures` showroom)
- [x] **P3B-05** Street props: trees/palms, benches, taxi/bus stops, phone-credit kiosks, fuel station; billboards with real content only (featured projects, live GitHub numbers, weather) (`streetProps.js` 4 tests, `billboards.js` 3 tests, `StreetProps.jsx`, 3 draw calls)
- [x] **P3B-06** Interactions: click a vehicle → follow cam (Esc leaves); hail a taxi → ride to a district (reusable by the AI guide in P4-04); honk / goat bleat; clickable traffic lights; new eggs (`cityPicking.js` 4 tests, `places.js`, rides in `traffic.js` +2 tests, crossing button + poles in `roadGraph.js` +2 tests, animal poke +1 test, `TrafficLights.jsx` 2 draw calls, `StreetControls.jsx`, sound toggle, eggs 7 → 10; since 2026-10-23 you ride inside the taxi: `passenger.js` 2 tests, `TaxiCabin.jsx`, ride watchdog 2 tests)
- [x] **P3B-07** Market district (SW of the entrance): Buea-style open market; each stall = a service the owner offers → panel (what's delivered, linked example buildings, "Ask for a quote" → contact panel); prices only if owner-supplied; Pidgin seller call-outs written/approved by the owner; taxi/bus drop-off (15 stalls from `docs/projects.md`, `marketContent.js` + `market.js` 6 tests, services parser +1 test, `MarketPlot.jsx` 4 draw calls, `MarketPanel.jsx`, quote → contact panel, 2 owner call-outs)
- [x] **P3B-08** Outskirts: residential filler houses (one merged mesh, not clickable), road out towards Douala/Limbe where traffic enters and leaves; ground-floor shopfronts downtown (roads out in `layout.js` + joined lanes in `roadGraph.js`, T with a Limbe / Douala sign, `outskirts.js` + `Outskirts.jsx` 3 draw calls, `shopfronts.js` + `Shopfronts.jsx` 3 draw calls with each project's name, `outskirts.test.js` 3 tests, roads-out traffic test, layout + graph tests updated)
- [x] **P3B-09** Drive mode: drive a taxi or bendskin (WASD / touch joystick), camera follows; eggs ("visit every district", "obey every red light") (`drive.js` 8 tests, `Drive.jsx`, chase view + driver's seat, traffic stops for you (+1 traffic test), joystick, Open <project> when stopped by a building, eggs Tour guide + Model driver)
- [x] **P3B-11** Police chase (owner, 2026-10-23: later): in drive mode, running a red brings the police car after you (siren, lights); lose it or pull over (`chase.js` 4 tests: grid path-finding on the drive world, the police car drives with `stepCar`; traffic gives way to it +1 traffic test; roof lights +1 draw call while chasing; siren; eggs Escape artist + Good citizen (14); `policeLines` content +1 content test)
- [x] **P3B-10** Performance pass: phone tier (about half the traffic/people), reduced motion (vehicles parked, people still), `npm run perf` within budget (`crowdShare` in `quality.js` +1 test: half on phones and low-tier devices; billboards still under reduced motion; `npm run perf` pins Buea time to 17:30 by default, adds a zoomed-out sample and `--reduced-motion` with a nobody-moves check; T sign on two rows, Market bulbs in front of the tarps)

**Done when:** traffic, people and the market make the city feel lived-in at every Buea time and weather, clicks on them do something, and `npm run perf` still passes on desktop and phone.
**Needs from the owner:** list of services for the market stalls (+ prices if wanted) and the Pidgin call-out lines, in `docs/projects.md`.

## Phase 4 — Ask My Portfolio (AI)
- [x] **P4-01** Knowledge builder: content → compact knowledge doc used as the cached system context (`server/lib/knowledge.js` 7 tests, `npm run knowledge:build`, `router.buildings()`; ~3.7k tokens today)
- [x] **P4-02** System prompt: scope, citing projects, honesty ("I don't know"), tone, refusal of off-topic/abuse (`server/prompts/system.md`, `server/lib/systemPrompt.js` 4 tests; OJ Guide, "he", English/French/Pidgin)
- [ ] **P4-03** `POST /api/chat`: streaming (SSE), zod-validated, per-IP rate limit, message/length caps, daily spend cap
- [ ] **P4-04** Tools: `fly_to_project`, `open_case_study`, `open_contact`, `switch_mode`, handled on the client
- [ ] **P4-05** Chat UI: floating guide, suggested questions, citations as chips, works in both modes
- [ ] **P4-06** Eval set: 25 questions (recruiter, client, tricky, prompt injection) with expected behaviour; pass ≥ 23

## Phase 5 — Recruiter Mode & Polish
- [ ] **P5-01** Recruiter mode: fast text-first page (bio, top 3 case studies, skills, CV, contact)
- [ ] **P5-02** Mode switch + auto-detect (reduced motion, no WebGL, low-end device → recruiter by default)
- [ ] **P5-03** Contact: Express + nodemailer (Hostinger SMTP) + Cloudflare Turnstile + honeypot; remove EmailJS
- [ ] **P5-04** Ctrl+K command palette (projects, modes, contact, CV)
- [ ] **P5-05** Accessibility: keyboard, focus, ARIA, contrast, screen-reader text for the 3D scene
- [ ] **P5-06** SEO: meta, Open Graph image, JSON-LD `Person`, sitemap, robots, prerendered recruiter HTML
- [ ] **P5-07** Mobile pass: layout, touch, perf on a real Android phone
- [ ] **P5-08** Sound design (muted by default, toggle remembered)
- [ ] **P5-09** Easter eggs (Konami code, football chant, night-owl mode…)

## Phase 6 — Hardening & Launch
- [ ] **P6-01** Security review against `docs/security.md` checklist (CSP, headers, rate limits, input validation)
- [ ] **P6-02** `npm audit`, dependency pinning, remove unused deps
- [ ] **P6-03** Lighthouse + WebPageTest; fix regressions
- [ ] **P6-04** Privacy-friendly analytics + server error logging
- [ ] **P6-05** README rewrite (case study of OJ City itself)
- [ ] **P6-06** Launch checklist + go live + announce (LinkedIn/X post draft)

---

## Backlog / ideas (not scheduled)
- Spotify "now playing" on a radio tower
- WakaTime coding hours as a city "power meter"
- Pidgin / French language toggle
- Visitor guestbook as lights in the sky
