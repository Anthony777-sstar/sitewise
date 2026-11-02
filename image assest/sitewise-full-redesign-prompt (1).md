# Sitewise — Full Site Redesign Prompt

Applies everywhere: landing page, auth screens, Module 1 dashboard, Module 2 chat. One consistent visual language throughout, with intensity scaled per screen based on what that screen needs to do — a data-heavy dashboard and a marketing hero shouldn't move the same amount, but they should clearly look like the same product.

---

## 1. Shared foundation — applies to every screen, no exceptions

- **Color tokens**: the existing dark palette (`--bg: #12181F`, `--surface: #1A2029`, `--text-primary: #E8E6DF`, `--accent: #F2A93B`, softened risk colors) — unchanged, this is the constant across the whole site.
- **Typography**: Space Grotesk / Inter / IBM Plex Mono — unchanged everywhere.
- **New shared visual element — the glow orb**: a soft, blurred amber-to-navy radial gradient. This becomes the site's signature ambient background element, appearing (at different sizes/opacities) behind key moments on every screen, not just the landing hero: behind the auth card, behind the dashboard's overall risk score card, behind the chat's empty state. Same visual DNA, different scale.
- **Glass-morphism cards**: dark, semi-transparent, blurred-backdrop cards (`backdrop-filter: blur(...)`, translucent `var(--surface)`) become the standard card treatment site-wide, replacing the current flat opaque cards — task cards, stat cards, message bubbles, the auth form, all get this treatment.
- **Idle float animation**: a small, slow, continuous up-down motion (a few pixels, several seconds per cycle) applied to key focal elements on every screen — not just landing's stat cards, but also the dashboard's overall-score card and the chat's active-conversation badge. Subtle, ambient, never distracting.
- **`prefers-reduced-motion` fallback**: required everywhere, no exceptions — every animated element on every screen needs a static fallback.

---

## 2. Landing page — full intensity (as previously scoped)

Glow orb hero centerpiece, floating glass stat cards, orbiting ring elements with module icons, GSAP + ScrollTrigger parallax and section-reveal animations, codebase-aware copy, scroll-spy navigation, repeated CTA. (Full detail already written — carry forward from the landing page prompt, unchanged.)

---

## 3. Auth screens (Sign Up / Log In) — medium intensity

- Glow orb behind the auth card, smaller and more subdued than the landing hero version — enough to feel like the same world, not competing with the form.
- Auth card gets the glass-morphism treatment (blurred, translucent, `var(--surface)`) instead of the current flat white/dark card.
- Form field focus states keep the amber glow ring already established.
- No scroll effects needed — this is a short, single-viewport screen. Keep motion to: card fade/scale-in on load, button hover lift, spinner on submit (already exists) — nothing more.
- The mode-switch between Sign Up and Log In (already built) gets a smooth crossfade/height transition instead of an instant content swap.

---

## 4. Module 1 — Dashboard

**What changes:**
- Overall project score card gets the glow-orb-behind-it treatment and the glass-morphism surface — this is the dashboard's single "hero" moment, treated with the same visual weight as the landing page's centerpiece.
- Task cards move to the glass-morphism style, replacing the current flat cards.
- The blueprint dimension-line dependency connectors (existing signature element) stay exactly as designed — don't replace this, it's already the dashboard's distinctive feature. The glow/glass treatment wraps around it, doesn't compete with it.
- Filter chips, risk badges: keep current design, just re-verify contrast against the new glass card backgrounds (translucent cards behind colored badges can reduce contrast — test this specifically, adjust badge background opacity if needed).

**What does NOT change:**
- No GSAP scroll parallax on the task board itself — a PM scanning risk data needs it to hold still and be scannable, not drift or fade as they scroll. Reserve scroll-triggered motion for one thing only: a gentle fade-up when the dashboard first loads (task cards entering, which already exists) — nothing tied to ongoing scroll position while reading data.
- No orbiting ring decoration on the dashboard — that's a landing-page-specific marketing element, it would look out of place next to real data.

---

## 5. Module 2 — Buying Assistant (chat)

**What changes:**
- The intent-selection modal (Buy/Build/Land) gets a glow orb behind it and the glass-morphism card treatment — this is chat's equivalent "entry moment" to the dashboard's score card.
- Message bubbles (both user and assistant) move to the glass-morphism surface style.
- The empty-state (before any messages) gets a subtle glow orb in the background — quiet, ambient, not distracting from the eventual conversation.
- The location/intent badge near the text box (from the earlier update) keeps its pill shape but gets the glass treatment.

**What does NOT change:**
- No parallax or scroll-triggered animation inside the message thread itself — chat needs to feel calm and readable (this was the explicit "comfortable" goal from earlier), motion tied to scrolling through a conversation would undermine that.
- Idle float animation stays extremely subtle here, if used at all — err toward stillness in this screen more than any other, since long reading sessions are the whole point of it.

---

## 6. Codebase-aware copy — applies everywhere, not just landing

Every piece of UI copy across every screen — dashboard empty states, chat's intent-modal descriptions, auth screen subtext, error messages — should be written after actually reading the project's guide files, SQL schema, and build notes, grounded in what Sitewise actually does. No generic SaaS placeholder text anywhere in the app, not just the landing page.

---

## 7. Navigation — applies everywhere

- Floating pill navbar (existing) gets the glass-morphism treatment applied consistently, present on every screen including inside the dashboard and chat views, not just pre-login.
- Scroll-spy active states apply on the landing page (multi-section scroll); dashboard and chat don't need this since they're not long single-page scrolls — their "navigation" is the module switcher (Dashboard / Buying Assistant) in the navbar, which should always clearly show which module you're currently in (active-state styling, same amber underline pattern).
- Mobile drawer (existing) gets the glass-morphism treatment, consistent with everything else.

---

## Build order for the full redesign
1. Establish the shared foundation first (section 1) as CSS variables/utility classes — glow orb component, glass-card class, idle-float class — reusable across every screen, built once.
2. Apply to landing page (section 2) — full intensity, as previously scoped.
3. Apply to auth screens (section 3) — quick, reuses the same components at lower intensity.
4. Apply to dashboard (section 4) — glass cards + hero glow on the score card, explicitly skip scroll-parallax here.
5. Apply to chat (section 5) — glass bubbles + modal glow, explicitly skip motion inside the message thread.
6. Rewrite copy site-wide (section 6) after the actual app structure is stable — don't write final copy before the layout is settled, you'll just rewrite it again.
7. Confirm `prefers-reduced-motion` fallback on every screen, not just landing.
8. Test contrast/readability of risk badges and message text against the new translucent glass backgrounds specifically — this is the most likely place for a real usability regression to sneak in.
