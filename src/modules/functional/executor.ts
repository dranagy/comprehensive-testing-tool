import type { TestingModule } from "../module-registry.js";
import type { ModuleContext } from "../../shared/types.js";
import type {
  Session,
  ContextDocument,
  TestCase,
  ExecutionResult,
  ExecutionOptions,
  BrowserType,
  TestPhase,
} from "../../shared/types.js";
import { BrowserManager } from "./browser-manager.js";
import { ModuleError } from "../../shared/errors.js";

export class FunctionalModule implements TestingModule {
  readonly id = "functional";
  readonly name = "Functional Test Module";
  readonly phase: TestPhase = "FUNCTIONAL";

  private browserManager = new BrowserManager();
  private context: ModuleContext | null = null;

  async initialize(context: ModuleContext): Promise<void> {
    this.context = context;
  }

  async generate(session: Session, documents: ContextDocument[]): Promise<TestCase[]> {
    // Functional test generation is handled by the ingestion module's functional-generator.
    // This module focuses on execution, not generation.
    return [];
  }

  async execute(testCases: TestCase[], options: ExecutionOptions = {}): Promise<ExecutionResult[]> {
    if (!this.context) {
      throw new ModuleError(
        "Module not initialized",
        this.id,
        "MODULE_NOT_INITIALIZED",
        "Initialize the module before executing tests",
      );
    }

    const browsers = options.browsers ?? this.context.config.browsers;

    // Connectivity check before test execution
    try {
      const response = await fetch(this.context.targetUrl, { method: "HEAD", signal: AbortSignal.timeout(5000) });
      if (!response.ok) {
        throw new ModuleError(
          `Target ${this.context.targetUrl} returned status ${response.status}`,
          this.id,
          "TARGET_UNREACHABLE",
          `Ensure the target application is running at ${this.context.targetUrl}`,
        );
      }
    } catch (err) {
      if (err instanceof ModuleError) throw err;
      throw new ModuleError(
        `Cannot connect to target ${this.context.targetUrl}: ${err instanceof Error ? err.message : String(err)}`,
        this.id,
        "TARGET_UNREACHABLE",
        `Start the target application at ${this.context.targetUrl} before running tests`,
      );
    }

    try {
      await this.browserManager.launchBrowsers(browsers);
    } catch (launchError) {
      throw new ModuleError(
        `Failed to launch browsers: ${launchError instanceof Error ? launchError.message : String(launchError)}`,
        this.id,
        "BROWSER_LAUNCH_FAILED",
        "Install browsers with: npx playwright install",
      );
    }

    const results: ExecutionResult[] = [];

    for (const browser of browsers) {
      for (const testCase of testCases) {
        const result = await this.browserManager.executeTest(
          testCase,
          this.context.targetUrl,
          browser,
          this.context.sessionId,
        );
        results.push(result);

        options.onProgress?.({
          testCaseId: testCase.id,
          status: result.status === "PASSED" ? "passed" : result.status === "FAILED" ? "failed" : "errored",
          message: `${browser}: ${result.status}`,
        });
      }
    }

    return results;
  }

  async cleanup(): Promise<void> {
    await this.browserManager.closeBrowsers();
  }

  getBrowserManager(): BrowserManager {
    return this.browserManager;
  }
}
