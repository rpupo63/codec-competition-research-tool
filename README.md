# Codec: Competition Research Tool

> Drop in a company name. Codec identifies their competitors, runs parallel web
> reconnaissance on each one, synthesizes the threat landscape, and delivers a
> classified Intel Dossier with a concrete battle plan — all streamed live as the
> agent works.

**[Try the live demo →](https://distro-interview.xyz)**

---

## Visual Design

Codec is built around the aesthetic of a tactical radio briefing — the kind of secure comms screen you'd see in a spy thriller. The interface treats competitive research like a field operation: you are Snake, your AI handler is the Colonel, and every analysis produces a classified dossier.

### Design language

| Element | What it does |
|---|---|
| **Phosphor green on black** | Primary palette (`hsl(153 90% 61%)` on `#000`) with Space Mono — evoking CRT terminals and night-vision HUDs |
| **MGS notched borders** | `mgs-border` and `mgs-border-strong` clip-path corners on panels, tabs, and matrix cards |
| **Portrait frames** | Colonel and Snake character portraits with scan-line overlays and a speaking pulse animation |
| **Frequency display** | Token count rendered as a radio frequency readout, with 32-bar activity meters that animate during agent processing |
| **Intel Dossier panel** | Slide-in overlay with three tabs — Competitor Matrix, Vulnerability Map, Strike Plan — each using military codenames (ALPHA / BRAVO / CHARLIE) |
| **Signal Lost overlay** | Full-screen static noise and interference lines for connection failures |
| **Text glow** | `text-glow` and `text-glow-strong` shadows on headings and threat-level labels |

### Screens

- **Codec screen** (`/`) — The main briefing view. Colonel/Snake portraits flank a live chat feed. Agent progress streams in as status messages. Competitor tabs open per-target drilldowns. The dossier slides in from the right when analysis completes.
- **Operations screen** (`/operations`) — Session archive styled as a mission log. Browse and resume past analyses.

### Motion and audio

Framer Motion drives panel transitions, typewriter-style message reveals, and the thinking-state bar animations. Ambient codec audio loops during active sessions for atmosphere.

---

## How It Works

Codec is a full-stack AI agent behind the briefing UI. You type a company name (or describe what you're competing against), and the agent runs a 5-step pipeline:

1. **Intent extraction** — LLM pulls the company identifier and focus areas from your message.
2. **Competitor discovery** — EnrichLayer returns structurally similar companies, with LLM fallback.
3. **Concurrent enrichment** — Up to 5 competitors enriched in parallel: headcount, revenue, tech stack, location.
4. **Web recon** — Three SerpAPI queries per competitor (news, pricing/reviews, alternatives).
5. **LLM synthesis + battle plan** — Threat profiles, competitive matrix, vulnerability gaps, and named strike plans with priority tiers.

The frontend streams every agent step in real time via SSE — users see each phase transition from PENDING → COMPLETE before the dossier renders.

---

## Running Locally

### Prerequisites

- Go 1.21+
- Node 18+
- API keys: **Gemini**, **EnrichLayer**, **SerpAPI**, **Supabase URL and Anon Key**

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env and fill in your API keys.
# Set PORT=3001 to avoid conflicting with the frontend dev server.
go run main.go
```

### Frontend

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:3001/api npm run dev
# Opens at http://localhost:8080
```

---

## Deployment

| Service | Host | URL |
|---|---|---|
| Frontend | Cloudflare Pages | [distro-interview.xyz](https://distro-interview.xyz) |
| Backend | RackNerd (systemd) | [api.distro-interview.xyz](https://api.distro-interview.xyz) |

Deploy scripts: `frontend/deploy-frontend` (Wrangler → Cloudflare Pages) and `backend/deploy-backend` (SCP + systemd restart).
