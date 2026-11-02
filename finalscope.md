# Sitewise — Final Scope: Rules Guidance + Materials + Clean Formatting

## Scope change — confirmed

**Dropped entirely:** RentCast, Homesage.ai, any live listings pull, any location-toggle-triggers-an-API-call feature. Not "later," not "if time allows" — out of scope. The location selector (USA/UK/Nigeria) stays, but its only job now is picking which country's rules/materials content the AI uses — no external API calls tied to it anymore.

**The module now does exactly one thing per intent + country combination:** tells the user the rules to follow, the rules/mistakes to avoid, and (for Build a House specifically) general material and sourcing guidance. Nothing else. This is a much smaller, much more defensible surface than what we were building toward.

---

## 1. Response structure — what the AI should actually output

Every response in this module should read like a knowledgeable person answering directly, not a formatted report. Add this to `guardrails.md` as new formatting rules:

```
12. FORMATTING: Keep responses short and direct. Default to plain sentences and
    short paragraphs. Use a bullet list only when listing 3+ discrete items, and
    keep each bullet to one line where possible. Do NOT use tables unless the
    user explicitly asks to compare multiple items side by side. Do NOT use
    emoji, ever. Do NOT use numbered section headers with decorative symbols
    (no "1️⃣", no "---" dividers, no bold section titles for a short answer).
    A typical response should be 2-4 short paragraphs or a short list — not a
    multi-section document. If the user's question is simple, answer in 2-3
    sentences. Reserve longer structured answers only for when the user asks
    for something genuinely comprehensive (e.g. "walk me through the whole
    process").
```

This directly targets the wall-of-text, fake-report-style responses seen earlier (heavy markdown tables, emoji headers, multiple decorative sections for a simple question). Combined with the earlier fabrication fixes, this should make responses both more accurate and much easier to actually read.

---

## 2. Rebuilt guide files — Rules to follow / Rules to avoid

Restructure each of the 9 files (`guide-{intent}-{country}.md`) around this simple two-part shape instead of the longer prose format from before:

**Template:**
```
RULES TO FOLLOW — {Intent} in {Country}
- [short, direct rule]
- [short, direct rule]
...

RULES TO AVOID / RED FLAGS — {Intent} in {Country}
- [short, direct warning]
- [short, direct warning]
...
```

**Example — `guide-buy-house-nigeria.md`:**
```
RULES TO FOLLOW — Buying a House in Nigeria
- Verify title at the State Land Registry before any payment — this is the single most important step.
- Confirm whether the property has a Certificate of Occupancy or valid Governor's Consent.
- Hire a lawyer independent of the seller/agent to review all documents.
- Physically verify boundaries match the survey plan.

RULES TO AVOID / RED FLAGS — Buying a House in Nigeria
- Don't pay before title verification is complete, regardless of urgency pressure.
- Avoid land sold as family/communal property without individual title.
- Be cautious of prices significantly below market with urgency framing.
- Don't rely solely on an agent's word for title status — verify independently.
```

Apply this same short, direct format across all 9 files, carrying over the actual content from the earlier draft (section 7 of the main build prompt / the updates file) — just restructured into this tighter Rules/Red Flags shape instead of paragraphs.

---

## 3. New: Materials guidance (Build a House branch only)

Add a third section to the three `guide-build-house-{country}.md` files specifically — general, non-numeric, no fabricated prices (this still follows guardrails rule 3 from before: no specific price figures, ever).

**`guide-build-house-usa.md` — materials section:**
```
MATERIALS — Typical for USA Residential Construction
- Framing: wood/timber framing is standard for most single-family homes.
- Foundation: poured concrete or concrete block, depending on region and soil.
- Roofing: asphalt shingles are most common; material choice affects insulation needs.
- Insulation: type and required R-value depends on climate zone — colder regions need higher-rated insulation.
- Exterior: vinyl siding, brick veneer, or fiber cement siding are common options.

WHERE TO SOURCE — USA
- Large hardware/building supply chains (Home Depot, Lowe's) for general materials.
- Local lumber yards and building material suppliers often have better pricing and selection for bulk/framing materials.
- A general contractor typically sources specialty materials through their own supplier relationships.
```

**`guide-build-house-uk.md` — materials section:**
```
MATERIALS — Typical for UK Residential Construction
- Structure: brick and block masonry cavity wall construction is most traditional; timber frame is increasingly common.
- Roofing: concrete or clay tile is standard; slate in some regions/conservation areas.
- Insulation: must meet Building Regulations Part L requirements — this varies by construction type.
- Windows: must meet current thermal performance standards under Building Regulations.

WHERE TO SOURCE — UK
- Builders' merchants (Travis Perkins, Jewson, Wickes) are the standard trade supply route.
- A main contractor or builder typically handles material sourcing directly as part of a build contract.
```

**`guide-build-house-nigeria.md` — materials section:**
```
MATERIALS — Typical for Nigerian Residential Construction
- Structure: sandcrete block walls with reinforced concrete columns/beams is the dominant method.
- Roofing: corrugated iron or aluminum roofing sheets on timber or steel trusses are most common.
- Cement: sourced from major producers (e.g. Dangote, Lafarge/WAPCO, BUA) through local distributors.
- Steel reinforcement (rebar): verify it meets standard specifications — substandard rebar is a known quality issue in some markets.

WHERE TO SOURCE — Nigeria
- Local building material markets and registered dealers in your state.
- Buy directly from, or verify authenticity with, major producers' authorized distributors where possible — counterfeit or substandard materials are a documented risk, especially cement and rebar.
- A registered contractor/builder typically has established supplier relationships worth using over sourcing materials yourself if you're inexperienced.
```

Note what's deliberately absent: no ₦/$/£ figures anywhere in this section, consistent with the existing price-fabrication ban. This is categorical guidance (what materials, what to watch for, where to look) — not pricing data, which the AI has no reliable source for.

---

## 4. Simplified user flow (final version)

1. User opens a new conversation → picks Location (USA/UK/Nigeria) + Intent (Buy house / Build house / Buy land)
2. Chat opens. AI's system prompt = `guardrails.md` (with new formatting rules) + the one matching `guide-{intent}-{location}.md` file (now in Rules/Red Flags/Materials format) + conversation history + user's message
3. User asks questions, gets short, direct, rules-based answers — no fabricated listings, no fabricated prices, no bloated formatting
4. Build-a-house conversations can still surface `[SUGGEST_ACTION: CREATE_PROJECT]` when the conversation turns toward tracking a real, specific build — unchanged from before
5. PDF attach for document Q&A — unchanged from before, still supported

No listings, no location-triggered API calls, no RentCast/Homesage.ai dependency anywhere in the build.

---

## What to do next
1. Add formatting rule 12 to `guardrails.md`
2. Rewrite the 9 guide files into the Rules-to-Follow / Red-Flags format (Build-house ones also get the Materials section)
3. Remove any RentCast/listings code or spec sections you'd already started on — this scope is now smaller than before, which is a good thing for your remaining time
4. Re-test the same three sample messages (buy/build/land) one more time — this time checking specifically for: short responses, no tables/emoji, Rules-to-Follow structure showing up naturally in the answer
