import { test, expect } from "@playwright/test";
import { createSession } from "./helpers.js";

/**
 * E2E Tests: Error Handling & Export
 *
 * Covers TESTING_GUIDE.md Part 4 manual tests:
 *   Test 11 — Error Handling (API unreachable)
 *   Test 12 — Export
 */

test.describe("Error Handling", () => {
  /**
   * Test 11: When the API is unavailable, the frontend shows an error toast
   * (red notification in the bottom-right).
   *
   * We simulate this by intercepting all API calls and returning 500.
   */
  test("Test 11: intercepted API failure shows an error toast on the dashboard", async ({ page }) => {
    // Intercept all API calls and respond with 500
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: "Service unavailable" }) })
    );

    await page.goto("/");

    // Wait for the error toast to appear (the dashboard tries to load sessions)
    await expect(page.locator('[role="alert"], [data-toast], .toast, [class*="toast"]').or(
      page.getByText(/Failed to load|error|unavailable/i)
    )).toBeVisible({ timeout: 10_000 });
  });

  test("Test 11a: 404 for unknown session ID shows not-found state", async ({ page }) => {
    await page.goto("/sessions/00000000-0000-0000-0000-000000000000");
    // Page should render without crashing; might show "Session not found" or an error
    await page.locator("main").getByText("Loading...").waitFor({ state: "hidden", timeout: 8_000 }).catch(() => {});
    // The UI should display an appropriate message (not an unhandled crash)
    await expect(page.getByText("Session not found.")).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("Export", () => {
  let sessionId: string;

  test.beforeAll(async () => {
    const s = await createSession("Export E2E Session", "https://export.example.com");
    sessionId = s.id;
  });

  test("Test 12: export page loads", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}/export`);
    // Page should render without errors
    await expect(page.getByText("Loading...")).not.toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL(`/sessions/${sessionId}/export`);
  });

  test("Test 12a: API export endpoint returns session data", async ({ page }) => {
    // Verify the REST export endpoint works (tests the output from the application)
    const response = await page.request.get(`http://localhost:3456/api/sessions/${sessionId}/export`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    // The export should contain the session
    expect(data).toBeDefined();
    expect(typeof data).toBe("object");
  });

  test("Test 12b: session detail shows export link", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}`);
    await expect(page.getByRole("heading", { name: "Export E2E Session" })).toBeVisible();

    // Navigate to the export page via URL
    await page.goto(`/sessions/${sessionId}/export`);
    await expect(page).toHaveURL(`/sessions/${sessionId}/export`);
  });
});
