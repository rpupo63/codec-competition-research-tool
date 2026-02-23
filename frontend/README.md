# CODEC — Frontend

React + TypeScript SPA. Connects to the Go backend via REST and SSE.

## Stack

- **React 18** + **TypeScript** via **Vite**
- **Tailwind CSS** + **shadcn/ui** for components
- **Framer Motion** for animations
- **TanStack Query** for server state
- **React Router** for navigation

## Running locally

```bash
cd frontend
npm install
npm run dev        # http://localhost:8080
```

The frontend defaults to `http://localhost:8080/api` for API calls. If your backend
runs on a different port, set `VITE_API_URL` before starting:

```bash
VITE_API_URL=http://localhost:3001/api npm run dev
```

## Key screens

| Route | Description |
|---|---|
| `/` | Main CODEC screen — chat input, live agent progress, competitor tabs, Intel Dossier |
| `/operations` | Session list — browse and resume past analyses |

## Project layout

```
src/
├── components/
│   ├── codec/          # CodecScreen — the main analysis view
│   ├── report/         # ReportScreen — printable dossier view
│   ├── shared/         # Reusable pieces: DossierPanel, ChatMessage, CompetitorPicker…
│   ├── layout/         # AppLayout, ChatSidebar
│   └── ui/             # shadcn/ui primitives
├── contexts/           # ChatSessionContext, AudioContext
├── hooks/              # use-audio-playback, use-sidebar, use-form-field
├── pages/              # Index, OperationsScreen, NotFound
├── services/           # ApiService (SSE + REST client), MockApiService
└── types/              # codec.ts, common.ts, report.ts
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080/api` | Backend API base URL |
