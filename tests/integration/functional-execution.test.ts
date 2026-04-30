import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as http from "node:http";
import { BrowserManager } from "../../src/modules/functional/browser-manager.js";
import type { TestCase } from "../../src/shared/types.js";

/**
 * Integration test for cross-browser functional test execution.
 *
 * These tests require Playwright browsers to be installed.
 * Run `npx playwright install` before running this test.
 * The test uses a local HTTP server to avoid external network dependencies.
 *
 * To skip: set SKIP_INTEGRATION=1
 */
const skipIntegration = process.env.SKIP_INTEGRATION === "1";

function startLocalServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body><h1>Local Test Server</h1></body></html>");
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

describe.skipIf(skipIntegration)("Cross-browser functional execution", () => {
  let manager: BrowserManager;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    manager = new BrowserManager();
    ({ server, baseUrl } = await startLocalServer());
  });

  afterAll(async () => {
    await manager.closeBrowsers();
    await new Promise<void>((resolve) => server.close(() => resolve()));
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
          { action: "navigate", selector: baseUrl, description: "Navigate to local server" },
        ],
        assertions: [
          { type: "url", expected: "127.0.0.1" },
        ],
      },
      approvalStatus: "APPROVED",
      tags: ["integration"],
      editHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await manager.executeTest(tc, baseUrl, "chromium", "int-session");

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
          { action: "navigate", selector: `${baseUrl}/path1`, description: "Navigate to path1" },
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
          { action: "navigate", selector: `${baseUrl}/path2`, description: "Navigate to path2" },
        ],
        assertions: [],
      },
    };

    const result1 = await manager.executeTest(tc1, baseUrl, "chromium", "int-session");
    const result2 = await manager.executeTest(tc2, baseUrl, "chromium", "int-session");

    // Each test runs in a fresh context (no state leakage)
    expect(result1.status).not.toBe("ERROR");
    expect(result2.status).not.toBe("ERROR");
  }, 30000);
});
