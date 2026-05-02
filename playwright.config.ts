import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for the CTT web application.
 *
 * Tests cover the full-stack workflow of the CTT dashboard:
 * - Dashboard load and session creation
 * - Sidebar navigation and session selector
 * - Document upload, test case review, approval gates
 * - Test execution (dry run) and reports
 * - Settings management
 * - Error handling
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Give pages time to connect to the API
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Auto-start the backend API and Next.js frontend before tests run
  webServer: [
    {
      // API server on port 3456
      command: "node_modules/.bin/tsx --import tsx/esm src/api/server.ts",
      url: "http://localhost:3456/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { CTT_PORT: "3456", NODE_ENV: "test" },
    },
    {
      // Next.js frontend on port 3000
      command: "cd frontend && npm run dev -- -p 3000",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { NEXT_PUBLIC_API_URL: "http://localhost:3456/api" },
    },
  ],
});
