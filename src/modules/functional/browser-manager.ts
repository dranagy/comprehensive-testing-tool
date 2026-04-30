import fs from "node:fs";
import path from "node:path";
import type { BrowserType, ExecutionResult, TestCase, TestStep, TestAssertion } from "../../shared/types.js";
import type { Page, TestExecutionResult } from "./types.js";
import { v4 as uuidv4 } from "uuid";

type PlaywrightBrowser = import("playwright").Browser;
type PlaywrightBrowserContext = import("playwright").BrowserContext;
type PlaywrightPage = import("playwright").Page;

export class BrowserManager {
  private browsers = new Map<BrowserType, PlaywrightBrowser>();

  async launchBrowsers(browsers: BrowserType[]): Promise<void> {
    const pw = await import("playwright");

    for (const browserType of browsers) {
      if (this.browsers.has(browserType)) continue;

      const launcher = pw[browserType as keyof typeof pw] as unknown as {
        launch: (opts: { headless: boolean }) => Promise<PlaywrightBrowser>;
      };
      const browser = await launcher.launch({ headless: true });
      this.browsers.set(browserType, browser);
    }
  }

  async createContext(browserType: BrowserType): Promise<PlaywrightBrowserContext> {
    const browser = this.browsers.get(browserType);
    if (!browser) {
      throw new Error(`Browser ${browserType} not launched. Call launchBrowsers first.`);
    }
    return browser.newContext();
  }

  async executeTest(
    testCase: TestCase,
    targetUrl: string,
    browserType: BrowserType,
    sessionId: string,
  ): Promise<ExecutionResult> {
    const startTime = new Date();
    let browser = this.browsers.get(browserType);

    if (!browser) {
      return buildResult(testCase.id, sessionId, "ERROR", startTime, new Date(), browserType, null, `Browser ${browserType} not launched`);
    }

    // Detect browser crash and attempt recovery
    try {
      await browser.version();
    } catch {
      try {
        const pw = await import("playwright");
        const launcher = pw[browserType as keyof typeof pw] as unknown as {
          launch: (opts: { headless: boolean }) => Promise<PlaywrightBrowser>;
        };
        browser = await launcher.launch({ headless: true });
        this.browsers.set(browserType, browser);
      } catch {
        return buildResult(testCase.id, sessionId, "ERROR", startTime, new Date(), browserType, null, `Browser ${browserType} crashed and could not be restarted`);
      }
    }

    let context: PlaywrightBrowserContext;
    try {
      context = await browser.newContext();
    } catch (ctxError) {
      const msg = ctxError instanceof Error ? ctxError.message : String(ctxError);
      return buildResult(testCase.id, sessionId, "ERROR", startTime, new Date(), browserType, null, `Failed to create context: ${msg}`);
    }

    let errorMessage: string | null = null;
    let status: ExecutionResult["status"] = "PASSED";
    let screenshotPath: string | null = null;

    try {
      const page = await context.newPage();

      for (const step of testCase.definition.steps) {
        try {
          await executeStep(page, step, targetUrl);
        } catch (stepError) {
          errorMessage = `Step "${step.description}" failed: ${stepError instanceof Error ? stepError.message : String(stepError)}`;
          status = "FAILED";
          screenshotPath = await captureScreenshot(page, testCase.id);
          break;
        }
      }

      if (status === "PASSED") {
        for (const assertion of testCase.definition.assertions) {
          try {
            await executeAssertion(page, assertion, targetUrl);
          } catch (assertionError) {
            errorMessage = `Assertion [${assertion.type}] failed: ${assertionError instanceof Error ? assertionError.message : String(assertionError)}`;
            status = "FAILED";
            screenshotPath = await captureScreenshot(page, testCase.id);
            break;
          }
        }
      }

      await context.close();
    } catch (pageError) {
      errorMessage = `Page error: ${pageError instanceof Error ? pageError.message : String(pageError)}`;
      status = "ERROR";
      try { await context.close(); } catch { /* best effort */ }
    }

    return buildResult(testCase.id, sessionId, status, startTime, new Date(), browserType, screenshotPath, errorMessage);
  }

  async closeBrowsers(): Promise<void> {
    for (const [type, browser] of this.browsers) {
      try {
        await browser.close();
      } catch { /* best effort */ }
    }
    this.browsers.clear();
  }
}

async function executeStep(page: PlaywrightPage, step: TestStep, targetUrl: string): Promise<void> {
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
    default:
      throw new Error(`Unknown step action: ${step.action}`);
  }
}

async function executeAssertion(page: PlaywrightPage, assertion: TestAssertion, targetUrl: string): Promise<void> {
  switch (assertion.type) {
    case "visible": {
      const sel = assertion.selector ? resolveSelector(assertion.selector, targetUrl) : "body";
      const isVisible = await page.locator(sel).first().isVisible().catch(() => false);
      if (!isVisible) throw new Error(`Expected element visible: ${sel}`);
      break;
    }
    case "text": {
      const bodyText = await page.textContent("body");
      if (!bodyText?.includes(assertion.expected)) {
        if (assertion.selector) {
          const sel = resolveSelector(assertion.selector, targetUrl);
          const elText = await page.locator(sel).first().textContent();
          if (!elText?.includes(assertion.expected)) {
            throw new Error(`Expected text "${assertion.expected}" not found in ${sel}`);
          }
        } else {
          throw new Error(`Expected text "${assertion.expected}" not found on page`);
        }
      }
      break;
    }
    case "url": {
      const current = page.url();
      if (!current.includes(assertion.expected) && !current.endsWith(assertion.expected)) {
        throw new Error(`Expected URL containing "${assertion.expected}", got: "${current}"`);
      }
      break;
    }
    case "status": {
      if (assertion.expected !== "200" && assertion.expected !== "OK") {
        throw new Error(`Status assertion "${assertion.expected}" cannot be verified after page load`);
      }
      break;
    }
    case "attribute": {
      if (!assertion.selector) throw new Error("Attribute assertion requires a selector");
      const sel = resolveSelector(assertion.selector, targetUrl);
      const attr = await page.locator(sel).first().getAttribute(assertion.expected);
      if (!attr) throw new Error(`Expected attribute "${assertion.expected}" not found on ${sel}`);
      break;
    }
    default:
      throw new Error(`Unknown assertion type: ${assertion.type}`);
  }
}

function resolveSelector(selector: string, _targetUrl: string): string {
  if (
    selector.startsWith("text=") || selector.startsWith(":text(") ||
    selector.includes(":has-text(") || selector.startsWith("[") ||
    selector.startsWith("#") || selector.startsWith(".") ||
    selector.startsWith("button") || selector.startsWith("a:") ||
    selector.startsWith("input") || selector.startsWith("select") ||
    selector.startsWith("textarea") || selector.startsWith("form")
  ) {
    return selector;
  }
  return `:text("${selector}")`;
}

async function captureScreenshot(page: PlaywrightPage, testCaseId: string): Promise<string | null> {
  try {
    const dir = path.join(process.cwd(), ".ctt", "screenshots");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${testCaseId}-${Date.now()}.png`);
    await page.screenshot({ path: filePath });
    return filePath;
  } catch {
    return null;
  }
}

function buildResult(
  testCaseId: string,
  sessionId: string,
  status: ExecutionResult["status"],
  startTime: Date,
  endTime: Date,
  browser: BrowserType,
  screenshotPath: string | null,
  errorMessage: string | null,
): ExecutionResult {
  return {
    id: uuidv4(),
    testCaseId,
    sessionId,
    status,
    durationMs: endTime.getTime() - startTime.getTime(),
    browser,
    screenshotPath,
    networkLog: null,
    errorMessage,
    artifacts: {},
    startedAt: startTime.toISOString(),
    completedAt: endTime.toISOString(),
  };
}
