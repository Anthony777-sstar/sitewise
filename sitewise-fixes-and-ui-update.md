# Sitewise — Fix & Update Prompt

Three things to fix/add. Read all three before touching code — the first one is a bug fix, not a feature.

---

## 1. BUG FIX: AI isn't recognizing intent_type context

**Symptom:** After selecting Buy a house / Build a house / Buy land, asking the AI "do you know what I want to do here?" fails to reflect the selected intent.

**Root cause:** the system prompt is very likely NOT being rebuilt fresh on every single request. This is the most common mistake with LLM APIs — treating the conversation as if the model "remembers" earlier context on its own. It doesn't. Every request to Groq/DeepSeek is stateless; if the intent isn't explicitly re-included in the system prompt on THIS specific request, the model has no way to know it.

**Required fix — apply this exactly:**

On every single call to `POST /api/buying-conversations/{id}/messages`, before calling Groq/DeepSeek, the backend MUST:

1. Look up the conversation's `intent_type` from the `buying_conversations` table (not from the frontend request body — always re-fetch from the database so it can't be spoofed or drift).
2. Load `guardrails.md` (already in memory from startup).
3. Load the ONE guide file matching `intent_type` (already in memory from startup).
4. Build the system prompt as a concatenation, with the intent explicitly and unambiguously stated at the top, e.g.:

```
The user has already indicated they are interested in: BUILDING A HOUSE.
Do not ask them what they're looking to do — you already know. Reference this
intent naturally when relevant, and if the user asks whether you know their
intent, confirm it directly using the phrase they selected (e.g. "building a house").

{contents of guardrails.md}

{contents of guide-build-house.md}
```

5. Append the full conversation history for this thread (all prior `buying_messages` rows, in order, mapped to `role: user`/`role: assistant`).
6. Append the new user message last.
7. Send this ENTIRE assembled array as the request to Groq/DeepSeek — not just the new message, not just the system prompt without history, all of it, every time.

**Verify the fix:** after implementing, test by opening a new "Build a house" conversation and, as literally the first message, ask "what am I looking to do here?" The AI's response must directly state the selected intent without hedging or asking. If it doesn't, the system prompt assembly step above is not actually running before the API call — check that `BuyingAssistantPromptService` is being invoked in the message-send code path, not bypassed.

---

## 2. UI UPDATE: Dark, comfortable color palette

Replace the current light Paper/Navy palette with this dark scheme across both Module 1 (dashboard) and Module 2 (chat). Apply as CSS custom properties so the switch is centralized, not scattered across files.

```css
:root {
  --bg: #12181F;           /* near-black slate base, not pure black */
  --surface: #1A2029;      /* cards/panels, lifted slightly off bg */
  --border: rgba(255,255,255,0.08);   /* faint hairlines only */
  --text-primary: #E8E6DF;  /* warm off-white, not pure white */
  --text-secondary: #8B95A3; /* muted slate-blue-grey */

  --accent: #F2A93B;         /* Hazard Amber — unchanged, signature color */
  --accent-soft: rgba(242,169,59,0.16);

  --risk-critical: #E85D5D;   /* softened red for dark backgrounds */
  --risk-high: #D89544;
  --risk-medium: #C9A227;
  --risk-low: #6FA37D;        /* softened green */
}
```

**Application notes:**
- Body background: `var(--bg)`. The faint blueprint grid lines (from the original design) flip to very low-opacity light lines instead of navy-on-paper — barely visible, texture not decoration: `rgba(255,255,255,0.03)` grid lines.
- Task cards, chat bubbles, the auth card, the navbar's frosted panel: `var(--surface)` with `var(--border)`.
- Risk badges use the softened risk colors above at low background opacity (e.g. `rgba(232,93,93,0.14)` background with `var(--risk-critical)` text) — same pattern as before, just recalibrated so they don't look like warning lights against a dark backdrop.
- Navbar pill stays dark (`rgba(20,20,20,0.9)`) — it was already dark in the light-mode version, so it barely changes, just slightly more opaque against the new dark page background so it still reads as a distinct floating element.
- Chat view (Module 2) specifically should feel the warmest/most comfortable of all views — this is where "dark comfortable vibe" matters most, since it's the longest-dwell-time screen. Slightly larger line-height on message text (1.7 instead of 1.6), slightly more generous padding inside message bubbles than the dashboard's tighter card padding.
- Respect `prefers-reduced-motion` as before — unrelated to this color change but don't drop it while touching these files.

Do not touch the Space Grotesk / Inter / IBM Plex Mono typography system or the blueprint dimension-line connector concept — only the color values change.

---

## 3. CLARIFICATION: What actually gets sent when a PDF is attached

**Requirement:** when a user attaches a PDF to a message, only the user's typed message text plus the PDF's extracted text goes to the AI provider (Groq/DeepSeek). The raw PDF file itself is never uploaded to or sent through the AI API.

**Correct flow (confirm this is what's implemented, fix if not):**

1. User selects a PDF file in the chat UI and types a message, hits send.
2. Frontend sends a multipart request to `POST /api/buying-conversations/{id}/messages` containing the message text + the raw PDF file.
3. Backend saves the raw PDF bytes to **Supabase Storage** (not the database, not sent anywhere else) and records the `storage_path` in `buying_pdf_attachments`.
4. Backend runs `PdfExtractionService` (Apache PDFBox) on the raw bytes to pull out plain text, and saves that into `buying_pdf_attachments.extracted_text`.
5. When `BuyingAssistantPromptService` assembles the request to send to Groq/DeepSeek, it includes the user's message text AND the `extracted_text` from the attachment as part of the prompt content — as plain text in the request body.
6. **The raw PDF file/bytes are never included in the Groq/DeepSeek API call.** Only extracted text ever leaves your server toward the AI provider. The original file stays in Supabase Storage, retrievable later if the user wants to re-view what they uploaded, but it has no further role in how the AI generates its answer.

This matters for two reasons: Groq's chat completion endpoint doesn't accept raw PDF uploads in the first place (it's a text API), and even if it did, sending the full raw document to a third-party API when you only need the answer to a specific question is unnecessary data exposure. Extract once server-side, reuse the text for every subsequent question in that conversation without re-uploading or re-extracting.
