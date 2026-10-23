# Content Source — OJ City

> **Owner fills this in (task P0-02).** This is the only source for the site's content and for the AI guide.
> Anything not written here will not appear on the site. Leave a field blank rather than guessing.
> Numbers must be real. Testimonials need the person's permission.
>
> **`[DEMO]` = placeholder added on 2026-10-14 so the site can be built before content is final.**
> A `[DEMO]` on a heading means **the whole block** is demo. On a field, only that value is demo.
> Every `[DEMO]` must be replaced or deleted before launch (`npm run content:check:strict` lists them).
> Editorial review and wording suggestions: `docs/projects_review.md`.
>
> **How this file becomes the site (ADR-010):** `npm run content:build` converts it into
> `content/profile.json` + `content/projects.json`. Never edit the JSON by hand; edit this file and rebuild.
> Format rules:
> - Fields are bullets: `- **Field:** value`. Lists go in indented sub-bullets under the field.
> - Blank or `TODO(content)` = missing (it stays visible as a TODO). `—` = "none / not applicable".
> - Dates: `2024-11 → 2025-08`, `2026-06 → present`, or a single `2026-07`.
> - Yes/no fields: `yes` or `no`. Checkboxes: `☑` (yes) / `☐` (no).
> - Lines in _italics_ are notes for you and are ignored. Any other stray text is reported as a warning.

---

## 1. Profile
- **Full name:** Ojong Randy
- **Title / one-liner:** [DEMO] Software engineer building fast, secure web and mobile products from Buea, Cameroon
- **Location:** Buea, Cameroon
- **Culture:** Bayangi / Orocko
- **Available for:** [DEMO] freelance ☑ · full-time ☑ · contract ☑ · remote ☑
- **Email (public):** contact@ojongrandy.com
- **GitHub username:** OJONG RANDY IKOKE https://github.com/ojrandy
- **GitHub accounts for the city:** ojrandy, mazunita237-netizen, webspectron
- **Hide these repos:** mazunita237-netizen/iot-sentinel-F-B
_iot-sentinel-F-B is an earlier one-commit upload of IoT Sentinel (the iot-sentinelf block below), hidden so the project appears once._
_Every public repo of these accounts becomes a building automatically, using real GitHub data (name, description, homepage, languages, commits, stars, last push). Forks, empty repos and profile-README repos are skipped; private repos never appear. To hide one, list it as owner/repo, comma-separated (e.g. ojrandy/threejs). A repo that also has a block in section 3 uses that block instead (ADR-012)._
- **LinkedIn:** Ojong Randy https://www.linkedin.com/in/ojong-randy/
- **X / Twitter:** 
- **YouTube / video reel:** https://www.youtube.com/@ojongrandy2580
- **CV (PDF) path or link:** [DEMO] /cv/ojong-randy-cv.pdf
- **Years coding:** 5+
- **Languages spoken:** [DEMO] English (fluent), French (working), Pidgin (fluent)
- **Degree:** Software Engineering, First Class — University of Buea, 2026

### Short bio (2–3 sentences)
 I believe that with 0s and 1s, together, we can make the world a better place, if not the best one. I hold a First Class degree in Software Engineering from the University of Buea, and I have built many projects while keeping a simple, easy life. I see myself as a techpreneur: my biggest breakthroughs are Vital Pulse and Smart Meal, which I am shipping now.

### Origin story (why you code, Buea, Bayangi roots)
_Blank lines separate paragraphs on the site._

 I'm Ojong, from Osing village in Bayangi. My dad is Orocko, so which tribe I really belong to is a running father-and-son debate at home, all in good fun. I grew up in Tiko, where I studied the sciences in secondary school, and moved to Buea in 2020.

 I started with basic computing at a cyber café, then earned an HND in Software Engineering. Harvard's CS50 with Prof. David J. Malan gave me the best introduction to computer science, and JavaScript Mastery on YouTube taught me JavaScript, its frameworks and Three.js, the library this city is built with. Today I hold a degree in Software Engineering, the AWS Cloud Practitioner certification and several Udemy certificates in Dart and Flutter.

 I see coding as a source of strength; as my friends always say, my powers are in my fingers. Security is at the heart of how I work: I never trust anything that comes from the client side, and I am preparing a Master's in Information Security. I am the software engineer who builds on cloud infrastructure and protects the data and information that live on it.

### Services you offer clients
_Each service is a stall in the Market (P3B-07), in this order. Sub-bullets are optional: **Delivered:** one line on what the client gets; **Examples:** project slugs from section 3 whose buildings show this work (demo projects are skipped). No prices: they depend on the job, so every stall says "Ask for a quote"._
- Frontend development
  - **Delivered:** Fast, responsive interfaces in React, Next.js and Tailwind CSS that look sharp on every screen.
  - **Examples:** anointed-plc, computer-solution, food-app-website
- Backend development
  - **Delivered:** Secure APIs and servers in Node.js and Express, with validated input and well-designed databases.
  - **Examples:** vital-pulse, navoraglobalfreight, iot-sentinelf
- Web app development
  - **Delivered:** Complete web applications, from the database to the dashboard, deployed and ready for real users.
  - **Examples:** sns-glam, wvl, novatransport
- Mobile app development
  - **Delivered:** Android and iOS apps built with Flutter or React Native, ready to publish to the stores.
  - **Examples:** vital-pulse, expense-tracker, food-recipe2
- Graphics design
  - **Delivered:** Logos, flyers, social media visuals and app screens, designed in Figma and Adobe XD.
- Cloud infrastructure
  - **Delivered:** Hosting, domains, databases and backups set up in the cloud, secured and ready to grow.
- AI infrastructure
  - **Delivered:** AI built into your product: chat assistants, smart search and automations on today's leading models.
  - **Examples:** threejs
- QA & QC
  - **Delivered:** Testing that catches bugs before your users do: test plans, automated tests and a clear report.
- Project management
  - **Delivered:** Your project planned, tracked and delivered, with clear milestones and regular updates.
- Video editing
  - **Delivered:** Clean edits for adverts, events and social media, cut in Premiere Pro and CapCut.
- CCTV installation
  - **Delivered:** CCTV cameras installed for homes and businesses, set up so you can watch from your phone.
- SEO & Google Maps
  - **Delivered:** Get found on Google: on-page SEO, and your business on Google Maps and on your website.
  - **Examples:** computer-solution
- IT lecturing & training
  - **Delivered:** Computer science and IT courses taught clearly, from first steps to real projects.
- AI for studying
  - **Delivered:** Learn to use AI tools to study smarter: research, summaries and exam revision.
- And many more
  - **Delivered:** Need something tech that isn't on a stall? Tell me what you need.

### Market call-outs (Pidgin)
_Shoppers in the Market say these when clicked (P3B-07). Only lines written or approved by the owner._
- I wan buy
- Who they here

### Taxi driver lines (Pidgin)
_The driver of the taxi you ride in says one of these when you get in (Pick-up) and when you arrive (Arrival), one per ride, in turn. Only lines written or approved by the owner; the driver stays quiet until there are some._
- **Pick-up:**
  - TODO(content)
- **Arrival:**
  - TODO(content)

### Police lines (Pidgin)
_In drive mode, running a red brings a police car after you (P3B-11). The officer says one of these when the chase starts (Chase) and when you pull over for him (Pull over), in turn. Only lines written or approved by the owner; until there are some, he says "Pull over!" and "Red means stop. Drive safe!"._
- **Chase:**
  - TODO(content)
- **Pull over:**
  - TODO(content)

### Hobbies
- Coding: Using JS, Familiar with React, React Native, NextJs and love coding with Threejs and Flutter 
- Video editing: use tools like premier pro, Capcut
- Gaming: Love FIFA, GTA and Action games 
- Teaching: currently teaching at Trustech University Institute of Buea (TUIB)
- Football: Am a proud FCB fan, I play Gk and simetime RB. 

### Cultural motifs approved for public use (ADR-009)
- None Yet

---

## 2. Experience (Career Road)
_Copy this block per role, newest first. The heading is just a label._

### Web Spectron Ltd
- **Role:** Software Developer
- **Company:** Web Spectron Ltd
- **Dates:** 2026-06 → Present
- **Location:** Remote
- **What you did (3 bullets max):**
  - Software development
  - Took on HR duties: assigned tasks to the team with Gantt charts
- **Proudest result:** Built the Trek Cameroon web app, the Computer Solutions website, a banking landing page, the Vital Pulse app, SNS Glam and many more

### Turko Banix Inc
- **Role:** Software Developer
- **Company:** Turko Banix Inc
- **Dates:** 2024-11 → 2025
- **Location:** Remote
- **What you did (3 bullets max):**
  - Software development
  - Took on HR duties: assigned tasks to the team with Gantt charts
- **Proudest result:** Built multiple apps and contributed to the PICKUP app

### First role (Buea)
- **Role:** Full-stack Developer & IT Technician
- **Company:** Freelance
- **Dates:** 2021-03 → 2024-09
- **Location:** Buea, Cameroon
- **What you did (3 bullets max):**
  - Used React and Next.js to build interactive dashboards
  - Used native PHP to contribute to the Learn Contri Talk app
  - Did networking and camera installation
- **Proudest result:** Built a hospital management system and a multi-vendor e-commerce app for Revival IT Centre Buea, and multiple WordPress sites for freelance clients

---

## 3. Projects (Downtown buildings)
_Copy this block per project. Mark up to 3 as featured._
_Status drives the building: `live` = lit windows, `in-progress` = crane, `archived` = dimmed._
_Effort (1–10) sets height when the repo is private or has no GitHub stats._

### Sns Glam
- **Slug:** Sns Glam
- **Featured:** yes 
- **Status:** live 
- **Live URL:** https://snsglamshairmakeupstudio.com/
- **Repo URL:** https://github.com/ojrandy/sns-glam
- **Built for:** company 
- **Your role:** solo 
- **Team size:** [DEMO] 1
- **Dates:** 1 october 2026
- **Stack:** React, Node, …
- **Category:** web 
- **Problem:** [DEMO] A hair and makeup studio in Buea relied on WhatsApp and walk-ins; it needed a site that shows its work and turns visitors into bookings.
- **Hardest part:** the toughest bug or decision was getting the best design and blend the colors
- **Decision:** I use an Online Pallete the get the best color combination
- **Result:** users: 100+, speed 100%, 
- **X-Ray layers:**
  - UI: [DEMO] React, Tailwind CSS, responsive gallery
  - API: [DEMO] Node.js (Express) booking/contact endpoint
  - Data: [DEMO] none / form submissions by email
  - Infra / hosting: Hostinger 
- **Effort (1–10):** 
- **Media:** [DEMO] public/previews/sns-glam.webp (captured by P3-02)
- **Can the live site be shown in an iframe?** yes

### Vital Pulse
_Live URL confirmed by the owner on 2026-10-20. The other fields are still the 2026-10-14 placeholders (including the 300+ patients number); replace each [DEMO] value._
- **Slug:** vital-pulse
- **Featured:** yes
- **Status:** live
- **Live URL:** https://vitalpulse237.com
- **Repo URL:** https://github.com/ojrandy/vitalpulse-mobile
- **Built for:** [DEMO] own product
- **Your role:** [DEMO] founder & lead developer
- **Team size:** [DEMO] 2
- **Dates:** [DEMO] 2025-02 → present
- **Stack:** [DEMO] React Native (Expo), Node.js, Express, PostgreSQL, Firebase Cloud Messaging
- **Category:** mobile
- **Problem:** [DEMO] Patients managing long-term conditions (hypertension, diabetes) in Cameroon log readings on paper, if at all, so doctors see a few numbers per visit instead of a trend.
- **Hardest part:** [DEMO] Keeping readings safe and in sync when patients are offline for days on weak mobile networks.
- **Decision:** [DEMO] Offline-first: readings are saved on the phone and synced with conflict-safe timestamps when a connection returns, instead of requiring a live connection.
- **Result:** [DEMO] 300+ patients logging readings weekly; doctors get a 30-day trend chart before each visit. Source: app analytics
- **X-Ray layers:**
  - UI: [DEMO] React Native screens, charts, reminders
  - API: [DEMO] Node.js + Express REST API, JWT auth, rate-limited
  - Data: [DEMO] PostgreSQL (readings, users), on-device SQLite cache
  - Infra / hosting: [DEMO] VPS + Firebase Cloud Messaging for reminders
- **Effort (1–10):** [DEMO] 9
- **Media:** public/previews/vital-pulse.webp (captured by P3-02)
- **Can the live site be shown in an iframe?** TODO(content)

### [DEMO] Smart Meal
- **Slug:** smart-meal
- **Featured:** yes
- **Status:** in-progress
- **Live URL:** TODO(content)
- **Repo URL:** https://github.com/ojrandy/smart_meal
- **Built for:** own product
- **Your role:** founder & lead developer
- **Team size:** 1
- **Dates:** 2025-09 → present
- **Stack:** Flutter, Dart, Riverpod, Supabase, Firebase Cloud Messaging, Google Sign-In
- **Category:** mobile
_Stack, category, X-Ray and iframe corrected 2026-10-16 from the repo (pubspec.yaml, README): a Flutter app for Android and iOS. The rest of this block is still demo text._
- **Problem:** Students and young workers in Buea spend too much on food and eat badly because planning meals around a small budget is tedious.
- **Hardest part:** Producing meal plans from local ingredients and real market prices, not generic Western recipes.
- **Decision:** A curated local ingredient and price list that the AI must plan from, so suggestions are realistic and cheap.
- **Result:** Beta with 50 testers; average weekly food spend down 20% in the first month. Source: tester survey
- **X-Ray layers:**
  - UI: Flutter (Android, iOS), Riverpod, go_router
  - API: TODO(content)
  - Data: Supabase (auth, database, storage, realtime)
  - Infra / hosting: Supabase; Firebase Cloud Messaging for push notifications
- **Effort (1–10):** 8
- **Media:** TODO(content)
- **Can the live site be shown in an iframe?** no (mobile app)

### [DEMO] OJ City (this portfolio)
- **Slug:** oj-city
- **Featured:** no
- **Status:** in-progress
- **Live URL:** https://ojongrandy.com
- **Repo URL:** https://github.com/ojrandy/portfolio
- **Built for:** personal
- **Your role:** solo
- **Team size:** 1
- **Dates:** 2026-10 → present
- **Stack:** React, Three.js (React Three Fiber), GSAP, Tailwind CSS, Node.js, Express, Claude API
- **Category:** web / 3D
- **Problem:** A list of projects doesn't show how a developer thinks. I wanted a portfolio people explore, built from real data.
- **Hardest part:** Rendering a whole city at 60 fps on mid-range phones.
- **Decision:** Instanced meshes and a lazy-loaded 3D scene, plus a fast text-only Recruiter mode.
- **Result:** The city you are standing in. Buildings, weather and lighting come from live GitHub and Buea data.
- **X-Ray layers:**
  - UI: React Three Fiber, drei, GSAP
  - API: Express (`/api/city`, `/api/buea`, `/api/chat`)
  - Data: GitHub API, Open-Meteo, content JSON
  - Infra / hosting: Hostinger Node.js
- **Effort (1–10):** 9
- **Media:** —
- **Can the live site be shown in an iframe?** no (it is this site)

### [DEMO] Trek Cameroon
- **Slug:** trek-cameroon
- **Featured:** no
- **Status:** live
- **Live URL:** TODO(content)
- **Repo URL:** private
- **Built for:** client (via Web Spectron Ltd)
- **Your role:** lead frontend developer
- **Team size:** 3
- **Dates:** 2026-06 → 2026-08
- **Stack:** Next.js, Tailwind CSS, Node.js, MySQL, Stripe
- **Category:** web
- **Problem:** A Mount Cameroon trekking operator took bookings by email and WhatsApp, which lost international visitors who wanted to book and pay online.
- **Hardest part:** A booking calendar that respects guide availability and group limits per route.
- **Decision:** Server-side availability checks and short-lived seat holds during checkout, so two people can't book the last place.
- **Result:** Online bookings live for the 2026 season; enquiries handled on the site instead of WhatsApp. Source: client
- **X-Ray layers:**
  - UI: Next.js, interactive route maps
  - API: Node.js booking API, Stripe checkout
  - Data: MySQL (routes, guides, bookings)
  - Infra / hosting: Hostinger
- **Effort (1–10):** 7
- **Media:** TODO(content)
- **Can the live site be shown in an iframe?** yes

### [DEMO] PICKUP App
- **Slug:** pickup-app
- **Featured:** no
- **Status:** live
- **Live URL:** TODO(content)
- **Repo URL:** private
- **Built for:** company (Turko Banix Inc)
- **Your role:** mobile developer
- **Team size:** 5
- **Dates:** 2024-11 → 2025-08
- **Stack:** Flutter, Firebase (Auth, Firestore, Cloud Functions), Google Maps API
- **Category:** mobile
- **Problem:** Customers needed to request a package pickup and track the rider live, instead of calling back and forth.
- **Hardest part:** Smooth live rider tracking without draining the rider's battery.
- **Decision:** Adaptive location updates: frequent while a pickup is active, rare when the rider is idle.
- **Result:** Shipped to Android and iOS; I owned live tracking and the rider app. Source: company
- **X-Ray layers:**
  - UI: Flutter (customer + rider apps)
  - API: Firebase Cloud Functions
  - Data: Firestore
  - Infra / hosting: Firebase, Google Maps Platform
- **Effort (1–10):** 8
- **Media:** TODO(content)
- **Can the live site be shown in an iframe?** no (mobile app)

### [DEMO] Hospital Management System
- **Slug:** hospital-management-system
- **Featured:** no
- **Status:** live
- **Live URL:** private (internal system)
- **Repo URL:** private
- **Built for:** client
- **Your role:** full-stack developer
- **Team size:** 2
- **Dates:** 2023-01 → 2023-09
- **Stack:** React, Node.js, Express, MySQL
- **Category:** web
- **Problem:** A private clinic kept patient records, appointments and billing on paper and in spreadsheets, so files went missing and bills were wrong.
- **Hardest part:** Role-based access: reception, nurses, doctors and the cashier must each see only what they need.
- **Decision:** Permissions enforced on the server for every request, never just hidden in the UI.
- **Result:** Records, appointments and billing in one system; staff trained in a week. Source: client
- **X-Ray layers:**
  - UI: React dashboard
  - API: Express REST API with role-based access control
  - Data: MySQL (patients, visits, invoices)
  - Infra / hosting: on-premise server + nightly backups
- **Effort (1–10):** 8
- **Media:** TODO(content), anonymised screenshots only
- **Can the live site be shown in an iframe?** no

### [DEMO] Multi-vendor E-commerce
- **Slug:** multi-vendor-ecommerce
- **Featured:** no
- **Status:** live
- **Live URL:** TODO(content)
- **Repo URL:** private
- **Built for:** client (Revival IT Centre, Buea)
- **Your role:** full-stack developer
- **Team size:** 2
- **Dates:** 2022-06 → 2023-02
- **Stack:** Next.js, Node.js, MongoDB, MTN MoMo / Orange Money payments
- **Category:** web
- **Problem:** Small shops in Buea had no affordable way to sell online and accept mobile money.
- **Hardest part:** Splitting one customer order across several vendors, with each vendor paid correctly.
- **Decision:** Orders split into per-vendor sub-orders with their own status and payout records.
- **Result:** Marketplace launched with local vendors; orders paid by mobile money. Source: client
- **X-Ray layers:**
  - UI: Next.js storefront + vendor dashboard
  - API: Node.js, payment webhooks
  - Data: MongoDB
  - Infra / hosting: VPS
- **Effort (1–10):** 8
- **Media:** TODO(content)
- **Can the live site be shown in an iframe?** TODO(content)

### [DEMO] Learn Contri Talk
- **Slug:** learn-contri-talk
- **Featured:** no
- **Status:** archived
- **Live URL:** —
- **Repo URL:** private
- **Built for:** company
- **Your role:** backend contributor
- **Team size:** 4
- **Dates:** 2021-06 → 2022-03
- **Stack:** PHP (native), MySQL, JavaScript
- **Category:** web
- **Problem:** A learning community needed a place for learners to post questions, share notes and join discussions.
- **Hardest part:** Keeping a hand-written PHP codebase secure against SQL injection and XSS.
- **Decision:** Moved every query to prepared statements and escaped all output.
- **Result:** Contributed discussion and notes features. Source: company
- **X-Ray layers:**
  - UI: server-rendered PHP + JavaScript
  - API: PHP endpoints
  - Data: MySQL
  - Infra / hosting: shared hosting
- **Effort (1–10):** 6
- **Media:** —
- **Can the live site be shown in an iframe?** no

### [DEMO] Business Analytics Dashboard
- **Slug:** analytics-dashboard
- **Featured:** no
- **Status:** live
- **Live URL:** private (internal)
- **Repo URL:** private
- **Built for:** company
- **Your role:** frontend developer
- **Team size:** 3
- **Dates:** 2022-01 → 2022-05
- **Stack:** React, Next.js, Recharts, REST API
- **Category:** web
- **Problem:** Managers waited for weekly spreadsheet reports to see sales and stock.
- **Hardest part:** Fast charts over large date ranges.
- **Decision:** Pre-aggregated daily totals on the server; the browser only draws charts.
- **Result:** Live sales and stock dashboard replaced the weekly spreadsheet. Source: company
- **X-Ray layers:**
  - UI: Next.js, Recharts
  - API: REST API (company backend)
  - Data: SQL database (company)
  - Infra / hosting: company server
- **Effort (1–10):** 5
- **Media:** TODO(content), anonymised
- **Can the live site be shown in an iframe?** no

### Computer Solutions Accessories
_Live URL confirmed by the owner on 2026-10-20. The other fields are still the 2026-10-14 placeholders; replace each [DEMO] value._
- **Slug:** computer-solution
- **Featured:** no
- **Status:** live
- **Live URL:** https://computersolutionsaccessories.com/
- **Repo URL:** [DEMO] private
- **Built for:** [DEMO] client (via Web Spectron Ltd)
- **Your role:** [DEMO] developer
- **Team size:** [DEMO] 2
- **Dates:** [DEMO] 2026-07
- **Stack:** [DEMO] React, Tailwind CSS, Google Maps embed
- **Category:** web
- **Problem:** [DEMO] A computer sales and repair shop needed to be found on Google and show its services and location.
- **Hardest part:** [DEMO] Ranking locally for "computer repair Buea".
- **Decision:** [DEMO] Local SEO: Google Business Profile, LocalBusiness schema and a Maps embed.
- **Result:** [DEMO] Live, listed on Google Maps. Source: client
- **X-Ray layers:**
  - UI: [DEMO] React, Tailwind CSS
  - API: [DEMO] contact form endpoint
  - Data: [DEMO] —
  - Infra / hosting: Hostinger
- **Effort (1–10):** [DEMO] 4
- **Media:** public/previews/computer-solution.webp (captured by P3-02)
- **Can the live site be shown in an iframe?** TODO(content)

### [DEMO] Banking Landing Page
- **Slug:** banking-landing-page
- **Featured:** no
- **Status:** live
- **Live URL:** TODO(content)
- **Repo URL:** TODO(content)
- **Built for:** client (via Web Spectron Ltd)
- **Your role:** frontend developer
- **Team size:** 1
- **Dates:** 2026-08
- **Stack:** React, Tailwind CSS, GSAP
- **Category:** web
- **Problem:** A financial services brand needed a landing page that builds trust and drives sign-ups.
- **Hardest part:** Rich animation without hurting load time on mobile.
- **Decision:** GSAP animations that start only when sections scroll into view, and that respect reduced-motion settings.
- **Result:** Lighthouse Performance 95+ on mobile. Source: Lighthouse report
- **X-Ray layers:**
  - UI: React, Tailwind CSS, GSAP
  - API: —
  - Data: —
  - Infra / hosting: TODO(content)
- **Effort (1–10):** 3
- **Media:** TODO(content)
- **Can the live site be shown in an iframe?** yes

### Anointed Financial PLC
_Live URL confirmed by the owner on 2026-10-20; merged with the afplc-connect repo block. The stack below is the old placeholder (WordPress) and the repo says React/TanStack; confirm which, then replace each [DEMO] value._
- **Slug:** anointed-plc
- **Featured:** no
- **Status:** live
- **Live URL:** https://anointedfinancialplc.com/
- **Repo URL:** https://github.com/mazunita237-netizen/afplc-connect
- **Built for:** [DEMO] client (Yaoundé)
- **Your role:** [DEMO] solo
- **Team size:** [DEMO] 1
- **Dates:** TODO(content)
- **Stack:** [DEMO] React, TypeScript, TanStack Start, Tailwind CSS, shadcn/ui (Radix), Lovable
- **Category:** web
- **Problem:** [DEMO] A Yaoundé company needed a professional bilingual (English/French) site it could update itself.
- **Hardest part:** [DEMO] Bilingual content without doubling the editing work.
- **Decision:** [DEMO] WordPress with a translation plugin and a short training session for the client.
- **Result:** [DEMO] Client updates the site without a developer. Source: client
- **X-Ray layers:**
  - UI: [DEMO] WordPress theme + Elementor
  - API: [DEMO] —
  - Data: [DEMO] WordPress (MySQL)
  - Infra / hosting: Hostinger
- **Effort (1–10):** [DEMO] 4
- **Media:** public/previews/anointed-plc.webp (captured by P3-02)
- **Can the live site be shown in an iframe?** TODO(content)

### [DEMO] WordPress Client Sites
- **Slug:** wordpress-sites
- **Featured:** no
- **Status:** live
- **Live URL:** TODO(content), list each site
- **Repo URL:** —
- **Built for:** freelance clients
- **Your role:** solo
- **Team size:** 1
- **Dates:** 2021 → present
- **Stack:** WordPress, WooCommerce, Elementor
- **Category:** web
- **Problem:** Small businesses in Buea needed affordable websites they could manage themselves.
- **Hardest part:** Keeping many client sites fast and secure after handover.
- **Decision:** A standard setup: caching, security hardening, automatic backups and updates.
- **Result:** Several business sites live and maintained. Source: owner (TODO(content): exact count)
- **X-Ray layers:**
  - UI: WordPress themes
  - API: —
  - Data: MySQL
  - Infra / hosting: Hostinger
- **Effort (1–10):** 5
- **Media:** TODO(content)
- **Can the live site be shown in an iframe?** TODO(content)

### Navora Global Freight
_Added 2026-10-15 from the GitHub repo list; fill in the details. GitHub: TypeScript, created 2026-10, last push 2026-10._ _Live URL confirmed by the owner on 2026-10-20._
- **Slug:** navoraglobalfreight
- **Featured:** no
- **Status:** live
- **Live URL:** https://navoraglobalfreight.com/
- **Repo URL:** https://github.com/ojrandy/navoraglobalfreight
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** [DEMO] React, TypeScript, Vite, Node.js, Express, Leaflet maps
_Stack read from the repo's package.json on 2026-10-15; confirm or edit, then remove [DEMO]._
- **Category:** web
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** public/previews/navoraglobalfreight.webp (captured by P3-02)
- **Can the live site be shown in an iframe?** 

### advancedGlobal
_Added 2026-10-15 from the GitHub repo list; fill in the name and details. GitHub: TypeScript, created 2026-10, last push 2026-10._
- **Slug:** advancedglobal
- **Featured:** no
- **Status:** 
- **Live URL:** 
- **Repo URL:** https://github.com/ojrandy/advancedGlobal
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** [DEMO] React, TypeScript, Vite, Node.js, Express, Leaflet maps
_Stack read from the repo's package.json on 2026-10-15; confirm or edit, then remove [DEMO]._
- **Category:** 
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** 
- **Can the live site be shown in an iframe?** 

### World Vexa Logistics
_Added 2026-10-15 from the GitHub repo list; fill in the details. GitHub: TypeScript, created 2026-10, last push 2026-10._ _Live URL confirmed by the owner on 2026-10-20._
- **Slug:** wvl
- **Featured:** no
- **Status:** live
- **Live URL:** https://worldvexalogistics.com/
- **Repo URL:** https://github.com/ojrandy/WVL
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** [DEMO] React, TypeScript, Vite, Node.js, Express, Leaflet maps
_Stack read from the repo's package.json on 2026-10-15; confirm or edit, then remove [DEMO]._
- **Category:** web
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** public/previews/wvl.webp (captured by P3-02)
- **Can the live site be shown in an iframe?** 

### coretexcore
_Added 2026-10-15 from the GitHub repo list; fill in the name and details. GitHub: no language detected, created 2026-07, last push 2026-07._
- **Slug:** coretexcore
- **Featured:** no
- **Status:** 
- **Live URL:** 
- **Repo URL:** https://github.com/ojrandy/coretexcore
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** 
- **Category:** 
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** 
- **Can the live site be shown in an iframe?** 

### food_app_website
_Added 2026-10-15 from the GitHub repo list; fill in the name and details. GitHub: TypeScript, created 2026-06, last push 2026-06. Repo description: "This is the official website for the Smart Meals mobile app." Related to the Smart Meal block?._
- **Slug:** food-app-website
- **Featured:** no
- **Status:** 
- **Live URL:** 
- **Repo URL:** https://github.com/ojrandy/food_app_website
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** [DEMO] Next.js, TypeScript, Tailwind CSS, Three.js (React Three Fiber), GSAP, Framer Motion
_Stack read from the repo's package.json on 2026-10-15; confirm or edit, then remove [DEMO]._
- **Category:** 
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** 
- **Can the live site be shown in an iframe?** 

### food_recipe2
_Added 2026-10-15 from the GitHub repo list; fill in the name and details. GitHub: Dart, created 2025-10, last push 2025-11. Repo description: "Food Recipe App. This create a dynamic page route with search functionalities"._
- **Slug:** food-recipe2
- **Featured:** no
- **Status:** 
- **Live URL:** 
- **Repo URL:** https://github.com/ojrandy/food_recipe2
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** [DEMO] Flutter, Dart
_Stack read from the repo's pubspec.yaml on 2026-10-15; confirm or edit, then remove [DEMO]._
- **Category:** 
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** 
- **Can the live site be shown in an iframe?** 

### expense-Tracker
_Added 2026-10-15 from the GitHub repo list; fill in the name and details. GitHub: Dart, created 2025-09, last push 2025-09._
- **Slug:** expense-tracker
- **Featured:** no
- **Status:** 
- **Live URL:** 
- **Repo URL:** https://github.com/ojrandy/expense-Tracker
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** [DEMO] Flutter, Dart
_Stack read from the repo's pubspec.yaml on 2026-10-15; confirm or edit, then remove [DEMO]._
- **Category:** 
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** 
- **Can the live site be shown in an iframe?** 

### threejs
_Added 2026-10-15 from the GitHub repo list; fill in the name and details. GitHub: JavaScript, created 2024-01, last push 2024-01._
- **Slug:** threejs
- **Featured:** no
- **Status:** 
- **Live URL:** 
- **Repo URL:** https://github.com/ojrandy/threejs
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** [DEMO] React, Three.js (React Three Fiber), Node.js, Express, MongoDB, OpenAI API
_Stack read from the repo's client/ and server/ package.json on 2026-10-15; confirm or edit, then remove [DEMO]._
- **Category:** 
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** 
- **Can the live site be shown in an iframe?** 

### polished-portfolio-pro
_Added 2026-10-15 from the GitHub repo list; fill in the name and details. GitHub: GitHub returns 404 (private, renamed or deleted), so no stats are shown and the repo is not linked._
- **Slug:** polished-portfolio-pro
- **Featured:** no
- **Status:** 
- **Live URL:** 
- **Repo URL:** https://github.com/mazunita237-netizen/polished-portfolio-pro
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** [DEMO] React, TypeScript, TanStack Start, Tailwind CSS, shadcn/ui (Radix), Lovable
_Stack read from the repo's package.json + README on 2026-10-15; confirm or edit, then remove [DEMO]._
- **Category:** 
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** 
- **Can the live site be shown in an iframe?** 

### iot-sentinelf
_Added 2026-10-15 from the GitHub repo list; fill in the name and details. GitHub: JavaScript, created 2026-05, last push 2026-06._
- **Slug:** iot-sentinelf
- **Featured:** no
- **Status:** 
- **Live URL:** 
- **Repo URL:** https://github.com/mazunita237-netizen/iot-sentinelf
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** [DEMO] Arduino (C++ firmware), MQTT, Node.js, Express, MongoDB, Socket.IO, React
_Stack read from the repo's firmware/, backend/ and frontend/ package.json on 2026-10-15; confirm or edit, then remove [DEMO]._
- **Category:** 
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** 
- **Can the live site be shown in an iframe?** 

### Nuvexa Global Transport
_Added 2026-10-15 from the GitHub repo list; fill in the details. GitHub: TypeScript, created 2026-10, last push 2026-10._ _Live URL confirmed by the owner on 2026-10-20._
- **Slug:** novatransport
- **Featured:** no
- **Status:** live
- **Live URL:** https://nuvexaglobaltransport.com/
- **Repo URL:** https://github.com/webspectron/novaTransport
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** [DEMO] React, TypeScript, Vite, Node.js, Express, Leaflet maps
_Stack read from the repo's package.json on 2026-10-15; confirm or edit, then remove [DEMO]._
- **Category:** web
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** public/previews/novatransport.webp (captured by P3-02)
- **Can the live site be shown in an iframe?** 

### novaF
_Added 2026-10-15 from the GitHub repo list; fill in the name and details. GitHub: TypeScript, created 2026-10, last push 2026-10._
- **Slug:** novaf
- **Featured:** no
- **Status:** 
- **Live URL:** 
- **Repo URL:** https://github.com/webspectron/novaF
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** [DEMO] React, TypeScript, Vite, Node.js, Express, Leaflet maps
_Stack read from the repo's package.json on 2026-10-15; confirm or edit, then remove [DEMO]._
- **Category:** 
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** 
- **Can the live site be shown in an iframe?** 

### worldL
_Added 2026-10-15 from the GitHub repo list; fill in the name and details. GitHub: TypeScript, created 2026-10, last push 2026-10._
- **Slug:** worldl
- **Featured:** no
- **Status:** 
- **Live URL:** 
- **Repo URL:** https://github.com/webspectron/worldL
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** [DEMO] React, TypeScript, Vite, Node.js, Express, Leaflet maps
_Stack read from the repo's package.json on 2026-10-15; confirm or edit, then remove [DEMO]._
- **Category:** 
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** 
- **Can the live site be shown in an iframe?** 

### Rebirth Labs
_Added 2026-10-20: live site confirmed by the owner; fill in the details._
- **Slug:** rebirth-labs
- **Featured:** no
- **Status:** live
- **Live URL:** https://rebirthlabs.org/
- **Repo URL:** 
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** 
- **Category:** web
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** public/previews/rebirth-labs.webp (captured by P3-02)
- **Can the live site be shown in an iframe?** 

### Global Sphere Autos
_Added 2026-10-20: live site confirmed by the owner; fill in the details._
- **Slug:** global-sphere-autos
- **Featured:** no
- **Status:** live
- **Live URL:** https://globalsphereautos.com/
- **Repo URL:** 
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** 
- **Category:** web
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** public/previews/global-sphere-autos.webp (captured by P3-02)
- **Can the live site be shown in an iframe?** 

### Queens Cargo
_Added 2026-10-20: live site confirmed by the owner; fill in the details._
- **Slug:** queens-cargo
- **Featured:** no
- **Status:** live
- **Live URL:** https://queenscargo.com/
- **Repo URL:** 
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** 
- **Category:** web
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** public/previews/queens-cargo.webp (captured by P3-02)
- **Can the live site be shown in an iframe?** 

### HandyMan Do IT
_Added 2026-10-20: live site confirmed by the owner; fill in the details._
- **Slug:** handyman-do-it
- **Featured:** no
- **Status:** live
- **Live URL:** https://app.handymandoit.com/
- **Repo URL:** 
- **Built for:** 
- **Your role:** 
- **Team size:** 
- **Dates:** 
- **Stack:** 
- **Category:** web
- **Problem:** 
- **Hardest part:** 
- **Decision:** 
- **Result:** 
- **X-Ray layers:**
  - UI: 
  - API: 
  - Data: 
  - Infra / hosting: 
- **Effort (1–10):** 
- **Media:** public/previews/handyman-do-it.webp (captured by P3-02)
- **Can the live site be shown in an iframe?** 

---

## 4. Teaching (School district)
_One line per course or talk: `- **Title** · venue · audience: … · date: … · link: …`_
- **Introduction to Programming (JavaScript)** · Trustech University Institute of Buea (TUIB) · audience: first-year students · date: TODO(content) → present
- **Web Development (HTML, CSS, React)** · TUIB · audience: second-year students · date: TODO(content) → present
- **Database Systems (SQL)** · TUIB · audience: second-year students · date: TODO(content) → present
- **Networking & IT Support basics** · TUIB · audience: IT diploma students · date: TODO(content)

## 5. Video work (Cinema district)
_One line per video: `- **Title**: link · what you did: … · tools: …`_
- [DEMO] **YouTube channel**: https://www.youtube.com/@ojongrandy2580 · what you did: filming and editing · tools: Premiere Pro, CapCut
- [DEMO] **Showreel 2026**: TODO(content) · what you did: edit, colour, sound · tools: Premiere Pro
- [DEMO] **Event highlight film**: TODO(content) · what you did: edit, motion titles · tools: Premiere Pro, CapCut
- [DEMO] **Product promo for a client**: TODO(content) · what you did: script and edit · tools: CapCut

## 6. Testimonials (only with permission)
- **Quote:** Ojong Randy Provides exxeptional services. He uses Tactile teaching methods to ensure every student in class understand and get the best out of themselves at all times
  - **Name, role, company:**
  - **Link (LinkedIn):**
  - **Permission confirmed:** yes / no
- **Quote:** [DEMO] "<What the client asked for, what Ojong delivered, and the result for their business, in their own words.>"
  - **Name, role, company:** [DEMO] <Name>, Owner, SNS Glam Hair & Makeup Studio
  - **Link (LinkedIn):** 
  - **Permission confirmed:** no
- **Quote:** [DEMO] "<What it was like to work with Ojong as a teammate: reliability, code quality, communication.>"
  - **Name, role, company:** [DEMO] <Name>, <role>, Web Spectron Ltd
  - **Link (LinkedIn):** 
  - **Permission confirmed:** no

## 7. Real numbers you want shown
_Each needs a source. `auto` = calculated by the site from the named source._
| Stat | Value | Source |
|---|---|---|
| Projects shipped | 100 | TODO(content) |
| Users served | 100 | TODO(content) |
| [DEMO] Years coding | 5+ | owner (start year: TODO(content)) |
| [DEMO] Public repos | auto | GitHub API (P1-01) |
| [DEMO] Projects in OJ City | auto | count of section 3 |
| [DEMO] Courses taught | auto | count of section 4 |

## 8. Tools & clients (replaces the logo marquee)
- Tools you actually use: Best with IDEs like VScode, Webstorm. Am a JS person but am willing and always available to learn new language inorder to complete a task 
  - [DEMO] Languages & frameworks: JavaScript, React, Next.js, React Native, Three.js, Flutter, Node.js, PHP
  - [DEMO] Design & media: Figma, Adobe XD, Premiere Pro, CapCut
  - [DEMO] Hosting & tools: Git/GitHub, Hostinger, WordPress, VS Code, WebStorm
- Clients/companies you've worked with (and permission to show their logo):  Yes you have persions to use their logo. 
 1: have worked with WebSpectron LTD Buea. 
 2. Teaching at Trustech University Buea 
 3. Work at Bethuel Tech Buea
 4. Work for a client in yaounde (Anionted PLC)

## 9. FAQ for the AI guide
_Questions clients/recruiters often ask, with your answers: `- **Q:** question? **A:** answer`_
- **Q:** What's your rate / how do you price? **A: Simple website can start from 75,000FCFA, A Complex Webapp can range from 150-500K FCFA based  on the type, Also Mobile Apps too prices ranges**
- **Q:** What's your availability / notice period? **Am Available 24/7. I may delay to reply you but will always withing hours**
- **Q:** Do you work with international clients / time zones? **I Work with all times of clients both local and internations**
- **Q:** What don't you do? **I don't start work without a 50% initail deposit**
- **Q:** [DEMO] How do you handle security? **A: [DEMO] I never trust input from the browser: every form and API is validated on the server, secrets stay on the server, and sites ship over HTTPS.**
- **Q:** [DEMO] What happens after launch? **A: [DEMO] TODO(content): support period, maintenance pricing, handover.**
