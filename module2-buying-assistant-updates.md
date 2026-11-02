# Sitewise — Update: Module 2 (Buying Assistant)

This covers only what's new since the last full prompt. Everything about Module 1 (Risk Assessment) is unchanged — see the main build prompt for that.

---

## What's new

A second module: a chat interface for users considering buying a house, building one, or buying land. Backed by a curated reference guide (not live legal research), supports PDF attachments the AI answers questions about, and — only in the "Build a house" branch — can suggest bridging into Module 1's risk tool, with the user always confirming before anything is created.

---

## SQL additions

```sql
-- One row per chat thread. intent_type is set once, at creation, from the popup.
CREATE TABLE buying_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    intent_type VARCHAR(20) NOT NULL CHECK (intent_type IN ('BUY_HOUSE','BUILD_HOUSE','BUY_LAND')),
    title VARCHAR(255),
    linked_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_buying_conversations_user_id ON buying_conversations(user_id);
ALTER TABLE buying_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own conversations" ON buying_conversations
    FOR ALL USING (auth.uid() = user_id);

-- Every message in a thread, both user and assistant turns.
CREATE TABLE buying_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES buying_conversations(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user','assistant')),
    content TEXT NOT NULL,
    suggested_action VARCHAR(30), -- e.g. 'CREATE_PROJECT', NULL if none
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_buying_messages_conversation_id ON buying_messages(conversation_id);

-- PDF attachments. File bytes go in Supabase Storage, not this table.
CREATE TABLE buying_pdf_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES buying_messages(id) ON DELETE CASCADE,
    storage_path VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    extracted_text TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pdf_attachments_message_id ON buying_pdf_attachments(message_id);

-- Trace-back link (run after the existing projects table already exists)
ALTER TABLE projects ADD COLUMN origin_conversation_id UUID REFERENCES buying_conversations(id) ON DELETE SET NULL;
```

---

## Backend additions

**New entities:** `BuyingConversation`, `BuyingMessage`, `BuyingPdfAttachment`

**New services:**
- `BuyingConversationService` — create/list conversations, scoped to user, sets `intent_type` at creation
- `BuyingMessageService` — appends messages, orchestrates the AI call
- `PdfExtractionService` — Apache PDFBox, pulls text out of an uploaded PDF server-side before it touches the AI
- `BuyingAssistantPromptService` — loads the guardrail + guide markdown files (below) at app startup, assembles the system prompt per request based on `intent_type`, strips the `[SUGGEST_ACTION: ...]` marker out of the AI's response before storing/displaying it, returns it separately for the frontend to render as a button

The existing `AiSummaryService`'s Groq/DeepSeek HTTP client is reused for this module too — one client, different system prompts.

**New endpoints:**
```
POST   /api/buying-conversations                    -- body: { intentType }
GET    /api/buying-conversations                     -- list user's conversations
GET    /api/buying-conversations/{id}                  -- full thread with messages
POST   /api/buying-conversations/{id}/messages          -- body: { content }, multipart if PDF attached
DELETE /api/buying-conversations/{id}

POST   /api/buying-conversations/{id}/create-project     -- explicit bridge action, only called after user confirms
```
`create-project` is never called automatically as a side effect of a chat message — only after the user clicks the confirmation button and reviews the pre-filled details.

---

## Frontend additions

```
static/
  buying-assistant.html
  js/buying-assistant.js   -- intent popup, chat rendering, PDF attach, bridge button handling
```

- `intentModal` — shown once per new conversation: "What are you looking to do?" → Buy a house / Build a house / Buy land
- `chatView` — message list, text input, PDF attach button (`.pdf` only), send button
- Assistant messages with a `suggestedAction` render an inline button beneath that specific message — only when the backend actually returned that flag
- Clicking it opens a confirmation panel with the AI's pre-filled project details, editable, with an explicit "Create Project" button

---

## AI guidance files (loaded at startup, not per-request)

`src/main/resources/prompts/guardrails.md` — always included:
```
You are Sitewise's Buying Assistant, helping users think through buying a house,
building one, or buying land. Follow these rules without exception:

1. You are not a lawyer, realtor, or licensed financial advisor, and you must never
   imply that you are one. Every response involving legal, financial, or contractual
   guidance must stay general and educational — never a definitive instruction to act.

2. You never perform actions. You only suggest them. If you believe creating a risk
   assessment project would help the user (this applies ONLY in Build-a-house
   conversations, and ONLY when the conversation has moved from general questions
   into genuine feasibility/timeline/cost concerns), end your response with the
   exact line: [SUGGEST_ACTION: CREATE_PROJECT]
   Do not include this line in any other circumstance. Do not create, modify, or
   delete anything yourself — you only ever propose.

3. If a PDF document's extracted text is provided in this conversation, ground your
   answers about it strictly in that text. If the answer isn't in the document, say
   so plainly rather than filling the gap with general knowledge. If you do
   supplement with general knowledge, label it clearly as separate from what the
   document says.

4. If a user's question is ambiguous between general guidance and a specific
   legal/financial conclusion, ask one clarifying question rather than guessing.

5. Always end substantive legal/financial/contractual responses with a reminder to
   consult a licensed professional, unless already included in the last 3 messages.

6. Never state or imply a definitive opinion on whether a specific neighborhood,
   property, or deal is "safe" or "a good idea" — describe relevant factors and
   let the user weigh them.
```

`src/main/resources/prompts/guide-buy-house.md`, `guide-build-house.md`, `guide-buy-land.md` — each covers general process steps and red flags for **United States, United Kingdom, and Nigeria** separately, framed explicitly as general educational guidance, not legal advice, with a note that requirements vary by state/region and change over time. (Full text of all three guides is in the main build prompt, section 7 — carry it over as-is, no changes needed here.)

The `guide-build-house.md` file additionally instructs: when a conversation turns from general questions toward tracking an actual planned build's feasibility/timeline/cost, that's the specific trigger point where suggesting the Risk Assessment tool is appropriate.

---

## Build order — where this fits

Build and fully stabilize Module 1 first. Only then:
1. `buying_conversations`/`buying_messages`/`buying_pdf_attachments` tables + RLS
2. Guardrail + guide files written and loaded at startup
3. Conversation/message CRUD + intent popup + chat UI (no PDF, no AI yet — verify plumbing first)
4. Wire the actual AI call, test edge-case prompts to confirm the guardrails actually hold
5. PDF attach + PDFBox extraction
6. `[SUGGEST_ACTION]` parsing + bridge button + confirmation panel + `create-project` endpoint

If time runs short, these are the steps to cut first — a fully working Module 1 alone is still a complete, defensible project.

---

## Non-negotiable additions to the constraint list
- AI never performs actions in Module 2 — only suggests them via the marker; all state changes require explicit user confirmation
- Module 2 never presents itself as legal, financial, or professional advice
- PDF-grounded answers must distinguish "from your document" vs. general knowledge — never blend silently
