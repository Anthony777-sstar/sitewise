# SITEWISE — AI BUILD PROMPT

Copy everything below into your AI code generator (Claude, GPT, etc).

---

## PROJECT OVERVIEW

Build **Sitewise**, a construction project risk assessment SaaS web application. It must look and feel like a premium fintech/SaaS product — think Stripe, Linear, Vercel, Mercury Bank — NOT a generic Bootstrap admin template. Blueprint/technical-drawing motifs should be woven into the visual identity subtly (grid lines, schematic accents, engineering-precision feel), but the overall execution must feel modern, expensive, and trustworthy — like software a construction firm would pay real money for.

**Absolutely no pricing pages, pricing tables, or pricing mentions anywhere in the UI.**

**Stack constraints — follow exactly:**
- Frontend: plain HTML, CSS, JavaScript only. No React, no TypeScript, no frontend frameworks or build tools.
- Backend: plain Java using only the built-in JDK (`com.sun.net.httpserver.HttpServer` and `java.net.http.HttpClient`). NO Spring Boot, NO Maven, NO Gradle, NO external jar dependencies of any kind. Everything must compile with a bare `javac` and run with `java`.
- Database/Auth: Supabase (Postgres + Supabase Auth + REST API), called directly from frontend JS using the Supabase JS client via CDN — do NOT route auth or data reads/writes through the Java backend.
- AI: Groq API (Llama 3.3 70B) called from the Java backend only, never exposed client-side.
- PDF export: jsPDF (CDN), generated client-side.

---

## JAVA BACKEND — SCOPE (KEEP MINIMAL AND FOCUSED)

Java's ONLY job is:
1. `RiskScorer.java` — a deterministic, weighted risk-scoring algorithm (pure math/logic, no libraries). Takes rated risk factors (budget, timeline, safety, resource availability, each 1–10) and returns a 0–100 score plus a LOW/MEDIUM/HIGH label.
2. `GroqClient.java` — calls the Groq API via `java.net.http.HttpClient` to generate a natural-language executive summary explaining the score. The AI never determines the score itself, only narrates it.
3. `Main.java` — a `com.sun.net.httpserver.HttpServer` exposing one POST endpoint (e.g. `/api/assess`) that accepts risk factor JSON, runs RiskScorer, passes the result to GroqClient, and returns combined JSON. Must include CORS headers (`Access-Control-Allow-Origin: *` etc.) since frontend runs on a different port via Live Server.
4. Manual JSON parsing/building with plain String logic — no Gson, no Jackson, no external JSON library.

Do not add any other responsibility to Java. All data persistence, auth, and history are handled by Supabase directly from JS.

---

## VISUAL DIRECTION

**Overall feel:** premium fintech SaaS dashboard. Confident whitespace, restrained color, sharp typography, subtle motion. Should feel calm and precise, not busy or "gamer dashboard."

**Color palette (define as CSS variables):**
- Deep ink navy/near-black background for dark sections: `#0A0E14` or similar
- Clean off-white/paper background for light sections: `#FAFAF8`
- One confident accent color — electric blue or amber — used sparingly for CTAs, active states, and data highlights only
- Muted grid-line gray for blueprint accents: low-opacity lines, never dominant
- Risk level colors: calm green (low), amber (medium), muted red (high) — desaturated, not alarm-red

**Typography:**
- A geometric or grotesk sans-serif for UI (e.g. Inter, Söhne-style, General Sans via Google Fonts/CDN)
- Optional monospace accent font for data/numbers/scores (e.g. JetBrains Mono) to reinforce technical precision
- Strong type hierarchy: large confident headlines, tight tracking on labels/uppercase micro-text

**Blueprint motifs (subtle, not literal):**
- Faint grid-paper background texture behind hero/landing sections only
- Thin schematic corner brackets or crosshair accents on cards
- Dashed connector lines between related data points
- Never full literal blueprint-blue-and-white CAD styling — that's too on-the-nose

**Required on every page:**
- Floating pill/capsule navbar: dark charcoal background (rgba ~20,20,20,0.85), backdrop-filter blur, border-radius 50px+, fixed and centered. Desktop: logo + accent dot centered, nav links split left/right, active link shown as accent-colored pill. Mobile: logo left, hamburger right, links slide in from right as a full-height glass drawer (rgba(20,20,20,0.85), backdrop-blur 24px, links centered/uppercase/bold/letter-spaced, cubic-bezier(0.16,1,0.3,1) 0.8s transition, pointer-events:none when closed).

---

## PAGE-BY-PAGE BREAKDOWN

### 1. Landing Page (public, pre-auth)
- Hero section: bold headline about eliminating construction project risk blind spots, subheadline, single strong CTA ("Get Started" / "Sign Up") — no pricing, no "free trial" badges
- Subtle animated blueprint-grid background or schematic line illustration in hero
- Feature section: 3–4 cards explaining risk scoring, AI executive summaries, and project tracking — icon + short copy each, arranged with generous whitespace
- Social proof or "built for construction teams" section — can be tasteful placeholder copy
- Footer: minimal, dark, logo + a few links

### 2. Auth (Sign Up / Log In)
- Centered card on the dark ink background with the grid texture behind it
- Supabase Auth (email/password to start — magic link optional)
- Clean form, generous spacing, subtle focus-glow on inputs using the accent color
- Smooth transition/redirect into the app shell on success

### 3. App Shell — Post-Login (THIS IS THE KEY PART)

After signup/login, users land in a **ChatGPT/Claude-style interface**, not a traditional form-heavy dashboard. Structure:

**Left sidebar (collapsible):**
- Logo/mark at top
- "New Assessment" button (prominent, accent-colored)
- Scrollable list of past risk assessments/conversations, grouped like chat history (e.g. "Today", "Previous 7 Days", "Earlier") — each item shows project name + truncated preview, pulled live from Supabase, clickable to reload that session
- User account menu pinned at bottom (avatar, name/email from Supabase Auth, logout)

**Main panel:**
- When no assessment is selected: centered empty state — logo mark, headline like "Assess your next project", and a large centered input area, echoing the ChatGPT "start typing" first-load feel
- Input area: instead of freeform chat text, present a clean structured form styled to feel conversational — project name, and sliders or segmented controls (1–10) for each risk factor (budget, timeline, safety, resource availability), styled with the accent color, smooth drag interaction
- On submit: show a subtle "thinking" state (skeleton loader or animated dots, consistent with the blueprint-grid theme — e.g. grid lines pulsing) while the request goes to the Java backend
- Response renders like a chat message from the assistant: a results card containing the numeric score (large, monospace font), a colored risk-level badge (LOW/MEDIUM/HIGH), a breakdown of each factor's contribution (small bar or radial indicators), and the AI-generated executive summary as readable prose below
- "Export PDF" button on each result card, using jsPDF to generate a clean report client-side
- Each submitted assessment + its result is saved to Supabase tied to the user's ID, and appears in the left sidebar history immediately

**Top bar within app shell:**
- Minimal — current project/assessment title, maybe a share or export icon, avoids clutter

---

## INTERACTION DETAIL REQUIREMENTS

- Smooth micro-interactions throughout: button hover states with slight scale/glow, card entrance animations (fade + slight rise), sidebar item hover highlighting
- Loading states must never be a plain spinner — use skeleton shapes or the blueprint-grid pulse motif to stay on-brand
- Score reveal should feel satisfying: animate the number counting up, animate the risk badge color in, stagger the breakdown bars filling in
- All transitions use smooth cubic-bezier easing, nothing jarring or default-linear

---

## TECHNICAL NOTES FOR THE AI BUILDING THIS

- Use real Unsplash image URLs where photography is needed (construction sites, teams on site) — no placeholder gray boxes, no SVG illustrations, no emoji
- Fully responsive: sidebar collapses to an overlay drawer on mobile, input area and cards stack cleanly
- Structure Supabase calls in a single `supabase-client.js` file: handle auth, and CRUD for assessments/history table
- Structure the fetch call to the Java backend in a single `api.js` file pointing to `http://localhost:8080/api/assess`
- Keep all files plain and readable — no bundler, no build step, everything runs by opening `index.html` via Live Server alongside the running Java process

---

## DELIVERABLE

Single cohesive HTML/CSS/JS frontend (multiple files is fine: index.html, app.html or single-page with view-swapping, styles.css, app.js, supabase-client.js, api.js) plus the three Java files (Main.java, RiskScorer.java, GroqClient.java). Prioritize visual polish and the chat-style post-login experience above all else — this needs to look like something that could genuinely launch as a SaaS product, not a student project.


anon key   = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxanBwdmpvc29tdHBoaHFreHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODU3NjQsImV4cCI6MjA5ODU2MTc2NH0.kFxQJafEC-xripN3ZaWbB_Yh3jzQ3Tc3cav0RZOrTyE

project url = https://bqjppvjosomtphhqkxug.supabase.co

grok =  <set GROQ_API_KEY in the environment — never commit the key>
