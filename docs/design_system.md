# Design System — OJ City

## The idea in one line
> **OJ City** is a small, living city at the foot of Fako, the way Buea is. Every building is something Ojong built, and the city changes with Buea's real time and weather.

Principles: **simple but alive** · **real data only** · **calm and professional, with personality in the details** · **fast first, beautiful second**.

## City map
```
                 ▲▲▲  FAKO (Mount Cameroon), backdrop, mist line  ▲▲▲
          ─────────────────────────────────────────────────────────
           🎬 CINEMA            🏗️ DOWNTOWN (projects)          📚 SCHOOL
          (video reel)     ┌──┐ ┌────┐ ┌──┐ ┌───┐             (teaching)
                           │  │ │    │ │  │ │   │
                           └──┘ └────┘ └──┘ └───┘
           🎮 ARCADE                 ═══ main road ═══            ⚽ PITCH
          (easter eggs)                                       (contact / goal)
          ══════════ CAREER ROAD (experience timeline) leading into the city ══════════
                                   ▼ camera starts here
```

## Districts
| District | Hobby | Content | Interaction |
|---|---|---|---|
| Downtown | Coding | project buildings | hover preview, click → case study, X-Ray |
| Cinema | Video editing | editing reel on a rooftop screen | click → play with sound |
| Arcade | Gaming | easter eggs, optional mini-game | hidden triggers |
| School | Teaching | tutorials, talks, mentoring | click → list of lessons |
| Pitch | Football | contact | kick the ball; goal → contact form |
| Career Road | n/a | experience timeline as signposts | scroll / walk along it |

## Building rules (data → shape)
| Property | Source | Rule |
|---|---|---|
| Height | commits (or owner `effort` 1–10) | `clamp(log2(commits+1) * k, minH, maxH)` |
| Footprint | repo size / scope | small / medium / large |
| Colour accent | primary language | language → token (below) |
| Lit windows | days since last push | more recent ⇒ more windows lit |
| Crane on roof | pushed in the last 7 days | "under construction" |
| Beacon on roof | has a live URL | soft pulsing light |
| Flag | featured project | owner-chosen top 3 |
| Weathered/dim | archived | lower saturation |

Placement is **deterministic** (seeded by slug), so the city looks the same for everyone until the data changes.

**City layout (P1-03, `src/lib/layout.js`, ADR-011):** Fako is north (−z); the camera enters from the south (+z).
- Downtown: square grid of city blocks centred on the origin. A block = 2 × 2 lots of 3.6 (fits the 3.0 large footprint) + 0.4 sidewalk = 8 units; streets 2.4 between blocks and around the north/west/east edges.
- Size steps: 3, 4, 5, 6, 8 blocks per side (36 → 256 lots); the smallest step that fits is used. Today: 3 × 3 (28 buildings, 8 parks).
- Featured (max 3): the front-row lots closest to Career Road, sorted by slug. Unused featured lots stay parks; other buildings never use them.
- Everyone else: `hash(slug) % freeLots` is the preferred lot; if taken, the next free lot (linear probing, slugs processed in sorted order). Adding/removing one project moves at most a few buildings; changing size step reshuffles.
- Empty lots become parks (green pads).
- Main road (4 wide) runs east–west along Downtown's front and across all plots; Career Road (3 wide, 30 long) runs south from its centre to the entrance (camera start, `layout.entrance`). Dashed centre lines skip the junction.
- District plots (16 × 16, 1 from the roads): Cinema NW, School NE (beside Downtown, north of the main road); Arcade SW, Pitch SE (south of it). Placeholder blocks until P3-08 → P3-11.
- Colours: ground basalt + 25 % fako-green; streets ash; main road ash + 10 % mist; Career Road ash + 20 % indigo; pavement ash + 15 % mist; parks fako-green; plot pads ash + 25 % of the district colour (cinema indigo, school window, arcade ember, pitch fako-green).
- Rendering: 3 draw calls (surfaces, parks + markings, placeholders).

**Backdrop (P1-04, `src/lib/backdrop.js`):** Fako, sky dome, ground and fog. 4 draw calls (sky, ground, mountain, mist).
- Fako: a low-poly ridge, not a cone: an ellipse with semi-axes 230 × 110 and a height of 72, tilted 0.3 rad so the east end recedes north (SW–NE ridge). The summit is broad and flat-topped, with 7 seeded cinder cones along the ridge and small per-vertex noise. Flat shading, vertex colours only, about 3k triangles. Its rim sits below the ground.
- Placement: 25 west of Career Road, and its foot is 45 behind the city's north edge at every downtown size (tested).
- Slope colours by height: ground colour at the foot → forest (fako-green + 35 % basalt) → grassland (ash + 30 % fako-green) from 30–50 % → rock (basalt + 50 % ash) from 55–80 %.
- Mist band: a soft open band hugging the slope from 28 % to 50 % of the height, opacity 0.4 × `mist` (1 = everyday Buea mist; P2-04 raises it for fog codes). It drifts slowly and is static with `prefers-reduced-motion`.
- Sky: a gradient dome (radius 900) that follows the camera. Night defaults: zenith basalt + 30 % indigo; horizon (basalt + 60 % indigo) + 18 % mist; mist mist + 25 % indigo. From P2-02 these are the Night keyframe; the time of day blends them with the others.
- Fog and background: linear fog 60 → 600, both in the (changing) horizon colour. Distant ground meets the sky without an edge, and Fako gets natural haze.
- Ground: a 2000 × 2000 plane in the ground colour at y = −0.05, just under the roads.

**Camera rig (P1-05, `src/lib/camera.js`, `src/city/CameraRig.jsx`):**
- Lens: fov 45°, far 2000.
- Start view: on Career Road at `layout.entrance`, eye height 12, looking at downtown's centre, pitched so Fako's summit sits at 60 % of the upper half of the view (always at least 0.05 rad down). On narrow screens it backs down Career Road, rising proportionally, until downtown's front row fits the width. It never backs off more than 90 units from downtown's centre, so tier 4+ downtowns are cropped in portrait. Today's 3 × 3 city fits from the entrance itself on 4:3 and wider screens.
- Building view: target at half the building's height (≥ 1). Viewed from the south-west at distance `clamp(1.4 h + 8, 10, 40)`, 0.45 rad above the horizon. If another building (footprint + 0.3, roof + 1) blocks the line of sight, the camera rises in 0.1 rad steps up to the polar limit, then backs off ×1.3 (up to 60). Only if that fails does it try the south, west, south-east, then north-west. All 28 real buildings use the south-west today.
- Limits: distance 6–100; polar 0.2 rad to π/2 − 0.03, so the camera never goes below its target. The target stays inside the city bounds at height 1–20, so the camera can't go underground and stays within ~120 of the city.
- Flights: camera-controls' critically damped smoothing, smoothTime 0.36–0.55 by distance (settles in ~1.2–1.8 s; measured ~1.5 s), back to 0.25 afterwards. With `prefers-reduced-motion`: cuts. The first view is always a cut.
- Mouse: drag rotates, right-drag moves, wheel zooms. Touch: one finger rotates, pinch zooms, two-finger drag moves. Page scrolling is blocked only over the canvas.
- Keyboard (when the city is focused): arrows/WASD move (by physical key, so AZERTY works), Q/E rotate, +/− zoom, Esc/Home return to the start view. Tab/Shift+Tab visit buildings front row first, west to east. Entering from the start view, Shift+Tab goes to the last building. Past either end, Tab leaves the canvas (no keyboard trap).

**Building interaction (P1-06):**
- Hover (mouse/pen only): the body takes 40 % of its accent colour (instance colour, no extra draw call), the cursor becomes a pointer, and a label floats 1.4 above the roof: name + up to 3 stack items, then "+n more" (drei `<Html>`, plain DOM, `aria-hidden`).
- The focused building (Tab, list or click) gets the same highlight and label. Hover wins the label when both exist.
- Click / tap: fly to the building and open its panel. Pointer travel over 4 px is a camera drag, not a click. Only building bodies are pickable, and the nearest hit wins.
- Keyboard: Tab flies + labels, Enter opens the panel, Esc closes it (a second Esc returns to the start view).
- Project panel (placeholder until P3-01): district, name, status, a "Demo content" badge for `demo` projects, stack, numbers with their source ("from GitHub" / "from Owner estimate", missing ones hidden), an empty case-study box, and https-only Live site / Code links (new tab). Right-hand sheet (22rem) from `md`, bottom sheet (max 60vh) on phones. Fades/slides in 300 ms `power2.out`, instant with reduced motion. Non-modal dialog: focus moves to its heading and returns to the opener on close.
- Project list: every building as a button outside the canvas, in Tab order. Hidden until it has keyboard focus (like a skip link); focusing a button flies there, pressing it opens the panel.

**Loading screen (P1-07, `src/lib/loading.js`, `src/components/LoadingScreen.jsx`):**
- Progress is the 3 real steps, never a percentage (there are no assets to count): 3D code downloaded → `/api/city` received → first frame with the buildings drawn. Labels say what is running: "Loading the city…", "Fetching the projects…", "Raising the buildings…". Three dots: done = window, current = pulsing mist (static with reduced motion), to do = faint.
- Visual: the real city's skyline (front elevation from Career Road; ash + 5 % mist at the back row → + 25 % at the front; accent colour as a roof line) rises west → east (0.5 s each, `power2.out`, spread over 0.4 s) on a ground line, under a flat-topped Fako ridge in basalt + 35 % indigo. Before the data arrives only Fako and the ground show. No cultural motifs until the owner confirms one (ADR-009); the skyline is the placeholder and can be swapped.
- Timing: never shows if everything is ready within 300 ms of navigation. Fades in over 200 ms, out over 400 ms once done (instant with reduced motion). The fade-out waits for the skyline to finish rising (≤ 0.9 s after the data arrives; owner's choice, so the skyline is seen on fast devices too). No other minimum display time.
- Errors: failed fetch → "Couldn't fetch the projects." + "Try again" (refetches). No WebGL → a plain message; the Recruiter mode fallback comes with P5-02.
- Accessibility: `role="status"` + `aria-live="polite"` with "Step n of 3"; the city wrapper is `aria-busy` until drawn; the screen never takes focus.

**Performance (P1-08, `src/lib/quality.js`):**
- 16 draw calls for today's city (budget 100): instanced building parts, merged layout surfaces, 4 backdrop meshes, 3 for the street lamps (P2-03), +1 for rain while it rains (P2-04).
- Quality levels change only DPR and shadow-map size, never which shaders exist (turning shadows off recompiles every material, a long freeze on a phone): low = DPR 1 + 512 map, medium = 1.25 + 1024, high = 1.5 + 2048. DPR never exceeds 1.5.
- Starting level from the device: ≤ 2 cores or ≤ 2 GB → low; ≤ 4 cores or ≤ 4 GB → medium (low on touch); otherwise high (medium on touch). Unknown values (no `deviceMemory` in Safari/Firefox) don't count against the device.
- After the first frame, drei `PerformanceMonitor` steps down one level after ~5 s mostly under 40 fps. It never steps back up: each change resizes the canvas and redraws shadows, so flip-flopping costs more than it saves.
- Shadows are static: the light and buildings don't move, so the shadow map is drawn only when the layout or quality changes. The moving sun (P2-02) redraws it for one frame once it has moved more than 0.3°, about once a minute.
- No `backdrop-filter` blur or blurred `box-shadow` on UI over the canvas. A blur is recomputed every frame the canvas changes, and the label's first shadow cost a ~150 ms frame. Use opaque-ish backgrounds and 1 px borders/rings.

**Final constants (P1-02, `src/lib/buildings.js`):**
- Height: `k = 1.6`, floor height `0.6`, snapped to whole floors, 3–20 floors (1.8–12 units). Owner `effort` uses the same log2 scale: `effort × 0.7` (effort 10 ≈ 128 commits), so self-rated projects never outgrow measured ones. `stats.source: none` → 3 floors.
- Footprint (scope): `stack` items ≤ 2 small (1.6, 2 window columns), 3–4 medium (2.2, 3), 5+ large (3.0, 4). With an empty stack, the number of GitHub languages ≥ 5 % is used.
- Lit windows: `0.9 − 0.8 × log(1 + days) / log(366)` (0.9 pushed today → 0.1 at a year or more). No push date → by status: in-progress 0.6, live 0.4, archived 0.1, unknown 0.25. Which windows are lit is a slug-seeded order, so a higher ratio lights more of the same windows.
- Crane: a real GitHub push in the last 7 days (owner status never adds a crane).
- Body = `--ash` mixed 12 % with the accent; roof cap = accent. Weathered (archived): accent desaturated 70 %, body 80 %, lit windows dimmed. Projects without GitHub data have no language, so they use `--indigo`.
- Rendering: one `InstancedMesh` per part (bodies, roofs, windows, cranes, flags, beacons), so 6 draw calls for any number of buildings.

## Colour tokens (draft, finalise in P1)
| Token | Hex | Use |
|---|---|---|
| `--basalt` | `#15161A` | night background, volcanic rock |
| `--ash` | `#2A2C33` | surfaces, roads |
| `--mist` | `#C9D3DA` | fog, light text on dark |
| `--fako-green` | `#2F6B4F` | vegetation, success |
| `--indigo` | `#2B3A8C` | primary accent (indigo-dye inspired) |
| `--sky` | `#4C9BE8` | clear day sky (P2-02; owner asked for a bright day) |
| `--window` | `#FFC56B` | lit windows, warm highlights |
| `--ember` | `#E2552B` | CTAs, beacon |
| `--paper` | `#F4F1EA` | recruiter mode background (light) |

Language accents: JavaScript `#F7DF1E` · TypeScript `#3178C6` · Python `#3776AB` · Dart `#0175C2` · PHP `#777BB4` · other `--indigo`.

## Time of day (Africa/Douala, UTC+1)
The sun's real position in Buea (NOAA equations in `shared/solar.js`; it sits on the horizon at the same sunrise/sunset as `/api/buea`, within ~1 min) on Buea's clock: the device clock corrected by `/api/buea`'s `now`, or the device clock alone if the API fails. Keyframes:
| Phase | Sky | Sun/ambient | City |
|---|---|---|---|
| Night | basalt → deep indigo | moonlight, low | all lamps + most windows on |
| Dawn | indigo → pink → mist | warm, rising | lamps fading |
| Day | bright clear blue (`--sky`), pale horizon | bright neutral | windows off, beacons visible |
| Dusk | orange → indigo | warm low sun | lamps switching on one by one |

**Implementation (P2-02, `src/lib/dayNight.js`):**
- Phases by sun elevation: night < −10°, day ≥ 8°, dawn/dusk in between (dawn while the sun is rising). In Buea (mid-October) dawn runs ~05:30–06:45 and dusk ~17:35–18:45.
- Keyframes by elevation, blended linearly. Morning: −12° Night → −6° pre-dawn (indigo, ember glow at the horizon) → 0° Dawn (pink horizon) → 8° morning (mist, sky + 40 % mist) → 20° Day (zenith `--sky`, horizon sky + 60 % paper). Evening: 20° Day → 8° golden (sky + 25 % indigo over a window-warm horizon) → 0° Dusk (orange: ember + 35 % window) → −6° blue hour (indigo + ember) → −12° Night. Every colour is a mix of the palette tokens; values in the code.
- Light (one directional, always): the sun follows its real azimuth (east → south → west); its height is limited to 6–60° for shadows, as Buea's noon sun is ~75–90° up and flattens the city. Intensity 0 at −6°, 0.9–1 at 0°, 1.6 at 8°, 2.8 by day. Below −6° it becomes a fixed moonlight (south-east, 45° up, cool mist-indigo, 0.8), not the real moon. Both are dark at the swap, so it doesn't show.
- Ambient (one ambient light, always): 0.6 at night, 0.8 at dawn/dusk, 0.9 in the morning and golden hour, 1.15 by day; colour mist, tinted ember/window around sunrise and sunset, indigo at night.
- Updates every minute; the scene eases to the new values (time constant 0.6 s), instantly with reduced motion. The first frame is a cut (never a fade from night). Lights are never added or removed (that would recompile every material).
- Weather (P2-04) adjusts these values before they are eased; see Weather → Implementation.

**City lights (P2-03, `cityLightsAt` in `src/lib/dayNight.js`, `src/lib/lamps.js`, `src/city/Lamps.jsx`):**
- Two levels (0..1) by sun elevation, linear: windows 0 at +6° → 1 at −4°; lamps 0 at +2° → 1 at −6°. The same ramps run backwards at dawn, so windows come on first at dusk (~17:45 in mid-October) and lamps follow (~18:00–18:35); at dawn lamps go off first (gone by ~06:20) and the last windows by ~06:35. Day = all off, night = all on. Eased with the rest of the lighting (instant with reduced motion).
- One by one: every lit window and every lamp has a seeded switch-on point in [0, 0.9] (window: slug; lamp: its position) and fades in over 0.04 of the level as the level passes it. A per-instance attribute + `onBeforeCompile` patch (`src/city/switchable.js`), so no extra draw calls.
- Night windows: which and how many are lit is unchanged (push recency, 0.1–0.9; a real number, not "most windows on"). By day all windows are dark glass, `#1B1F2A` + 30 % of the horizon colour; at night unlit windows are plain `#1B1F2A`.
- Lamps: on every block's pavement, 0.2 inside the edge, at the 4 corners and 4 edge midpoints (every 4 units); both sides of Career Road every 5; the main road's south side every 6 (not at Career Road's mouth) and its north side beside the district plots. 99 lamps today. A 1.3-high ash post, a `--window` head (grey when off) and a 3.2-wide round pool of light on the ground (additive, 0.4 peak, unfogged). No real lights: ~100 point lights would be far too slow on phones.
- No bloom: a full-screen pass breaks the phone budget. May come back later as a high-quality-only extra.
- Under a dark sky they switch on earlier: as if the sun were up to 5° lower at full gloom (see Weather), so a stormy late afternoon lights up while a bright one doesn't.

## Weather (Open-Meteo WMO codes)
| Codes | Meaning | Effect |
|---|---|---|
| 0–1 | clear | clean sky |
| 2–3 | cloudy | cloud layer, softer light |
| 45, 48 | fog | **Fako mist**: heavy fog band on the mountain, lighter in the city |
| 51–67, 80–82 | drizzle / rain / showers | rain particles, wet road reflections |
| 95–99 | thunderstorm | rain + occasional lightning flash (disabled for reduced motion) |
Buea is often misty: keep a light mist band on Fako even in clear weather.

**Implementation (P2-04, `src/lib/weatherFx.js`, `src/city/Rain.jsx`):**
- Levels: `weatherFx(/api/buea weather)` → cloud, rain, fog (0..1), storm, and gloom (0..1, how much darker the city gets: 0.55 cloud + 0.35 rain + 0.1 fog + 0.15 storm). Cloud is the measured cover when there is one, else by code (0 → 0, 1 → 0.15, 2 → 0.45, 3 → 0.85); rain by code (light drizzle 0.2 … heavy rain/showers 1), raised by the measured mm (6 mm/h = 1). Missing, unknown or fallback weather draws the plain clear city. Snow (never in Buea) is a grey, misty day.
- Light (`applyWeather`, inside `lightingAt`, eased with day/night): the sky goes towards an overcast grey (the time of day's own sky, desaturated, darkened with gloom): zenith × 0.85 cloud, horizon and fog × 0.7 of cloud or fog. Direct sun −80 % and ambient −20 % at full gloom, both desaturated with cloud: overcast light is soft, with faint shadows. Clear weather changes nothing.
- Clouds: drawn in the sky shader (no extra draw call), drifting noise on a flat ceiling, faded towards the horizon; coverage follows cloud.
- Fog: scene fog closes in from 60–600 to 20–260 at full fog, and to 65 % of that in heavy rain. The Fako mist band's density = 1 + 1.6 fog + 0.6 cloud, so fog hides most of the mountain while the city stays readable.
- Rain: one line mesh (1 draw call while raining, 0 otherwise), drops animated in the vertex shader in an 80 × 40 × 80 box in front of the camera that wraps as it moves. Drop count = rain × 600 / 1000 / 1500 (low / medium / high quality). Drops are pale against the day sky and faint grey at night. Frozen with reduced motion.
- Wet streets: in rain, roads and pavements darken up to 35 % and lose roughness (0.95 → 0.4), so the sun leaves a soft sheen. No real reflections (too slow on phones).
- Lightning (thunderstorm only): one strike per 14 s slot, 3–9 s into it, so strikes are 8–20 s apart; a strike is one or two 0.12 s flashes 0.2 s apart, so never more than 3 flashes a second (WCAG 2.3.1). It brightens the ambient light and the sky. Seeded by time, so the same for everyone. None with reduced motion.
- Cost: storm = 1 extra draw call. `npm run perf -- --weather=storm` checks it (19 desktop / 17 phone draw calls, 60 fps).

## Typography
- Display: a geometric sans with character (e.g. "Space Grotesk" or "Clash Display")
- Body/UI: "Inter" or "Geist"
- Mono (x-ray labels, status line): "JetBrains Mono"
Final choice in P1, max 2 families plus mono.

## Motion
- GSAP for UI, R3F frame loop for the scene. Ease: `power2.out` for UI, critically-damped springs for the camera.
- Durations: UI 200–400 ms; camera flights 1.2–1.8 s.
- `prefers-reduced-motion`: no camera flights (cut instead), no lightning, no auto-rotation.

## Sound (P5-08)
Muted by default. Ambient city/rain bed, soft UI ticks, crowd cheer on a goal. Toggle stored in localStorage.

## Voice & copy
Warm, confident, short. A bit of Buea humour, never jokes about the work itself.
- Status line: "It's 23:40 in Buea · light rain · Ojong is probably shipping something."
- Empty AI answer: "I don't know that one. Ask Ojong directly, the pitch is open ⚽."
- CTA: "Let's build something" / "Kick off a project".
Optional later: Pidgin / French toggle (backlog).

## Culture (Bayangi / Manyu): read before using motifs
Visual inspiration can come from Manyu textiles and art (for example indigo resist-dye patterns) for the loader, dividers and textures.
**Some Manyu symbols (certain Nsibidi signs, Ekpe/Mgbe regalia such as ukara cloth) carry sacred or restricted meaning.**
Use only motifs the owner has confirmed with community members are appropriate for public use (ADR-009). When in doubt, use abstract geometry.
