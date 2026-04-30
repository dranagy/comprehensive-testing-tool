import type { ProxyManager } from "./proxy-manager.js";
import type { AuthHandler } from "./auth-handler.js";
import type { SecurityFinding, ScanType } from "../../shared/types.js";
import { processFindings } from "./findings.js";

export class ActiveScanner {
  private proxyManager: ProxyManager;
  private authHandler: AuthHandler;

  constructor(proxyManager: ProxyManager, authHandler: AuthHandler) {
    this.proxyManager = proxyManager;
    this.authHandler = authHandler;
  }

  async scan(targetUrl: string, maxWaitMs = 120000): Promise<string> {
    const scanId = await this.proxyManager.startActiveScan(targetUrl);
    await this.waitForCompletion(scanId, maxWaitMs);
    return scanId;
  }

  async collectFindings(sessionId: string, targetUrl: string): Promise<SecurityFinding[]> {
    const alerts = await this.proxyManager.getAlerts(targetUrl);
    return processFindings(alerts, sessionId, "ACTIVE" as ScanType);
  }

  private async waitForCompletion(scanId: string, maxWaitMs: number): Promise<void> {
    const pollIntervalMs = 5000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const progress = await this.proxyManager.getActiveScanProgress(scanId);
      if (progress >= 100) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Active scan ${scanId} did not complete within ${maxWaitMs}ms`);
  }
}
