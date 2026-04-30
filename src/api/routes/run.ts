import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { SessionManager } from "../../core/session.js";
import { AuditLogger } from "../../core/audit-log.js";
import { TestCaseRepository } from "../../db/repositories/test-case-repo.js";
import { ExecutionResultRepository } from "../../db/repositories/execution-result-repo.js";
import { PerformanceModule } from "../../modules/performance/executor.js";
import { SecurityModule } from "../../modules/security/index.js";
import { getDb } from "../db.js";
import { ApiError } from "../middleware/error-handler.js";
import { resolveSession } from "../middleware/session-resolver.js";
import "../types.js";
import { progressEmitter } from "../websocket/progress.js";
import type {
  TestCase,
  ExecutionResult,
  TestPhase,
  TestStep,
  TestAssertion,
  SessionConfig,
  ProgressUpdate,
} from "../../shared/types.js";

export const runRouter = Router();

// Active runs tracker
const activeRuns = new Map<string, { cancelled: boolean }>();

// Start test run
runRouter.post("/:sessionId/run", resolveSession, async (req, res) => {
  const db = getDb();
  const sessionManager = new SessionManager(db);
  const auditLogger = new AuditLogger(db);
  const testCaseRepo = new TestCaseRepository(db);
  const executionResultRepo = new ExecutionResultRepository(db);

  const session = req.session!;

  const {
    testIds,
    phase,
    failed,
    tags,
    browser = "chromium",
    parallel,
    timeout,
    dryRun,
  } = req.body as {
    testIds?: string[];
    phase?: string;
    failed?: boolean;
    tags?: string[];
    browser?: string;
    parallel?: number;
    timeout?: number;
    dryRun?: boolean;
  };

  // Resolve which tests to run
  let testsToRun: TestCase[];

  if (testIds && testIds.length > 0) {
    testsToRun = [];
    for (const id of testIds) {
      const tc = testCaseRepo.getById(id);
      if (tc) testsToRun.push(tc);
    }
  } else if (failed) {
    const failedIds = testCaseRepo.getFailedTestIds(session.id);
    testsToRun = failedIds
      .map((id) => testCaseRepo.getById(id))
      .filter((tc): tc is TestCase => tc !== undefined);
  } else if (tags && tags.length > 0) {
    testsToRun = testCaseRepo
      .getByTags(session.id, tags)
      .filter((tc) => tc.approvalStatus === "APPROVED");
  } else if (phase) {
    testsToRun = testCaseRepo
      .getBySession(session.id, phase.toUpperCase() as TestPhase)
      .filter((tc) => tc.approvalStatus === "APPROVED");
  } else {
    testsToRun = testCaseRepo
      .getBySession(session.id)
      .filter((tc) => tc.approvalStatus === "APPROVED");
  }

  if (testsToRun.length === 0) {
    throw new ApiError(400, "No tests to run");
  }

  // Dry run: just return what would be executed
  if (dryRun) {
    res.json({
      runId: null,
      testCount: testsToRun.length,
      tests: testsToRun.map((tc) => ({
        id: tc.id,
        name: tc.name,
        phase: tc.phase,
      })),
      dryRun: true,
    });
    return;
  }

  const runId = uuidv4();
  const runTracker = { cancelled: false };
  activeRuns.set(runId, runTracker);

  auditLogger.log(session.id, "PHASE_STARTED", "api", {
    runId,
    testCount: testsToRun.length,
    browser,
  });

  // Return run ID immediately
  res.json({
    runId,
    testCount: testsToRun.length,
    status: "running",
  });

  // Execute tests asynchronously
  const isPerformancePhase = testsToRun.every((tc) => tc.phase === "PERFORMANCE");
  const isSecurityPhase = testsToRun.every((tc) => tc.phase === "SECURITY");
  const sessionConfig: SessionConfig = { browsers: [browser as "chromium"] };

  const emitProgress = (update: ProgressUpdate) => {
    progressEmitter.emit(runId, {
      ...update,
      runId,
    });
  };

  try {
    let results: ExecutionResult[];

    if (isPerformancePhase) {
      const perfModule = new PerformanceModule();
      await perfModule.initialize({
        sessionId: session.id,
        targetUrl: session.targetUrl,
        config: sessionConfig,
        db,
        logger: console,
        reportProgress: emitProgress,
      });
      try {
        results = await perfModule.execute(testsToRun, {
          onProgress: emitProgress,
        });
      } finally {
        await perfModule.cleanup();
      }
    } else if (isSecurityPhase) {
      const secModule = new SecurityModule();
      await secModule.initialize({
        sessionId: session.id,
        targetUrl: session.targetUrl,
        config: sessionConfig,
        db,
        logger: console,
        reportProgress: emitProgress,
      });
      try {
        results = await secModule.execute(testsToRun, {
          onProgress: emitProgress,
        });
      } finally {
        await secModule.cleanup();
      }
    } else {
      // Functional tests - execute sequentially
      results = [];
      for (let i = 0; i < testsToRun.length; i++) {
        if (runTracker.cancelled) break;

        const tc = testsToRun[i];
        emitProgress({
          testCaseId: tc.id,
          status: "running",
          message: `Running: ${tc.name}`,
          percentage: Math.round((i / testsToRun.length) * 100),
        });

        const result = await executeFunctionalTest(
          tc,
          session.targetUrl,
          browser,
          session.id,
        );

        executionResultRepo.create(result);
        results.push(result);

        emitProgress({
          testCaseId: tc.id,
          status: result.status === "PASSED" ? "passed" : result.status === "FAILED" ? "failed" : "errored",
          message: `${tc.name}: ${result.status}`,
          percentage: Math.round(((i + 1) / testsToRun.length) * 100),
        });
      }
    }

    // Store non-functional results
    if (isPerformancePhase || isSecurityPhase) {
      for (const result of results) {
        executionResultRepo.create(result);
      }
    }

    const passed = results.filter((r) => r.status === "PASSED").length;
    const failed = results.filter((r) => r.status === "FAILED").length;

    auditLogger.log(session.id, "PHASE_COMPLETED", "api", {
      runId,
      total: results.length,
      passed,
      failed,
    });

    progressEmitter.emit(runId, {
      runId,
      status: "completed",
      percentage: 100,
      summary: {
        total: results.length,
        passed,
        failed: results.filter((r) => r.status === "FAILED").length,
        errored: results.filter((r) => ["ERROR", "TIMEOUT"].includes(r.status)).length,
        skipped: results.filter((r) => r.status === "SKIPPED").length,
      },
    });
  } catch (err) {
    progressEmitter.emit(runId, {
      runId,
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    activeRuns.delete(runId);
  }
});

// Cancel a run
runRouter.post("/:sessionId/run/:runId/cancel", (req, res) => {
  const tracker = activeRuns.get(req.params.runId);
  if (!tracker) {
    throw new ApiError(404, `Run not found: ${req.params.runId}`);
  }
  tracker.cancelled = true;
  res.json({ cancelled: true, runId: req.params.runId });
});

/**
 * Execute a single functional test using Playwright.
 */
async function executeFunctionalTest(
  testCase: TestCase,
  targetUrl: string,
  browserName: string,
  sessionId: string,
): Promise<ExecutionResult> {
  const startTime = new Date();
  let errorMessage: string | null = null;
  let status: ExecutionResult["status"] = "PASSED";

  let chromium: typeof import("playwright").chromium;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    return {
      id: uuidv4(),
      testCaseId: testCase.id,
      sessionId,
      status: "ERROR",
      durationMs: Date.now() - startTime.getTime(),
      browser: browserName as ExecutionResult["browser"],
      screenshotPath: null,
      networkLog: null,
      errorMessage: "Playwright is not installed",
      artifacts: {},
      startedAt: startTime.toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  let browser: import("playwright").Browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (launchError) {
    return {
      id: uuidv4(),
      testCaseId: testCase.id,
      sessionId,
      status: "ERROR",
      durationMs: Date.now() - startTime.getTime(),
      browser: browserName as ExecutionResult["browser"],
      screenshotPath: null,
      networkLog: null,
      errorMessage: `Browser launch failed: ${launchError instanceof Error ? launchError.message : String(launchError)}`,
      artifacts: {},
      startedAt: startTime.toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    for (const step of testCase.definition.steps) {
      await executeStep(page, step, targetUrl);
    }

    for (const assertion of testCase.definition.assertions) {
      await executeAssertion(page, assertion, targetUrl);
    }

    await context.close();
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    status = "FAILED";
  } finally {
    await browser.close();
  }

  return {
    id: uuidv4(),
    testCaseId: testCase.id,
    sessionId,
    status,
    durationMs: Date.now() - startTime.getTime(),
    browser: browserName as ExecutionResult["browser"],
    screenshotPath: null,
    networkLog: null,
    errorMessage,
    artifacts: {},
    startedAt: startTime.toISOString(),
    completedAt: new Date().toISOString(),
  };
}

async function executeStep(
  page: import("playwright").Page,
  step: TestStep,
  targetUrl: string,
): Promise<void> {
  const selector = resolveSelector(step.selector, targetUrl);
  switch (step.action) {
    case "navigate": {
      const url = step.value ?? step.selector;
      const resolved = url.startsWith("http") ? url : `${targetUrl}${url.startsWith("/") ? "" : "/"}${url}`;
      await page.goto(resolved, { waitUntil: "domcontentloaded", timeout: 30000 });
      break;
    }
    case "click":
      await page.locator(selector).first().click({ timeout: 10000 });
      break;
    case "type":
      await page.locator(selector).first().fill(step.value ?? "", { timeout: 10000 });
      break;
    case "wait":
      await page.locator(selector).first().waitFor({ state: "visible", timeout: 15000 });
      break;
    case "select":
      await page.locator(selector).first().selectOption(step.value ?? "", { timeout: 10000 });
      break;
    case "submit":
      await page.locator(selector).first().press("Enter", { timeout: 10000 });
      break;
  }
}

async function executeAssertion(
  page: import("playwright").Page,
  assertion: TestAssertion,
  targetUrl: string,
): Promise<void> {
  switch (assertion.type) {
    case "visible": {
      const sel = assertion.selector ? resolveSelector(assertion.selector, targetUrl) : "body";
      const visible = await page.locator(sel).first().isVisible().catch(() => false);
      if (!visible) throw new Error(`Element not visible: ${sel}`);
      break;
    }
    case "text": {
      const bodyText = await page.textContent("body");
      if (!bodyText?.includes(assertion.expected)) {
        if (assertion.selector) {
          const sel = resolveSelector(assertion.selector, targetUrl);
          const elText = await page.locator(sel).first().textContent();
          if (!elText?.includes(assertion.expected)) {
            throw new Error(`Text "${assertion.expected}" not found in ${sel}`);
          }
        } else {
          throw new Error(`Text "${assertion.expected}" not found on page`);
        }
      }
      break;
    }
    case "url": {
      const current = page.url();
      if (!current.includes(assertion.expected) && !current.endsWith(assertion.expected)) {
        throw new Error(`URL expected to contain "${assertion.expected}", got "${current}"`);
      }
      break;
    }
    case "status": {
      if (assertion.expected !== "200" && assertion.expected !== "OK") {
        throw new Error(`Status assertion "${assertion.expected}" cannot be verified post-load`);
      }
      break;
    }
    case "attribute": {
      if (!assertion.selector) throw new Error("Attribute assertion requires a selector");
      const sel = resolveSelector(assertion.selector, targetUrl);
      const attr = await page.locator(sel).first().getAttribute(assertion.expected);
      if (!attr) throw new Error(`Attribute "${assertion.expected}" not found on ${sel}`);
      break;
    }
  }
}

function resolveSelector(selector: string, _targetUrl: string): string {
  if (
    selector.startsWith("text=") ||
    selector.startsWith(":text(") ||
    selector.includes(":has-text(") ||
    selector.startsWith("[") ||
    selector.startsWith("#") ||
    selector.startsWith(".") ||
    selector.startsWith("button") ||
    selector.startsWith("a:") ||
    selector.startsWith("input") ||
    selector.startsWith("select") ||
    selector.startsWith("textarea") ||
    selector.startsWith("form")
  ) {
    return selector;
  }
  return `:text("${selector}")`;
}
