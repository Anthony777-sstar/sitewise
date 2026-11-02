# Sitewise — Update: Location Toggle + Real USA Listings (RentCast)

## What's new

A location selector (USA / Nigeria / UK) shown beside the chat text box, chosen before the user starts messaging. This does two things depending on location:
- **Determines which country-specific guide content** the AI uses (sharper focus than before — the AI no longer sees all three countries' guidance at once, just the selected one)
- **For USA + "Buy a house" specifically** — triggers a real listings pull from RentCast, shown as actual property cards in the chat, not AI-narrated text

For UK and Nigeria, and for USA's other two intents (Build/Land), there is no live data pull — same link-out approach as before. Be upfront with yourself about this asymmetry; it's honest, not a shortcut, but it does mean the demo will look different depending on what the user selects. Plan your defense walkthrough around showing the USA + Buy House path as the "full" experience.

---

## Flow change

1. User opens a new conversation → **now sees two choices before proceeding**, not one:
   - Location: USA / Nigeria / UK
   - Intent: Buy a house / Build a house / Buy land
2. Both get locked in at conversation creation (`buying_conversations.location` + `buying_conversations.intent_type`) — not changeable mid-conversation. If the user wants a different location or intent, they start a new conversation. This keeps the system prompt assembly simple and avoids the AI getting confused mid-thread about which country it's advising on.
3. A small persistent badge near the text box shows the active selection for that conversation (e.g. "🇺🇸 USA · Buying a house" — no emoji per the style guide, so render as a plain text pill instead: "USA · Buying a house").
4. If `location === USA` and `intent_type === BUY_HOUSE`, the chat view also shows a **search filter bar** (city/state, min/max price, beds) above the message list. Submitting it calls your backend, which calls RentCast, and renders real listing cards inline in the chat as a distinct message type — separate from the AI's text response, sourced directly from RentCast's data, not generated or summarized by the LLM.

---

## SQL change

```sql
ALTER TABLE buying_conversations ADD COLUMN location VARCHAR(10) NOT NULL DEFAULT 'NIGERIA' CHECK (location IN ('USA','UK','NIGERIA'));
```
(Default only applies to any pre-existing rows if you already have data; new conversations should always set this explicitly at creation, never rely on the default.)

---

## Backend changes

### New credential (backend only, same rule as Groq/DeepSeek — never in frontend code)
```properties
rentcast.api.key=${RENTCAST_API_KEY}
rentcast.api.url=https://api.rentcast.io/v1
```

### New service: `ListingsService`
- `searchListings(city, state, maxPrice, minBeds)` — calls RentCast's listings endpoint, returns a small DTO list (address, price, beds/baths, sqft, listing URL, photo URL if available)
- Only ever called when `location = USA` — for UK/Nigeria this service isn't invoked at all, the frontend doesn't even show the filter bar

### New endpoint
```
GET /api/buying-conversations/{id}/listings?city=...&state=...&maxPrice=...&minBeds=...
```
Returns real RentCast data as JSON. This does NOT go through the AI at all — it's a direct data endpoint. The frontend renders it as listing cards; if the user then asks the AI a question referencing a specific listing ("is 123 Main St a good deal?"), THAT message goes through the normal AI pipeline, with the listing's real data included in the message context so the AI can discuss it grounded in actual numbers instead of guessing.

### Rate limit handling — important, don't skip this
RentCast's free tier is **50 calls/month**. That is very easy to burn through accidentally during development/testing before you ever get to your actual defense day. Two required safeguards:
1. **Cache results server-side** — store each search's results (keyed by city+state+price+beds) for at least 24 hours before allowing a repeat call for the same query. Don't hit RentCast fresh every time someone re-runs a similar search.
2. **Track your remaining quota** — log every RentCast call with a running count, and have the endpoint return a graceful "listings temporarily unavailable, try again later" response (not a raw error) if you're close to the monthly cap, so a demo doesn't visibly break mid-presentation.

---

## Prompt file restructuring

Previously, `guide-buy-house.md` (etc.) contained all three countries' sections in one file, and the AI saw all of them regardless of context. Split each into three separate files so the AI only ever sees the one relevant to the active conversation:

```
resources/prompts/
  guardrails.md                     (unchanged, always included)
  guide-buy-house-usa.md
  guide-buy-house-uk.md
  guide-buy-house-nigeria.md
  guide-build-house-usa.md
  guide-build-house-uk.md
  guide-build-house-nigeria.md
  guide-buy-land-usa.md
  guide-buy-land-uk.md
  guide-buy-land-nigeria.md
```
Content for each is just the matching country section already written in the original combined files — copy each section out into its own file, no new writing needed.

`BuyingAssistantPromptService` now selects the file using both fields: `guide-{intent}-{location}.md`, lowercased and hyphenated to match. This also naturally tightens the AI's focus, which should help further with the fabrication issues from earlier — less content in the prompt for it to potentially mix up or overgeneralize from.

For the USA + Buy House case specifically, also add one line to that guide file (or to the reminder block) telling the AI that if real RentCast listing data is present in the conversation, it should reference that data specifically when discussing prices/listings and should NOT fall back to invented figures — reinforcing the existing "ground answers in provided data" rule from guardrails.md, now with an actual real data source to ground against instead of just a PDF.

---

## Frontend changes

```
static/
  js/location-selector.js   -- the USA/UK/Nigeria toggle + intent popup, now combined into one initial screen
  js/listings.js             -- search filter bar + listing card rendering, only mounted when location=USA and intent=BUY_HOUSE
```

- Listing cards render as a distinct message-thread item — visually different from a chat bubble (more like a small product card: address, price, beds/baths, a "View on RentCast" link using the listing's actual source URL). This visual distinction matters: it makes clear to the user "this came from real data," separate from the AI's generated text, reinforcing the honesty of the whole system rather than blending AI text and real data together indistinguishably.

---

## Non-negotiable additions
- RentCast is only ever called for `location = USA`. Never attempt to call it for UK/Nigeria searches — it doesn't have reliable coverage there, and doing so risks returning wrong/empty data that could confuse the AI into fabricating something to fill the gap.
- The RentCast API key is backend-only, exactly like the Groq/DeepSeek keys — never exposed in frontend JS.
- Listing data shown to the user is never rephrased/summarized by the AI before display — the raw structured data renders directly as cards. The AI only discusses listings when the user explicitly asks it to, using that same real data as grounding context.



6bc09804ec9b489dbcf373d500316ee8 rent cast api key 