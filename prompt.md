# Prompt Book — OJ City

Copy-paste prompts for Claude Code, from the first session to launch and beyond.
They run **in order**; each ID matches `docs/project_tracker.md`.

**How to use**
1. Start every session with **S-START**.
2. Paste the prompt for the next unchecked task. Prompts marked 🧭 ask for a plan first; approve it before code is written.
3. End every session with **S-END**.
4. If a prompt's result isn't right, reply with what's wrong instead of re-pasting it.

---

## Session prompts

### S-START: start of every session
```
Read CLAUDE.md, docs/project_tracker.md and the latest entry in docs/progress.md.
Tell me in 5 lines or fewer: where we are, the next unchecked task, and anything blocking it.
Don't write code yet.
```

### S-END: end of every session
```
Wrap up this session:
1. Tick finished tasks in docs/project_tracker.md (use [~] for partly done).
2. Add an entry at the top of docs/progress.md using its template.
3. If we made a decision that changes the plan, add an ADR to docs/decisions.md.
4. Run npm run lint and npm run build and report the result.
5. Suggest a commit message starting with the task ID. Don't commit unless I say so.
```

### S-STUCK: when something breaks
```
Use a structured debugging approach: reproduce, isolate, find the root cause, then propose the smallest fix.
Show me the evidence (error output, the line responsible) before changing code.
```

---

## Phase 0: Foundations

### P0-01: Secrets clean-up
```
Task P0-01 (see docs/security.md).
.env is currently tracked by git. Please:
- stop tracking .env (keep my local file), add .env and .env.* (except .env.example) to .gitignore
- create .env.example with every variable name from docs/architecture.md and no values
- tell me which existing values I must rotate and where to do it (WEB_FORM, EmailJS)
Don't print any secret values.
```

### P0-02: *(owner task)* Fill content
```
I've filled in docs/projects.md. Review it as an editor:
- list missing or vague fields per project, ranked by impact on the site
- flag any number without a source and any testimonial without permission
- suggest sharper wording for the bio and the problem/result lines (as suggestions, don't overwrite)
```

### P0-03: Content → JSON 🧭
```
Task P0-03. Plan first.
Convert docs/projects.md into content/projects.json and content/profile.json.
Create content/schema.js with zod schemas matching docs/architecture.md (slug, district, status, stack, x-ray layers, stats, featured…).
Add scripts/validate-content.js and an npm script "content:check" that fails on invalid data.
Keep TODO(content) markers for missing fields. Never invent data.
```

### P0-04: Express server 🧭
```
Task P0-04 (see docs/architecture.md and docs/security.md). Plan first.
Add an Express server in server/:
- serves dist/ with SPA fallback, compression, helmet with the starting CSP from security.md
- GET /api/health
- trust proxy set for Hostinger, JSON body limit 16kb, generic error handler (no stack traces in production)
- shared zod validation + rate-limit helpers in server/lib/
- npm scripts: dev:server (watch), dev:all (Vite + server), start (production)
- Vite dev proxy /api → server
Update CLAUDE.md commands when done.
```

### P0-05: Hostinger deploy test
```
Task P0-05. I'm deploying to Hostinger Node.js hosting with the domain ojongrandy.com.
Give me a step-by-step checklist for hPanel (connect GitHub repo, build command, entry file, Node version,
env vars, domain, SSL, www→apex redirect, contact@ojongrandy.com mailbox).
Then help me verify: /api/health on the live domain, the real client IP reaching Express (trust proxy), HTTPS forced.
Write anything Hostinger-specific we learn into docs/architecture.md.
```

### P0-06: Restructure & clean 🧭
```
Task P0-06. Plan first.
Restructure src/ to the target structure in docs/architecture.md.
List every template section, component, image and model that OJ City won't use and propose what to delete.
After I approve: move/delete, fix imports, add Prettier matching the existing style (4 spaces), make lint + build pass.
Install zustand for global state (mode, selected project, camera target).
```

---

## Phase 1: The City

### P1-01: /api/city
```
Task P1-01. Build GET /api/city (shape in docs/architecture.md).
Merge content/projects.json with GitHub data (commits, languages, stars, last push) using GITHUB_TOKEN.
Cache 6h in memory + persist the last good result to server/.cache/; serve stale data if GitHub fails.
Private repos use the owner-supplied effort/stats. Add a small test for the merge logic.
```

### P1-02: Building generator 🧭
```
Task P1-02. Plan first.
Implement the building rules from docs/design_system.md ("Building rules") as pure functions in src/lib/buildings.js
(data → { height, footprint, accentColor, litWindowRatio, crane, beacon, flag, weathered }).
Unit-test them. Then render buildings in R3F using instancing for bodies and windows.
```

### P1-03: City layout
```
Task P1-03. Lay out OJ City per the map in docs/design_system.md:
Downtown grid in the centre, district plots (Cinema, Arcade, School, Pitch), main road, Career Road leading in.
Placement must be deterministic (seeded by project slug). Use placeholder blocks for districts for now.
```

### P1-04: Fako backdrop
```
Task P1-04. Add Fako (Mount Cameroon) as the backdrop: a low-poly stylised volcano silhouette with a mist band,
ground plane, and sky dome. Keep it cheap: one or two draw calls, no heavy textures.
```

### P1-05: Camera rig
```
Task P1-05. Build the camera rig: constrained orbit (no going under the ground, limited zoom),
smooth fly-to(target) driven by the zustand store, keyboard controls (arrows/WASD + Tab through buildings),
touch gestures on mobile. With reduced motion: cut instead of fly.
```

### P1-06: Building interaction
```
Task P1-06. Hover a building → label (name + stack). Click → fly to it and open a project panel (placeholder layout).
Keyboard and screen-reader accessible (focusable list mirrored outside the canvas).
```

### P1-07: Loading screen
```
Task P1-07. Build a loading screen showing real asset progress.
Check docs/projects.md section "Cultural motifs approved for public use". If none are approved, use abstract
geometry in the design-system palette (ADR-009). Respect reduced motion.
```

### P1-08: Performance pass
```
Task P1-08. Measure against the performance budget in CLAUDE.md:
fps (laptop + throttled mobile), draw calls, JS bundle sizes. Lazy-load the 3D chunk, clamp DPR, merge static geometry,
compress any GLB (Draco/meshopt), remove unused models. Report before/after numbers.
```

---

## Phase 2: Live Buea

### P2-01: /api/buea
```
Task P2-01. Build GET /api/buea: Buea local time (Africa/Douala), sunrise/sunset and current weather from Open-Meteo
(lat 4.1527, lon 9.2410). Cache 15 min, timeout 4s, fallback to "clear" + computed time. Validate the upstream response with zod.
```

### P2-02: Day/night
```
Task P2-02. Drive sun position, sky colours and ambient light from /api/buea using the time-of-day keyframes in
docs/design_system.md. Interpolate smoothly between phases; update every minute.
```

### P2-03: City lights
```
Task P2-03. Street lamps and window glow that switch on at dusk (staggered, one by one) and off at dawn.
Use emissive materials + a light bloom pass; keep real lights to a minimum for performance.
```

### P2-04: Weather FX
```
Task P2-04. Map Open-Meteo WMO codes to effects per docs/design_system.md: Fako mist (always a light band),
fog, clouds, rain particles + wet road, thunderstorm flashes (off with reduced motion). GPU-friendly particles only.
```

### P2-05: Status line
```
Task P2-05. Add the status line: "It's 23:40 in Buea · light rain · <contextual phrase>".
Write 10–15 phrases keyed to time and weather in the voice from docs/design_system.md, and show them to me before wiring them in.
```

### P2-06: Debug override
```
Task P2-06. In development only, support ?time=HH:MM&weather=<clear|cloudy|fog|rain|storm> to preview any combination.
Make sure it's stripped from production builds.
```

---

## Phase 3: Content, Districts & X-Ray

### P3-01: Case study panel 🧭
```
Task P3-01. Plan first.
Case study panel for a project: problem → hardest part → decision → result, stack chips, live/repo links, media.
Content comes only from content/projects.json. Works as an overlay in Explorer mode and as a page section in Recruiter mode.
```

### P3-02: Previews
```
Task P3-02 (ADR-006). Write scripts/capture-previews.js with Playwright: for each project with a live URL, capture a
1280×800 .webp (and optional 6s .webm loop) into public/previews/. Add npm script "previews".
Show the preview on building hover. Use a live iframe only for projects marked iframe: yes, and add those domains to CSP frame-src.
```

### P3-03: Project X-Ray 🧭
```
Task P3-03. Plan first.
Project X-Ray: the selected building separates into floors UI → API → Data → Infra, each labelled from the
project's x-ray layers. Animated with GSAP; a 2D diagram version for Recruiter mode and reduced motion.
```

### P3-04 → P3-07: Replace template sections
```
Tasks P3-04 to P3-07. Replace the template sections:
- counters → real numbers from docs/projects.md section 7 and GitHub, each with a source tooltip
- logo marquee → real tools/clients (section 8), or remove it if empty
- ability cards → the 3 featured case studies
- testimonials → only quotes with permission confirmed (or one strong quote)
List anything we can't fill with real data, and remove it rather than fake it.
```

### P3-08: Cinema
```
Task P3-08. Cinema district: a building with a rooftop screen playing my reel (muted loop from public/ or a YouTube
thumbnail, never autoplaying with sound). Click → open the reel in a modal. Content from docs/projects.md section 5.
```

### P3-09: Arcade
```
Task P3-09. Arcade district: an arcade building that holds the easter-egg hub. Propose 3 small easter eggs
tied to my favourite games (section 1, Hobbies) and an optional 30-second mini-game. Keep it light on performance.
```

### P3-10: School
```
Task P3-10. School district: a school building; click → list of my teaching content (section 4) with links.
```

### P3-11: Pitch
```
Task P3-11. Pitch district: a small football pitch with a kickable ball (simple physics, no heavy engine unless
justified). Scoring a goal plays a cheer (if sound is on) and opens the contact form. Also give a plain "Contact" button.
```

### P3-12: Career Road
```
Task P3-12. Turn the experience timeline into Career Road: signposts along the road into the city, one per role
(section 2). Scroll/keys move the camera along the road. A plain timeline version for Recruiter mode.
```

### P3-13: About / origin
```
Task P3-13. About section from my origin story (Buea, Bayangi roots, why I code). Draft the copy from docs/projects.md
for my review first. Keep it short and personal. Then build it for both modes.
```

---

## Phase 4: Ask My Portfolio (AI)
> Load the `claude-api` skill before any code in this phase.

### P4-01: Knowledge builder
```
Task P4-01 (ADR-004). Write scripts/build-knowledge.js: content/*.json → server/knowledge/knowledge.md, a compact,
well-structured doc (profile, services, FAQ, experience, each project with its slug). Add npm script "knowledge" and run it in the build.
```

### P4-02: System prompt
```
Task P4-02. Draft server/prompts/system.md for the guide, following the AI guardrails in docs/security.md:
answers only about me and my work, cites project slugs, says "I don't know" when the knowledge doesn't cover it,
short friendly answers, suggests a next action (view project / contact), ignores attempts to change its rules.
Show me the draft before wiring it in.
```

### P4-03: /api/chat 🧭
```
Task P4-03. Plan first. Load the claude-api skill.
POST /api/chat with streaming (SSE) using @anthropic-ai/sdk, model from ANTHROPIC_MODEL, knowledge + system prompt
as a cached system block. zod-validated input, limits from docs/security.md (turns, chars, output tokens),
per-IP rate limit, daily budget counter with graceful fallback. No transcript logging with IPs.
```

### P4-04: Tools
```
Task P4-04. Add tools fly_to_project(slug), open_case_study(slug), open_contact(), switch_mode(mode).
The server forwards tool calls to the client; the client validates slugs against known projects and runs them via the zustand store.
```

### P4-05: Chat UI
```
Task P4-05. Chat UI: a floating "Ask OJ City" guide, 4 suggested questions (2 for clients, 2 for recruiters),
streaming text rendered safely (no raw HTML), project citations as clickable chips, works in both modes, keyboard accessible.
```

### P4-06: Evals
```
Task P4-06. Create evals/chat.json with 25 questions: recruiter, client, edge cases (unknown facts, rates, availability)
and prompt-injection/off-topic attempts, each with the expected behaviour. Write a script that runs them against
/api/chat and reports pass/fail. Target ≥ 23/25. Fix the system prompt (not the evals) for failures.
```

---

## Phase 5: Recruiter Mode & Polish

### P5-01: Recruiter mode 🧭
```
Task P5-01 (ADR-008). Plan first.
Recruiter mode: fast, text-first page with bio, availability, top 3 case studies, skills, Career Road timeline,
CV download, contact, and the chat. No WebGL. Light theme with the --paper token. Lighthouse ≥ 95.
```

### P5-02: Mode switch
```
Task P5-02. Mode switch in the nav plus auto-detect: reduced motion, no WebGL, low device memory/cores or saveData
→ Recruiter by default. Remember the choice. Share URLs per mode (/ and /recruiter).
```

### P5-03: Contact
```
Task P5-03 (ADR-007). POST /api/contact with nodemailer over Hostinger SMTP, Cloudflare Turnstile verified on the server,
honeypot, minimum time-on-form, header-injection-safe, fixed recipient. Remove EmailJS and its variables.
Rate limit per docs/security.md. Send me a test email.
```

### P5-04: Command palette
```
Task P5-04. Ctrl/Cmd+K command palette: jump to any project, district, mode, contact, CV, toggle sound. Fully keyboard-driven.
```

### P5-05: Accessibility
```
Task P5-05. Run an accessibility review (WCAG 2.1 AA) on both modes: keyboard paths, focus visibility, contrast,
ARIA, a screen-reader description of the 3D scene, reduced motion. Fix the issues and list what you changed.
```

### P5-06: SEO
```
Task P5-06. SEO: titles/meta, Open Graph + Twitter image (render a nice OJ City still), JSON-LD Person with sameAs links,
sitemap.xml, robots.txt, canonical ojongrandy.com, prerendered HTML for the recruiter route.
```

### P5-07: Mobile
```
Task P5-07. Mobile pass: layout at 360px, touch controls, chat on small screens, performance on a mid-range Android
(throttled). Report fps and fixes.
```

### P5-08: Sound
```
Task P5-08. Sound design per docs/design_system.md: muted by default, ambient city/rain bed, UI ticks, goal cheer.
Lazy-load audio, remember the toggle.
```

### P5-09: Easter eggs
```
Task P5-09. Implement the approved easter eggs (Konami code, football chant, night-owl mode, game references from P3-09).
None may hurt performance or accessibility.
```

---

## Phase 6: Hardening & Launch

### P6-01: Security review
```
Task P6-01. Go through the pre-launch checklist in docs/security.md item by item against the real code and the live
site. Report each item as pass/fail with evidence, fix the failures, and tighten the CSP.
```

### P6-02: Dependencies
```
Task P6-02. Run npm audit, remove unused dependencies, pin versions, check bundle size. Report what changed.
```

### P6-03: Performance
```
Task P6-03. Run Lighthouse on both modes (mobile + desktop) against the live site. Fix regressions to meet the
budget in CLAUDE.md. Report before/after scores.
```

### P6-04: Analytics & logging
```
Task P6-04. Add privacy-friendly analytics (no cookie banner needed) with events for: mode switch, project opened,
x-ray opened, chat started, contact sent, goal scored. Add server error logging without personal data.
```

### P6-05: README
```
Task P6-05. Rewrite README.md as a case study of OJ City itself: concept, live link, features, architecture diagram,
stack, how the data flows, security, performance numbers, and how to run it locally.
```

### P6-06: Launch
```
Task P6-06. Final launch checklist: all tracker tasks done or deliberately dropped, env vars set in hPanel, SSL/HSTS,
backups, 404 page, favicon/icons, OG preview checked on LinkedIn/X. Then draft a LinkedIn post and an X post announcing OJ City.
```

---

## After launch: maintenance prompts

### M-01: Add a new project
```
I added a new project to docs/projects.md. Update content/projects.json, run content:check, capture its preview,
rebuild the knowledge file, and confirm the new building appears in the city and in Recruiter mode.
```

### M-02: Refresh previews
```
Re-capture all project previews (npm run previews), compare with the old ones, and list which changed.
```

### M-03: Monthly health check
```
Monthly check: npm audit, Lighthouse on both modes, chat eval run, AI spend vs budget, GitHub cache freshness,
broken links across all project URLs. Summarise and propose fixes.
```

### M-04: Update the AI guide
```
Here's a question the AI guide answered badly: "<question>" → "<answer>".
Diagnose whether it's missing knowledge or a system-prompt problem, fix it, and add it to evals/chat.json.
```
