import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();

function mockZapResponse(data: unknown, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
  });
}

describe("ProxyManager", () => {
  let manager: import("../../../src/modules/security/proxy-manager.js").ProxyManager;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch);
    const { ProxyManager } = await import("../../../src/modules/security/proxy-manager.js");
    manager = new ProxyManager({ port: 8080, apiKey: "test-key" });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("start", () => {
    it("returns true when ZAP is already running", async () => {
      mockFetch.mockResolvedValueOnce(
        mockZapResponse({ status: "running" }),
      );

      const result = await manager.start();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("throws when ZAP is unreachable", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      await expect(manager.start()).rejects.toThrow("ZAP proxy is not running");
    });
  });

  describe("getProxyAddress", () => {
    it("returns the configured proxy address", () => {
      expect(manager.getProxyAddress()).toBe("http://localhost:8080");
    });
  });

  describe("isRunning", () => {
    it("returns true when ZAP responds", async () => {
      mockFetch.mockResolvedValueOnce(
        mockZapResponse({ status: "running" }),
      );

      const running = await manager.isRunning();
      expect(running).toBe(true);
    });

    it("returns false when ZAP is unreachable", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const running = await manager.isRunning();
      expect(running).toBe(false);
    });
  });

  describe("stop", () => {
    it("calls ZAP shutdown API", async () => {
      mockFetch.mockResolvedValueOnce(
        mockZapResponse({ Result: "OK" }),
      );

      await manager.stop();

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("core/action/shutdown");
    });

    it("does not throw when shutdown fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      await expect(manager.stop()).resolves.toBeUndefined();
    });
  });

  describe("passive scan", () => {
    it("checks passive scan status via ZAP API", async () => {
      mockFetch.mockResolvedValueOnce(
        mockZapResponse({ status: "100", recordsToScan: "0" }),
      );

      const status = await manager.getPassiveScanStatus();

      expect(status.recordsToScan).toBe(0);
    });
  });

  describe("active scan", () => {
    it("starts an active scan via ZAP API", async () => {
      mockFetch.mockResolvedValueOnce(
        mockZapResponse({ scan: "1" }),
      );

      const scanId = await manager.startActiveScan("http://localhost:3000");

      expect(scanId).toBe("1");
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("ascan/action/scan");
    });

    it("checks active scan progress", async () => {
      mockFetch.mockResolvedValueOnce(
        mockZapResponse({ status: "50" }),
      );

      const progress = await manager.getActiveScanProgress("1");

      expect(progress).toBe(50);
    });
  });

  describe("alerts", () => {
    it("retrieves alerts from ZAP API", async () => {
      mockFetch.mockResolvedValueOnce(
        mockZapResponse({
          alerts: [
            {
              alert: "X-Content-Type-Options Header Missing",
              riskcode: "1",
              confidence: "2",
              url: "http://localhost:3000/login",
              description: "The header is missing",
              solution: "Add the header",
              evidence: "HTTP/1.1 200 OK",
            },
          ],
        }),
      );

      const alerts = await manager.getAlerts("http://localhost:3000");

      expect(alerts).toHaveLength(1);
      expect(alerts[0].alert).toContain("X-Content-Type-Options");
    });

    it("returns empty array when no alerts found", async () => {
      mockFetch.mockResolvedValueOnce(
        mockZapResponse({ alerts: [] }),
      );

      const alerts = await manager.getAlerts("http://localhost:3000");

      expect(alerts).toHaveLength(0);
    });
  });
});
