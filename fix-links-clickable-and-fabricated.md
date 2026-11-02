# Sitewise — Fix: Links Not Clickable + AI Still Inventing URLs + Unstructured Text

Three separate bugs, three separate fixes. Confirmed by checking the actual response you got: at least 2 of the 3 URLs the AI provided are fabricated/wrong (verified below), so both link fixes are needed, not just one — plus a structure fix for the confusing/bloated text generation.

---

## Bug 1: Links render as plain text, not clickable

**Cause:** your chat message rendering code is almost certainly inserting the AI's response as plain text (`element.textContent = response` or equivalent), which displays markdown link syntax literally instead of converting it to an actual `<a>` tag.

**Fix — add a small markdown-link-to-HTML converter in `js/buying-assistant.js`, applied to every AI message before it's inserted into the DOM:**

```js
function renderMessageContent(rawText) {
  // Escape HTML first to prevent injection from the raw text
  const escaped = rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convert markdown-style [text](url) into real clickable links
  const withMarkdownLinks = escaped.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Also catch any bare URLs the AI outputs without markdown formatting
  const withBareLinks = withMarkdownLinks.replace(
    /(^|[^"'>])(https?:\/\/[^\s<]+)/g,
    '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
  );

  // Convert line breaks to actual breaks for readability
  return withBareLinks.replace(/\n/g, '<br>');
}

// Use this wherever you currently insert an assistant message:
messageElement.innerHTML = renderMessageContent(aiResponseText);
```

Use `innerHTML` here (not `textContent`) specifically because you now want the `<a>` tags to actually render as links — the escaping step above protects against the raw text itself containing injected HTML/script tags, so this stays safe.

---

## Bug 2: The AI is still inventing URLs (confirmed, not suspected)

I checked the actual links from your last test response:
- **"Federal Ministry of Works and Housing" → `ministryofworks.gov.ng`** — WRONG. The real site is `fmw.gov.ng`. This exact domain doesn't appear to be the ministry's actual address.
- **"Nigerian Building Code (NBCC)" → `nigerianbuildingcode.org`** — no evidence this is a real official site. The actual National Building Code document is hosted as a government PDF, not at that domain.
- **"NIPC" → `nipc.gov.ng`** — NIPC is a real agency, but it handles investment promotion, not building permits — irrelevant to this guide regardless of whether the URL itself is correct.

This confirms guardrail rule 13 (only use links from the provided list, never construct your own) is not being followed — same root problem as the earlier price/listing fabrication, just showing up as invented URLs now.

### Fix A — reinforce rule 13 in the reminder block (same sandwich technique as before)

Add this line to the "REMINDER BEFORE YOU RESPOND" block that sits right before the user's message in every request:
```
- You will ONLY include a link if it appears character-for-character in the
  USEFUL LINKS section of your guide content below. You will NOT state any
  other URL, government site, or organization website from memory or by
  guessing a plausible domain name — not even ones you believe are real.
  If no relevant link exists in your provided list, say so plainly instead
  of providing one.
```

### Fix B — expand the actual verified link list so the AI has real options instead of feeling it needs to guess

Two more real ones, verified just now (not from memory):

```
USEFUL LINKS — Nigeria (Build a House)
- Lagos State Lands Bureau (title/land verification): https://landsbureau.lagosstate.gov.ng/
- National Building Code of Nigeria 2006 (official government-hosted document): http://www.epp.lagosstate.gov.ng/regulations/National_Building_Code_of_Nigeria_2006.pdf
```

Add these to `guide-build-house-nigeria.md`'s USEFUL LINKS section, replacing whatever was there before. Every additional link you want to add later must go through this same process — search for it, confirm the exact working URL yourself, and only then add it verbatim to the guide file. Never add a link because it "sounds like it should exist."

### Fix C — verify the fix actually works

Re-ask the same question ("give me resources for building a house in Nigeria") after both changes. Every link in the response must exactly match a URL from the guide file's USEFUL LINKS list, character for character. If a new/different URL appears that isn't in your list, the reminder block still isn't being respected — at that point, drop the temperature further (0.1-0.2) for this specific type of query, or consider validating links server-side too: after getting the AI's response, regex-extract any URLs and check each one against your known-good list before allowing the message through — same pattern as the price/listing validation layer from before, just checking URLs instead of numbers.

---

## Bug 3: AI's text generation is unstructured and confusing to read

An earlier fix (formatting rule 12 in `guardrails.md`) already asked for short, plain responses with minimal decoration. If it's still coming out confusing/unstructured, the same underlying issue applies as the other two bugs: an instruction stated once, early in a long system prompt, isn't being followed reliably — it needs reinforcement in the reminder block, plus a stricter, more literal template instead of a general style preference.

### Fix A — replace the vague style rule with an explicit, enforced structure

General instructions like "keep it short" leave too much room for the model to fall back on its default habits (headers, tables, multiple sections). Give it an actual template to fill in instead:

**Update `guardrails.md` rule 12 to this:**
```
12. RESPONSE STRUCTURE — follow this shape for every response, do not deviate:
    a. One short opening sentence directly addressing what the user asked.
    b. If listing rules or red flags: a plain bullet list, each bullet one
       line, no sub-bullets, no bold text inside bullets, maximum 5 bullets.
       Use a single short header ("Rules to follow:" or "Watch out for:")
       only if you are listing more than one category in the same response.
    c. One short closing sentence — a direct next step or the required
       disclaimer (per rule 8), not a summary of what you just said.
    d. Total response length: aim for under 120 words unless the user
       explicitly asks for a detailed/comprehensive explanation.
    NEVER use: tables, emoji, numbered section headers, horizontal rule
    dividers ("---"), multiple bold headers, or more than one blank-line
    section break. If you notice yourself building a multi-section document,
    stop and compress it into the shape above instead.
```

### Fix B — add the same rule to the reminder block, in short imperative form

```
- Structure your response as: one opening sentence, a short plain bullet
  list if needed (max 5 bullets, no sub-bullets, no bold inside bullets),
  one closing sentence. No tables, no headers, no emoji, no "---" dividers.
  Keep it under 120 words unless the user explicitly asked for something
  comprehensive.
```

### Fix C — verify

Ask the same three test questions again (buy/build/land). Check specifically: no more than one short list per response, no headers unless genuinely more than one category is being listed, response is noticeably shorter than earlier tests, and reads like a direct answer rather than a formatted report. If it's still bloated after this, lower temperature further (as in Bug 2's fallback) — verbose, over-structured output is a related symptom to the same "model defaulting to its most common training pattern instead of following instructions" issue seen in the other two bugs, so the same escalation path applies.

