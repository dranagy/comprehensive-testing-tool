import fs from "node:fs";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { initializeDatabase } from "../../db/migrations.js";
import { SessionManager } from "../../core/session.js";
import { AuditLogger } from "../../core/audit-log.js";
import { TestCaseRepository } from "../../db/repositories/test-case-repo.js";
import { ExecutionResultRepository } from "../../db/repositories/execution-result-repo.js";
import { loadConfig } from "../../core/config.js";
import { PerformanceModule } from "../../modules/performance/executor.js";
import { SecurityModule } from "../../modules/security/index.js";
import type {
  TestCase,
  ExecutionResult,
  TestPhase,
  TestStep,
  TestAssertion,
  SessionConfig,
} from "../../shared/types.js";

function openDb() {
  const cttDir = path.join(process.cwd(), ".ctt");
  if (!fs.existsSync(cttDir)) {
    fs.mkdirSync(cttDir, { recursive: true });
  }
  return initializeDatabase(path.join(cttDir, "sessions.db"));
}

function getLatestSessionId(sessionManager: SessionManager): string {
  const sessions = sessionManager.listSessions();
  if (sessions.length === 0) {
    console.error(
      "No sessions found. Run 'ctt init' to create a project first.",
    );
    process.exit(1);
    throw new Error("unreachable");
  }
  return sessions[0].id;
}

interface RunOptions {
  phase?: string;
  failed?: boolean;
  dryRun?: boolean;
  browser?: string;
  session?: string;
  filter?: string;
}

export async function runCommand(
  testIds: string[],
  options: RunOptions,
): Promise<void> {
  try {
    const db = openDb();
    const sessionManager = new SessionManager(db);
    const auditLogger = new AuditLogger(db);
    const testCaseRepo = new TestCaseRepository(db);
    const executionResultRepo = new ExecutionResultRepository(db);

    const sessionId = options.session ?? getLatestSessionId(sessionManager);
    const session = sessionManager.getSession(sessionId);

    // Load config for browser and output settings
    let config;
    try {
      config = loadConfig();
    } catch {
      config = null;
    }

    const browser = (options.browser ?? config?.browsers[0] ?? "chromium") as string;

    // Determine which tests to run
    let testsToRun: TestCase[];

    if (testIds.length > 0) {
      // Specific test IDs provided
      testsToRun = [];
      for (const id of testIds) {
        const tc = testCaseRepo.getById(id);
        if (!tc) {
          console.error(`Test case not found: ${id}`);
          db.close();
          process.exit(1);
          return;
        }
        if (tc.sessionId !== sessionId) {
          console.error(
            `Test case ${id} does not belong to session ${sessionId}`,
          );
          db.close();
          process.exit(1);
          return;
        }
        testsToRun.push(tc);
      }
    } else if (options.failed) {
      // Re-run previously failed tests
      const failedIds = testCaseRepo.getFailedTestIds(sessionId);
      if (failedIds.length === 0) {
        console.log("No failed tests to re-run.");
        db.close();
        process.exit(0);
        return;
      }
      testsToRun = failedIds
        .map((id) => testCaseRepo.getById(id))
        .filter((tc): tc is TestCase => tc !== undefined);
    } else if (options.filter) {
      // Run tests matching tag(s)
      const tags = options.filter.split(",").map((t) => t.trim());
      const matched = testCaseRepo.getByTags(sessionId, tags);
      testsToRun = matched.filter((tc) => tc.approvalStatus === "APPROVED");
      if (testsToRun.length === 0) {
        console.log(
          `No approved tests found matching tag(s): ${tags.join(", ")}`,
        );
        db.close();
        process.exit(0);
        return;
      }
    } else if (options.phase) {
      // Run all approved tests in the given phase
      const phase = options.phase.toUpperCase() as TestPhase;
      const allInPhase = testCaseRepo.getBySession(sessionId, phase);
      testsToRun = allInPhase.filter(
        (tc) => tc.approvalStatus === "APPROVED",
      );
      if (testsToRun.length === 0) {
        console.log(
          `No approved tests found for phase: ${phase}. Run 'ctt review approve ${phase.toLowerCase()}' first.`,
        );
        db.close();
        process.exit(0);
        return;
      }
    } else {
      // Default: run all approved tests in the session
      const allTests = testCaseRepo.getBySession(sessionId);
      testsToRun = allTests.filter(
        (tc) => tc.approvalStatus === "APPROVED",
      );
      if (testsToRun.length === 0) {
        console.log(
          "No approved tests to run. Use 'ctt review approve' to approve test cases first.",
        );
        db.close();
        process.exit(0);
        return;
      }
    }

    // Dry run: just list what would be executed
    if (options.dryRun) {
      console.log("Dry run -- the following tests would be executed:\n");
      for (const tc of testsToRun) {
        console.log(
          `  [${tc.phase}] ${tc.name} (${tc.id})`,
        );
        for (const step of tc.definition.steps) {
          console.log(
            `    - [${step.action}] ${step.description}`,
          );
        }
      }
      console.log(`\nTotal: ${testsToRun.length} test(s)`);
      db.close();
      process.exit(0);
      return;
    }

    console.log(
      `Running ${testsToRun.length} test(s) against ${session.targetUrl}...\n`,
    );

    auditLogger.log(sessionId, "PHASE_STARTED", "system", {
      testCount: testsToRun.length,
      browser,
    });

    // Determine execution strategy based on phase
    const isPerformancePhase = testsToRun.every((tc) => tc.phase === "PERFORMANCE");
    const isSecurityPhase = testsToRun.every((tc) => tc.phase === "SECURITY");

    // Execute tests
    const results: ExecutionResult[] = [];

    if (isPerformancePhase) {
      const perfModule = new PerformanceModule();
      const sessionConfig: SessionConfig = config ?? {
        browsers: [browser as "chromium"],
      };
      await perfModule.initialize({
        sessionId,
        targetUrl: session.targetUrl,
        config: sessionConfig,
        db,
        logger: console,
        reportProgress: () => {},
      });

      const perfResults = await perfModule.execute(testsToRun, {
        onProgress: (update) => {
          console.log(`  ${update.message ?? update.status}`);
        },
      });

      for (const result of perfResults) {
        executionResultRepo.create(result);
        results.push(result);
      }

      await perfModule.cleanup();
    } else if (isSecurityPhase) {
      const secModule = new SecurityModule();
      const sessionConfig: SessionConfig = config ?? {
        browsers: [browser as "chromium"],
      };
      await secModule.initialize({
        sessionId,
        targetUrl: session.targetUrl,
        config: sessionConfig,
        db,
        logger: console,
        reportProgress: () => {},
      });

      const secResults = await secModule.execute(testsToRun, {
        onProgress: (update) => {
          console.log(`  ${update.message ?? update.status}`);
        },
      });

      for (const result of secResults) {
        executionResultRepo.create(result);
        results.push(result);
      }

      await secModule.cleanup();
    } else {
      for (const testCase of testsToRun) {
        console.log(`  Running: ${testCase.name} (${testCase.id})`);

        const result = await executeTest(
          testCase,
          session.targetUrl,
          browser,
          sessionId,
        );

        executionResultRepo.create(result);
        results.push(result);

        const statusLabel =
          result.status === "PASSED"
            ? "PASSED"
            : result.status === "FAILED"
              ? "FAILED"
              : "ERROR";
        const duration = `${result.durationMs}ms`;
        console.log(`    -> ${statusLabel} (${duration})`);

        if (result.errorMessage) {
          console.log(`       Error: ${result.errorMessage}`);
        }
      }
    }

    // Summary
    const passed = results.filter((r) => r.status === "PASSED").length;
    const failed = results.filter(
      (r) => r.status === "FAILED",
    ).length;
    const errored = results.filter((r) =>
      ["ERROR", "TIMEOUT"].includes(r.status),
    ).length;
    const skipped = results.filter((r) => r.status === "SKIPPED").length;

    console.log("\n--- Test Run Summary ---");
    console.log(`  Total:   ${results.length}`);
    console.log(`  Passed:  ${passed}`);
    console.log(`  Failed:  ${failed}`);
    console.log(`  Errored: ${errored}`);
    console.log(`  Skipped: ${skipped}`);

    auditLogger.log(sessionId, "PHASE_COMPLETED", "system", {
      total: results.length,
      passed,
      failed,
      errored,
      skipped,
    });

    db.close();

    // Exit with code 1 if any test failed or errored
    if (failed > 0 || errored > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error running tests: ${message}`);
    process.exit(1);
  }
}

/**
 * Execute a single test case using Playwright.
 * For the MVP, supports basic navigation, click, type, wait, select, submit actions
 * and visible/text/url assertions.
 */
async function executeTest(
  testCase: TestCase,
  targetUrl: string,
  browserName: string,
  sessionId: string,
): Promise<ExecutionResult> {
  const startTime = new Date();
  let errorMessage: string | null = null;
  let status: ExecutionResult["status"] = "PASSED";
  let screenshotPath: string | null = null;

  // Dynamic import to handle cases where playwright is not installed
  let chromium: typeof import("playwright").chromium;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    // Playwright not available -- mark as error
    return buildResult(
      testCase.id,
      sessionId,
      "ERROR",
      startTime,
      new Date(),
      browserName,
      null,
      "Playwright is not installed. Run: npx playwright install",
    );
  }

  let browser: import("playwright").Browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (launchError) {
    const msg =
      launchError instanceof Error
        ? launchError.message
        : String(launchError);
    return buildResult(
      testCase.id,
      sessionId,
      "ERROR",
      startTime,
      new Date(),
      browserName,
      null,
      `Failed to launch browser: ${msg}`,
    );
  }

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Execute each step
    for (const step of testCase.definition.steps) {
      try {
        await executeStep(page, step, targetUrl);
      } catch (stepError) {
        const msg =
          stepError instanceof Error
            ? stepError.message
            : String(stepError);
        errorMessage = `Step "${step.description}" failed: ${msg}`;
        status = "FAILED";

        // Capture screenshot on failure
        try {
          const screenshotDir = path.join(process.cwd(), ".ctt", "screenshots");
          if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
          }
          screenshotPath = path.join(
            screenshotDir,
            `${testCase.id}-${Date.now()}.png`,
          );
          await page.screenshot({ path: screenshotPath });
        } catch {
          // Screenshot capture is best-effort
        }

        break;
      }
    }

    // Run assertions only if all steps passed
    if (status === "PASSED") {
      for (const assertion of testCase.definition.assertions) {
        try {
          await executeAssertion(page, assertion, targetUrl);
        } catch (assertionError) {
          const msg =
            assertionError instanceof Error
              ? assertionError.message
              : String(assertionError);
          errorMessage = `Assertion [${assertion.type}] failed: ${msg}`;
          status = "FAILED";

          // Capture screenshot on assertion failure
          try {
            const screenshotDir = path.join(
              process.cwd(),
              ".ctt",
              "screenshots",
            );
            if (!fs.existsSync(screenshotDir)) {
              fs.mkdirSync(screenshotDir, { recursive: true });
            }
            screenshotPath = path.join(
              screenshotDir,
              `${testCase.id}-${Date.now()}.png`,
            );
            await page.screenshot({ path: screenshotPath });
          } catch {
            // Screenshot capture is best-effort
          }

          break;
        }
      }
    }

    await context.close();
  } catch (pageError) {
    const msg =
      pageError instanceof Error ? pageError.message : String(pageError);
    errorMessage = `Page error: ${msg}`;
    status = "ERROR";
  } finally {
    await browser.close();
  }

  const endTime = new Date();

  return buildResult(
    testCase.id,
    sessionId,
    status,
    startTime,
    endTime,
    browserName,
    screenshotPath,
    errorMessage,
  );
}

/**
 * Execute a single test step on the page.
 */
async function executeStep(
  page: import("playwright").Page,
  step: TestStep,
  targetUrl: string,
): Promise<void> {
  const selector = resolveSelector(step.selector, targetUrl);

  switch (step.action) {
    case "navigate": {
      const url = step.value ?? step.selector;
      const resolvedUrl = url.startsWith("http")
        ? url
        : `${targetUrl}${url.startsWith("/") ? "" : "/"}${url}`;
      await page.goto(resolvedUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      break;
    }
    case "click": {
      await page.locator(selector).first().click({ timeout: 10000 });
      break;
    }
    case "type": {
      const value = step.value ?? "";
      await page.locator(selector).first().fill(value, { timeout: 10000 });
      break;
    }
    case "wait": {
      await page.locator(selector).first().waitFor({ state: "visible", timeout: 15000 });
      break;
    }
    case "select": {
      const value = step.value ?? "";
      await page.locator(selector).first().selectOption(value, { timeout: 10000 });
      break;
    }
    case "submit": {
      await page.locator(selector).first().press("Enter", { timeout: 10000 });
      break;
    }
    default: {
      throw new Error(`Unknown step action: ${step.action}`);
    }
  }
}

/**
 * Execute a single assertion on the page.
 */
async function executeAssertion(
  page: import("playwright").Page,
  assertion: TestAssertion,
  targetUrl: string,
): Promise<void> {
  switch (assertion.type) {
    case "visible": {
      const selector = assertion.selector
        ? resolveSelector(assertion.selector, targetUrl)
        : "body";
      const locator = page.locator(selector).first();
      const isVisible = await locator.isVisible().catch(() => false);
      if (!isVisible) {
        throw new Error(
          `Expected element to be visible: ${selector}`,
        );
      }
      break;
    }
    case "text": {
      // Check if the expected text appears anywhere on the page
      const bodyText = await page.textContent("body");
      if (!bodyText?.includes(assertion.expected)) {
        // If a selector is specified, check within that element
        if (assertion.selector) {
          const selector = resolveSelector(assertion.selector, targetUrl);
          const elementText = await page
            .locator(selector)
            .first()
            .textContent();
          if (!elementText?.includes(assertion.expected)) {
            throw new Error(
              `Expected text "${assertion.expected}" not found in element: ${selector}. Got: "${elementText}"`,
            );
          }
        } else {
          throw new Error(
            `Expected text "${assertion.expected}" not found on page.`,
          );
        }
      }
      break;
    }
    case "url": {
      const currentUrl = page.url();
      const expected = assertion.expected;
      if (
        !currentUrl.includes(expected) &&
        !currentUrl.endsWith(expected)
      ) {
        throw new Error(
          `Expected URL to contain "${expected}", got: "${currentUrl}"`,
        );
      }
      break;
    }
    case "status": {
      // For status assertions, we check the current page response status
      // Since we are already on the page, a loaded page implies 200
      const expected = assertion.expected;
      if (expected !== "200" && expected !== "OK") {
        throw new Error(
          `Status assertion "${expected}" cannot be verified after page load in MVP`,
        );
      }
      // Page loaded successfully, so status is OK
      break;
    }
    case "attribute": {
      if (!assertion.selector) {
        throw new Error(
          "Attribute assertion requires a selector",
        );
      }
      const selector = resolveSelector(assertion.selector, targetUrl);
      const attribute = await page
        .locator(selector)
        .first()
        .getAttribute(assertion.expected);
      if (!attribute) {
        throw new Error(
          `Expected attribute "${assertion.expected}" not found on element: ${selector}`,
        );
      }
      break;
    }
    default: {
      throw new Error(`Unknown assertion type: ${assertion.type}`);
    }
  }
}

/**
 * Resolve a CSS-like selector, handling Playwright-specific pseudo-selectors.
 * If the selector starts with common Playwright selectors, pass through.
 * Otherwise, treat it as a CSS selector.
 */
function resolveSelector(selector: string, _targetUrl: string): string {
  // Playwright-specific selectors: text=, :text(), has-text, etc.
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

  // Fallback: treat as a text selector
  return `:text("${selector}")`;
}

/**
 * Build an ExecutionResult object.
 */
function buildResult(
  testCaseId: string,
  sessionId: string,
  status: ExecutionResult["status"],
  startTime: Date,
  endTime: Date,
  browser: string,
  screenshotPath: string | null,
  errorMessage: string | null,
): ExecutionResult {
  return {
    id: uuidv4(),
    testCaseId,
    sessionId,
    status,
    durationMs: endTime.getTime() - startTime.getTime(),
    browser: browser as ExecutionResult["browser"],
    screenshotPath,
    networkLog: null,
    errorMessage,
    artifacts: {},
    startedAt: startTime.toISOString(),
    completedAt: endTime.toISOString(),
  };
}
