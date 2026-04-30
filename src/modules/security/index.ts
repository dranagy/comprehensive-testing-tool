import type { TestingModule } from "../module-registry.js";
import type { ModuleContext } from "../../shared/types.js";
import type { TestCase, ExecutionResult, ExecutionOptions, TestPhase } from "../../shared/types.js";
import { ProxyManager } from "./proxy-manager.js";
import { PassiveScanner } from "./passive-scanner.js";
import { ActiveScanner } from "./active-scanner.js";
import { AuthHandler } from "./auth-handler.js";
import { ModuleError } from "../../shared/errors.js";

export class SecurityModule implements TestingModule {
  readonly id = "security";
  readonly name = "Security Test Module";
  readonly phase: TestPhase = "SECURITY";

  private context: ModuleContext | null = null;
  private proxyManager: ProxyManager | null = null;
  private passiveScanner: PassiveScanner | null = null;
  private activeScanner: ActiveScanner | null = null;
  private authHandler: AuthHandler | null = null;

  async initialize(context: ModuleContext): Promise<void> {
    this.context = context;

    const secConfig = context.config.security;
    if (secConfig) {
      this.proxyManager = new ProxyManager({
        port: 8080,
        apiKey: "zap-api-key",
      });
      this.passiveScanner = new PassiveScanner(this.proxyManager);
      this.authHandler = new AuthHandler();
      this.activeScanner = new ActiveScanner(this.proxyManager, this.authHandler);
    }
  }

  async generate(): Promise<TestCase[]> {
    return [];
  }

  async execute(
    testCases: TestCase[],
    options: ExecutionOptions = {},
  ): Promise<ExecutionResult[]> {
    if (!this.context) {
      throw new ModuleError(
        "Module not initialized",
        this.id,
        "MODULE_NOT_INITIALIZED",
        "Initialize the module before executing tests",
      );
    }

    if (!this.proxyManager) {
      throw new ModuleError(
        "Security configuration not set",
        this.id,
        "NO_SECURITY_CONFIG",
        "Configure security settings in ctt.config.ts to enable DAST scanning",
      );
    }

    const results: ExecutionResult[] = [];
    const targetUrl = this.context.targetUrl;
    const sessionId = this.context.sessionId;
    const secConfig = this.context.config.security;

    // Start proxy
    const started = await this.proxyManager.start();
    if (!started) {
      for (const tc of testCases) {
        results.push({
          id: crypto.randomUUID(),
          testCaseId: tc.id,
          sessionId,
          status: "ERROR",
          durationMs: 0,
          browser: null,
          screenshotPath: null,
          networkLog: null,
          errorMessage: "ZAP proxy is not running. Start ZAP daemon first.",
          artifacts: {},
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        });
      }
      return results;
    }

    // Passive scan
    if (secConfig?.passiveScan && this.passiveScanner) {
      try {
        await this.passiveScanner.waitForCompletion();
      } catch {
        // Continue even if passive scan times out
      }
    }

    // Active scan
    if (secConfig?.activeScan && this.activeScanner) {
      try {
        await this.activeScanner.scan(targetUrl);
      } catch {
        // Continue even if active scan times out
      }
    }

    // Collect findings
    const allFindings: import("../../shared/types.js").SecurityFinding[] = [];
    if (this.passiveScanner) {
      const passiveFindings = await this.passiveScanner.collectFindings(sessionId, targetUrl);
      allFindings.push(...passiveFindings);
    }
    if (this.activeScanner) {
      const activeFindings = await this.activeScanner.collectFindings(sessionId, targetUrl);
      allFindings.push(...activeFindings);
    }

    // Create results for each test case
    const hasCriticalOrHigh = allFindings.some(
      (f) => f.severity === "CRITICAL" || f.severity === "HIGH",
    );

    for (const tc of testCases) {
      results.push({
        id: crypto.randomUUID(),
        testCaseId: tc.id,
        sessionId,
        status: hasCriticalOrHigh ? "FAILED" : "PASSED",
        durationMs: 0,
        browser: null,
        screenshotPath: null,
        networkLog: null,
        errorMessage: hasCriticalOrHigh
          ? `Found ${allFindings.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH").length} critical/high findings`
          : null,
        artifacts: { findings: allFindings },
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
    }

    return results;
  }

  getProxyManager(): ProxyManager | null {
    return this.proxyManager;
  }

  async cleanup(): Promise<void> {
    if (this.proxyManager) {
      await this.proxyManager.stop();
    }
  }
}
