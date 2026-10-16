# CLAUDE.md — OJ City (ojongrandy.com)

Personal portfolio of **Ojong Randy**, a developer based in **Buea, Cameroon** (Bayangi by culture).
It is being rebuilt from a tutorial template into **OJ City**: a living 3D city where each project is a building,
generated from real GitHub data, lit by Buea's real time of day and weather, with an AI guide ("Ask My Portfolio").

Audience: **both freelance clients and employers**. Tone: simple, professional, polished, secure.

## Read first, every session
1. `docs/project_tracker.md`: what is done, what's next (task IDs like `P1-03`)
2. `docs/progress.md`: the session log (latest entry at the top)
3. The doc relevant to the task:
   - `docs/architecture.md`: stack, folders, API endpoints, env vars, deployment
   - `docs/design_system.md`: OJ City concept, districts, colours, time/weather rules, motion
   - `docs/security.md`: security rules and the pre-launch checklist
   - `docs/decisions.md`: why things are the way they are (ADRs). Don't re-argue a decision; add a new ADR to change it.
   - `docs/projects.md`: the content source the owner fills in (projects, bio, links)

## Working rules
- **Plan before code.** For any task bigger than a small fix, propose a plan and wait for approval.
- **Work one tracker task at a time.** Reference its ID in commits: `P1-03: generate buildings from city data`.
- **At the end of every session:** tick the task in `project_tracker.md` and add an entry at the top of `progress.md`.
- **Never invent content.** Projects, numbers, testimonials and bio come only from `docs/projects.md` / `content/`.
  If something is missing, leave a clear `TODO(content)` and ask.
- **No fake stats.** Every number on the site must be real and checkable (GitHub API, live metrics, or owner-supplied).
- Commit only when asked. Never push to `main` without the owner's OK.

## Security rules (non-negotiable)
- **Secrets never go in the frontend.** Anything prefixed `VITE_` is shipped to every visitor's browser.
  API keys (Anthropic, GitHub token, SMTP, Turnstile secret) live only in server env vars (hPanel / `.env`).
- `.env` is never committed; keep `.env.example` up to date with names only.
- All `/api/*` input is validated with `zod`; all public endpoints are rate-limited.
- See `docs/security.md` before touching the server, chat, or contact form.

## Stack
- Frontend: React 19, Vite 7, @react-three/fiber 9, drei 10, postprocessing, GSAP (+ @gsap/react), Tailwind CSS 4
- Server: Node.js + Express (single process: serves `dist/` and `/api/*`), deployed on **Hostinger Node.js hosting**
- AI: Claude API via `@anthropic-ai/sdk` (model set by `ANTHROPIC_MODEL` env var). **Load the `claude-api` skill before writing chat code.**
- Data: GitHub REST/GraphQL API, Open-Meteo (Buea weather, no key), Playwright for preview screenshots at build time

## Commands
```bash
npm run dev       # Vite dev server (frontend)
npm run build     # production build to dist/ (runs content:check first)
npm run content:build         # docs/projects.md → content/*.json (never edit the JSON by hand)
npm run content:check         # validate content + check JSON matches the markdown
npm run content:check:strict  # also fail on [DEMO] / TODO(content) (launch gate; or CONTENT_STRICT=1)
npm test          # content converter + server tests (node --test)
npm run lint      # ESLint
npm run preview   # preview the built frontend (Vite only, no API)
npm run dev:server  # Express API on :3001 (development mode, restarts on change, loads .env)
npm run dev:all     # Vite + Express together; Vite proxies /api → :3001
npm start           # production: Express serves dist/ + /api (Hostinger start command)
npm run perf        # after a build: fps, draw calls and chunk sizes vs the budget (desktop + emulated phone)
```

## Code conventions (match the existing code)
- Function components as `const Name = () => {...}; export default Name`, `.jsx` files, 4-space indentation.
- Imports include the `.jsx` / `.js` extension.
- Styling with Tailwind utility classes; shared design tokens live in `src/index.css` (`@theme`).
- Animations with GSAP via `useGSAP`; 3D with R3F + drei. Prefer instancing for repeated meshes (buildings, windows).
- Static content/config in `src/constants/` → migrating to `content/` (JSON validated with zod).
- Keep comments short and only where intent isn't obvious.

## Performance budget
- Explorer mode: 60 fps on a mid-range laptop, 30+ fps on a mid-range Android phone; < 100 draw calls.
- Initial JS (excluding the 3D chunk) < 200 KB gzip; the 3D scene is lazy-loaded.
- Recruiter mode: Lighthouse ≥ 95 in every category; usable with no WebGL.
- Respect `prefers-reduced-motion`; clamp DPR to 1.5 on mobile.

## Key facts
- Domain: `ojongrandy.com` · City name: **OJ City** · Timezone: `Africa/Douala` (WAT, UTC+1)
- Buea coordinates (weather): lat `4.1527`, lon `9.2410`
- Cultural visuals (Bayangi / Manyu): use only motifs the owner has confirmed are appropriate for public use (ADR-009).
