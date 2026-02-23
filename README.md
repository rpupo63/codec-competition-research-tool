# CODEC — Competitive Intelligence Agent

> Drop in a company name. CODEC identifies their competitors, runs parallel web
> reconnaissance on each one, synthesizes the threat landscape, and delivers a
> classified Intel Dossier with a concrete battle plan — all streamed live as the
> agent works.

---

## Live Application

The app is up and running at [distro-interview.xyz](http://distro-interview.xyz) and can be interacted with as normal. Everyone is a single user, so you can see the searches from my previous tests and from your own searches.

---

## Development Process & Philosophy

### Tooling & Workflow

This project began with a first draft developed using Lovable, which is excellent for creating nicely formatted initial versions and for easily connecting to a backend. For more substantial backend changes, I used Claude Code. I adapted a backend from a previous project with similar functionality, and Claude Code was instrumental for the larger structural and reformatting edits. For fine-grained, scalpel-level edits and bug fixing, I primarily used Cursor.

### The Role of AI

While AI was a significant accelerant in the coding process, much of the foundational work was completed before a single line of AI-generated code was written. The overall plan and architecture were heavily informed by previous projects and my experience implementing services like Serp and EnrichLayer in other applications. The primary challenge wasn't generating code, but rather orchestrating the correct flow and integration of these services.

### A Note on Presentation

As you've probably noticed, the app's presentation is heavily inspired by the briefing scenes in the Metal Gear Solid series. This was a deliberate and fun choice, intended as a statement on how we can evolve the "chatbot" image, especially in lower-stakes contexts like this interview project. I'm a big fan of the creativity and craziness of the old internet, and I believe AI offers a new frontier to bring back that same spirit.

---

## How It Works

CODEC is a full-stack AI agent with a spy-ops aesthetic. You type a company name (or describe what you're competing against), and the agent runs a 5-step pipeline:

1.  **Intent extraction** — LLM pulls the company identifier and focus areas from your message, so natural language works just as well as a domain name.
2.  **Competitor discovery** — EnrichLayer returns structurally similar companies. If the results look generic, the LLM falls back to reasoning about the competitive landscape directly.
3.  **Concurrent enrichment** — Up to 5 competitors are enriched in parallel: headcount, revenue band, tech stack, location.
4.  **Web recon** — Three SerpAPI queries fire concurrently per competitor (recent news, pricing/reviews, "X alternative" searches). Snippets feed the next step.
5.  **LLM synthesis + battle plan** — Each competitor is synthesized concurrently into a structured threat profile. A second LLM pass generates the full Intel Dossier: competitive matrix, vulnerability gaps, and named strike plans with timelines and priority tiers (ALPHA / BRAVO / CHARLIE). A final validation pass checks that the recommendations are specific rather than generic.

The frontend streams every agent step in real time via SSE — users see each phase transition from PENDING → COMPLETE before the dossier renders.

---

## Running it Locally

### Prerequisites

- Go 1.21+
- Node 18+
- API keys: **Gemini** (free tier works), **EnrichLayer**, **SerpAPI**, **Supabase URL and Anon Key**

### 1 — Start the database

This project uses Supabase as its database. Ensure you have a Supabase project set up and its URL and Anon Key are configured in your backend's `.env` file.

### 2 — Start the backend

```bash
cd backend
cp .env.example .env
# Edit .env and fill in your API keys.
# Set PORT=3001 to avoid conflicting with the frontend dev server.
go run main.go
```

The server auto-migrates the schema on first run.

### 3 — Start the frontend

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:3001/api npm run dev
# Opens at http://localhost:8080
```

---

## What I'd Do With an Extra Day

Given more time, I would first address the single-user nature of the application by implementing proper user accounts. This would not only fix the shared session issue but also open up opportunities to gain perspective on the user's specific angle for competitor analysis (e.g., are they doing investment research, due diligence, or tracking direct competitors?).

Finally, I would add critical guardrails such as rate limiting and protections against prompt injection to enhance the application's security and robustness.
