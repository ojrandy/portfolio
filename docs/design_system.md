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
- Sky: a gradient dome (radius 900) that follows the camera. Night defaults: zenith basalt + 30 % indigo; horizon (basalt + 60 % indigo) + 18 % mist; mist mist + 25 % indigo. P2-02 drives `{ zenith, horizon, mist }`.
- Fog: linear, 60 → 600, in the horizon colour. Distant ground meets the sky without an edge, and Fako gets natural haze.
- Ground: a 2000 × 2000 plane in the ground colour at y = −0.05, just under the roads.

**Camera rig (P1-05, `src/lib/camera.js`, `src/city/CameraRig.jsx`):**
- Lens: fov 45°, far 2000.
- Start view: on Career Road at `layout.entrance`, eye height 12, looking at downtown's centre, pitched so Fako's summit sits at 60 % of the upper half of the view (always at least 0.05 rad down). On narrow screens it backs down Career Road, rising proportionally, until downtown's front row fits the width. It never backs off more than 90 units from downtown's centre, so tier 4+ downtowns are cropped in portrait. Today's 3 × 3 city fits from the entrance itself on 4:3 and wider screens.
- Building view: target at half the building's height (≥ 1). Viewed from the south-west at distance `clamp(1.4 h + 8, 10, 40)`, 0.45 rad above the horizon. If another building (footprint + 0.3, roof + 1) blocks the line of sight, the camera rises in 0.1 rad steps up to the polar limit, then backs off ×1.3 (up to 60). Only if that fails does it try the south, west, south-east, then north-west. All 28 real buildings use the south-west today.
- Limits: distance 6–100; polar 0.2 rad to π/2 − 0.03, so the camera never goes below its target. The target stays inside the city bounds at height 1–20, so the camera can't go underground and stays within ~120 of the city.
- Flights: camera-controls' critically damped smoothing, smoothTime 0.36–0.55 by distance (settles in ~1.2–1.8 s; measured ~1.5 s), back to 0.25 afterwards. With `prefers-reduced-motion`: cuts. The first view is always a cut.
- Mouse: drag rotates, right-drag moves, wheel zooms. Touch: one finger rotates, pinch zooms, two-finger drag moves. Page scrolling is blocked only over the canvas.
- Keyboard (when the city is focused): arrows/WASD move (by physical key, so AZERTY works), Q/E rotate, +/− zoom, Esc/Home return to the start view. Tab/Shift+Tab visit buildings front row first, west to east. Entering from the start view, Shift+Tab goes to the last building. Past either end, Tab leaves the canvas (no keyboard trap).

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
| `--window` | `#FFC56B` | lit windows, warm highlights |
| `--ember` | `#E2552B` | CTAs, beacon |
| `--paper` | `#F4F1EA` | recruiter mode background (light) |

Language accents: JavaScript `#F7DF1E` · TypeScript `#3178C6` · Python `#3776AB` · Dart `#0175C2` · PHP `#777BB4` · other `--indigo`.

## Time of day (Africa/Douala, UTC+1)
Uses real sunrise/sunset from `/api/buea`. Keyframes:
| Phase | Sky | Sun/ambient | City |
|---|---|---|---|
| Night | basalt → deep indigo | moonlight, low | all lamps + most windows on |
| Dawn | indigo → pink → mist | warm, rising | lamps fading |
| Day | soft blue, hazy | bright neutral | windows off, beacons visible |
| Dusk | orange → indigo | warm low sun | lamps switching on one by one |

## Weather (Open-Meteo WMO codes)
| Codes | Meaning | Effect |
|---|---|---|
| 0–1 | clear | clean sky |
| 2–3 | cloudy | cloud layer, softer light |
| 45, 48 | fog | **Fako mist**: heavy fog band on the mountain, lighter in the city |
| 51–67, 80–82 | drizzle / rain / showers | rain particles, wet road reflections |
| 95–99 | thunderstorm | rain + occasional lightning flash (disabled for reduced motion) |
Buea is often misty: keep a light mist band on Fako even in clear weather.

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
