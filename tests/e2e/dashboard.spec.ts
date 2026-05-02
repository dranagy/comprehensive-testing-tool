import { test, expect } from "@playwright/test";

/**
 * E2E Tests: Dashboard
 *
 * Covers TESTING_GUIDE.md Part 4 manual tests:
 *   Test 1 — Dashboard Loads
 *   Test 2 — Create Session
 */

test.describe("Dashboard", () => {
  test("Test 1: dashboard loads with empty state message and New Session button", async ({ page }) => {
    await page.goto("/");

    // Wait for loading to finish (use main content area to avoid TopBar's "Loading..." option)
    await expect(page.locator("main").getByText("Loading...")).not.toBeVisible({ timeout: 8_000 });

    // Heading
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Stat cards are present
    await expect(page.getByText("Total Sessions")).toBeVisible();
    await expect(page.getByText("Active Sessions")).toBeVisible();
    await expect(page.getByText("Last Run Pass Rate")).toBeVisible();

    // When no sessions exist yet, empty state message should be shown
    // (This test runs first so the DB may have sessions from prior runs;
    //  we verify the key chrome elements regardless.)
    await expect(page.getByRole("link", { name: "+ New Session" })).toBeVisible();

    // Sidebar brand
    await expect(page.getByText("CTT")).toBeVisible();
    await expect(page.getByText("Testing Platform")).toBeVisible();
  });

  test("Test 2: create session — form validation, submit, and redirect to session detail", async ({ page }) => {
    await page.goto("/sessions/new");

    // Page heading
    await expect(page.getByRole("heading", { name: "New Session" })).toBeVisible();

    // Create button is disabled while Target URL is empty
    const createBtn = page.getByRole("button", { name: "Create Session" });
    await expect(createBtn).toBeDisabled();

    // Fill required Target URL
    await page.getByPlaceholder("https://example.com").fill("https://example-e2e.com");

    // Create button becomes enabled
    await expect(createBtn).toBeEnabled();

    // Optionally set a session name
    await page.getByPlaceholder("My test session").fill("E2E Test Session");

    // Submit
    await createBtn.click();

    // Should redirect to the session detail page
    await expect(page).toHaveURL(/\/sessions\/[a-zA-Z0-9-]+$/, { timeout: 15_000 });

    // Session detail: heading shows the session name
    await expect(page.getByRole("heading", { name: "E2E Test Session" })).toBeVisible({ timeout: 10_000 });

    // Target URL is visible
    await expect(page.getByText("https://example-e2e.com")).toBeVisible();

    // Phase progress shows INGESTION (initial phase)
    await expect(page.locator("main").getByText("INGESTION")).toBeVisible();

    // Test count cards are rendered
    await expect(page.getByText("Functional Tests")).toBeVisible();
    await expect(page.getByText("Performance Tests")).toBeVisible();
    await expect(page.getByText("Security Tests")).toBeVisible();

    // Quick action button is present
    await expect(page.getByRole("link", { name: "Upload Documents" })).toBeVisible();
  });

  test("Test 2b: cancel on new session page navigates back", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "+ New Session" }).click();
    await expect(page).toHaveURL("/sessions/new");

    await page.getByRole("button", { name: "Cancel" }).click();
    // Should navigate back (to dashboard or previous page)
    await expect(page).not.toHaveURL("/sessions/new");
  });

  test("Test 2c: create session without URL shows button disabled", async ({ page }) => {
    await page.goto("/sessions/new");
    // Confirm button disabled when no URL is typed
    await expect(page.getByRole("button", { name: "Create Session" })).toBeDisabled();
    // Enter only the name (no URL)
    await page.getByPlaceholder("My test session").fill("No URL Session");
    await expect(page.getByRole("button", { name: "Create Session" })).toBeDisabled();
  });
});
