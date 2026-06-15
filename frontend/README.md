# Codec — Frontend

React + TypeScript SPA for the Codec briefing interface. Connects to the Go backend via REST and SSE.

**[Live demo →](https://distro-interview.xyz)**

## Visual design

The frontend implements Codec's tactical briefing aesthetic on top of shadcn/ui primitives.

### Color and typography

Defined in `src/index.css` and `tailwind.config.ts`:

- **Background**: pure black (`--background: 0 0% 0%`)
- **Foreground**: phosphor green (`--foreground: 153 90% 61%`)
- **Font**: Space Mono — monospace throughout for a terminal/HUD feel
- **Glow tokens**: `--codec-glow` and `--codec-glow-strong` box-shadows on active panels

### Key CSS classes

| Class | Purpose |
|---|---|
| `mgs-border` / `mgs-border-strong` | Notched-corner clip-path borders (Metal Gear Solid briefing panels) |
| `portrait-frame` | Character portrait container with scan-line overlay animation |
| `codec-border` / `codec-border-strong` | Glowing green borders for active UI chrome |
| `dossier-header` / `dossier-tab` / `dossier-tab-active` | Intel Dossier slide-in panel styling |
| `text-glow` / `text-glow-strong` | Phosphor text-shadow on headings and threat labels |

### Components

| Component | Role |
|---|---|
| `CodecScreen` | Main briefing view — portraits, chat, agent progress, dossier |
| `PortraitFrame` | Colonel/Snake portraits with speaking pulse |
| `FrequencyDisplay` | Token count as a frequency readout + 32-bar activity meter |
| `DossierPanel` | Slide-in dossier with Matrix / Vulnerabilities / Strike Plan tabs |
| `SignalLostOverlay` | Static noise + interference lines for connection errors |
| `ChatMessage` | Typewriter-style message rendering with sender labels |
| `CompetitorPicker` | Multi-select grid for choosing analysis targets |

### Motion

Framer Motion handles dossier panel slide-in, message entrance animations, thinking-state bar oscillation, and the Signal Lost overlay. `use-audio-playback` loops ambient codec audio during active sessions.

## Stack

- **React 18** + **TypeScript** via **Vite**
- **Tailwind CSS** + **shadcn/ui**
- **Framer Motion** for animations
- **TanStack Query** for server state
- **React Router** for navigation

## Running locally

```bash
cd frontend
npm install
npm run dev        # http://localhost:8080
```

Point at a local backend with `VITE_API_URL`:

```bash
VITE_API_URL=http://localhost:3001/api npm run dev
```

## Routes

| Route | Description |
|---|---|
| `/` | Main Codec briefing screen |
| `/operations` | Session archive / mission log |

## Deploy

```bash
./deploy-frontend
```

Builds with `VITE_API_URL=https://api.distro-interview.xyz/api` and deploys to Cloudflare Pages via Wrangler.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080/api` | Backend API base URL |
