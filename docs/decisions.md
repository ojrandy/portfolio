# Decisions (ADR log) — OJ City

Format: context → decision → consequences. To change a decision, add a new ADR that supersedes it.

## ADR-001: Concept: "OJ City", a living city
**Date:** 2026-10-01 · **Status:** accepted
**Context:** The site was a recognisable tutorial template with placeholder content.
**Decision:** Rebuild as OJ City: projects are buildings generated from real data, at the foot of Fako like Buea, with hobby districts.
**Consequences:** Content must be structured data; the 3D scene is the primary experience, so a non-3D mode is needed (ADR-008).

## ADR-002: Hosting: Hostinger Node.js, single Express server
**Date:** 2026-10-01 · **Status:** accepted
**Context:** The owner hosts on Hostinger Node.js hosting with the domain ojongrandy.com. The AI chat, contact form and GitHub data need server-side secrets.
**Decision:** One Express process serves `dist/` and `/api/*`. No serverless functions.
**Consequences:** In-memory rate limiting/caching is fine for a single instance; a file cache survives restarts. Hostinger specifics (proxy, env vars, Node version) are verified in P0-05.

## ADR-003: Keep React + Vite + R3F + GSAP + Tailwind
**Date:** 2026-10-01 · **Status:** accepted
**Context:** The existing stack is modern and the owner knows it.
**Decision:** Keep it. Add zustand for small global state.
**Consequences:** No framework migration. SEO for recruiter mode is handled by prerendering (P5-06).

## ADR-004: AI chat: Claude API, full-context + prompt caching (no RAG)
**Date:** 2026-10-01 · **Status:** accepted
**Context:** The portfolio content is small (tens of KB).
**Decision:** Put the whole knowledge doc in a cached system prompt; tools drive the 3D camera on the client. Model is configured by env var.
**Consequences:** Simple and accurate; cost is controlled by caching, caps and a daily budget (security.md).

## ADR-005: Weather: Open-Meteo
**Date:** 2026-10-01 · **Status:** accepted
**Decision:** Open-Meteo (free, no API key) for Buea, proxied and cached 15 min by the server.
**Consequences:** No key to protect; graceful fallback to "clear, by time of day".

## ADR-006: Previews: pre-captured with Playwright, not a runtime screenshot API
**Date:** 2026-10-01 · **Status:** accepted
**Context:** Many sites block iframes (X-Frame-Options/CSP), and screenshot APIs cost money and add a third party.
**Decision:** `scripts/capture-previews.js` captures `.webp` stills (and optional short `.webm` loops) locally; they are committed. Live iframes only for the owner's own domains, if allowed.
**Consequences:** Previews must be re-captured when a project changes (documented in prompt.md).

## ADR-007: Contact: nodemailer + Hostinger SMTP + Turnstile (replace EmailJS)
**Date:** 2026-10-01 · **Status:** accepted
**Decision:** The server sends mail from `contact@ojongrandy.com`; Cloudflare Turnstile + honeypot stop spam.
**Consequences:** EmailJS and its `VITE_` variables are removed.

## ADR-008: Two modes: Explorer (3D) and Recruiter (fast, text-first)
**Date:** 2026-10-01 · **Status:** accepted
**Decision:** Both modes share the same content. Recruiter mode is the default for reduced motion, no WebGL, or low-end devices, and is prerendered for SEO.
**Consequences:** Every content feature needs a 2D representation as well.

## ADR-009: Cultural motifs need community confirmation
**Date:** 2026-10-01 · **Status:** accepted
**Context:** Some Bayangi/Manyu symbols (certain Nsibidi signs, Ekpe/Mgbe regalia) carry sacred or restricted meaning.
**Decision:** Only use motifs the owner has confirmed are appropriate for public use; otherwise use abstract geometry inspired by the palette.
**Consequences:** The loader/pattern work in P1-07 waits for the owner's confirmation.

## ADR-010: Content pipeline: docs/projects.md → generated JSON
**Date:** 2026-10-14 · **Status:** accepted
**Context:** The owner writes content in markdown. The site, server and AI guide need validated, structured data.
**Decision:** `docs/projects.md` stays the single source. `npm run content:build` (`scripts/build-content.js`) converts it into `content/profile.json` + `content/projects.json`, validated by the zod schemas in `content/schema.js`. The JSON is generated and committed, never edited by hand. `npm run content:check` (run automatically before `npm run build`) fails on invalid data or JSON that no longer matches the markdown. Missing values stay as `TODO(content)`; placeholders are tagged `[DEMO]`. With `CONTENT_STRICT=1` (or `content:check:strict`) any `TODO(content)` or `[DEMO]` fails the build; this is switched on in hPanel at launch.
**Consequences:** The markdown must follow the format rules at the top of `projects.md`. The converter tolerates small slips but stops with a line number on anything it can't place, so nothing is silently dropped. Demo content can be deployed for testing before launch, but never once strict mode is on.

## ADR-011: City layout: slug-hash lots with fixed size steps
**Date:** 2026-10-15 · **Status:** accepted
**Context:** Placement must be deterministic (same data ⇒ same city). A sorted or shuffled grid rearranges every building whenever one project is added; ordering by height (tall at the back) keeps every tower visible from the entrance but reshuffles whenever commit counts change (every 6 h).
**Decision (owner chose option A):** Downtown grows in fixed steps of blocks (3, 4, 5, 6, 8 per side). Up to 3 featured projects get the front-row lots nearest Career Road. Every other building takes lot `hash(slug) % freeLots`, or the next free lot on a collision. Empty lots are parks.
**Consequences:** The city stays recognisable between visits and content changes; only crossing a size step reshuffles it. A tall building can stand in front of a short one; the camera rig (P1-05) and hover/X-Ray must cope rather than the layout. Projects in non-downtown districts are still placed in Downtown until P3 gives district plots their own content.

## ADR-012: Projects are discovered from GitHub; projects.md adds to and overrides them
**Date:** 2026-10-16 · **Status:** accepted · **Extends:** ADR-010
**Context:** Listing every repo by hand in `docs/projects.md` (across the owner's accounts) was slow and drifted from GitHub. The owner asked for the city to come from GitHub automatically.
**Decision (owner chose: all three accounts, all public repos minus a hide list, keep existing stub blocks):** `/api/city` lists the public repos of the accounts in the profile field "GitHub accounts for the city" (`ojrandy`, `mazunita237-netizen`, `webspectron`) and turns each one into a building, using only GitHub data: name (prettified repo name), description, https homepage (= live link), languages (≥ 5 %, minus build tooling and Flutter runner code, as the stack), commits, stars, last push. Status is derived: archived → archived, https homepage → live, pushed in the last 90 days → in-progress, else unknown. Forks, empty repos, the profile-README repo, `.github`, private repos and anything in "Hide these repos" are skipped. A repo that also has a block in `projects.md` (same repo URL) uses that block; GitHub only adds its numbers and description. Same repo name on two accounts → `owner-repo` slug. The repo list is cached with the stats (6 h, file-persisted, last good copy kept if GitHub fails).
**Consequences:** New public repos appear within 6 h without editing anything; the owner hides the ones that shouldn't. Auto-added buildings have no case study (the panel says so, marked "From GitHub") and never get invented text. Projects without a public repo (client work, videos, private repos) still come only from `projects.md`. The building count follows GitHub, so Downtown can cross a size step (ADR-011) when repos are added. Needs `GITHUB_TOKEN` (60 → 5,000 requests/h); without GitHub the city falls back to content projects only.
