import { test, expect, type Page } from "@playwright/test";
import { API_URL } from "../playwright.config";

// The backend runs with FAKE_PROVIDERS=true, so the analysis pipeline always
// resolves the target to "Fake Target Inc" and discovers three deterministic
// competitors (Globex Corporation, Initech Systems, Umbrella Dynamics).
//
// The intel dossier has a unique company constraint, so only the FIRST test
// below may take the live pipeline path. Later tests mention "Fake Target Inc"
// in the message so the backend serves the fast path from the database.

async function openFreshSession(page: Page): Promise<string> {
  const created = await page.request.post(`${API_URL}/sessions`, {
    data: { title: "New operation" },
  });
  expect(created.ok()).toBeTruthy();
  const session = await created.json();
  await page.goto(`/operations/${session.id}`);
  await expect(page.getByPlaceholder("Send a message...")).toBeVisible();
  return session.id;
}

async function runAnalysis(page: Page, message: string) {
  const input = page.getByPlaceholder("Send a message...");
  await input.fill(message);
  await input.press("Enter");

  // The pipeline resolves the company and asks for confirmation.
  await expect(page.getByText("TARGET IDENTIFIED")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "CONFIRM TARGET" }).click();
}

test.describe("chat analysis pipeline (mocked providers)", () => {
  test("full run: confirm target, receive competitors, dossier and picker", async ({ page }) => {
    const sessionId = await openFreshSession(page);
    await runAnalysis(page, "run a competitive analysis on my startup");

    // Intel lines for the deterministic competitors appear in the main tab.
    await expect(page.getByText(/\[HIGH\] Globex Corporation/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/\[HIGH\] Initech Systems/)).toBeVisible();
    await expect(page.getByText(/\[HIGH\] Umbrella Dynamics/)).toBeVisible();

    // Deep-recon picker renders.
    await expect(page.getByText("SELECT TARGET FOR DEEP RECON")).toBeVisible();

    // Competitors were persisted for the session.
    const res = await page.request.get(`${API_URL}/sessions/${sessionId}/competitors`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.competitors).toHaveLength(3);
    expect(body.dossier?.operationName).toBe("OPERATION PAPER TIGER");
  });

  test("aborting the confirmation cancels the mission", async ({ page }) => {
    await openFreshSession(page);

    const input = page.getByPlaceholder("Send a message...");
    await input.fill("look into fake target inc but wait for my go");
    await input.press("Enter");

    await expect(page.getByText("TARGET IDENTIFIED")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "ABORT MISSION" }).click();

    await expect(page.getByText("Mission aborted. Target unconfirmed.", { exact: false })).toBeVisible();
    // Input is usable again.
    await expect(input).toBeEnabled();
  });

  test("competitor drilldown returns synthesized intel", async ({ page }) => {
    await openFreshSession(page);
    await runAnalysis(page, "brief me on fake target inc");

    await expect(page.getByText("SELECT TARGET FOR DEEP RECON")).toBeVisible({ timeout: 30_000 });

    // Pick Globex for deep recon — opens its tab and fetches the drilldown.
    await page.getByRole("button", { name: /Globex Corporation/ }).first().click();

    await expect(
      page.getByText("Colonel, give me everything on Globex Corporation.", { exact: false }),
    ).toBeVisible({ timeout: 15_000 });
    // FakeLLM's synthesis recommendation surfaces as the drilldown analysis.
    await expect(page.getByText(/Undercut Globex Corporation on pricing/)).toBeVisible({
      timeout: 30_000,
    });
  });

  test("session restores messages and competitor tabs after reload", async ({ page }) => {
    const sessionId = await openFreshSession(page);
    await runAnalysis(page, "fake target inc persistence check");
    await expect(page.getByText(/\[HIGH\] Globex Corporation/)).toBeVisible({ timeout: 30_000 });

    await page.goto(`/operations/${sessionId}`);

    // Persisted user message and colonel reply come back from the DB.
    await expect(page.getByText("fake target inc persistence check")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(/gathered initial intelligence on Fake Target Inc/),
    ).toBeVisible();

    // Competitor tabs are rebuilt from session competitors.
    await expect(page.getByText("Globex Corporation").first()).toBeVisible();
  });
});
