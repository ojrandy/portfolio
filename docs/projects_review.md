# Editorial review of `docs/projects.md` (2026-10-14)

Suggestions only. Nothing in `projects.md` written by the owner has been reworded. Blank fields were filled
with `[DEMO]` placeholders; those must be replaced before launch.

---

## 1. Missing or vague fields, ranked by impact on the site

| # | Where | Problem | Why it matters |
|---|---|---|---|
| 1 | §3 Projects | Only **1 project** is written up. Vital Pulse and Smart Meal (your "biggest breakthrough" projects in the bio) have no project block. Trek Cameroon, Computer Solution, banking landing page, PICKUP, hospital system and the e-commerce app are only mentioned in passing. | Every project is a building. With one project, Downtown has one building. The featured slots and the AI guide have nothing to talk about. |
| 2 | §3 Sns Glam | **Problem**, **Stack** ("React, Node, …"), **X-Ray layers** and **Media** are blank or template text. **Result** has numbers with no source (see §2 below). | These fields fill the case-study panel (P3-01) and X-Ray (P3-03), which are the main thing recruiters read. |
| 3 | §1 Title / one-liner | Blank. | It's the first line on the site and in Recruiter mode. |
| 4 | §2 Experience | No **job title** on any role, and the 2021–2024 role has no **company**. Roles 2 and 3 have identical bullets ("Software development", "Work as the HR…"). The end date "2025-" is incomplete. | Career Road can't label its milestones. Duplicate bullets read as copy-paste to a recruiter. |
| 5 | §6 Testimonials | The only quote has no name, role or permission answer. | It can't be shown (security + "no fake reviews" rule). |
| 6 | §1 Available for, CV, Languages spoken | Blank. | Recruiters filter on availability and want a CV download. |
| 7 | §4 Teaching, §5 Video work | No entries (TUIB and YouTube are only in Hobbies). | The School and Cinema districts would be empty. |
| 8 | §1 Degree | "1st Class degree" in the bio, but no institution or year. | It's a strong claim; make it checkable. |
| 9 | §3 Sns Glam Slug | "Sns Glam" should be URL-safe: `sns-glam`. Heading was "Project Name" (now "Sns Glam"). Display name might be "SNS Glam Hair & Makeup Studio". | Slugs become URLs and building IDs. |
| 10 | §1 Culture | Says "Bayangi / Orocko"; CLAUDE.md says Bayangi only. | Confirm which you want public; Bayangi and Oroko are different groups. |
| 11 | §8 Tools | Prose, not a list. | Hard to render as a tool shelf. A `[DEMO]` list was added under it. |

## 2. Numbers without a source / testimonials without permission

**Numbers (none can ship as written):**
- Sns Glam **Result: "users: 100+"**: no source. Use Google Analytics / Hostinger stats, or remove.
- Sns Glam **Result: "speed 100%"**: unclear what this means. If it's a Lighthouse Performance score, say "Lighthouse Performance 100 (mobile), tested <date>" and keep the report.
- §7 table: **"Projects shipped 50+ / 100"** and **"Users served 100 / 100"**: the table is malformed (four columns, two values each) and the source column says "this file" / "analytics" without a link. "This file" lists 1 project, so 50+ or 100 can't be checked.
- §1 **"Years coding: 5+"**: fine if you add the start year (your 2021-03 role supports ~5 years).
- §2 **"many more"**, **"multiple"**, bio **"countless projects"**: vague counts. Use a real number or drop them.

**Testimonials:**
- The teaching quote ("Ojong Randy provides exceptional services…") has **no author and permission not confirmed**. It can't be shown.
- The two `[DEMO]` testimonial slots are **templates, not reviews**. I did not write invented quotes under real-sounding names: a made-up review on a live portfolio is a fake testimonial, and clients and recruiters can check. Ask SNS Glam's owner and a Web Spectron colleague for 2–3 sentences, plus their OK to use their name.

**Logos (§8):** "Yes you have permission to use their logo" needs to come from each company (Web Spectron, TUIB, Bethuel Tech, Anointed PLC), not from you. Get a written "yes" from each, or list names as text without logos.

## 3. Suggested wording (pick, edit, or ignore)

### One-liner
- "Software engineer building fast, secure web and mobile products from Buea, Cameroon."
- "Full-stack developer. I build web and mobile apps that small businesses can rely on."

### Short bio
Current version mixes a belief, a degree, a modesty note and a product mention. Suggested:

> I'm Ojong Randy, a software engineer in Buea, Cameroon, with a First Class degree in Software Engineering
> and 5+ years of building for the web and mobile. I build products end to end, from the interface to the
> server, and I take security seriously. My own products include Vital Pulse and Smart Meal; I also lecture
> in computer science at TUIB.

Shorter (Recruiter mode):

> Software engineer (First Class, Software Engineering) in Buea, Cameroon. 5+ years building web and mobile
> products with React, Next.js, React Native and Node. Founder of Vital Pulse and Smart Meal.

### Origin story
> My friends say my powers are in my fingers. For me, code is how a developer in Buea builds things the whole
> world can use. I also never trust anything that comes from the browser: every input is checked on the server.

### Services: group them so the main offer leads
- **Web & mobile apps** (React, Next.js, React Native, Flutter)
- **Websites & SEO** (WordPress, Google Maps / Business integration)
- **UI design** (Figma, Adobe XD)
- **Video editing** (Premiere Pro, CapCut)
- **IT setup** (networking, CCTV installation)
- **Training** (computer science and IT courses)

"Leverage the use of AI for the best study experience" is unclear as a service. Say what you deliver, e.g.
"AI-assisted study tools for schools", or drop it.

### Experience bullets
"Work as the HR, where I use Gantt charts to assign tasks" sounds like an HR job. If you led the team's
planning, say: "Planned sprints and assigned tasks for a team of <n> developers using Gantt charts."

Replace "Software development" with what you built, e.g.:
- "Built the Trek Cameroon booking site and the Computer Solution company site (React, Node)."
- "Contributed to the PICKUP mobile app: <feature you owned>."

2021–2024: "Built a hospital management system and a multi-vendor e-commerce app for Revival IT Centre, Buea."

### Sns Glam: problem / decision / result
- **Problem:** "SNS Glam, a hair and makeup studio in Buea, took bookings by WhatsApp and walk-in. They needed a site that shows their work and turns visitors into bookings."
- **Hardest part:** "Matching a premium beauty brand's look while keeping the site fast on mobile data."
- **Decision:** "Built the palette from the studio's photos and checked every colour pair for readable contrast." (Rewrite only if this is what you actually did.)
- **Result:** "Live since October 2026; <n> visitors in the first month (Google Analytics); Lighthouse Performance <score> on mobile."

### FAQ answers
- **Rates:** "Websites start at 75,000 FCFA. Web apps are usually 150,000–500,000 FCFA depending on scope. Mobile apps are quoted per project. I work with a 50% deposit and 50% on delivery."
- **Availability:** "I reply to messages within <x> hours (WAT, UTC+1)." ("24/7" isn't believable and invites late-night demands.)
- **International clients:** "Yes. I work with clients in Cameroon and abroad, and overlap well with European working hours."
