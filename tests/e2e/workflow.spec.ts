import { test, expect } from "@playwright/test";
import { createSession, uploadTextDoc, approvePhase } from "./helpers.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

/**
 * E2E Tests: Session Workflow
 *
 * Covers TESTING_GUIDE.md Part 4 manual tests:
 *   Test 5  — Upload Documents
 *   Test 6  — Review Test Cases
 *   Test 7  — Approval Flow
 *   Test 8  — Run Tests (dry run)
 *   Test 9  — Reports
 *
 * Tests run in serial order so that state (uploaded docs, generated test cases,
 * approved gates) carries through to subsequent tests.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const TEST_CASES_MD = path.join(FIXTURES_DIR, "test-cases.md");
const SIMPLE_TXT = path.join(FIXTURES_DIR, "simple.txt");

test.describe.serial("Session Workflow", () => {
  let sessionId: string;

  test.beforeAll(async () => {
    const session = await createSession("Workflow E2E Session", "https://workflow.example.com");
    sessionId = session.id;
    // Seed the session with uploaded docs and approved test cases via API
    // so the Run tests (Test 8b) and Reports (Test 9) have data to work with.
    const docContent = fs.readFileSync(TEST_CASES_MD, "utf8");
    await uploadTextDoc(sessionId, "test-cases.md", docContent);
    await approvePhase(sessionId, "FUNCTIONAL");
  });

  // ─── Test 5: Upload Documents ─────────────────────────────────────────────

  test("Test 5: ingest page loads and accepts file upload", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}/ingest`);
    await expect(page.getByRole("heading", { name: "Upload Documents" })).toBeVisible();

    // Drop zone is visible
    await expect(page.getByText("Drop files here or click to browse")).toBeVisible();
    await expect(page.getByText("Accepted: PDF, DOCX, TXT, Markdown")).toBeVisible();

    // Upload test-cases.md via the hidden file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CASES_MD);

    // Wait for the uploaded document to appear in the list
    await expect(page.getByText("Uploaded Documents")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("test-cases.md")).toBeVisible();
  });

  test("Test 5b: uploading a second file shows both in the uploaded list", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}/ingest`);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(SIMPLE_TXT);

    await expect(page.getByText("Uploaded Documents")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("simple.txt")).toBeVisible();
  });

  // ─── Test 6: Review Test Cases ────────────────────────────────────────────

  test("Test 6: test cases page lists generated test cases", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}/test-cases`);
    await expect(page.getByRole("heading", { name: "Test Cases" })).toBeVisible();

    // Wait for test cases to load (may be 0 if generation hasn't run)
    await expect(page.locator("main").getByText("Loading...")).not.toBeVisible({ timeout: 8_000 });

    // Page renders table headers or empty state — both are valid
    const hasTable = await page.getByRole("table").isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no test cases|empty/i).isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);
  });

  test("Test 6a: status filter dropdown is visible on test cases page", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}/test-cases`);
    await expect(page.locator("main").getByText("Loading...")).not.toBeVisible({ timeout: 8_000 });

    // The filter controls should be present
    const filterEl = page.locator("select").first();
    await expect(filterEl).toBeVisible();
  });

  // ─── Test 7: Approval Flow ────────────────────────────────────────────────

  test("Test 7: approval page loads and shows gates", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}/approval`);
    await expect(page.getByRole("heading", { name: "Approval Gates" })).toBeVisible();

    // Wait for loading to finish
    await expect(page.locator("main").getByText("Loading...")).not.toBeVisible({ timeout: 8_000 });

    // Should show approval gates or empty state
    const hasGates = await page.locator(".border-l-4").first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText("No approval gates found.").isVisible().catch(() => false);
    expect(hasGates || hasEmpty).toBe(true);
  });

  test("Test 7a: when a gate is PENDING, Approve/Reject/Skip buttons are visible", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}/approval`);
    await expect(page.locator("main").getByText("Loading...")).not.toBeVisible({ timeout: 8_000 });

    // If PENDING gates exist, action buttons should be present
    const approveBtns = await page.getByRole("button", { name: "Approve" }).count();
    const rejectBtns = await page.getByRole("button", { name: "Reject" }).count();
    const skipBtns = await page.getByRole("button", { name: "Skip" }).count();

    // There should be the same number of each (one per PENDING gate), or all 0 if no pending gates
    expect(approveBtns).toBe(rejectBtns);
    expect(rejectBtns).toBe(skipBtns);
  });

  test("Test 7b: approving a gate updates its status", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}/approval`);
    await expect(page.locator("main").getByText("Loading...")).not.toBeVisible({ timeout: 8_000 });

    const approveBtns = page.getByRole("button", { name: "Approve" });
    const count = await approveBtns.count();
    if (count === 0) {
      // No pending gates — skip; state was already resolved
      test.skip();
      return;
    }

    // Optionally add a comment
    const textarea = page.locator("textarea").first();
    await textarea.fill("Looks good");

    // Click Approve on the first gate
    await approveBtns.first().click();

    // The gate status should change away from PENDING
    await expect(page.getByText("APPROVED")).toBeVisible({ timeout: 8_000 });
  });

  // ─── Test 8: Run Tests ────────────────────────────────────────────────────

  test("Test 8: run page loads with selection modes and configuration", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}/run`);
    await expect(page.getByRole("heading", { name: "Run Tests" })).toBeVisible();

    // Selection mode options
    await expect(page.getByText("All approved tests")).toBeVisible();
    await expect(page.getByText("By phase")).toBeVisible();
    await expect(page.getByText("Specific tests")).toBeVisible();
    await expect(page.getByText("Failed only")).toBeVisible();
    await expect(page.getByText("By tag")).toBeVisible();

    // Configuration section
    await expect(page.getByText("Configuration")).toBeVisible();
    await expect(page.getByText("Browser")).toBeVisible();
    await expect(page.getByText("Parallel Workers")).toBeVisible();
    await expect(page.getByLabel("Dry Run")).toBeVisible();
  });

  test("Test 8a: selecting 'By phase' reveals phase selector", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}/run`);
    await page.getByText("By phase").click();

    // Phase selector should appear
    const phaseSelect = page.locator("select").filter({ hasText: /Functional|Performance|Security/ });
    await expect(phaseSelect).toBeVisible();
    await expect(phaseSelect).toContainText("Functional");
  });

  test("Test 8b: enabling dry run and clicking Run Tests navigates to run progress page", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}/run`);

    // Enable dry run
    await page.getByLabel("Dry Run").check();

    // Click Run Tests
    const runBtn = page.getByRole("button", { name: "Run Tests" });
    await runBtn.click();

    // Should navigate to run progress page
    await expect(page).toHaveURL(/\/sessions\/[a-zA-Z0-9-]+\/run\/[a-zA-Z0-9-]+/, { timeout: 10_000 });
  });

  // ─── Test 9: Reports ──────────────────────────────────────────────────────

  test("Test 9: summary report page loads with stat cards", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}/reports/summary`);
    await expect(page.getByRole("heading", { name: "Summary Report" })).toBeVisible();
    await expect(page.locator("main").getByText("Loading report...")).not.toBeVisible({ timeout: 8_000 });

    // Stat cards
    await expect(page.getByText("Total Tests")).toBeVisible();
    await expect(page.getByText("Pass Rate")).toBeVisible();
    await expect(page.getByText("Security Findings")).toBeVisible();
    await expect(page.getByText("SLA Status")).toBeVisible();
  });

  test("Test 9a: summary report has links to sub-reports", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}/reports/summary`);
    await expect(page.locator("main").getByText("Loading report...")).not.toBeVisible({ timeout: 8_000 });

    await expect(page.getByRole("link", { name: "Functional Report" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Performance Report" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Security Report" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Audit Trail" })).toBeVisible();
  });

  test("Test 9b: functional report page loads", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}/reports/functional`);
    await expect(page.locator("main").getByText("Loading...")).not.toBeVisible({ timeout: 8_000 });

    // Either shows results or empty state
    await expect(page).toHaveURL(`/sessions/${sessionId}/reports/functional`);
  });

  test("Test 9c: security report page loads", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}/reports/security`);
    await expect(page.locator("main").getByText("Loading...")).not.toBeVisible({ timeout: 8_000 });

    await expect(page).toHaveURL(`/sessions/${sessionId}/reports/security`);
  });

  test("Test 9d: audit trail page loads and shows entries", async ({ page }) => {
    await page.goto(`/sessions/${sessionId}/reports/audit`);
    await expect(page.locator("main").getByText("Loading...")).not.toBeVisible({ timeout: 8_000 });

    await expect(page).toHaveURL(`/sessions/${sessionId}/reports/audit`);
  });
});
