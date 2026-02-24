# CODEC — Backend

Go API server powering the competitive intelligence agent pipeline.

## Stack

- **Go 1.24** with **Chi v5** router
- **GORM** + **PostgreSQL** for persistence
- **Gemini Flash** (LLM), **EnrichLayer** (company data), **SerpAPI** (web search)
- Server-Sent Events (SSE) for streaming agent progress to the frontend

## Running locally

### Prerequisites

- Go 1.21+
- PostgreSQL (or use `docker-compose up -d` from the repo root to start one)

### Start

```bash
cd backend
cp .env.example .env   # then fill in your API keys
go run main.go
```

Server starts on `PORT` (default `8080`).

> **Port conflict:** the frontend Vite dev server also defaults to 8080. Either set
> `PORT=3001` in `backend/.env` and point `VITE_API_URL=http://localhost:3001/api` in
> the frontend, or adjust `vite.config.ts`.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP listen port (default `8080`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgres://user:pass@host:5432/db`) |
| `GEMINI_API_KEY` | Yes | Google Gemini Flash — used for all LLM calls |
| `ENRICH_API_KEY` | Yes | EnrichLayer — company data + competitor discovery |
| `SERP_API_KEY` | Yes | SerpAPI — web search snippets |
| `ACCEPTED_ORIGINS` | No | Comma-separated CORS origins (default: none) |

## Agent pipeline

`POST /api/chat/stream` runs the 5-step pipeline and streams `ProgressEvent`
JSON objects as SSE before sending the final `done` payload.

```
Step 0  Extract company name + focus areas from the user message (LLM)
Step 1  Discover competitors via EnrichLayer; fall back to LLM if results are generic
Step 2  Enrich each competitor concurrently (EnrichLayer)
Step 3  Web recon per competitor — 3 concurrent SerpAPI queries (news, pricing, alternatives)
Step 4  Synthesize each competitor concurrently (LLM) → threat level, products, gaps
Step 5  Generate battle plan (LLM) → matrix, vulnerabilities, strike plans
        Validate battle plan (second LLM pass for actionability)
        Persist everything to PostgreSQL
```

All per-competitor work in steps 2–4 runs concurrently with `errgroup`. Individual
failures are non-fatal — the pipeline continues with whatever data it has.

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat/stream` | Run analysis (SSE stream) |
| `POST` | `/api/chat` | Run analysis (blocking JSON) |
| `GET` | `/api/competitors/{id}` | Competitor drilldown |
| `GET` | `/api/sessions` | List sessions |
| `POST` | `/api/sessions` | Create session |
| `GET` | `/api/sessions/{id}` | Get session with messages |
| `GET` | `/api/sessions/{id}/competitors` | Get session competitors + dossier |
| `PATCH` | `/api/sessions/{id}` | Update title |
| `POST` | `/api/sessions/{id}/summarize` | Auto-summarize title via LLM |
| `DELETE` | `/api/sessions/{id}` | Delete session |
| `GET` | `/healthcheck` | Server uptime + timestamp |

## Project layout

```
backend/
├── api/          # HTTP handlers, routes, middleware, SSE serialization
├── config/       # Env-based configuration
├── database/     # Repository interfaces + GORM implementations
├── errs/         # Typed error definitions
├── models/       # GORM models: Company, Competitor, IntelDossier, …
├── services/     # strategy_agent.go, llm_client.go, enrich_client.go, serp_client.go
└── main.go
```
