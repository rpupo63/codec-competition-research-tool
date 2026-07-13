import { defineConfig, devices } from "@playwright/test";

// Backend and frontend are started by Playwright itself (webServer below).
// The backend runs with FAKE_PROVIDERS=true so no SerpAPI/EnrichLayer/Gemini
// keys are ever needed — the pipeline returns deterministic fixture data.
const BACKEND_PORT = 3001;
const FRONTEND_PORT = 4173;

export const API_URL = `http://localhost:${BACKEND_PORT}/api`;

const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/codec_e2e?sslmode=disable";

export default defineConfig({
  testDir: "./tests",
  // Specs share one backend database, so run them sequentially.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `cd ../backend && go build -o /tmp/codec-e2e-server . && exec /tmp/codec-e2e-server`,
      url: `http://localhost:${BACKEND_PORT}/api/test`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: String(BACKEND_PORT),
        DATABASE_URL,
        FAKE_PROVIDERS: "true",
        GENERATE_MODELS: "true", // auto-migrate; overrides backend/.env
        ACCEPTED_ORIGINS: `http://localhost:${FRONTEND_PORT}`,
      },
    },
    {
      command: `cd ../frontend && npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_API_URL: API_URL,
      },
    },
  ],
});
