# CODEC — Competitive Intelligence Agent

> Drop in a company name. CODEC identifies their competitors, runs parallel web
> reconnaissance on each one, synthesizes the threat landscape, and delivers a
> classified Intel Dossier with a concrete battle plan — all streamed live as the
> agent works.

---

## What I built

CODEC is a full-stack AI agent with a spy-ops aesthetic. You type a company name (or
describe what you're competing against), and the agent runs a 5-step pipeline:

1. **Intent extraction** — LLM pulls the company identifier and focus areas from your
   message, so natural language works just as well as a domain name.
2. **Competitor discovery** — EnrichLayer returns structurally similar companies. If
   the results look generic, the LLM falls back to reasoning about the competitive
   landscape directly.
3. **Concurrent enrichment** — Up to 5 competitors are enriched in parallel:
   headcount, revenue band, tech stack, location.
4. **Web recon** — Three SerpAPI queries fire concurrently per competitor (recent
   news, pricing/reviews, "X alternative" searches). Snippets feed the next step.
5. **LLM synthesis + battle plan** — Each competitor is synthesized concurrently into
   a structured threat profile. A second LLM pass generates the full Intel Dossier:
   competitive matrix, vulnerability gaps, and named strike plans with timelines and
   priority tiers (ALPHA / BRAVO / CHARLIE). A final validation pass checks that the
   recommendations are specific rather than generic.

The frontend streams every agent step in real time via SSE — users see each phase
transition from PENDING → COMPLETE before the dossier renders.

---

## Running it

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

## Architecture decisions

**Go backend.** I wanted a backend I could reason about concurrently. The
`errgroup`-based pipeline makes it straightforward to fire off all competitor
enrichment and synthesis calls in parallel and merge results, with per-competitor
failures being non-fatal.

**Gemini Flash.** Fast, cheap, and the structured-output (`responseMimeType:
application/json`) support meant I didn't need a parsing layer between the LLM and
my Go structs — the response maps directly.

**EnrichLayer + SerpAPI together.** EnrichLayer gives structured company data
(funding, headcount, tech stack, similar companies) which seeds the competitor list.
SerpAPI adds recency — the "news 2025" / "pricing reviews" / "X alternative" query
triple consistently surfaces product gaps and customer complaints that structured
databases miss.

**Battle plan validation pass.** A second LLM call reviews the generated
recommendations against the actual competitor data and flags or rewrites anything
that reads as generic ("improve your UX"). This is the single biggest driver of
output quality.

**SSE over WebSockets.** The pipeline is one-directional and the agent doesn't need
to receive messages mid-run. SSE is simpler, works through any reverse proxy, and
the browser `EventSource` API needs no library.

**Session persistence.** Each analysis is stored in Postgres so users can resume and
compare past operations. The sidebar lists all sessions; clicking one restores the
full dossier.

---

## How I used AI tools

I used **Claude Code** throughout this project as the primary coding tool.

**Where it moved me faster:**
- Scaffolding the Go repository structure (models, repositories, handlers) took
  minutes instead of hours. I described the domain — companies, competitors,
  dossiers — and got idiomatic GORM models with the right relationship structure.
- The SSE serialization and Chi routing boilerplate was tedious to write by hand;
  Claude generated it correctly on the first pass.
- The shadcn/ui component wiring and Tailwind layout work — especially the
  competitive matrix table and dossier panel — was the kind of work where AI
  assistance meaningfully compresses iteration time.

**Where I had to override it:**
- The initial battle plan prompts produced generic output ("focus on your strengths,
  differentiate on UX"). I rewrote the prompt engineering myself — the validation
  pass and the structured `StrikePlan` schema with `codename / objective / target /
  approach / timeline / priority` were my design, not generated.
- The concurrent pipeline structure required deliberate thought about which failures
  should be fatal vs. non-fatal. Claude defaulted to propagating all errors; I
  restructured it so per-competitor failures degrade gracefully.
- The spy-ops aesthetic and the "Colonel" persona in the UI were intentional design
  choices I drove. The framing makes the output more engaging to read than a plain
  table of competitor data.

---

## What I'd do with another day

- **Deeper web research.** Right now SerpAPI gives snippets. Scraping the actual
  pricing pages and G2/Capterra reviews would make the vulnerability analysis sharper.
- **Company URL input.** Accept a URL, scrape the landing page, and infer the
  company's own positioning claims — then use those as the frame for gap analysis.
- **Export.** A one-click PDF of the Intel Dossier. The structured data is already
  there; it just needs a print stylesheet and a download handler.
- **Streaming the dossier render.** Right now the dossier appears all at once when
  the pipeline finishes. Streaming the matrix and strike plans as they're generated
  would feel more alive.
- **Deployment.** The `docker-compose.yml` only covers the DB for local dev. I'd add
  backend and frontend services so the whole stack stands up with a single command.
