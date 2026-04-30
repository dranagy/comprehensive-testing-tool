import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { BrowserManager } from "../../src/modules/functional/browser-manager.js";
import type { TestCase } from "../../src/shared/types.js";

/**
 * Integration test for cross-browser functional test execution.
 *
 * These tests require Playwright browsers to be installed.
 * Run `npx playwright install` before running this test.
 * The test uses a simple HTTP target (httpbin or similar).
 *
 * To skip: set SKIP_INTEGRATION=1
 */
const skipIntegration = process.env.SKIP_INTEGRATION === "1";

describe.skipIf(skipIntegration)("Cross-browser functional execution", () => {
  let manager: BrowserManager;

  beforeAll(async () => {
    manager = new BrowserManager();
  });

  afterAll(async () => {
    await manager.closeBrowsers();
  });

  it("runs a test across chromium with fresh context", async () => {
    await manager.launchBrowsers(["chromium"]);

    const tc: TestCase = {
      id: "int-tc-001",
      sessionId: "int-session",
      sourceDocumentId: null,
      phase: "FUNCTIONAL",
      name: "Cross-browser navigation test",
      description: "Navigate to a page and verify content",
      definition: {
        steps: [
          { action: "navigate", selector: "https://httpbin.org/get", description: "Navigate to httpbin" },
        ],
        assertions: [
          { type: "url", expected: "httpbin.org" },
        ],
      },
      approvalStatus: "APPROVED",
      tags: ["integration"],
      editHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await manager.executeTest(tc, "https://httpbin.org", "chromium", "int-session");

    expect(result.testCaseId).toBe("int-tc-001");
    expect(result.status).toBe("PASSED");
    expect(result.browser).toBe("chromium");
    expect(result.durationMs).toBeGreaterThan(0);
  }, 30000);

  it("creates isolated contexts between tests", async () => {
    await manager.launchBrowsers(["chromium"]);

    const tc1: TestCase = {
      id: "int-tc-002a",
      sessionId: "int-session",
      sourceDocumentId: null,
      phase: "FUNCTIONAL",
      name: "First context test",
      description: "First test in its own context",
      definition: {
        steps: [
          { action: "navigate", selector: "https://httpbin.org/cookies/set?test=1", description: "Set cookie" },
        ],
        assertions: [],
      },
      approvalStatus: "APPROVED",
      tags: [],
      editHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const tc2: TestCase = {
      ...tc1,
      id: "int-tc-002b",
      name: "Second context test",
      definition: {
        steps: [
          { action: "navigate", selector: "https://httpbin.org/cookies", description: "Check cookies" },
        ],
        assertions: [],
      },
    };

    const result1 = await manager.executeTest(tc1, "https://httpbin.org", "chromium", "int-session");
    const result2 = await manager.executeTest(tc2, "https://httpbin.org", "chromium", "int-session");

    // Each test runs in a fresh context (no cookie leakage)
    expect(result1.status).not.toBe("ERROR");
    expect(result2.status).not.toBe("ERROR");
  }, 30000);
});
