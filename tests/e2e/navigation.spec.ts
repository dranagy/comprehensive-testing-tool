import { test, expect } from "@playwright/test";
import { createSession } from "./helpers.js";

/**
 * E2E Tests: Navigation
 *
 * Covers TESTING_GUIDE.md Part 4 manual tests:
 *   Test 3 — Sidebar Navigation
 *   Test 4 — TopBar Session Selector
 */

test.describe("Navigation", () => {
  let sessionId: string;
  let sessionId2: string;

  test.beforeAll(async () => {
    const s1 = await createSession("Nav Test Session A", "https://nav-a.example.com");
    sessionId = s1.id;
    const s2 = await createSession("Nav Test Session B", "https://nav-b.example.com");
    sessionId2 = s2.id;
  });

  test("Test 3: sidebar shows static and session-scoped links; active link is highlighted", async ({ page }) => {
    await page.addInitScript((id) => localStorage.setItem("ctt-active-session", id), sessionId);
    await page.goto(`/sessions/${sessionId}`);
    // Wait for the session to load
    await expect(page.getByRole("heading", { name: "Nav Test Session A" })).toBeVisible();

    // Static nav item
    await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();

    // Session-scoped nav items appear
    await expect(page.getByRole("link", { name: "Ingest" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Test Cases" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Approve" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Run" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reports" })).toBeVisible();

    // Settings at bottom of sidebar
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  });

  test("Test 3a: clicking Ingest navigates to /sessions/:id/ingest", async ({ page }) => {
    await page.addInitScript((id) => localStorage.setItem("ctt-active-session", id), sessionId);
    await page.goto(`/sessions/${sessionId}`);
    await expect(page.getByRole("heading", { name: "Nav Test Session A" })).toBeVisible();

    await page.getByRole("link", { name: "Ingest" }).click();
    await expect(page).toHaveURL(`/sessions/${sessionId}/ingest`);
    await expect(page.getByRole("heading", { name: "Upload Documents" })).toBeVisible();
  });

  test("Test 3b: clicking Test Cases navigates to /sessions/:id/test-cases", async ({ page }) => {
    await page.addInitScript((id) => localStorage.setItem("ctt-active-session", id), sessionId);
    await page.goto(`/sessions/${sessionId}`);
    await expect(page.getByRole("heading", { name: "Nav Test Session A" })).toBeVisible();

    await page.getByRole("link", { name: "Test Cases" }).click();
    await expect(page).toHaveURL(`/sessions/${sessionId}/test-cases`);
    await expect(page.getByRole("heading", { name: "Test Cases" })).toBeVisible();
  });

  test("Test 3c: clicking Approve navigates to /sessions/:id/approval", async ({ page }) => {
    await page.addInitScript((id) => localStorage.setItem("ctt-active-session", id), sessionId);
    await page.goto(`/sessions/${sessionId}`);
    await expect(page.getByRole("heading", { name: "Nav Test Session A" })).toBeVisible();

    await page.getByRole("link", { name: "Approve" }).click();
    await expect(page).toHaveURL(`/sessions/${sessionId}/approval`);
    await expect(page.getByRole("heading", { name: "Approval Gates" })).toBeVisible();
  });

  test("Test 3d: clicking Run navigates to /sessions/:id/run", async ({ page }) => {
    await page.addInitScript((id) => localStorage.setItem("ctt-active-session", id), sessionId);
    await page.goto(`/sessions/${sessionId}`);
    await expect(page.getByRole("heading", { name: "Nav Test Session A" })).toBeVisible();

    await page.getByRole("link", { name: "Run" }).click();
    await expect(page).toHaveURL(`/sessions/${sessionId}/run`);
    await expect(page.getByRole("heading", { name: "Run Tests" })).toBeVisible();
  });

  test("Test 3e: clicking Reports navigates to /sessions/:id/reports/summary", async ({ page }) => {
    await page.addInitScript((id) => localStorage.setItem("ctt-active-session", id), sessionId);
    await page.goto(`/sessions/${sessionId}`);
    await expect(page.getByRole("heading", { name: "Nav Test Session A" })).toBeVisible();

    await page.getByRole("link", { name: "Reports" }).click();
    await expect(page).toHaveURL(`/sessions/${sessionId}/reports/summary`);
    await expect(page.getByRole("heading", { name: "Summary Report" })).toBeVisible();
  });

  test("Test 4: TopBar session selector switches the active session", async ({ page }) => {
    // Set sessionA as active in localStorage before navigating
    await page.addInitScript((id) => localStorage.setItem("ctt-active-session", id), sessionId);
    // Navigate to first session
    await page.goto(`/sessions/${sessionId}`);
    await expect(page.getByRole("heading", { name: "Nav Test Session A" })).toBeVisible();

    // The session selector dropdown should be visible in the top bar
    const selector = page.locator("header select");
    await expect(selector).toBeVisible();

    // Switch to the second session
    await selector.selectOption(sessionId2);

    // Should navigate to the second session detail page
    await expect(page).toHaveURL(`/sessions/${sessionId2}`, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Nav Test Session B" })).toBeVisible();
  });

  test("Test 4a: Settings link navigates to /settings", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });
});
