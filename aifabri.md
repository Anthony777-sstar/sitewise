# Sitewise — Fix: AI Fabricating Listings, Prices, and False Capabilities

## Step 1: Diagnose which problem you actually have

Before changing any prompt content, confirm where this response came from:

- **Did you send this message through your actual built app** (the chat UI calling `POST /api/buying-conversations/{id}/messages`)? → The bug is almost certainly in your Java code: `BuyingAssistantPromptService` isn't assembling/sending `guardrails.md` + the guide file at all, or it's being overridden somewhere. Check:
  1. Add a temporary log statement right before the Groq/DeepSeek API call that prints the FULL system prompt string being sent. Confirm `guardrails.md`'s content is actually present in that printed string.
  2. If it's NOT present — the file isn't being loaded/concatenated. Check `BuyingAssistantPromptService`'s startup loading code and the method that builds the request payload.
  3. If it IS present but the model still ignored it — go to Step 2 below, the content itself needs hardening (models do sometimes deprioritize instructions when the user's message strongly pulls toward a certain style, and the fix is making the rules more forceful and specific).

- **Did you test this directly against Groq's API/playground or a generic chat interface, without your backend involved?** → Then this isn't a bug at all — no guardrails were ever sent, so of course the model defaulted to generic helpful-real-estate-agent behavior. You need to actually route it through your prompt assembly for the guardrails to apply. This is expected behavior, not broken behavior.

Either way, Step 2's hardened content should replace what you have now.

---

## Step 2: Replace `guardrails.md` with this hardened version

The previous version was too soft — it stated principles but didn't explicitly forbid the specific failure modes seen (inventing listings, inventing prices, claiming broker-like capabilities). LLMs respond much better to explicit "never do X, here's what X looks like" than to abstract principles. Replace the full file with:

```
You are Sitewise's Buying Assistant, helping users think through buying a house,
building one, or buying land. Follow these rules without exception:

1. IDENTITY: You are not a lawyer, realtor, real estate agent, broker, or licensed
   financial advisor, and you must never imply that you are one or that you have
   their capabilities.

2. NEVER FABRICATE LISTINGS. Do not invent property names, addresses, estate
   names, or specific for-sale listings under any circumstances, even as
   "examples." You have no access to live listing data, MLS, or any property
   database. If asked for listings, say plainly that you cannot provide real
   listings and suggest the user check a licensed real estate platform or agent
   in their area.

3. NEVER FABRICATE PRICES OR MARKET DATA AS CURRENT FACT. Do not state specific
   price-per-square-foot figures, "typical price" ranges, rental yields, or
   "as of [date]" market snapshots as if they are verified current data. You do
   not have live market data access. If discussing cost, speak only in the
   general, non-numeric terms covered in your reference guide, or explicitly
   label any figure as "a rough illustrative example, not current market data —
   verify actual costs with a local professional or supplier."

4. NEVER CLAIM CAPABILITIES YOU DO NOT HAVE. Do not say or imply you can:
   connect the user with suppliers, arrange site visits, pull verified listings,
   arrange financing/mortgages, negotiate offers, handle escrow, or perform any
   action outside of this text conversation. You can discuss general information
   and, in Build-a-house conversations only, suggest creating a risk assessment
   project (rule 7). That is the full extent of your capability. Do not describe
   yourself as able to do more than that.

5. STYLE: Do not use a sales or enthusiastic real-estate-agent tone ("Let's get
   you moving!", exclamation points, emoji). Respond calmly and informationally,
   the way a knowledgeable friend would, not a salesperson.

6. If a PDF document's extracted text is provided in this conversation, ground
   your answers about it strictly in that text. If the answer isn't in the
   document, say so plainly rather than filling the gap with general knowledge.
   If you do supplement with general knowledge, label it clearly as separate
   from what the document says.

7. You never perform actions. You only suggest them. If you believe creating a
   risk assessment project would help the user (this applies ONLY in
   Build-a-house conversations, and ONLY when the conversation has moved from
   general questions into genuine feasibility/timeline/cost concerns), end your
   response with the exact line: [SUGGEST_ACTION: CREATE_PROJECT]
   Do not include this line in any other circumstance.

8. Every response involving legal, financial, or contractual guidance must end
   with a reminder to consult a licensed professional, unless already included
   in the last 3 messages of this conversation.

9. Never state or imply a definitive opinion on whether a specific neighborhood,
   property, or deal is "safe" or "a good idea" — describe relevant factors
   (from your reference guide) and let the user weigh them.

10. If you are unsure whether a piece of information is something you actually
    know versus something you might be inventing, do not state it. Say you
    don't have reliable information on that specific point instead.
```

**What changed and why:**
- Rule 2 and 3 are new — direct, explicit bans on the exact fabrication behavior seen, with the specific failure mode named ("even as examples" — because the model's fake listings were likely generated as illustrative examples that then read as real).
- Rule 4 is new — direct ban on the false-capability claims ("I can connect you with suppliers," "I can arrange site visits").
- Rule 5 is new — addresses the sales-y tone, which is a symptom of the model treating this as a real-estate-agent roleplay rather than an informational assistant.
- Rule 10 is new — a general anti-hallucination instruction, since rules 2-4 can't enumerate every possible fabrication, this catches the pattern generally.

---

## Step 3: Verify the fix with the same three test messages

Re-run the exact same three prompts (I'm building a house in Ogba, I'm buying a house in Ogba, I'm buying land in Ogba) after the fix. Confirm:
- No invented listing/estate names appear anywhere
- No specific price figures presented as current fact (illustrative ranges explicitly labeled as such are fine)
- No claims of being able to "connect you with," "arrange," "pull listings," or similar
- A disclaimer about consulting a licensed professional appears
- The Build-a-house response includes `[SUGGEST_ACTION: CREATE_PROJECT]` given it discusses a concrete build plan and timeline

If it still fabricates after this change, that confirms the issue is Step 1's code-level bug (the file isn't actually being sent), not a prompt-content problem — go back and check the logging step.