import { test, expect } from "@playwright/test";
import { API_URL } from "../playwright.config";

test.describe("operations list", () => {
  test("lists sessions and filters by search", async ({ page }) => {
    await page.request.post(`${API_URL}/sessions`, { data: { title: "Alpha recon" } });
    await page.request.post(`${API_URL}/sessions`, { data: { title: "Bravo strike" } });

    await page.goto("/operations");
    await expect(page.getByRole("heading", { name: "All Operations" })).toBeVisible();
    // Titles also render in the sidebar, so scope to the list's links.
    await expect(page.getByRole("link", { name: /Alpha recon/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Bravo strike/ })).toBeVisible();

    await page.getByPlaceholder("Search operations...").fill("Alpha");
    await expect(page.getByRole("link", { name: /Alpha recon/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Bravo strike/ })).toHaveCount(0);
  });

  test("clicking an operation opens its codec screen", async ({ page }) => {
    const created = await page.request.post(`${API_URL}/sessions`, {
      data: { title: "Clickable operation" },
    });
    const session = await created.json();

    await page.goto("/operations");
    await page.getByRole("link", { name: /Clickable operation/ }).click();
    await expect(page).toHaveURL(new RegExp(`/operations/${session.id}`));
    await expect(page.getByPlaceholder("Send a message...")).toBeVisible();
  });
});
