import { test, expect } from "@playwright/test";

/**
 * E2E Tests: Settings
 *
 * Covers TESTING_GUIDE.md Part 4 manual tests:
 *   Test 10 — Settings
 */

test.describe("Settings", () => {
  test("Test 10: settings page loads current configuration", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.locator("main").getByText("Loading settings...")).not.toBeVisible({ timeout: 8_000 });

    // Sections are rendered
    await expect(page.getByText("General")).toBeVisible();
    await expect(page.getByText("Performance Defaults")).toBeVisible();
    await expect(page.getByText("Security Defaults")).toBeVisible();
    await expect(page.getByText("Output Defaults")).toBeVisible();

    // Form fields (labels exist in the page)
    await expect(page.getByText("Default Target URL")).toBeVisible();
    await expect(page.getByText("Default Browsers")).toBeVisible();
    await expect(page.getByText("Virtual Users")).toBeVisible();

    // Action buttons
    await expect(page.getByRole("button", { name: "Save Settings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset to Defaults" })).toBeVisible();
  });

  test("Test 10a: updating Default Target URL and saving shows success message", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("main").getByText("Loading settings...")).not.toBeVisible({ timeout: 8_000 });

    // Update the target URL (the input has placeholder "https://example.com")
    const urlField = page.getByPlaceholder("https://example.com");
    await urlField.fill("https://updated-e2e.example.com");

    // Save
    await page.getByRole("button", { name: "Save Settings" }).click();

    // Success message should appear
    await expect(page.getByText("Settings saved successfully.")).toBeVisible({ timeout: 8_000 });
  });

  test("Test 10b: resetting settings shows success message", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("main").getByText("Loading settings...")).not.toBeVisible({ timeout: 8_000 });

    await page.getByRole("button", { name: "Reset to Defaults" }).click();

    // Success message should appear
    await expect(page.getByText("Settings reset to defaults.")).toBeVisible({ timeout: 8_000 });
  });

  test("Test 10c: browser checkboxes toggle correctly", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("main").getByText("Loading settings...")).not.toBeVisible({ timeout: 8_000 });

    // firefox checkbox (the label text is "firefox" as a sibling of the checkbox)
    const firefoxCheckbox = page.locator('input[type="checkbox"]').nth(1);
    const initialState = await firefoxCheckbox.isChecked();

    // Toggle it
    await firefoxCheckbox.click();
    expect(await firefoxCheckbox.isChecked()).toBe(!initialState);

    // Toggle back
    await firefoxCheckbox.click();
    expect(await firefoxCheckbox.isChecked()).toBe(initialState);
  });
});
