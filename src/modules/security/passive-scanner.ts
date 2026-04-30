import type { ProxyManager } from "./proxy-manager.js";
import type { SecurityFinding, ScanType } from "../../shared/types.js";
import { processFindings } from "./findings.js";

export class PassiveScanner {
  private proxyManager: ProxyManager;

  constructor(proxyManager: ProxyManager) {
    this.proxyManager = proxyManager;
  }

  async waitForCompletion(maxWaitMs = 60000): Promise<void> {
    const pollIntervalMs = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.proxyManager.getPassiveScanStatus();
      if (status.recordsToScan === 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Passive scan did not complete within ${maxWaitMs}ms`);
  }

  async collectFindings(sessionId: string, targetUrl: string): Promise<SecurityFinding[]> {
    const alerts = await this.proxyManager.getAlerts(targetUrl);
    return processFindings(alerts, sessionId, "PASSIVE" as ScanType);
  }
}
