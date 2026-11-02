# Sitewise — AI Connection Guide

This document explains how Sitewise talks to the AI (Groq), how requests are sent,
how the AI replies, and how to follow / change the flow. It covers **both** AI flows
found in the codebase:

1. **Buying Assistant chat** (`/api/buying-assistant/chat`) — the conversational AI.
2. **Risk assessment summary** (`/api/assess`) — AI-generated executive summaries.

---

## 1. Architecture overview

```
┌──────────────┐   fetch(/api/...)    ┌──────────────────────────┐
│   Browser    │ ───────────────────▶ │   Java backend (Main)    │
│  (vanilla JS)│                      │  com.sun.net.httpserver  │
│              │ ◀─────────────────── │  serves /frontend + JSON │
└──────┬───────┘      JSON reply      └────────────┬─────────────┘
       │                                          │
       │ Supabase JS SDK                          │ POST chat/completions
       │ (auth, messages, storage)                │  Bearer <GROQ API KEY>
       ▼                                          ▼
┌────────────────────────┐            ┌─────────────────────────┐
│        Supabase        │            │   Groq API (OpenAI-compat)│
│  auth / DB / storage   │            │  api.groq.com/...        │
└────────────────────────┘            └─────────────────────────┘
```

- **Frontend**: plain HTML/CSS/JS in `frontend/` (`app.html`, `buying-assistant.html`,
  `auth.html`). It talks to the backend over `fetch`, and to Supabase via the
  supabase-js CDN library.
- **Backend**: `backend/Main.java` — a single Java HTTP server built on the JDK's
  built-in `com.sun.net.httpserver.HttpServer`. It serves the static frontend and
  exposes two JSON endpoints. No web framework, no JSON library — JSON is built and
  parsed by hand with string helpers.
- **AI**: `backend/GroqClient.java` — a thin wrapper around Groq's
  OpenAI-compatible Chat Completions endpoint.

---

## 2. Flow 1 — Buying Assistant chat (the main "text in, AI answers" path)

### 2.1 Frontend sends the message

File: `frontend/buying-assistant.js`

1. User types and presses Enter / the send button → `sendMessage()` (`buying-assistant.js:263`).
2. The user message is saved to Supabase first (`buying_messages` table, role `user`).
3. Optional PDF/file attachment text is extracted client-side
   (`handleFileAttach`, `buying-assistant.js:399` — PDF.js for PDFs, plain `file.text()` otherwise).
4. A "thinking" spinner is shown (`showThinking()`).
5. The last 20 messages become `history` (with the just-sent message removed).
6. A POST is made to the Java backend (`buying-assistant.js:335`):

```js
await fetch('/api/buying-assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        intentType: currentIntent || 'BUILD_HOUSE', // BUY_HOUSE | BUILD_HOUSE | BUY_LAND
        location: currentLocation || 'NIGERIA',     // NIGERIA | USA | UK
        userMessage: text,
        pdfText: currentPdfText,                    // extracted file text or null
        history: history                            // [{role, content}, ...]
    })
});
```

### 2.2 Backend receives and parses it

File: `backend/Main.java`, `BuyingChatHandler` (`Main.java:154`)

- Sets CORS headers and handles `OPTIONS` preflight.
- Reads the raw body and hand-parses `intentType`, `location`, `userMessage`,
  `pdfText`, and the `history` array (`parseHistory`, `Main.java:264`).
- Calls the message service:

```java
BuyingMessageService.ChatResult result = messageService.processMessage(
    intentType, location, history, userMessage, pdfText);
```

### 2.3 The prompt is assembled

File: `backend/BuyingMessageService.java` + `backend/BuyingAssistantPromptService.java`

The final AI request contains, in order:

1. **System prompt** (`buildSystemPrompt`, `BuyingAssistantPromptService.java:44`):
   - A preamble that states the user's intent + location (e.g. "The user is interested
     in building a house in Nigeria.").
   - `prompts/guardrails.md` — rules about what the bot must NOT claim (no fake listings,
     no invented lenders/agents, no guessed URLs, no emoji, keep responses short).
   - A location/intent guide file: `prompts/guide-<intent>-<location>.md`
     (e.g. `guide-build-house-nigeria.md`), which holds the real, verified content the
     bot is allowed to use.
2. **A hardcoded REMINDER block** (`BuyingMessageService.java:17`) injected before the
   user message to reinforce the guardrails on every turn.
3. **Chat history** (last 20 messages, each with its real `role`).
4. **The new user message**, plus the PDF text appended as a bracketed attachment note
   if present (`GroqClient.chatWithMessages`, `GroqClient.java:132`).

### 2.4 Request sent to Groq

File: `backend/GroqClient.java`

- URL: `https://api.groq.com/openai/v1/chat/completions`
- Model: `openai/gpt-oss-120b`
- Auth: `Authorization: Bearer <API_KEY>` (⚠️ key currently hardcoded — see §7)
- Method: POST, `Content-Type: application/json`
- Body (built with string concatenation, not a JSON library):

```json
{
  "model": "openai/gpt-oss-120b",
  "messages": [
    {"role": "system", "content": "<guardrails + guide + preamble>"},
    {"role": "user",   "content": "<previous message 1>"},
    {"role": "assistant","content": "<previous reply 1>"},
    "... more history ...",
    {"role": "user",   "content": "<REMINDER block + new user message> [PDF text]"}
  ],
  "temperature": 0.7,
  "max_tokens": 800
}
```

### 2.5 Groq replies, backend parses

- Groq returns OpenAI-style JSON: `{"choices":[{"message":{"content":"..."}}]}`.
- `extractContent` (`GroqClient.java:62`) pulls the text out with a **manual string
  search** — it is crude and fragile (see caveats in §4).
- The bot is allowed to append the marker `[SUGGEST_ACTION: CREATE_PROJECT]` inside its
  reply. `parseSuggestedAction` (`BuyingAssistantPromptService.java:85`) turns that into
  `suggestedAction = "CREATE_PROJECT"`, and `stripMarker` removes the marker from the
  visible text.

### 2.6 Backend replies to the browser

`BuyingChatHandler` returns:

```json
{
  "content": "Here is your guide on building a house in Nigeria...",
  "suggestedAction": "CREATE_PROJECT"
}
```

### 2.7 Frontend saves and renders the reply

File: `frontend/buying-assistant.js`

- The assistant reply is inserted into Supabase `buying_messages` with
  `role: 'assistant'` and `suggested_action` (`buying-assistant.js:354`).
- `renderMessages()` displays it (`buying-assistant.js:456`); `formatResponse` turns
  plain text into paragraphs and clickable links.
- If `suggested_action === 'CREATE_PROJECT'`, a **"Create Risk Assessment"** button is
  rendered which redirects the user into the risk-assessment flow
  (`createAssessmentFromChat`, `buying-assistant.js:595`).

---

## 3. Flow 2 — Risk assessment summary

1. Frontend: `frontend/app.js:322` calls `assessRisk(...)`.
2. `frontend/api.js:6` POSTs to `/api/assess`:

```json
{ "projectName": "...", "budget": 7, "timeline": 5, "safety": 8, "resources": 6 }
```

3. Backend: `AssessHandler` (`Main.java:38`) hand-parses the body, runs `RiskScorer`
   to compute a `/100` score + label, then calls
   `groq.generateExecutiveSummary(score, riskLabel, budget, timeline, safety, resources, projectName)`.
4. `GroqClient.generateExecutiveSummary` (`GroqClient.java:21`) builds a one-turn
   request (system role + prompt with the scores) to the same Groq endpoint, model
   `openai/gpt-oss-120b`, `max_tokens: 500`, and returns the generated summary text.
5. The handler wraps score + label + summary into JSON and replies to the browser:

```json
{
  "projectName": "...",
  "budget": 7, "timeline": 5, "safety": 8, "resources": 6,
  "score": 62, "riskLabel": "MEDIUM",
  "executiveSummary": "This project shows moderate risk, mainly around..."
}
```

---

## 4. GroqClient deep-dive & caveats

| Item | Value | Where |
|---|---|---|
| Endpoint | `https://api.groq.com/openai/v1/chat/completions` | `GroqClient.java:11` |
| Model | `openai/gpt-oss-120b` | `GroqClient.java:13` |
| API key | hardcoded string | `GroqClient.java:12` |
| HTTP client | `java.net.http.HttpClient` | `GroqClient.java:17` |
| Timeouts | none set | — |

Caveats / known weaknesses:

- **Hand-built JSON.** Messages are concatenated with `+` and escaped with a local
  `escapeJson`. This works but is error-prone; a JSON library (Jackson/Gson) or the
  Java 21 `JsonParser` would be safer.
- **Crude response parsing.** `extractContent` finds `"content":"` by string search.
  It can misbehave if the model output contains quotes/newlines in unexpected ways, or
  if Groq changes its response shape. A real JSON parser is recommended.
- **No streaming.** Replies arrive all at once; there is no token streaming, which is
  why the UI shows a static "thinking" spinner instead of live text.
- **API key in source.** The Groq key is committed to `GroqClient.java` (see §7).
- **History cap.** Only the last 20 messages are sent, so the model's memory is limited.

---

## 5. Prompt construction at a glance

```
SYSTEM  = intent/location preamble
        + "\n\n---\n\n" + guardrails.md
        + "\n\n---\n\n" + guide-<intent>-<location>.md

USER    = "--- REMINDER BEFORE YOU RESPOND ---\n"
        + <guardrail reminders>
        + "--- END REMINDER ---\n\n"
        + <new user message>
        + (optional) "\n\n[The user attached a document. Extracted text:\n<text>\n]"
```

Files that feed the prompt:

- `backend/prompts/guardrails.md` — behaviour rules.
- `backend/prompts/guide-*.md` — one file per intent + location (the only content the
  bot is allowed to cite). `BuyingAssistantPromptService.loadGuide` picks the file as
  `guide-<intent>-<location>.md` (e.g. `guide-build-house-nigeria.md`).

Special marker protocol: the model may emit `[SUGGEST_ACTION: CREATE_PROJECT]`; the
backend converts it to `suggestedAction` and strips it from the visible text.

---

## 6. Data persistence (Supabase)

Frontend uses the supabase-js SDK (`frontend/supabase-client.js`).

| Table | Purpose |
|---|---|
| `buying_conversations` | Chat threads: `user_id`, `intent_type`, `location`, `title`, `updated_at`, `linked_assessment_id` |
| `buying_messages` | Individual messages: `conversation_id`, `role` (`user`/`assistant`), `content`, `suggested_action` |
| `buying_pdf_attachments` | Uploaded files: `message_id`, `storage_path`, `original_filename`, `extracted_text` |
| `assessments` | Risk assessment results: score, `risk_label`, `executive_summary`, `origin_conversation_id` |

Storage bucket: `buying-pdfs` (used by `buying-assistant.js:290`).

---

## 7. Running locally & deploying

### Local development

```bash
cd backend
javac *.java
java Main        # starts on http://localhost:8080 (or java Main <port>)
```

The backend serves `frontend/` and `websitecdnshaders/` itself, so you only need this
one process. The browser must be able to reach `http://localhost:8080` (the frontend
uses relative URLs like `/api/buying-assistant/chat`, so just open the backend's URL).

### Deployment

- **Dockerfile**: `eclipse-temurin:21-jdk-alpine`, compiles `backend/*.java`, copies
  `frontend/` and `websitecdnshaders/`, runs `java Main` on `$PORT` (default 8080).
- **Vercel**: `.vercel/` holds the project config; `.env.local` holds a Vercel OIDC
  token. Both are gitignored (`.gitignore` lists `.vercel` and `.env*`).

---

## 8. ⚠️ Security warnings

1. **Groq API key is committed.** `backend/GroqClient.java:12` contains a live-looking
   `gsk_...` key. Anyone with the repo can use/abuse it and run up your bill.
   Move it to an environment variable / secret manager and read it at runtime, e.g.
   `System.getenv("GROQ_API_KEY")`.
2. **`.env.local`** contains a Vercel OIDC token. It is gitignored, but be careful not
   to share it or commit it to another repo.
3. **Supabase anon key** (`frontend/supabase-client.js:2`) is public by design (that's
   how anon clients work) — but ensure Row Level Security (RLS) on the Supabase tables
   restricts rows to the logged-in user, since reads/writes go straight from the browser.
4. **No rate limiting / no server-side auth** on the Java endpoints. Anyone who can
   reach the backend can POST messages and consume Groq tokens.
