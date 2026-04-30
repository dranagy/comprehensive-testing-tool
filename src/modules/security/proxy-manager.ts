import type { ProxyConfig, PassiveScanStatus, ZapAlert } from "./types.js";

export class ProxyManager {
  private config: ProxyConfig;
  private baseUrl: string;

  constructor(config: ProxyConfig) {
    this.config = config;
    this.baseUrl = `http://localhost:${config.port}`;
  }

  getProxyAddress(): string {
    return `http://localhost:${this.config.port}`;
  }

  async start(): Promise<boolean> {
    const running = await this.isRunning();
    if (!running) {
      throw new Error(
        `ZAP proxy is not running at ${this.baseUrl}. ` +
        `Start ZAP daemon first: zap.sh -daemon -port ${this.config.port} -config api.key=${this.config.apiKey}`,
      );
    }
    return true;
  }

  async startWithValidation(): Promise<{ started: boolean; error: string | null }> {
    try {
      await this.start();
      return { started: true, error: null };
    } catch (err) {
      return {
        started: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async isRunning(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/JSON/core/view/status/?apikey=${this.config.apiKey}`,
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async stop(): Promise<void> {
    try {
      await fetch(
        `${this.baseUrl}/JSON/core/action/shutdown/?apikey=${this.config.apiKey}`,
      );
    } catch {
      // ZAP may close the connection before responding
    }
  }

  async getPassiveScanStatus(): Promise<PassiveScanStatus> {
    const response = await fetch(
      `${this.baseUrl}/JSON/pscan/view/recordsToScan/?apikey=${this.config.apiKey}`,
    );
    const data = (await response.json()) as { recordsToScan: string };
    return { recordsToScan: parseInt(data.recordsToScan, 10) || 0 };
  }

  async startActiveScan(targetUrl: string): Promise<string> {
    const url = `${this.baseUrl}/JSON/ascan/action/scan/?apikey=${this.config.apiKey}&url=${encodeURIComponent(targetUrl)}&recurse=true&inScopeOnly=false`;
    const response = await fetch(url);
    const data = (await response.json()) as { scan: string };
    return data.scan;
  }

  async getActiveScanProgress(scanId: string): Promise<number> {
    const response = await fetch(
      `${this.baseUrl}/JSON/ascan/view/status/?apikey=${this.config.apiKey}&scanId=${scanId}`,
    );
    const data = (await response.json()) as { status: string };
    return parseInt(data.status, 10) || 0;
  }

  async getAlerts(baseUrl: string): Promise<ZapAlert[]> {
    const response = await fetch(
      `${this.baseUrl}/JSON/core/view/alerts/?apikey=${this.config.apiKey}&baseurl=${encodeURIComponent(baseUrl)}&start=&count=`,
    );
    const data = (await response.json()) as { alerts: ZapAlert[] };
    return data.alerts ?? [];
  }

  getApiKey(): string {
    return this.config.apiKey;
  }

  getPort(): number {
    return this.config.port;
  }
}
