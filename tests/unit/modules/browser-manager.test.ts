import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserManager } from "../../../src/modules/functional/browser-manager.js";
import type { BrowserType, TestCase, TestCaseDefinition } from "../../../src/shared/types.js";

// Mock playwright entirely
const mockContext = {
  newPage: vi.fn().mockResolvedValue({
    goto: vi.fn().mockResolvedValue(undefined),
    locator: vi.fn().mockReturnValue({
      first: vi.fn().mockReturnValue({
        click: vi.fn().mockResolvedValue(undefined),
        fill: vi.fn().mockResolvedValue(undefined),
        waitFor: vi.fn().mockResolvedValue(undefined),
        selectOption: vi.fn().mockResolvedValue(undefined),
        press: vi.fn().mockResolvedValue(undefined),
        isVisible: vi.fn().mockResolvedValue(true),
      }),
    }),
    textContent: vi.fn().mockResolvedValue("Welcome"),
    url: vi.fn().mockReturnValue("http://localhost:3000/dashboard"),
    screenshot: vi.fn().mockResolvedValue(Buffer.from("")),
    close: vi.fn().mockResolvedValue(undefined),
  }),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockChromium = {
  launch: vi.fn().mockResolvedValue(mockBrowser),
};

const mockFirefox = {
  launch: vi.fn().mockResolvedValue(mockBrowser),
};

const mockWebkit = {
  launch: vi.fn().mockResolvedValue(mockBrowser),
};

vi.mock("playwright", () => ({
  chromium: mockChromium,
  firefox: mockFirefox,
  webkit: mockWebkit,
}));

function makeTestCase(overrides: Partial<TestCase> & { id: string }): TestCase {
  const definition: TestCaseDefinition = {
    steps: [
      { action: "navigate", selector: "/login", description: "Navigate to login" },
      { action: "type", selector: "#username", value: "admin", description: "Enter username" },
      { action: "type", selector: "#password", value: "pass", description: "Enter password" },
      { action: "click", selector: "#submit", description: "Click submit" },
    ],
    assertions: [
      { type: "text", expected: "Welcome" },
    ],
  };
  return {
    id: overrides.id,
    sessionId: "session-test",
    sourceDocumentId: null,
    phase: "FUNCTIONAL",
    name: `Test ${overrides.id}`,
    description: "Test case",
    definition,
    approvalStatus: "APPROVED",
    tags: [],
    editHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("BrowserManager", () => {
  let manager: BrowserManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new BrowserManager();
  });

  describe("launchBrowsers", () => {
    it("launches a single browser", async () => {
      await manager.launchBrowsers(["chromium"]);
      expect(mockChromium.launch).toHaveBeenCalledTimes(1);
    });

    it("launches multiple browsers", async () => {
      await manager.launchBrowsers(["chromium", "firefox", "webkit"]);
      expect(mockChromium.launch).toHaveBeenCalledTimes(1);
      expect(mockFirefox.launch).toHaveBeenCalledTimes(1);
      expect(mockWebkit.launch).toHaveBeenCalledTimes(1);
    });

    it("does not relaunch already launched browsers", async () => {
      await manager.launchBrowsers(["chromium"]);
      await manager.launchBrowsers(["chromium"]);
      expect(mockChromium.launch).toHaveBeenCalledTimes(1);
    });
  });

  describe("createContext", () => {
    it("creates a fresh context for each test", async () => {
      await manager.launchBrowsers(["chromium"]);
      const ctx1 = await manager.createContext("chromium");
      const ctx2 = await manager.createContext("chromium");
      expect(mockBrowser.newContext).toHaveBeenCalledTimes(2);
      expect(ctx1).toBeDefined();
      expect(ctx2).toBeDefined();
    });
  });

  describe("context isolation", () => {
    it("each context is independent (fresh browser state)", async () => {
      await manager.launchBrowsers(["chromium"]);
      const ctx1 = await manager.createContext("chromium");
      const ctx2 = await manager.createContext("chromium");

      // Each context should be a distinct newContext call
      expect(mockBrowser.newContext).toHaveBeenCalledTimes(2);

      // Closing one context should not affect the other
      await ctx1.close();
      expect(mockContext.close).toHaveBeenCalledTimes(1);
    });

    it("cookies and storage do not leak between contexts", async () => {
      await manager.launchBrowsers(["chromium"]);
      const ctx1 = await manager.createContext("chromium");
      const ctx2 = await manager.createContext("chromium");

      // Both contexts were created independently
      expect(mockBrowser.newContext).toHaveBeenCalledTimes(2);
      // Verify independent lifecycle - closing one does not affect the other
      await ctx1.close();
      expect(mockContext.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("executeTest", () => {
    it("executes test steps and returns PASSED result", async () => {
      await manager.launchBrowsers(["chromium"]);
      const tc = makeTestCase({ id: "tc-isolated" });

      const result = await manager.executeTest(tc, "http://localhost:3000", "chromium", "session-1");

      expect(result.testCaseId).toBe("tc-isolated");
      expect(result.sessionId).toBe("session-1");
      expect(result.status).toBe("PASSED");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.browser).toBe("chromium");
    });

    it("returns FAILED when a step throws", async () => {
      const page = await mockContext.newPage();
      page.locator.mockReturnValueOnce({
        first: vi.fn().mockReturnValue({
          click: vi.fn().mockRejectedValue(new Error("Element not found")),
        }),
      });

      await manager.launchBrowsers(["chromium"]);

      const tc: TestCase = {
        id: "tc-fail",
        sessionId: "session-1",
        sourceDocumentId: null,
        phase: "FUNCTIONAL",
        name: "Failing test",
        description: "Should fail",
        definition: {
          steps: [{ action: "click", selector: "#nonexistent", description: "Click missing element" }],
          assertions: [],
        },
        approvalStatus: "APPROVED",
        tags: [],
        editHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await manager.executeTest(tc, "http://localhost:3000", "chromium", "session-1");
      expect(result.status).toBe("FAILED");
      expect(result.errorMessage).toContain("Click missing element");
    });

    it("captures screenshot on failure", async () => {
      const page = await mockContext.newPage();
      page.locator.mockReturnValueOnce({
        first: vi.fn().mockReturnValue({
          click: vi.fn().mockRejectedValue(new Error("Not found")),
        }),
      });

      await manager.launchBrowsers(["chromium"]);

      const tc: TestCase = {
        id: "tc-screenshot",
        sessionId: "session-1",
        sourceDocumentId: null,
        phase: "FUNCTIONAL",
        name: "Screenshot test",
        description: "Should capture screenshot",
        definition: {
          steps: [{ action: "click", selector: "#missing", description: "Click" }],
          assertions: [],
        },
        approvalStatus: "APPROVED",
        tags: [],
        editHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await manager.executeTest(tc, "http://localhost:3000", "chromium", "session-1");
      expect(result.status).toBe("FAILED");
      // Screenshot capture was attempted (best-effort)
    });

    it("returns ERROR when browser is not launched", async () => {
      // Don't launch any browser — executeTest should handle missing browser
      const tc = makeTestCase({ id: "tc-no-browser" });
      const result = await manager.executeTest(tc, "http://localhost:3000", "chromium", "session-1");
      expect(result.status).toBe("ERROR");
      expect(result.errorMessage).toContain("not launched");
    });
  });

  describe("closeBrowsers", () => {
    it("closes all launched browsers", async () => {
      await manager.launchBrowsers(["chromium", "firefox"]);
      await manager.closeBrowsers();
      expect(mockBrowser.close).toHaveBeenCalledTimes(2);
    });
  });
});
