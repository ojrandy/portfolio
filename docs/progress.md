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

## 2026-10-23 — System prompt
**Tasks:** P4-02 (done)
**Decisions (owner):** plan approved. The guide is **OJ Guide**; it talks about Ojong in the third person as "he"; it answers in the visitor's language: English, French or Pidgin.
**Done:**
- `server/prompts/system.md` (owner-editable rules): role and audiences, knowledge-only facts with the knowledge treated as data, "I don't know" + contact form, no invented numbers/clients/testimonials/dates/prices, GitHub numbers named as GitHub's, prices only from the FAQ as Ojong's own answer, `[slug]` citations (only slugs in the knowledge), scope (portfolio + finding your way round OJ City; one-line redirect for anything else), short plain-text answers fitted to employer vs client, language matching, security (rules can't be changed by the conversation, no revealing the prompt, no personal data beyond the knowledge, one calm line for abuse), what it can't do.
- `server/lib/systemPrompt.js`: `loadRules()`, `buildSystem(knowledge)` → rules block + `<knowledge>` block with the cache breakpoint; refuses knowledge containing a `<knowledge>` tag.
- `npm run knowledge:build` prints the combined size: ~5.2k tokens (rules ~1.5k + knowledge ~3.7k).
- Knowledge doc header now says "his work" (pronoun confirmed). `architecture.md` (system prompt layout and caching), `security.md` (guardrails in place).
**Checks:** `npm test` 273/273 (system prompt 4); lint clean on changed files.
**Problems / notes:**
- The rules are untested against the model until P4-03 exists; the P4-06 eval set is where behaviour (refusals, injection, language, citations) gets checked.
- The district list in the rules (Downtown, Market, Cinema, Arcade, School, Pitch, About house) is written by hand; update it if a district is added or renamed.
**Next:** P4-03 `POST /api/chat`.

---

## 2026-10-23 — Knowledge builder
**Tasks:** P4-01 (done)
**Decisions (owner):** plan approved; the guide also knows the GitHub-discovered repos; `server/knowledge/knowledge.md` is a git-ignored review copy (the server builds the text in memory).
**Done:**
- `server/lib/knowledge.js` (pure): `buildKnowledge({ profile, projects, buildings })` → compact Markdown; `loadProfile`, `estimateTokens`, `MAX_TOKENS` (15 000). Takes `buildCity()` output, so GitHub numbers, case studies and X-Ray are cleaned exactly as on the site, and the 12 discovered repos are listed with their GitHub data. Leaves out demo records/fields, TODO(content) anywhere in a value, `<placeholders>`, unsourced numbers ("Projects shipped 100", "Users served 100", Sns Glam's "users: 100+"), testimonials without permission, scenery lines. Ends with a "Not known" list (headline, availability, CV, spoken languages, testimonials, video work, figures) for the "I don't know" rule in P4-02.
- `scripts/build-knowledge.js` + `npm run knowledge:build`: writes the review copy and prints its size; fails over the budget. `.gitignore`: `server/knowledge/`.
- `server/routes/city.js`: `router.buildings()` (same building list as `/api/city`) for P4-03.
- `architecture.md`: knowledge builder notes.
**Checks:** `npm test` 269/269 (knowledge 7, city route +2 assertions); lint clean on changed files. `npm run knowledge:build`: 13 028 chars, ~3.7k tokens, 21 content projects + 12 discovered repos.
**Problems / notes:**
- What the guide can say is only as good as `docs/projects.md`: most projects have only links and GitHub numbers (no case study), availability and spoken languages are still demo, and no testimonial has permission yet. Filling those in improves the guide directly.
- The FAQ answers (prices, "Available 24/7", 50 % deposit) go in as written by the owner.
- GitHub repo descriptions go in as data; the P4-02 system prompt must treat the whole knowledge doc as facts, not instructions.
- ~3.7k tokens is above the minimum cacheable prompt length for current models once the system prompt is added; check the exact minimum for the chosen `ANTHROPIC_MODEL` in P4-03.
**Next:** P4-02 system prompt.

---

## 2026-10-23 — Police chase
**Tasks:** P3B-11 (done)
**Decisions (owner):** plan approved. Two eggs (Escape artist, Good citizen); the officer's lines go in `docs/projects.md` for the owner to write, with "Pull over!" / "Red means stop. Drive safe!" until then; no chase with reduced motion.
**Done:**
- `src/lib/chase.js` (pure): `navGrid` (1-unit grid of the drive world, roads 1 / grass 3, blocked where a 0.8 square touches a solid; built shape by shape, 9–45 ms, checked cell by cell against `collision` in the tests), A* `findPath` (reused buffers, no allocation per push; a replan ~25 away takes 0.7 ms), `createChase` (takes over a traffic police car within 40, else a road 20–30 away, behind you if it can), `stepChase` (path-follow / direct pursuit, stop 2 short, back up when stuck; lose = 16 for 4 s, or 32 before it has been within 16; pull over = stopped within 3 for 2 s; waits 3 s; drives off to a road 20–30 away and fades over 8 s). `HANDLING.police` (4.2, turns wider). `drive.js` exports `touches`.
- `traffic.js`: `player` takes a list of footprints (you and the police car: drivers stop, walkers wait); `takeVehicle`.
- `Drive.jsx`: starts the chase on a red (not with reduced motion), steps it, your car can't go through it, bubbles ("Pull over!" after 1.2 s, the pull-over line, "You lost them."), eggs, siren while chasing, `streets.chase`, store `chase` for the chip; `?perf` only: `__cityPerf.redRun = true` counts as a red (browser checks). `Traffic.jsx` draws the police car as one more instance and its roof lights (new beacon glow mesh, blue/red, 5 Hz, only while chasing). `citySound.js` `startSiren`. `StreetControls.jsx` chip: "Police! Lose them or pull over · n away" / "Pulled over" (phase in an aria-live region). Store: `chase`, `setChase`.
- Content: "Police lines (Pidgin)" in `docs/projects.md` (Chase / Pull over, TODO(content)), parser + schema → `profile.policeLines`.
- Eggs 12 → 14 (Escape artist, Good citizen).
**Checks:** `npm test` 262/262 (chase 4, traffic +1, content +1); lint clean on changed files; build OK. Playwright on the production build at 18:40: Drive → Taxi, `redRun` → chip "Police! … 23 away", it came and stopped behind the waiting taxi in ~9 s → "Pulled over" + "Easter egg 1/14: Good citizen", the chip goes and it drives off (draw calls 49 → 50 while chasing → 49), a second chase ends cleanly on Esc; the police car turning in with its roof light flashing; 60 fps during the chase (worst frame 30 ms); no console errors.
**Problems / notes:**
- The owner needs to write the officer's lines in `docs/projects.md` ("Police lines (Pidgin)"), then `npm run content:build`.
- In the browser the chase was started with the perf-only `redRun` flag, not by really running a red (that path is the existing `trackTrip`, unit-tested). Losing it was tested in the unit tests only, not in the browser; the siren wasn't listened to (headless).
- Pulled over in the chase view, the police car stops between your car and the camera and fills the bottom of the screen for those 3 s.
- `npm run perf` wasn't re-run with a chase on (it doesn't drive); the machine was still heavily loaded.
**Next:** P0-06 initial JS (446 KB, budget 200), or the next phase.

---

## 2026-10-23 — Performance pass
**Tasks:** P3B-10 (done)
**Decisions (owner):** plan approved; low-tier devices get the half crowd too (not only phones); the T sign and Market bulbs notes were fixed here.
**Found:** the phone half (vehicles, people, shoppers) and nearly all reduced-motion handling were already in from P3B-03/04/07. Every `useFrame` was checked: the only thing still moving under reduced motion was the featured billboard turning over. The real gap was `npm run perf`: it used the real Buea time, so a run at 03:00 measured ~4 vehicles and passed without saying anything about rush hour, and it never measured dusk glows, the zoomed-out view or reduced motion.
**Done:**
- `quality.js` `crowdShare({ touch, tier })`: 0.5 on touch devices and when the first quality guess is low, 1 otherwise; used by Traffic, Pedestrians and MarketPlot (was `touch ? 0.5 : 1` in three places). Decided once on load, not on PerformanceMonitor step-downs (a new share rebuilds the traffic). +1 test.
- `?perf&time=HH:MM` pins Buea time in the production build (perf runs only, reuses `parsePreviewOverride`). `scripts/perf.mjs`: default `--time=17:30` (rush hour at dusk: full crowd, lamps and head/tail-light glows; `--time=live` for the clock); a third sample zoomed right out (hold '-' from the start view); `--reduced-motion` runs with prefers-reduced-motion and fails if any vehicle or person moves (`PerfProbe` `crowd()`); prints the crowd size and the zoomed-out draw calls.
- `StreetProps.jsx`: the featured billboard doesn't turn over with reduced motion.
- T sign (`Outskirts.jsx`): one place per row with its arrow on its side and a rule between ("← Douala" over "Limbe →"); board 1.4 tall (was 1), texture 1024 × 840.
- Market (`MarketPlot.jsx`): three bulbs just in front of each tarp's edge instead of one under it (same draw call).
- `design_system.md`: phones and weak devices, reduced motion list, perf defaults, T sign, Market bulbs.
**Checks:** `npm test` 256/256; lint clean on changed files; build OK (initial JS 446 KB, lazy 96 KB). `npm run perf`, all PASS on desktop (quality medium) and phone (Pixel 7, 4× throttle, low):
- 17:30 default: desktop 56.4 / 56.3 / 60 fps (idle / flight / zoomed out), 43 draw calls (60 zoomed out), 30 vehicles + 39 people; phone 53.1 / 53.7 / 59.7, 41 calls, 15 + 19.
- `--weather=storm`: desktop 59.7 / 56.9 / 60, 45 calls (62 out); phone 58.2 / 54.3 / 55.4, 43.
- `--reduced-motion`: nobody moved; desktop 60 / 59.6 / 59.5; phone 49.6 / 38.2 / 48.3.
- `--time=03:00`: 4 vehicles, 2 people; desktop 60 / 56.6 / 60; phone 56 / 41.9 / 48.4.
- Playwright on the production build at 18:50: Market stalls show their bulbs from above, the T sign reads "← Limbe" over "Douala →" from the town side, no page errors.
**Problems / notes:**
- The machine was at 100 % CPU with < 1 GB free memory (VS Code, Chrome) during the runs: two runs timed out before loading, and the phone reduced-motion / 03:00 numbers (less work, lower fps) are noise. Worth one re-run on an idle machine.
- On the phone the zoomed-out sample shows the same draw calls as the start view: the portrait start view is probably already near the maximum distance.
- The reduced-motion check was only run where it should pass; it wasn't tried against moving traffic.
- Initial JS is still 446 KB gzip (budget 200); P0-06.
**Next:** P3B-11 police chase, or P0-06 initial JS.

---

## 2026-10-23 — Drive mode
**Tasks:** P3B-09 (done); P3B-11 added (police chase, later)
**Decisions (owner):** plan approved. Roads and grass are drivable, not pavements or buildings; chase view by default plus the driver's seat for the taxi; Model driver = every set of lights in one drive with no red; running a red only says "Red light!" and clears the count for now (the police coming after you is P3B-11, later); stopped next to a building, Enter (or the chip) opens its project.
**Done:**
- `src/lib/drive.js` (pure): arcade handling (taxi top 4, bendskin 4.4, 60 % on grass), solid shapes from the layout in a grid (pavements, plots, fuel station parts, stops, kiosks, benches, trunks, lamps, poles, sign and billboard posts, About house, pens, outskirts houses, the T sign), bounds = `layout.outskirts`, slide along walls / stop head-on, sub-steps of 0.12; `chaseView` (comes in when a building is behind), `nearBuilding`, `districtAt`, `trackTrip` (districts, crossings passed, red runs). `drive.test.js` (8 tests: start spot, 90 s random driving on every tier never leaves the bounds or ends inside anything, walls / sliding / reverse / grass, vehicles and people, red lights and the egg, districts and the tour, chase camera vs buildings and the building you stop by, deterministic).
- `traffic.js`: `stepTraffic` takes `player` (your footprint): drivers who see it ahead stop behind it, nobody moves into it; `crosswalkClear` keeps walkers back while your car is within 1. Traffic test: parked in a lane and in a crossing for 90 s, nobody drives into it, traffic still flows, walkers wait.
- `Drive.jsx` (keys, joystick input, bump honks, "End of OJ City. Turn back!", "Red light!", eggs, engine hum), `Traffic.jsx` draws your car as one more instance (no extra draw calls), `CameraRig.jsx` chase view / driver's seat, Esc parks and the view comes back, `TaxiCabin.jsx` driver's-seat cabin with a spoked wheel that turns (2 draw calls, only in that view), `StreetControls.jsx` Drive menu, chip (Open <project>, View, Horn, Park), touch joystick. Store: `driving`, `driveNear`, `startDrive` / `stopDrive` / `setDriveView` / `peekProject`. Eggs 10 → 12 (Tour guide, Model driver). `honkText` moved to `vehicles.js`.
**Checks:** `npm test` 255/255; lint clean on changed files; build OK. `npm run perf`: desktop PASS (60 / 59.5 fps, 40 draw calls), phone PASS (59 / 53.6 fps, 40); initial JS 445.8 KB (unchanged), city chunk 93.2 KB (was 87.6). Playwright on the production build (:3105), 16/16: Drive → Taxi, the city gets the keys, up Career Road into downtown, stopped by Learn Contri Talk → Open → panel opens while still driving, V → driver's seat, H → "Beep beep!", Esc parks, bendskin (no seat view) + Park, Pixel 7 joystick drives, no horizontal scroll, no console errors.
**Problems / notes:**
- First look from the driver's seat had the wheel filling the windscreen: the wheel is now lower and nearer the dashboard, and your eyes sit a little further back.
- The eggs were tested in the unit tests, not by driving them in the browser.
- Drivers wait behind your car as long as it stays in their lane (no overtaking in the simulation).
- The T sign reads "Douala·Limbe" squeezed together from far away (P3B-08), worth a look in P3B-10.
- Initial JS is still 446 KB gzip (budget 200); P0-06.
**Next:** P3B-10 performance pass, or P3B-11 police chase.

---

## 2026-10-23 — Outskirts and the road out
**Tasks:** P3B-08 (done)
**Decisions (owner):** plan approved. Career Road carries on south to a T: Limbe west, Douala east (the real Buea → Mutengene roads); the main road runs on through the outskirts too; shopfronts carry each project's own name (real content); the goats and chickens stay by Career Road.
**Done:**
- `layout.js`: `ROAD_OUT`; four `out` roads (main road +30 each way, Career Road +24 to the T, the 4-wide Limbe–Douala road), dashed centre lines, `layout.reach` (camera target down to the T, used by `CameraRig`), `layout.roadOut`, `layout.outskirts`. `layout.bounds` is unchanged, so props, pens, plots and the start view stay where they were.
- `roadGraph.js`: pieces of one road laid end to end are joined into one line (no junction between Career Road and its road out). Edges are now the four far ends; the T is a give-way tee.
- `traffic.js`: `SPEED.out` 3.2; every entry equally likely (no more "fewer from the entrance"); `index.town` = lanes town traffic can reach. Drop-offs only on those, and bookings only take taxis already in town (a taxi still on the Douala road had made an About ride take 105 s). Corners: the two turns always conflict (two buses touched on a corner, an old case the new traffic pattern exposed).
- `pedestrians.js`: someone who has waited a whole light cycle may start crossing later in the red (more turning traffic had someone waiting 39.6 s on tier 6).
- `src/lib/outskirts.js` + `src/city/Outskirts.jsx` (3 draw calls): about 150 houses (240 on tier 8), rows facing the roads out plus a thinning grid, zinc gable roofs (new `roof` part in `propGeometry.js`), verandas, yard walls, lit windows at night; the Limbe / Douala sign at the T.
- `src/lib/shopfronts.js` + `src/city/Shopfronts.jsx` (3 draw calls): two shops per building, project name on the fascia, awning, door, display window lit at night; `Buildings.jsx` leaves out those ground-floor windows; hidden for a building in X-Ray.
- Tests: `outskirts.test.js` (3: houses clear of town, roads, each other, the sign and the start view on every tier; the sign; shopfronts face roads), a roads-out traffic test (vehicles appear and vanish only far out), layout + graph tests updated for the new edges and the T.
**Checks:** `npm test` 246/246; lint clean on changed files; build OK (city chunk 87.6 KB gzip, was 81.2). `npm run perf`: desktop PASS (59.4 / 58.5 fps, 40 draw calls), phone PASS (60 / 60 fps, 40). Playwright on the dev server: start view with houses either side of downtown under Fako, zoomed-out view of the roads out, the T and its sign; shopfronts by day and lit at 20:30 ("Smart Meal" fascia); phone portrait at 17:30 in rain with no house in the foreground; peak 59 draw calls fully zoomed out; no console errors. Ride simulations on every tier: all places reached, longest 96.9 s on tier 8 (limit 100).
**Problems / notes:**
- About 25 of the 30 vehicles are in town at any moment now (5 are on the roads out). If downtown feels thin, turning out of town can be made rarer (`EXIT_WEIGHT`).
- Taxi booking falls back to a new taxi at the nearest entry, which is now ~45 away by road; it only happens when no free taxi in town can go.
- Rides on the 8 × 8 downtown are close to the 100 s test limit (96.9 s).
- Initial JS is still 446 KB gzip (budget 200), unchanged; P0-06.
**Next:** P3B-09 drive mode (can reuse the cabin, the inside view and the roads out), or P3B-10 performance pass.

---

## 2026-10-23 — Riding inside the taxi
**Tasks:** P3B-06 (rework, owner request)
**Owner request:** booking a taxi should feel real: the taxi takes you to the place and you are inside it, not a camera trick. Confirmed this is not P3B-09 (drive mode = you drive with WASD/joystick); it builds on P3B-06.
**Decisions (owner):** full real drive (30–75 s, Skip any time), front passenger seat, the driver says owner-written Pidgin lines (none yet).
**Done:**
- `traffic.js`: route rides are back (`planRoute`, `startRide`, `bookTaxi`: the followed taxi, the nearest free taxi that can go, or a new one at an entry); the quick-trip jump is gone. `RIDE.max` 120 s.
- `src/lib/passenger.js` (pure): seat (right-hand front seat, the driver on the left), field of view, head-turn limits, `passengerView` (eye + target). `passenger.test.js` (2 tests: the eye stays inside the cabin in every heading; look limits and directions).
- `CameraRig.jsx`: during a ride the camera is your eyes (camera-controls disabled and kept at your seat, so stepping out flies on from there); drag or arrows/WASD/Q/E turn your head and it settles back to the road; Esc / "Get out" leave the ride.
- `TaxiCabin.jsx` (1 draw call, only during a ride): hood, dashboard and dials, ring steering wheel, pillars, doors, roof lining, mirror and the driver. `Traffic.jsx` hides your taxi's toy-scale shell and its own light glows (they flared across the windscreen); clicks on other vehicles during a ride honk without throwing you out; 1.2 s at the stop before you step out.
- Engine hum while riding (`citySound.js` `startEngine`, Sound on only). Driver lines: `docs/projects.md` "Taxi driver lines (Pidgin)" (Pick-up / Arrival, TODO(content) for now) → `profile.taxiLines` (parser + schema + 1 content test); the driver stays silent until the owner writes them.
- Store watchdog: no taxi after 1.5 s, or still riding after 125 s → straight to the place (store tests updated). `say()` takes a duration (driver lines stay 3 s).
- Ride tests: back to the real-drive test (every place from every entry; rush-hour rides with crossing buttons pressed arrive in < 80 s, 100 s on tier 8, no touching, no red-light running).
**Checks:** `npm test` 241/241; lint clean on changed files; `content:check` OK. Production build, Playwright from the passenger seat: first attempt showed the toy-scale cabin filling the screen (yellow roof and hood, a black slab of dashboard, a block-stack wheel), fixed with the hidden shell + roomier cabin + torus wheel. Rides: Market 65 s, Pitch 39 s, School (20:00, night) 55 s, Cinema (noon) 57 s; arrival + "Taxi!"; no console errors.
**Problems / notes:**
- The owner needs to write driver lines (pick-up and arrival) in `docs/projects.md`, then `npm run content:build`.
- Two dev servers were running (:5173 and :5174); the store changed, so restart `npm run dev:all` and hard-refresh.
**Next:** P3B-08 outskirts, or P3B-09 drive mode (can reuse the cabin and the inside view).

---

## 2026-10-22 — Quick taxi rides (owner report)
**Tasks:** P3B-06 (fix)
**Owner report:** booking a taxi took too long and in the end no ride came. A ride must not take even 5 s.
**Causes:** the taxi drove the real route through traffic, obeying every light and give-way (30–75 s, up to 90 s before the give-up). And any arrow/WASD key during a ride silently cancelled it, leaving you halfway with no arrival.
**Decision (owner):** "Quick trip" (over a 10× time-lapse). The taxi picks you up (camera follows it 1 s), jumps to the drop-off while the camera glides after it, pulls up, and you're there. At most 5 s, whatever happens.
**Done:**
- `traffic.js`: `nearestTaxi` (free taxi within 40 of the camera target), `jumpToRide` (lands up to 2.5 before the stop, only where the body and the stretch to the stop are clear, 3 from the lane start if someone is turning in, and nobody behind would have to brake hard; a new taxi when none is near). `RIDE` gets `near`, `pickup`, `pullIn`, `max`. Route planning (`planRoute`, `startRide`, `hailTaxi`) removed.
- `Traffic.jsx`: quick-trip flow, retries the jump next frame when there's no room, 5 s wall-clock cap → the camera goes to the place. `CameraRig.jsx`: keys (or losing the taxi) during a ride skip to the place; Esc / Stop still leave the ride.
- Tests: the busy-traffic ride test is now "every place within 5 s" on every tier at rush hour with crossing buttons pressed (taxi stops at the drop-off, no touching, no red-light running). This replaces yesterday's 80 s / 100 s limits.
**Checks:** `npm test` 236/236; lint clean on changed files. Production build, Playwright at 08:00 WAT (rush hour), timed in the page from click to arrival with no Skip: Market 2.7 s, Pitch 1.4, Cinema 2.4, School 2.5, Arcade 2.4, Downtown 2.2, About house 2.4, Market again 3.2; the chip shows at once; no console errors.
**Follow-up (same day, owner: still slow and "no ride"):** reproduced on the owner's own dev server (:5173) at Buea's real time (night): rides did arrive in 0.5–2.9 s (also 0.6–3.5 s at 6× CPU throttle), but frame captures showed why it didn't feel like a ride. The follow cam dived to street level among dark buildings, the taxi was hidden behind the TAXI/BUS sign, and the camera then jumped to the place. Fixes:
- Ride camera (`CameraRig.jsx` `RIDE_VIEW`): a high chase view (16 back, 0.72 rad) instead of the street-level follow cam. While catching up after the jump it pulls out by up to 24, an arc over the city.
- "Your taxi" pin and label over the ride taxi (`Traffic.jsx`: window-yellow cone, unlit so it reads at night, bobbing; Html label; only during a ride).
- Pick-up 1 s → 1.5 s, so you see your taxi drive off.
- Checked: Windows animation effects are on here (so the browser doesn't ask for reduced motion, which skips the taxi on purpose). Frames now show the pinned taxi downtown → the glide over Career Road → the pinned taxi pulling up at the Market → arrival + "Taxi!" in about 3.5 s. `npm test` 236/236, lint clean, build OK.
- Two OJ City dev servers were running (:5173 since 10-21 19:19 and :5174 since 10-21 06:16); both serve the current files, but a tab open since before the fix needs a hard refresh.

**Follow-up 2 (owner screenshot: stuck on "Finding a taxi…"):** that label means no taxi ever answered, i.e. the ride step in Traffic's frame loop wasn't running or was throwing. Likely cause: a tab left open across the ride-code changes; hot reload keeps the old ride record (no drop-off target), so the new code throws on every frame. Fixed for good:
- `useCityStore` watchdog, independent of the 3D loop: no taxi after 1.5 s, or still riding after 5.5 s → arrive at the place (`useCityStore.test.js`, 2 tests with mocked timers, incl. an old ride's timers leaving a newer ride alone).
- `Traffic.jsx`: the ride step is wrapped (any error ends the ride at the place and is logged), a leftover ride without a target ends at once, and with no taxi within 40 the nearest free taxi anywhere answers (a Downtown run had gone straight there with no taxi). No taxi yet → retry next frame instead of skipping the ride.
- Checked on the owner's dev server at 1920 × 946 with Sound on: all 8 rides (Market, Pitch, Cinema, School, Arcade, Downtown, About house, Market) show the chip at once and arrive in 0.4–3.1 s; no console errors. `npm test` 238/238, lint clean.

**Next:** P3B-08 outskirts, or P3B-09 drive mode.

---

## 2026-10-21 — Market district
**Tasks:** P3B-07 (done)
**Decisions (owner):** plan approved. All 15 stalls: the owner's new list (frontend, backend, web app, mobile app, graphics design, cloud infrastructure, AI infrastructure, QA & QC, project management) merged with the earlier one (video editing, CCTV, SEO & Google Maps, IT lecturing, AI for studying), "Graphics" listed twice → one stall, plus "And many more". No prices (they depend on the job). The owner asked Claude to write the "Delivered" lines and approved proposing example projects. Call-outs: "I wan buy" and "Who they here", as written.
**Done:**
- Content: `docs/projects.md` services now take **Delivered** / **Examples** sub-bullets, plus a "Market call-outs (Pidgin)" section. The parser makes `services: { name, delivered, examples, demo }[]` and `marketCalls`; unknown example slugs and fields are errors; the schema was updated (+1 content test).
- `layout.js`: Market plot (`MARKET`, 13 × 9) west of Career Road by the entrance; props, lamps and animals avoid it automatically (district plot). `places.js`: "Market" in Take a taxi, seen from the entrance side; drop-off on Career Road beside the west taxi/bus stop.
- `src/lib/marketContent.js` (owner content only; demo services, demo fields and demo/unknown examples left out). `src/lib/market.js` (pure, seeded): stall rows, MARKET sign spot, market hours, shoppers walking the aisles, `pickMarket`. `market.test.js` (6 tests: content, plot clear of signs/props/lamps/About house on every tier with 0–8 roles, stalls for 1–18 services, hours, shoppers, clicks).
- `src/city/MarketPlot.jsx` (4 draw calls) reusing the prop kit helpers now exported from `propGeometry.js`. `MarketPanel.jsx`; `ContactPanel` takes `about` (title "Ask for a quote: <service>", mailto subject "Quote: <service>").
**Checks:** `npm test` 236/236; lint clean on changed files. Build: Market code only in the lazy city chunk (81.2 KB gzip, was 77.4); initial JS 445.8 KB (services text ~1 KB). Playwright on the production build (scratch script): taxi to the Market, Market button → panel, stall switch, no prices, quote title + mailto subject, example → Vital Pulse panel, 3D clicks on stalls open the right service, shoppers answer "I wan buy" / "Who they here" in turn, dusk view, Pixel 7 no horizontal scroll, no console errors.
**Problems / notes:**
- `npm run perf`: phone PASS (55.2 / 49.2 fps, 38 draw calls). Desktop FAIL (40 / 30 fps, 40 draw calls), but an A/B with the Market switched off gave the same (40.9 / 28.5): the machine was busy (VS Code and Chrome using a lot of CPU). **Re-run on an idle machine.**
- The ride test's 75 s limit broke because a new place changed the order of rides (a tier-3 About ride waited ~20 s at lights whose buttons the test presses at random: 76 s). Now 80 s up to tier 6 and 100 s on tier 8, where rides were already at 74 s.
- At dusk the stall bulbs sit under the tarps and barely show from above; could be raised in P3B-10.
- Example names show as written in content (`expense-Tracker`, `food_recipe2`): give those projects proper names in `docs/projects.md` when convenient.
**Next:** P3B-08 outskirts, or P3B-09 drive mode.

---

## 2026-10-21 — City interactions
**Tasks:** P3B-06 (done)
**Decisions (owner):** plan approved with the defaults: the sound module and a muted-by-default toggle now (P5-08 builds on it), the traffic-light click is a crossing button, three new eggs (Taxi!, Goat whisperer, Undercover), no separate Career Road stop (the About house is enough).
**Done:**
- `src/lib/cityPicking.js` (pure): ray vs box / sphere hit tests for vehicles (at least 0.5 wide, so motos can be clicked), animals and signal poles. Each joins R3F's events through one invisible hit object with a custom `raycast`, so the nearest thing wins (three's instanced-mesh bounds are computed once and would miss moving vehicles).
- Follow cam (`CameraRig.jsx`, store `following`): click a vehicle → chase view behind it, still rotatable/zoomable; Esc or Stop goes back to the view from before; keys stay where you are; a vehicle leaving the map ends it.
- Taxi rides: `traffic.js` `rideTarget` (nearest lane point, never an entry lane), `planRoute` (shortest way over the lane graph, no exits on the way), `startRide` / `hailTaxi` (followed taxi, nearest taxi to the camera target, or a new one at the nearest entry) / `endRide`; the taxi pulls up, waits 1.5 s and emits an `arrived` event. `src/lib/places.js`: Downtown, the four districts, the About house, with the arrival view. Store `rideTo(place)` is the entry point for P4-04. "Take a taxi" menu, "Ride in this taxi", chip with Skip / Stop. Reduced motion: cut to the place.
- Honk / bleat: speech bubbles (`SpeechBubble.jsx`, also in the live region), `animals.js` `pokeAnimal` (a goat looks at the camera 2.5 s, a hen scurries off inside its pen). `citySound.js`: Web Audio horn / bleat / cluck / button beep, silent unless the new Sound toggle is on (`useSoundStore`, localStorage `oj-city:sound`).
- Traffic lights: `roadGraph.js` `signalPoles`, `pressSignal` (a green ≥ 2 s old ends now through amber and all red; once a cycle per crossing), `roadGraphFor` (one graph per layout shared by traffic, people and poles). `TrafficLights.jsx`: poles with live lamps and a crossing button, 2 draw calls.
- Eggs 7 → 10: Taxi! (finish a ride), Goat whisperer, Undercover (follow the police car 20 s).
- Bottom-left buttons grouped in `StreetControls.jsx` (About, Take a taxi, Sound); the chip sits bottom right (above the buttons on phones).
**Checks:** `npm test` 229/229; lint clean on changed files (the old template files still have their 5 errors). Build: new code only in the lazy city chunk (77.4 KB gzip by perf, was ~71). `npm run perf`: desktop PASS (60 / 56.2 fps, 39 draw calls), phone PASS (59.2 / 53.6 fps, 35). Playwright on the production build (scratch script, 14/14): ride to the Pitch with the chip, honk on the followed taxi, arrival + "Taxi!" toast, Esc leaves a ride, Skip, sound toggle stored, a hen answers "Bwok bwok!", a pole answers "Beep! The lights change now.", reduced motion cuts to the Cinema, Pixel 7 no horizontal scroll, no console errors.
**Problems / notes:**
- The Arcade's nearest lane was the main road's entry lane from the west edge, which nothing on the roads can turn into: drop-offs now skip entry lanes (test: every place from every entry, every tier).
- A crossing joining a wide and a narrow road put the narrow arm's pole too far out: poles use their own road's width.
- Clicking the taxi you are riding honks without ending the ride; clicking another vehicle ends it.
- Pedestrians aren't clickable (not in this task).
**Next:** P3B-07 Market (needs the owner's services list and Pidgin lines in `docs/projects.md`), or P3B-08 outskirts.

---

## 2026-10-21 — Pedestrians and animals
**Tasks:** P3B-04 (done)
**Decisions (owner):** plan approved with the defaults: up to 40 people on desktop (phones half), 2 × 3 goats and 4 + 5 chickens at the edge of today's town, plain clothes colours (no cultural motifs).
**Done:**
- `src/lib/pedestrians.js` (pure, seeded): walk network from the block pavements + crosswalks, walking with gaps and keep-right, crossing rules (lights: first 4 s of the red, with time to cross; no lights: give way to drivers near the line for up to 8 s), density by Buea time, rain halves the head count and brings out umbrellas, fade in/out at doorways, two people at each taxi/bus stop by day.
- `src/lib/traffic.js`: each turn knows the crosswalks it passes; `stepTraffic({ crossing })` stops drivers booking a turn through a busy one; `crosswalkClear` for walkers. `roadGraph.js` crosswalks now have an `id` and the light `phase` that stops traffic across them.
- `src/lib/animals.js` (pure, seeded): pens near the entrance clear of everything, wander / graze / peck, chickens roost and goats rest at night.
- `src/lib/figures.js` + `src/city/figureGeometry.js`: person, umbrella, goat, chicken; limbs and heads animated in the vertex shader. `Pedestrians.jsx`, `Animals.jsx` (4 draw calls), mounted in `CityExperience`, sharing a `streets` object with `Traffic.jsx`. Dev showroom `/?city&figures`.
- Tests: `pedestrians.test.js` (8: density, redLeft vs the lights, walk network on pavement/crosswalks and connected, nobody off the network or starting against the lights, with traffic on every tier: no vehicle ever touches anyone on a crosswalk, longest waits < 30 s on foot and < 50 s driving, head count, stop waiters, deterministic), `animals.test.js` (3), `traffic.test.js` +1 (no turn through a busy crosswalk).
**Checks:** `npm test` 220/220; lint clean on changed files. Production build: all new code in the lazy city chunk (71.5 KB gzip, was 58.4). `npm run perf`: desktop PASS (59.8 / 55.7 fps, 35 draw calls), phone PASS (55.6 / 53.1 fps, 30). Playwright on the dev server: people walk the pavements mid-stride, cross at the crosswalks, umbrellas in the showroom, goats and chickens visible beside Career Road when zoomed out; no console errors (the dev API returned 500 on some loads, fine on retry).
**Problems / notes:**
- First joint run: a driver waited 120 s and a walker 87 s. Causes: people waiting at a corner for a second crosswalk while still on the first, people allowed to start for most of the red (starving turning drivers), and walkers at tees never finding a gap. Fixed by the no-two-crosswalks rule, the 4 s walk window + hurrying across, and an 8 s patience. Drivers now wait up to ~45 s at worst (26 s with no people), since turning drivers give way to people.
- The animals sit south of the main road, below the start view: they show when zoomed out or travelling along Career Road. If the owner wants them in the first view, move the `HERDS` anchors.
- Initial JS is still 445 KB gzip (budget 200), unchanged; P0-06.
**Next:** P3B-06 interactions (plan first): follow cam, hail a taxi, honk / goat bleat.

---

## 2026-10-21 — Street props and billboards
**Tasks:** P3B-05 (done; desktop perf borderline, see notes). P3B-04 (pedestrians) postponed by the owner.
**Decisions (owner):** plan approved as proposed: "Call box" kiosks with no network brands or colours, an unbranded "FUEL" station, three billboards (featured project, GitHub numbers, Buea weather).
**Done:**
- `src/lib/streetProps.js` (pure, seeded): fuel station, 3 billboards, 2 taxi/bus stops, call boxes, palms, benches, park trees, each at the first free candidate spot clear of roads, blocks, plots, lamps, career signs, the About house and earlier props. `streetProps.test.js` (4 tests, every tier + the real city, 0/3/5 career signs).
- `src/lib/billboards.js` (+3 tests): featured boards (non-demo, name, stack, HTTPS domain), GitHub numbers (sums over non-demo GitHub projects, source + Buea date), weather (rounded °C, condition, source + time).
- `src/city/propGeometry.js` (prop kit, merged geometry, text-panel atlas) and `StreetProps.jsx` (3 draw calls; lamps light with the street lamps; panels glow at night; the featured board turns over every 8 s by switching UVs and opens the project on click).
- `aboutHouseSpot` / `ABOUT_HOUSE` moved into `aboutContent.js` (AboutHouse and the props share them).
**Checks:** `npm test` 208/208; lint clean on changed files. Playwright on the production build (own server on :3105, `/api/buea` time/weather rewritten for night/rain): boards read "Sns Glam · React · Node", "456 commits · 11 stars across 27 GitHub repositories", "Buea now 25 °C · Overcast"; night glow; clicking the featured board opens Sns Glam's panel (pointer cursor on hover); Pixel 7 no horizontal scroll; no console errors.
**Problems / notes:**
- The first placement put the GitHub board behind the fuel station, cut off at the bottom of the start view; all three now stand in a row east of Career Road.
- `npm run perf`: phone PASS (53.1 / 54.1 fps, 26 draw calls); desktop FAIL on flight (52.5 fps; idle 59.7, 28 draw calls) on a busy machine. An A/B on the same build (props on/off, 4 runs each) gave flight 54.0 vs 56.8 fps and identical idle (60); the long single frames (66–285 ms) happen in both. Repainting the featured board every 8 s (a 9 MB texture upload) was ruled out and replaced by the UV switch anyway. **Re-run `npm run perf` on an idle machine;** if desktop flight stays under 55, P3B-10 can trim (e.g. props stop receiving shadows, smaller atlas).
- The owner's dev API server (:3001) stopped during the session; checks used a production server on :3105 instead.
- Weather text and the GitHub board repaint the whole atlas when their data changes (rare).
**Next:** P3B-04 pedestrians and animals, or P3B-06 interactions (plan first).

---

## 2026-10-21 — Traffic fix: vehicles passing through each other
**Tasks:** P3B-03 (fix, owner report)
**Done:**
- The overlap test shrank bodies to 90 % and missed real contacts. At full size the one case left in the simulation was a driver following someone who turned another way out of the same lane: drivers on a turn now keep their gap to them.
- Safety net in `stepTraffic`: before moving, each vehicle checks its full-size body against every vehicle in front of it (any road, already decided moves first) and stops if they would touch. `footprint` / `footprintsOverlap` are exported and used by the test.
- The dev showroom (`?vehicles`) turns the live traffic off (it drove through the parked rows).
- Test: full-size bodies, every tier + the real city, at 30 and 10 fps (long frames).
**Checks:** `npm test` 201/201; lint clean on changed files; full-size overlap scan 0 contacts; longest wait unchanged (≤ 27 s); Playwright: traffic drives as before, no console errors (the dev API returned 500 on two runs, fine on retry).

---

## 2026-10-21 — Traffic
**Tasks:** P3B-03 (done)
**Decisions (owner):** plan approved with the default numbers: up to 30 vehicles at rush hour on desktop, about 12 at midday, about 4 late at night, half on phones. Drive mode stays in P3B-09.
**Done:**
- `src/lib/traffic.js` (pure, seeded): lane following, smooth braking for the vehicle ahead and for lights, junction booking (conflicting turns from the lane graph, room beyond the junction, short lanes booked straight through), give way at tees and for left turns, a 6 s patience rule with fair claims so side streets aren't starved; density by Buea time (`trafficDensity`, `targetCount`), Buea mix (`pickType`, rain halves motos), rain slows everyone by up to 30 %; vehicles enter at the map edges and fade in/out.
- `src/lib/traffic.test.js` (7 tests): density curve, mix, no overlaps (oriented footprints), no red-light entries after the all-red second and nobody stopped in a junction, no gridlock (longest wait < 35 s, vehicles keep leaving), density target and rain, deterministic.
- `src/city/Traffic.jsx`: one InstancedMesh per type written every frame + head/tail glow sprites (additive billboards, fade in with the lamps; tail-lights brighter when braking). No shadows (static shadow map), no pointer hits; reduced motion keeps them parked. Mounted in `CityExperience` (phones `share` 0.5).
- Vehicle geometry and materials moved into `vehicleGeometry.js` (shared by the showroom and the traffic).
**Checks:** `npm test` 201/201; lint clean on changed files. Production build: traffic only in the lazy city chunk (58.4 KB gzip). Playwright on the dev server (GPU): vehicles drive on the right at 08:00, headlights at 20:30–21:00, fewer motos and slower in rain, showroom still fine, reduced motion frames identical, no console errors (one run hit a transient 500 from the dev API). `npm run perf`: first run desktop FAIL (flight 54.4 fps; machine busy: VS Code, Chrome, another dev server), re-run PASS on both (desktop 60 / 55.8 fps, 28 draw calls; phone 50.5 / 48.3 fps, 23).
**Problems / notes:**
- Tuning found real jams on the 3 × 3 city: the main road is the only way in and out, and through traffic has to book three junctions at once by Career Road. Rarer exits, the patience/claim rule and "only the front driver deals with the junction" fixed them (longest wait 42 s → 23 s).
- The simulation costs about 0.3–1 ms a frame for 30 vehicles (timings noisy on this machine); the phone is ~3–4 fps lower than before. P3B-10 can trim it (e.g. step at 30 Hz).
- Vehicles appear and leave at the entrance, near the start view; P3B-08's road out will take that over.
- In the dev showroom (`?vehicles`) the live traffic drives past the parked rows.
**Next:** P3B-04 pedestrians and animals (plan first).

---

## 2026-10-21 — Vehicle kit
**Tasks:** P3B-02 (done)
**Decisions (owner):** police cars are dark blue with one white stripe reading "POLICE" (as in Cameroon); timber and banana trucks are two types with differently shaped loads, kept light; taxis stay the standard yellow.
**Done:**
- `src/lib/vehicles.js` (pure): 11 types (sedan, taxi, police, SUV, pickup, bendskin moto, minibus, bus, timber truck, banana truck, ambulance) as lists of boxes / cylinders / blobs; sizes, head and tail light points (for P3B-03) and colour variants; `pickVariant(type, seed)` is deterministic. No brands; no red cross on the ambulance (protected emblem); the "Hiace" is a generic minibus.
- `src/city/vehicleGeometry.js`: merges a type into one geometry (vertex colours, `aTint` so only body parts take the instance colour, decal UVs for the police lettering); `Vehicles.jsx` draws one `InstancedMesh` per type (police lettering from a small canvas texture).
- `src/lib/vehicles.test.js` (6 tests): the 11 types, every one fits a street lane and is short enough to turn, parts above the ground and wheels on it, lights front/back, variants valid and deterministic, ≤ 600 triangles per type (banana truck 13 bunches and six-sided wheels to get under it).
- Dev showroom `/?city&vehicles` (`VehicleShowroom.jsx` via `CityPreview`).
**Checks:** `npm test` 194/194; lint clean on the new files (the 3 old template components still fail, unchanged). Playwright on the dev server, day and night: every type reads at the start view and close up, westbound row faces west, "POLICE" legible on the stripe, no console errors; the vehicles add up to 11 draw calls. Production build: no vehicle code in any chunk (not used in the live city until P3B-03). `npm run perf`: desktop PASS (60 / 56.3 fps, 23 draw calls), phone PASS (53.3 / 52.3 fps, 21).
**Problems / notes:**
- Headless Playwright doesn't take the WASD keys (no focus); zoom with small wheel steps towards the target instead.
**Next:** P3B-03 traffic (plan first): lane following, lights, density by Buea time, glow sprites at the light points.

---

## 2026-10-21 — Road and lane graph
**Tasks:** P3B-01 (done)
**Done:**
- `src/lib/roadGraph.js`: `buildRoadGraph(layout)` → nodes (cross / tee / corner / edge), two lanes per road piece on the right, turn links (curves, never straight back), crosswalks, entries/exits; `signalState(node, t)` for the lights (NS 8 s green, 2 s amber, 1 s all red, then EW; offset per crossing). Junctions are found from the road rectangles, so the market road and the road out (P3B-07/08) join by themselves. Coordinates are snapped so roads meeting at x = 0 share one node (a −0 vs 0 key split them at first).
- `src/lib/roadGraph.test.js` (7 tests, every tier + the real city): lanes on their road and on the right, every lane reachable from an entry and leading to an exit, lights never green/amber both ways, crosses → lights, tees → the through/main road has priority, Career Road a T on odd tiers and a crossing on even ones, crosswalks outside the junction, deterministic.
- `src/city/LaneDebug.jsx` via `CityPreview` (dev only): `/?city&lanes` draws lanes by road kind with arrows, turns, crosswalks and live light dots.
**Checks:** `npm test` 188/188; lint clean on changed files. Production build: no lane code in any chunk (city chunk 48.9 KB, unchanged). Top-down renders of tier 3 and 4 and the 3D overlay on the real 4 × 4 city look right, no console errors. `npm run perf`: first run desktop FAIL (flight 50.1 fps, another dev server running on :5173); re-run PASS on both (desktop 60 / 55.3 fps, 23 draw calls; phone 55.7 / 52 fps, 21).
**Problems / notes:**
- On odd tiers the main-road stretch between Career Road's T and the next T is only 0.9 long: P3B-03 must not let a car enter a junction without room beyond it.
- Initial JS is still 445 KB gzip (budget 200), unchanged; P0-06.
**Next:** P3B-02 vehicle kit (plan first).

---

## 2026-10-20 — Phase 3-B Interactive City planned
**Tasks:** P3-B phase added (P3B-01 … P3B-10, all todo)
**Decisions (owner, ADR-013):** traffic + people + market before Phase 4; vehicles built in code in the flat style; drive mode included; Market = services market (one stall per service → contact), SW of the entrance; Pidgin call-outs with owner-approved lines.
**Done:** tracker phase + tasks; "Interactive city" rules in design_system.md; ADR-013.
**Needs (owner):** services list for the market stalls (+ prices if wanted) and Pidgin call-out lines in `docs/projects.md`.
**Next:** plan and build P3B-01 (lane graph).

---

## 2026-10-20 — About house and origin story; zoom to cursor
**Tasks:** P3-13 (done); camera fix (wheel/pinch zoom)
**Content (owner):** origin story supplied (Osing village in Bayangi, Orocko father, Tiko, Buea since 2020, cyber café → HND → CS50 / JavaScript Mastery → degree, AWS, Udemy Dart/Flutter, Master's in Information Security planned). Owner asked for all wording to be professional: bio and origin rewritten for grammar, with no change of meaning. Degree confirmed: Software Engineering, First Class, University of Buea, 2026 ([DEMO] removed). Smart Meal stays in the bio as a breakthrough ("which I am shipping now").
**Decisions (owner):** About house at the entrance, beside Career Road (the story starts where the road starts).
**Done:**
- Converter: a blank line in the bio/origin sections starts a new paragraph (`\n\n`), and `_italic notes_` are skipped there (+1 test).
- `src/lib/aboutContent.js` (+4 tests): name, title, place, roots, degree (each hidden while demo/TODO), bio, origin paragraphs, hobby → district list.
- `src/city/AboutHouse.jsx`: small house east of Career Road, 7 north of the entrance (3 draw calls); drawn front with the "About" sign and the owner's name; windows lit at night; house or "About" button opens the panel.
- `src/components/AboutPanel.jsx`: bio, facts, origin story, "Around the city", Career / Contact / LinkedIn / GitHub, via the shared `Dialog`.
- "About Ojong" button at the bottom left of the screen: the house is below the desktop start view.
- `CameraRig`: `dollyToCursor`. Wheel and pinch used to zoom towards the downtown target only, so the School and Pitch couldn't be zoomed into (owner report). They now zoom towards the pointer.
**Checks:** `npm test` 181/181; lint clean on changed files. Playwright on the production build (GPU): the button opens the panel with no TODO/DEMO text, focus on Close, Career hands over to the career panel, Escape returns focus to the button, wheel zoom over the right of the screen moves there; Pixel 7: house in the start view at the bottom right, tapping it or its button opens the panel, no horizontal scroll (with and without the panel); no console errors. `npm run perf`: desktop PASS (59.6 / 55.6 fps, 22 draw calls), phone PASS (55.4 / 50.1 fps, 20).
**Problems / notes:**
- `npm run perf` reports initial JS at 444 KB gzip (budget 200). Not from this task (the About code is in the lazy city chunk, 49 KB); worth a look before P5.
- The hobby lines in section 1 (e.g. Football, Gaming) are still in the owner's rough wording; the About panel doesn't show them, but the Arcade hub quotes the Gaming line.
**Next:** owner reviews the rewritten bio/origin; P4-01 knowledge builder.

---

## 2026-10-20 — Career Road timeline
**Tasks:** P3-12 (done; perf re-run pending, see notes)
**Content (owner):** the three role titles confirmed ([DEMO] removed); the first role's company is "Freelance"; section 2 spelling and wording fixed with the owner's OK (e.g. "Took on HR duties: assigned tasks to the team with Gantt charts", "Turko Banix Inc", end dates "2025" / "Present"). "multi ecommerce" was read as "multi-vendor e-commerce" (matches the project block); owner to correct if wrong.
**Decisions (owner):** oldest role nearest the entrance, newest next to downtown (walking up the road moves forward in time).
**Done:**
- `src/lib/careerRoad.js` (+ 6 tests): `careerRoles` (non-demo roles, newest first, no demo fields / TODO text, "Mar 2021 – Sep 2024" labels), `careerSigns` (between the lamps, alternating sides, turned towards the road), `signParts`.
- `src/city/CareerRoad.jsx`: a signpost per role (2 draw calls: instanced posts + boards, one merged front mesh on a canvas atlas: years, company, role); fronts glow a little at night. A sign, or the "Career" button above the newest one, opens the panel.
- `src/components/CareerPanel.jsx`: the roles newest first via the shared `Dialog`; the clicked role is outlined.
**Checks:** `npm test` 176/176; lint clean on changed files. Playwright on the production build (GPU), first run: the signs read well at night in the start view (newest two in frame), "Career" opens the panel with the three roles and no TODO/DEMO text, focus on Close, Escape closes and focus returns, clicking the middle sign opens the panel on Turko Banix; Pixel 7: no horizontal scroll, panel fits; no console errors. 22 draw calls in the start view (was 20).
**Problems / notes:**
- On the phone the "Career" button (first placed at the newest sign's foot) covered the oldest sign; moved above the newest board.
- Later runs were unreliable: the machine was at 100 % CPU (a java process, VS Code, desktop Chrome, and another session's `scripts/optimize-images.mjs --recompress`). Headless frames stalled (screenshots timed out, camera didn't move, sign clicks were lost), and `npm run perf` reported FAIL (desktop idle 60 fps but flight 39 fps at medium quality; phone 27 fps, 60 s to load), then couldn't load the page at all. Not attributed to this change (2 draw calls, static geometry); **re-run `npm run perf` on an idle machine.**
**Next:** re-run `npm run perf`; P3-13 About / origin story.

---

## 2026-10-20 — Pitch district
**Tasks:** P3-11 (done)
**Decisions (owner):** a goal opens a contact panel now (email + links); the server form stays P5-03, and the EmailJS form isn't reused. Kick by clicking where you strike the ball; a simple keeper; scoring is a 7th egg, "Top corner".
**Done:**
- `src/lib/pitchKick.js` (+ 8 tests): penalty rules (aim from the strike offset, friction, hop, keeper reaction, goal/save/post/wide, settling in the net). Tests: a centre strike is always saved, the far corner beats the keeper, the keyboard kick scores at every moment tried.
- `src/city/PitchPlot.jsx`: the pitch on the SE plot (5 draw calls, replaces the placeholder): drawn grass and lines, goal frame, net, keeper, faceted ball. Click/tap the ball (larger invisible tap target; offset measured on screen); "Kick" (always scores) and "Contact" buttons; result line in a live region; reduced motion resolves at once with a still keeper.
- `src/lib/contactLinks.js` (+ 3 tests) and `src/components/ContactPanel.jsx`: email (mailto + Copy) and HTTPS LinkedIn/GitHub/X, via the shared `Dialog`. No availability shown (still `[DEMO]`).
- `arcadeEggs.js`: 7th egg `goal`. `PerfProbe`: `screenOf(name)` for browser checks.
**Checks:** `npm test` 170/170; lint clean on changed files; Playwright on the production build (GPU), camera panned to the pitch with the keyboard: centre clicks saved, an off-centre click scored and opened "Goal! Kick off a project", toast "Easter egg 1/7: Top corner", Kick button scores, Contact opens the panel (focus on Close, mailto + LinkedIn + GitHub, no TODO/DEMO text), Escape closes and focus returns; reduced motion: Kick → goal → panel; Pixel 7: no horizontal scroll, panel fits; no console errors. 24 draw calls with the pitch in view. `npm run perf`: desktop PASS (60 / 59.6 fps, 20 draw calls), phone PASS (15).
**Problems / notes:**
- The first keeper tuning saved most corners; slowed (reaction 0.25 s, 2 units/s, reach 0.9) so the corner away from him usually scores.
- Like the Arcade, the Pitch is off-screen from the start view (found by looking around), and its buttons stay in the Tab order while off-screen (P5 accessibility).
- The ball is small from far away; zooming in helps, and the Kick/Contact buttons don't need aiming.
- `public/previews/handyman-do-it.webp` was already modified in the tree (not this task); left uncommitted.
**Next:** P3-12 Career Road timeline.

---

## 2026-10-20 — School district
**Tasks:** P3-10 (done)
**Content (owner):** the four TUIB courses in section 4 confirmed real ([DEMO] removed; dates still `TODO(content)`, so hidden); "Institue" → "Institute" and "Experince Lecturer … cources" → "Experienced lecturer … courses" corrected; no tutorials or mentoring to list yet.
**Done:**
- `src/lib/schoolContent.js` (+ 3 tests): non-demo lessons only, no demo fields / TODO dates / non-HTTPS links; the owner's teaching line; short venue for the board.
- `src/city/SchoolPlot.jsx`: two-storey school on the NE plot (3 draw calls, replaces the placeholder); drawn front with windows lit by `lighting.windows`, door and a "Teaching / TUIB" chalkboard; click or "Lessons" opens the panel.
- `src/components/SchoolPanel.jsx`: quote + course list (venue, audience, dates and course link when present), via the shared `Dialog`.
**Checks:** `npm test` 159/159; lint clean; Playwright on the production build (GPU): building renders, panel lists the owner's line and the four courses with no TODO/DEMO text, focus moves into it, Escape closes it; Pixel 7 no horizontal scroll; no console errors. `npm run perf`: desktop PASS (60 / 59.5 fps, 20 draw calls), phone PASS (15). Re-run after the client-sites session landed in the same tree: same results.
**Content to fill (owner):** start dates for the four courses (section 4, `date:`); optional course links; tutorials, talks or mentoring as extra lines.
**Next:** P3-11 Pitch district.

---

## 2026-10-20 — Ten live client sites added
**Tasks:** P0-02 (content, still in progress); P3-02 (preview script hardened)
**Decisions (owner):** site → block mapping confirmed; "Navora" is the spelling; owner asked for all ten as Featured, but the schema allows 3, so Featured stays SNS Glam / Vital Pulse / Smart Meal (owner to choose).
**Done:**
- `docs/projects.md`: live URLs + `Status: live` on Vital Pulse, Computer Solutions Accessories, Anointed Financial PLC (merged with the afplc-connect repo block), Navora Global Freight, World Vexa Logistics (WVL), Nuvexa Global Transport (novaTransport); new blocks for Rebirth Labs, Global Sphere Autos, Queens Cargo, HandyMan Do IT. The three former `[DEMO]` blocks are now real projects with each placeholder field still marked `[DEMO]`. 31 projects.
- `scripts/capture-previews.js`: waits for network idle, clicks age-gate/consent buttons, refuses a blank single-colour screenshot (+2 tests). Fixed HandyMan (was blank) and Rebirth Labs (was the 21+ gate).
- Previews captured: `rebirth-labs.webp`, `handyman-do-it.webp`.
**Checks:** `npm test` 156/156; `content:check` OK; lint clean on the script.
**Problems / notes:**
- Every Hostinger-hosted site (2a02:4780::/32, incl. SNS Glam) resets connections from this machine (HTTP and HTTPS, IPv4), so 8 previews are missing. Likely Hostinger's firewall blocking this IP after rapid requests; re-run `npm run previews` later or from another network.
- Rebirth Labs sends `X-Frame-Options: SAMEORIGIN`, so its iframe answer will be "no".
**Next:** re-run `npm run previews`; owner fills the new blocks' details and picks the 3 featured projects.

---

## 2026-10-20 — Arcade: Code runner mini-game
**Tasks:** P3-09b (done)
**Decisions (owner):** best score in this browser only (no shared leaderboard); scoring 10 unlocks a 6th egg, "Bug squasher"; coffee cups worth +3.
**Done:**
- `src/lib/codeRunner.js` (+ 7 tests): seeded rules, jump physics, spawning with speed-scaled safe gaps, forgiving hitboxes, cups, dt clamp, best-score parsing. A test bot survives 60 s to top speed on five seeds (every level is beatable).
- `src/components/CodeRunner.jsx`: canvas drawing in OJ City colours, keyboard/tap input on a focusable stage, pause (P, and automatically when the tab is hidden), HTML overlays for start/pause/game over, live-region messages.
- Hub: "Play" (lazy-loads the game, its own 2.4 KB chunk), "Back to the eggs", best score shown; "Start over" also clears the best. 6th egg added to `arcadeEggs.js`; toast raised above dialogs.
**Checks:** `npm test` 154/154; lint clean; Playwright on the production build (GPU): chunk loads only on Play, focus moves to the game, pause works, standing still loses at 0, a pixel-watching bot scored 12 and earned the egg (toast "2/6: Bug squasher"), best saved mid-run and shown in the hub, Escape closes; Pixel 7: fits the width, tap jumps, no horizontal scroll; no console errors. `npm run perf`: desktop PASS (60 / 58.5 fps, 19 draw calls), phone PASS (17).
**Problems / notes:**
- Two jump presses in one frame both counted (the runner hadn't left the ground yet); "on the ground" now also needs no upward speed.
- The best score was first saved only at game over, so leaving mid-run lost it; now saved as it rises.
- A fast reflex game can't be fully accessible; it is optional, and nothing in the hub depends on it.
**Next:** P3-10 School district.

---

## 2026-10-20 — Arcade: easter eggs hub
**Tasks:** P3-09 (done); P3-09b added (mini-game "Code runner", owner's choice, deferred)
**Decisions (owner):** hub + eggs now, mini-game later as its own task; eggs: Konami code, Fako, find the hub, Night owl, plus one more of my choosing (Explorer: open three projects).
**Done:**
- `src/lib/arcadeEggs.js` (+ tests): egg list, Konami matcher (any lead-in, any case), Fako knock counter (5 in a row, ≤ 2 s apart), night check from the real sun, defensive progress parsing.
- `src/store/useArcadeStore.js`: found eggs saved in `localStorage` (try/catch), toast, marquee/mist effect timers. `src/hooks/useEasterEggs.js`: cheat code, Night owl, Explorer triggers.
- `src/city/ArcadePlot.jsx`: cabinet on the SW plot (4 draw calls, replaces the placeholder), screen shows eggs found, marquee lit after the cheat code. `Fako.jsx`: knocks + mist fade.
- `src/components/ArcadeHub.jsx` (hub dialog with hints), `EggToast.jsx` (aria-live toast), `Dialog.jsx`: the Cinema player's focus-trap modal extracted and shared (CinemaModal now uses it).
**Checks:** `npm test` 147/147; lint clean on changed files; Playwright on the production build (GPU): hub, cheat code, Explorer, Fako all fire, toast + save + reload ("Found 4 of 5") + "Start over" work, focus moves into the dialog and Escape closes it, no console errors. Night owl unit-tested only (daytime in Buea). `npm run perf`: desktop PASS (60 / 57.7 fps, 19 draw calls), phone PASS (17).
**Problems / notes:**
- The toast's live region first had `role="status"`; `perf.mjs` waits for no `[role=status]` (the loading screen), so perf hung. Now a plain `aria-live` region (documented in architecture.md).
- The first Fako rule (5 knocks within 4 s) missed slow clicks; replaced by "5 in a row, ≤ 2 s apart".
- The Arcade sits beside Career Road, behind the start view's frame, so it is found by looking around (fits an easter-egg district). Its floating button, like the Cinema's, stays in the Tab order while off-screen; worth a look in P5 accessibility.
- Initial JS 442 KB gzip vs the 200 KB budget is the homepage template bundle (unchanged here); the city chunk is 40 KB.
**Content:** the hub quotes the gaming hobby line; "Acion" corrected to "Action" in `docs/projects.md` with the owner's OK (content rebuilt).
**Next:** P3-10 School district (or P3-09b Code runner).

---

## 2026-10-20 — Cinema: owner's YouTube channel
**Tasks:** P3-08 (done; the 2026-10-17 work, audited and changed with the owner)
**Audit:** the earlier session registered `public/images/screen.mp4` in `docs/projects.md` as the owner's "Cinema reel". That file is the template's 5-second "Hello world!" terminal loop, not video-editing work, so it was invented content. **Owner decision:** link the YouTube channel instead.
**Done:**
- `docs/projects.md`: the `screen.mp4` line removed (content rebuilt). Support for a local reel (`file: public/videos/…`) stays.
- `src/lib/cinemaReel.js`: `cinemaReel(profile)` → the first non-demo local reel, else `links.youtube` (HTTPS, not `[DEMO]`), else null.
- `src/city/CinemaPlot.jsx`: with a channel, the screen shows a drawn "Video work" card (nothing fetched from YouTube; CSP unchanged) and the screen or a "Watch on YouTube ↗" link opens the channel in a new tab. With a local reel: video texture + player as before; the player is now a `div` (the template forces `section` to 100dvw) and keeps Tab focus inside.
- `CityLayout`: the Cinema placeholder block is hidden only when the Cinema plot is drawn (`built` prop); before, a city without a reel had an empty plot.
- Docs: architecture.md and design_system.md (Cinema).
- Preview thumbnails (`BuildingLabel`, `LivePreview`) decode with `decoding="async"`: on a cold cache the 1280×800 WebP was decoded on the main thread as the first flight started (a 100–190 ms frame).
**Checks:** `npm test` all pass (reel/channel/demo/non-HTTPS rules); production build: link `https://www.youtube.com/@ojongrandy2580`, `target=_blank`, `rel=noopener noreferrer`, opens a new tab; no `<video>` loaded; screenshot of the card; no page errors. `npm run perf`: desktop PASS (60 / 59.5 fps, 19 draw calls), phone PASS (17 draw calls). Some runs on this machine showed 0.6–4 s stalls even while idle, with the owner's Chrome using ~60 % CPU; those are machine noise, not the scene (the same build then runs at 60 fps).

---

## 2026-10-20 — Testimonials removal audited
**Tasks:** P3-07 (done; the 2026-10-17 work, audited)
**Audit:** correct: the template's invented testimonials, the section, its nav link and the five-star review text on the Experience cards are gone, and no quote is shown until the owner supplies one with permission. Also fixes an old template bug: `GlowCard` never received `index`, so every card wrote to the same ref slot.
**Content note:** the Experience cards themselves still mix owner edits with template data (e.g. "React Native Developer, March 2019 – May 2020"); to be checked against `docs/projects.md` in P3-12.

---

## 2026-10-20 — Featured case studies audited
**Tasks:** P3-06 (done; the 2026-10-17 work, audited)
**Audit:** correct: the template's ability cards (invented claims) are removed. No featured project has a complete, publishable case study yet, so nothing replaces them; the case studies live in the city's project panels (P3-01).

---

## 2026-10-20 — Tools and clients audited
**Tasks:** P3-05 (done; the 2026-10-17 work, audited)
**Audit:** shows only owner content, but tools came only from two IDE names matched in the summary sentence, so tool groups would have stayed hidden even after the owner confirmed them. Now: tools from every non-[DEMO] group plus the IDEs named in the summary; client lines only with `logoPermission: yes`; placeholders never. Tests are rule tests (the old one pinned the exact client wording).
**Content notes for the owner (not changed):** all three tool groups are still `[DEMO]`, so only VS Code and WebStorm show. Client lines are shown as written: "have worked with WebSpectron LTD Buea." and "Work for a client in yaounde (Anionted PLC)" may need a capital letter / spelling check.
**Checks:** tool and client tests pass; homepage shows VS Code, WebStorm and the four permitted client lines.

---

## 2026-10-20 — Sourced metrics fixed
**Tasks:** P3-04 (done; the 2026-10-17 work, audited and fixed)
**Audit:** the template's invented counters (5 years, 80 clients, 35 projects, 99 %) are gone, but "Projects in OJ City" counted the 13 whole `[DEMO]` placeholder projects as real ones, a fake stat. Fixed: demos never count, in both numbers. Also: the source was only a hover tooltip (invisible on touch screens), now visible text in plain words; and the counter was a `<section>`, which the template forces to `100dvw` inside the padded hero (now a `div` with `role="region"`).
**Checks:** metrics test with demo projects; homepage shows the non-demo counts with their sources.
**Note:** `react-countup` is no longer used; removing it is left to P6-02 (dependency clean-up).

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

## 2026-10-17 — Cinema reel
**Tasks:** P3-08 (done)
**Done:**
- `docs/projects.md` and `content/profile.json`: registered the user-supplied `public/images/screen.mp4` as the non-demo Cinema reel; `content/schema.js` and the Markdown parser validate local MP4/WebM paths under `public/images` or `public/videos`.
- `src/city/CityLayout.jsx` and `src/city/CinemaPlot.jsx`: replaced the Cinema placeholder with a platform, framed screen, muted video texture and an in-world Play reel control. The loop pauses for reduced motion and while the modal is open.
- The accessible modal provides controls, begins muted, closes with Escape, and restores focus.
- `src/lib/cinemaReel.js`: selects only safe local reel records from profile content.
- `docs/architecture.md` and `docs/design_system.md`: documented the local source format, interaction, and rendering cost.
**Checks:**
- `npm test`: 130/130 pass.
- Targeted ESLint and editor diagnostics: clean.
- `npm run build`: succeeds; existing Zod annotation and large-main-chunk warnings remain.
- Chromium smoke test reached the screen with WASD, opened the modal, decoded a 640×360 frame, and confirmed muted playback, controls, and no page errors.
- `npm run perf`: desktop PASS (60 fps idle / 58.5 flight, 24 draw calls); phone PASS (59.4 / 59.6 fps, 22 draw calls).
**Problems / notes:**
- Initial JS remains 442 KB gzip versus the 200 KB target; this is existing template weight and is tracked under P0-06.
**Next:**
- P3-09 Arcade district (propose easter eggs first).

---

## 2026-10-17 — Unapproved testimonials removed
**Tasks:** P3-07 (done)
**Done:**
- `src/App.jsx`, `src/constants/index.js` and `src/sections/Testimonial.jsx`: removed the standalone testimonial section, its navigation link, hardcoded template quotes and unused component.
- `src/components/GlowCard.jsx`, `src/sections/ExperienceSection.jsx` and `src/constants/index.js`: removed unapproved review text and five-star decorations from Experience cards while preserving the career section structure.
**Checks:**
- `npm test`: 126/126 pass.
- Targeted ESLint and editor diagnostics: clean.
- `npm run build`: succeeds; existing Zod annotation and large-main-chunk warnings remain.
- Browser: no testimonial headings, links, old review quotes or star images; no page errors.
**Problems / notes:**
- `content/profile.json` has no testimonial with confirmed permission and attribution, so the section stays absent until the owner updates `docs/projects.md`.
**Next:**
- P3-08 Cinema district.

---

## 2026-10-17 — Featured case studies
**Tasks:** P3-06 (done)
**Done:**
- `src/App.jsx`: removed the template ability-card section from the homepage.
- `src/constants/index.js`: deleted the unused fabricated ability claims and export; `src/sections/FeatureCards.jsx` was removed.
**Checks:**
- `npm test`: 126/126 pass.
- Editor diagnostics: clean.
- `npm run build`: succeeds; existing Zod annotation and large-main-chunk warnings remain.
- Browser after full reload: ability-card headings are absent, Tools & clients remains, and no page errors occur.
**Problems / notes:**
- No featured project currently has a complete publishable case study. Sns Glam has demo-marked/missing fields; Vital Pulse and Smart Meal are whole-record demos. The section stays absent until verified featured case-study content is supplied.
**Next:**
- P3-07 remove unapproved testimonials.

---

## 2026-10-17 — Tools and clients
**Tasks:** P3-05 (done)
**Done:**
- `src/lib/toolClientContent.js`: selects VS Code and WebStorm from the non-demo profile summary and client statements only where `logoPermission` is true; placeholder text is filtered out.
- `src/sections/LogoSection.jsx`: replaced the animated generic logo marquee with a responsive text-only tools and clients section.
- `src/constants/index.js`: removed the unused generic logo list and export. The generic image files remain unreferenced for P0-06 asset cleanup.
**Checks:**
- `npm test`: 126/126 pass.
- Targeted ESLint and editor diagnostics: clean.
- `npm run build`: succeeds; existing Zod annotation and large-main-chunk warnings remain.
- Browser displayed only VS Code, WebStorm, and permission-approved client statements; no generic logo images or page errors.
**Next:**
- P3-06 replace ability cards with featured case studies.

---

## 2026-10-17 — Sourced portfolio metrics
**Tasks:** P3-04 (done)
**Done:**
- `src/lib/portfolioStats.js`: derives two exact metrics from `/api/city`: projects in OJ City and projects with GitHub-backed stats. Each includes a source label for its tooltip.
- `src/components/AnimatedCounter.jsx` and `src/sections/Hero.jsx`: replaced the template's animated/fabricated counters with the live values; loading shows no placeholder number and API failure is stated plainly.
- `src/constants/index.js`: removed the unused template values (5 years, 80 clients, 35 projects, 99% retention).
**Checks:**
- `npm test`: 125/125 pass.
- Targeted ESLint and editor diagnostics: clean.
- `npm run build`: succeeds; existing Zod annotation and large-main-chunk warnings remain.
- Browser displayed 39 projects and 29 projects with GitHub data, with their `/api/city` and GitHub API source tooltips; no page errors.
**Next:**
- P3-05 replace the logo marquee.

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
