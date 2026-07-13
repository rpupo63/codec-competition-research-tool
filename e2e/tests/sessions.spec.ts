import { test, expect } from "@playwright/test";
import { API_URL } from "../playwright.config";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

test.describe("session CRUD", () => {
  test("visiting the app lands on an operation and greets the analyst", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(new RegExp(`/operations/${UUID_RE.source}`));
    await expect(page.getByText("Snake, do you read me?")).toBeVisible();
  });

  test("NEW OPERATION creates a session and navigates to it", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(new RegExp(`/operations/${UUID_RE.source}`));
    const firstUrl = page.url();

    await page.getByRole("button", { name: "NEW OPERATION" }).click();
    await expect(page).toHaveURL(new RegExp(`/operations/${UUID_RE.source}`));
    await expect.poll(() => page.url()).not.toBe(firstUrl);

    // The new session is persisted server-side.
    const res = await page.request.get(`${API_URL}/sessions`);
    expect(res.ok()).toBeTruthy();
    const sessions = await res.json();
    expect(sessions.length).toBeGreaterThanOrEqual(2);
  });

  test("PATCH renames a session and the sidebar reflects it", async ({ page }) => {
    // Create a dedicated session via the API.
    const created = await page.request.post(`${API_URL}/sessions`, {
      data: { title: "Rename me" },
    });
    expect(created.ok()).toBeTruthy();
    const session = await created.json();

    const patch = await page.request.patch(`${API_URL}/sessions/${session.id}`, {
      data: { title: "Operation Renamed" },
    });
    expect(patch.status()).toBe(204);

    await page.goto("/operations");
    await expect(page.getByRole("link", { name: /Operation Renamed/ })).toBeVisible();
  });

  test("PATCH with an unknown session id returns 404", async ({ request }) => {
    const res = await request.patch(
      `${API_URL}/sessions/00000000-0000-0000-0000-000000000001`,
      { data: { title: "ghost" } },
    );
    expect(res.status()).toBe(404);
  });

  test("deleting a session removes it from the sidebar and the API", async ({ page }) => {
    // Ensure at least two sessions exist (delete button only renders when >1).
    await page.request.post(`${API_URL}/sessions`, { data: { title: "Doomed operation" } });
    await page.request.post(`${API_URL}/sessions`, { data: { title: "Survivor operation" } });

    await page.goto("/");
    const doomed = page.getByRole("button", { name: "Doomed operation" }).first();
    await expect(doomed).toBeVisible();

    // The trash action appears on hover on the sidebar row.
    await doomed.hover();
    const row = page.locator("li", { has: doomed });
    await row.locator("[data-sidebar='menu-action']").click();

    await expect(page.getByRole("button", { name: "Doomed operation" })).toHaveCount(0);

    const res = await page.request.get(`${API_URL}/sessions`);
    const sessions: Array<{ title: string }> = await res.json();
    expect(sessions.some((s) => s.title === "Doomed operation")).toBe(false);
    expect(sessions.some((s) => s.title === "Survivor operation")).toBe(true);
  });
});
