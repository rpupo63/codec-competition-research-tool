# E2E tests (Playwright)

Playwright starts both servers itself (see `playwright.config.ts`):

- Go backend on :3001 with `FAKE_PROVIDERS=true` — SerpAPI/EnrichLayer/Gemini are
  replaced by deterministic fakes (`backend/services/fakes`), so **no API keys are needed**.
- Vite dev server on :4173 pointed at the fake-provider backend.

## Run locally

```bash
# Postgres must be reachable; default DSN targets a codec_e2e database:
createdb codec_e2e   # or: export E2E_DATABASE_URL=postgres://...

cd e2e
npm install
npx playwright install chromium
npx playwright test
```

Note: the live-pipeline spec persists "Fake Target Inc" with its dossier, and the
dossier has a unique-per-company constraint. Re-runs against the same database work
(later runs use the fast path), but if a run gets into a weird state, drop and
recreate `codec_e2e`.

## CI

`.github/workflows/ci.yml` runs `go test`, a frontend build, and this suite against
a `postgres:16` service container on every push to `main` and every PR.
