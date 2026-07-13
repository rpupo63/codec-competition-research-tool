import { test, expect } from "@playwright/test";
import { API_URL } from "../playwright.config";

test.describe("backend health", () => {
  test("GET /api/test returns OK", async ({ request }) => {
    const res = await request.get(`${API_URL}/test`);
    expect(res.status()).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("GET /healthcheck reports uptime", async ({ request }) => {
    const res = await request.get(API_URL.replace("/api", "/healthcheck"));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("startup_time");
    expect(body).toHaveProperty("uptime_seconds");
  });
});
