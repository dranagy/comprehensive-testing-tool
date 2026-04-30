import type { BrowserType, TestCaseDefinition } from "../../shared/types.js";

export type { BrowserType };

export interface BrowserContext {
  newPage(): Promise<Page>;
  close(): Promise<void>;
}

export interface Page {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  locator(selector: string): { first(): Locator };
  textContent(selector: string): Promise<string | null>;
  url(): string;
  screenshot(options: { path: string }): Promise<Buffer>;
  close(): Promise<void>;
}

export interface Locator {
  click(options?: { timeout?: number }): Promise<void>;
  fill(value: string, options?: { timeout?: number }): Promise<void>;
  waitFor(options: { state: string; timeout?: number }): Promise<void>;
  selectOption(value: string, options?: { timeout?: number }): Promise<void>;
  press(key: string, options?: { timeout?: number }): Promise<void>;
  isVisible(): Promise<boolean>;
  getAttribute(name: string): Promise<string | null>;
}

export interface StepResult {
  stepIndex: number;
  description: string;
  passed: boolean;
  error?: string;
}

export interface AssertionResult {
  type: string;
  passed: boolean;
  error?: string;
}

export interface TestExecutionResult {
  testCaseId: string;
  status: "PASSED" | "FAILED" | "ERROR";
  durationMs: number;
  browser: BrowserType;
  screenshotPath: string | null;
  errorMessage: string | null;
  stepResults: StepResult[];
  assertionResults: AssertionResult[];
}
