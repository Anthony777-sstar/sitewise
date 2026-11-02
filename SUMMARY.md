# Sitewise — Construction Project Risk Assessment & Advisory Platform

## Overview

Sitewise is a full-stack web application that helps construction teams identify, quantify, and understand project risks. It combines a **weighted risk scoring engine** with an **AI-powered buying/building assistant** that provides country-specific guidance on property rules, red flags, and materials.

---

## Core Features

### 1. Risk Assessment (Module 1)
- Four-factor weighted scoring: **Budget**, **Timeline**, **Safety**, **Resource Availability**
- Each factor rated 1–10, combined into a single 0–100 score with a risk label (Low / Medium / High / Critical)
- AI-generated executive summary via **Groq (Llama 3.3 70B)** explaining contributing factors and mitigations
- Save assessments to account history, export as PDF

### 2. Buying Assistant (Module 2)
- Country-specific guidance for **USA, UK, and Nigeria**
- Three intent types: **Buy a house**, **Build a house**, **Buy land**
- Rules-to-follow and red-flags guidance powered by curated guide files
- **Build a house** intent includes materials and sourcing recommendations per country
- PDF document Q&A — attach a PDF and ask questions about it
- Conversation history with title auto-generation
- Risk assessment bridge — create a risk assessment directly from a chat conversation

### 3. Authentication & Data
- **Supabase Auth** (email/password with optional email confirmation)
- **Row Level Security** — each user's data is isolated
- PostgreSQL tables: `projects` (assessments), `buying_conversations`, `buying_messages`, `buying_pdf_attachments`

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Java (HTTP server on port 8080, no framework) |
| **Frontend** | Vanilla HTML/CSS/JS |
| **Database** | PostgreSQL via Supabase |
| **Auth** | Supabase Auth |
| **AI** | Groq API (Llama 3.3 70B / openai/gpt-oss-120b) |
| **PDF** | pdf.js (client-side extraction) |
| **Animations** | GSAP + ScrollTrigger |

---

## Visual Design

- **Dark palette**: `--bg: #12181F`, `--surface: #1A2029`, `--accent: #F2A93B` (amber)
- **Glass-morphism**: translucent blurred cards (`backdrop-filter: blur()`) used site-wide — feature cards, message bubbles, auth forms, navigation
- **Glow orb**: signature ambient amber-to-navy radial gradient behind hero, auth, score card, and empty states
- **Typography**: Inter (body) + JetBrains Mono (monospace)

### Landing Page
- Two-column hero: text left, orbiting stat cards right
- Liquid glass orb centerpiece with 4-layer GSAP parallax scroll
- Feature glass cards with staggered parallax reveal
- Logo trust bar (Marketeam-inspired) showing official data sources
- Scroll-spy navigation, repeated CTA

### Auth Screens
- Glass-morphism auth card with glow orb backdrop
- Smooth crossfade transition between Sign Up / Log In modes

### Dashboard (Assessments)
- Glass-morphism form and result panels
- Glow orb + idle float on score circle
- Conversation viewer with inline read-only chat history and "Continue Chat" link

### Buying Assistant Chat
- Glass sidebar and modals
- Glass message bubbles (user + assistant)
- Glow orb behind intent-selection modal and empty state
- Mobile hamburger toggle with slide-in sidebar

---

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/assess` | POST | Submit risk factors, get weighted score + AI summary |
| `/api/buying-assistant/chat` | POST | Send chat message, get AI response with intent/location context |

---

## Project Structure

```
├── backend/
│   ├── Main.java                    HTTP server + routing
│   ├── GroqClient.java              Groq API wrapper
│   ├── AssessmentService.java       Risk scoring logic
│   ├── BuyingMessageService.java    Chat processing + reminders
│   ├── BuyingConversationService.java  Intent validation
│   ├── BuyingAssistantPromptService.java  System prompt builder
│   └── prompts/
│       ├── guardrails.md            Global AI behavior rules
│       ├── guide-buy-house-{usa,uk,nigeria}.md
│       ├── guide-build-house-{usa,uk,nigeria}.md
│       └── guide-buy-land-{usa,uk,nigeria}.md
├── frontend/
│   ├── index.html                   Landing page
│   ├── auth.html                    Sign In / Sign Up
│   ├── app.html                     Dashboard + Risk Assessment
│   ├── buying-assistant.html        Chat interface
│   ├── styles.css                   Global styles
│   ├── api.js                       Supabase client + shared utils
│   ├── app.js                       Dashboard logic
│   ├── buying-assistant.js          Chat logic
│   └── supabase-client.js           Supabase init
├── database/
│   └── schema-module2.sql           Buying assistant tables
├── testfolder/                      Test PDF documents
├── finalscope.md                    Original scope document
├── fix-links-clickable-and-fabricated.md  Bug fix documentation
└── sitewise-full-redesign-prompt.md      Design system spec
```

---

## Key Design Decisions

- **No listings APIs** — RentCast, Homesage, and all live property listing integrations were dropped. The assistant explicitly declines to pull up listings.
- **No fabricated prices** — the AI is prohibited from generating specific cost figures. Materials guidance is general and non-numeric.
- **Verified links only** — all URLs in responses must come verbatim from the guide files' USEFUL LINKS sections. The AI cannot construct URLs from memory.
- **Short, direct responses** — guardrails enforce 2–4 paragraph answers, no tables, no emoji, no decorative headers.
- **Reduced motion fallback** — all GSAP and CSS animations respect `prefers-reduced-motion`.
