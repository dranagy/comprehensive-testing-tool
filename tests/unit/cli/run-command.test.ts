import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "../../helpers/test-db.js";
import { TestCaseRepository } from "../../../src/db/repositories/test-case-repo.js";
import { ExecutionResultRepository } from "../../../src/db/repositories/execution-result-repo.js";
import type { TestCase, ExecutionResult, TestCaseDefinition } from "../../../src/shared/types.js";

function makeTestCase(overrides: Partial<TestCase> & { id: string; sessionId: string }): TestCase {
  const baseDefinition: TestCaseDefinition = {
    steps: [
      { action: "navigate", selector: "/", description: "Go to page" },
    ],
    assertions: [
      { type: "visible", expected: "body" },
    ],
  };
  return {
    sourceDocumentId: null,
    phase: "FUNCTIONAL",
    name: `Test ${overrides.id}`,
    description: "A test case",
    definition: baseDefinition,
    approvalStatus: "APPROVED",
    tags: [],
    editHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeExecutionResult(overrides: Partial<ExecutionResult> & { id: string; testCaseId: string; sessionId: string }): ExecutionResult {
  return {
    durationMs: 100,
    browser: "chromium",
    screenshotPath: null,
    networkLog: null,
    errorMessage: null,
    artifacts: {},
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    status: "PASSED",
    ...overrides,
  };
}

describe("Selective test execution (US2)", () => {
  let db: ReturnType<typeof createTestDb>;
  let testCaseRepo: TestCaseRepository;
  let executionResultRepo: ExecutionResultRepository;
  const sessionId = "session-select";

  beforeEach(() => {
    db = createTestDb();
    testCaseRepo = new TestCaseRepository(db);
    executionResultRepo = new ExecutionResultRepository(db);

    db.prepare(
      `INSERT INTO sessions (id, name, status, target_url, config, created_at, updated_at)
       VALUES (?, 'test', 'FUNCTIONAL', 'http://localhost:3000', '{}', datetime('now'), datetime('now'))`,
    ).run(sessionId);
  });

  describe("filtering by test ID", () => {
    it("retrieves specific test cases by ID", () => {
      const tc1 = makeTestCase({ id: "tc-001", sessionId });
      const tc2 = makeTestCase({ id: "tc-002", sessionId });
      const tc3 = makeTestCase({ id: "tc-003", sessionId });
      testCaseRepo.createMany([tc1, tc2, tc3]);

      const selected = [tc1.id, tc3.id].map((id) => testCaseRepo.getById(id));
      expect(selected).toHaveLength(2);
      expect(selected[0]!.id).toBe("tc-001");
      expect(selected[1]!.id).toBe("tc-003");
    });

    it("returns undefined for nonexistent test ID", () => {
      expect(testCaseRepo.getById("nonexistent")).toBeUndefined();
    });

    it("filters out test cases from other sessions", () => {
      const otherSessionId = "session-other";
      db.prepare(
        `INSERT INTO sessions (id, name, status, target_url, config, created_at, updated_at)
         VALUES (?, 'other', 'FUNCTIONAL', 'http://other.com', '{}', datetime('now'), datetime('now'))`,
      ).run(otherSessionId);

      const tc1 = makeTestCase({ id: "tc-001", sessionId });
      const tc2 = makeTestCase({ id: "tc-002", sessionId: otherSessionId });
      testCaseRepo.createMany([tc1, tc2]);

      // When selecting by ID for session-select, tc-002 belongs to a different session
      const tc = testCaseRepo.getById("tc-002");
      expect(tc).toBeDefined();
      expect(tc!.sessionId).toBe(otherSessionId);
      // Verify it's NOT in the current session's tests
      const sessionTests = testCaseRepo.getBySession(sessionId);
      expect(sessionTests).toHaveLength(1);
      expect(sessionTests[0].id).toBe("tc-001");
    });
  });

  describe("filtering by tag (--filter)", () => {
    it("returns test cases matching any of the specified tags", () => {
      const tc1 = makeTestCase({ id: "tc-001", sessionId, tags: ["login", "smoke"] });
      const tc2 = makeTestCase({ id: "tc-002", sessionId, tags: ["logout"] });
      const tc3 = makeTestCase({ id: "tc-003", sessionId, tags: ["login", "regression"] });
      testCaseRepo.createMany([tc1, tc2, tc3]);

      const filtered = testCaseRepo.getByTags(sessionId, ["login"]);
      expect(filtered).toHaveLength(2);
      const ids = filtered.map((tc) => tc.id);
      expect(ids).toContain("tc-001");
      expect(ids).toContain("tc-003");
    });

    it("returns test cases matching any tag from a list", () => {
      const tc1 = makeTestCase({ id: "tc-001", sessionId, tags: ["login"] });
      const tc2 = makeTestCase({ id: "tc-002", sessionId, tags: ["logout"] });
      const tc3 = makeTestCase({ id: "tc-003", sessionId, tags: ["navigation"] });
      testCaseRepo.createMany([tc1, tc2, tc3]);

      const filtered = testCaseRepo.getByTags(sessionId, ["login", "logout"]);
      expect(filtered).toHaveLength(2);
    });

    it("returns empty array when no tests match the tag", () => {
      const tc1 = makeTestCase({ id: "tc-001", sessionId, tags: ["login"] });
      testCaseRepo.createMany([tc1]);

      const filtered = testCaseRepo.getByTags(sessionId, ["nonexistent"]);
      expect(filtered).toEqual([]);
    });

    it("returns empty array for tests with no tags", () => {
      const tc1 = makeTestCase({ id: "tc-001", sessionId, tags: [] });
      testCaseRepo.createMany([tc1]);

      const filtered = testCaseRepo.getByTags(sessionId, ["login"]);
      expect(filtered).toEqual([]);
    });
  });

  describe("re-running failed tests (--failed)", () => {
    it("returns IDs of tests with FAILED, ERROR, or TIMEOUT status", () => {
      const tc1 = makeTestCase({ id: "tc-001", sessionId });
      const tc2 = makeTestCase({ id: "tc-002", sessionId });
      const tc3 = makeTestCase({ id: "tc-003", sessionId });
      testCaseRepo.createMany([tc1, tc2, tc3]);

      const r1 = makeExecutionResult({ id: "r-001", testCaseId: "tc-001", sessionId, status: "PASSED" });
      const r2 = makeExecutionResult({ id: "r-002", testCaseId: "tc-002", sessionId, status: "FAILED" });
      const r3 = makeExecutionResult({ id: "r-003", testCaseId: "tc-003", sessionId, status: "TIMEOUT" });
      executionResultRepo.create(r1);
      executionResultRepo.create(r2);
      executionResultRepo.create(r3);

      const failedIds = testCaseRepo.getFailedTestIds(sessionId);
      expect(failedIds).toHaveLength(2);
      expect(failedIds).toContain("tc-002");
      expect(failedIds).toContain("tc-003");
    });

    it("returns empty array when no tests failed", () => {
      const tc1 = makeTestCase({ id: "tc-001", sessionId });
      testCaseRepo.createMany([tc1]);

      const r1 = makeExecutionResult({ id: "r-001", testCaseId: "tc-001", sessionId, status: "PASSED" });
      executionResultRepo.create(r1);

      const failedIds = testCaseRepo.getFailedTestIds(sessionId);
      expect(failedIds).toEqual([]);
    });

    it("deduplicates failed test IDs", () => {
      const tc1 = makeTestCase({ id: "tc-001", sessionId });
      testCaseRepo.createMany([tc1]);

      // Two execution results for the same test, both failed
      const r1 = makeExecutionResult({ id: "r-001", testCaseId: "tc-001", sessionId, status: "FAILED" });
      const r2 = makeExecutionResult({ id: "r-002", testCaseId: "tc-001", sessionId, status: "FAILED" });
      executionResultRepo.create(r1);
      executionResultRepo.create(r2);

      const failedIds = testCaseRepo.getFailedTestIds(sessionId);
      expect(failedIds).toHaveLength(1);
    });
  });

  describe("dry-run mode", () => {
    it("lists tests that would be executed without running them", () => {
      const tc1 = makeTestCase({ id: "tc-001", sessionId, name: "Login Test" });
      const tc2 = makeTestCase({ id: "tc-002", sessionId, name: "Logout Test" });
      testCaseRepo.createMany([tc1, tc2]);

      // Simulate dry-run: gather test IDs, verify they match
      const allApproved = testCaseRepo.getBySession(sessionId).filter(
        (tc) => tc.approvalStatus === "APPROVED",
      );
      expect(allApproved).toHaveLength(2);
      expect(allApproved.map((tc) => tc.name)).toEqual(["Login Test", "Logout Test"]);

      // Verify NO execution results exist (dry-run doesn't execute)
      const results = executionResultRepo.getBySession(sessionId);
      expect(results).toHaveLength(0);
    });

    it("lists only filtered tests in dry-run with --filter", () => {
      const tc1 = makeTestCase({ id: "tc-001", sessionId, tags: ["smoke"] });
      const tc2 = makeTestCase({ id: "tc-002", sessionId, tags: ["regression"] });
      const tc3 = makeTestCase({ id: "tc-003", sessionId, tags: ["smoke"] });
      testCaseRepo.createMany([tc1, tc2, tc3]);

      const filtered = testCaseRepo.getByTags(sessionId, ["smoke"]).filter(
        (tc) => tc.approvalStatus === "APPROVED",
      );
      expect(filtered).toHaveLength(2);
      expect(filtered.every((tc) => tc.tags.includes("smoke"))).toBe(true);
    });

    it("lists only failed tests in dry-run with --failed", () => {
      const tc1 = makeTestCase({ id: "tc-001", sessionId });
      const tc2 = makeTestCase({ id: "tc-002", sessionId });
      testCaseRepo.createMany([tc1, tc2]);

      const r1 = makeExecutionResult({ id: "r-001", testCaseId: "tc-001", sessionId, status: "PASSED" });
      const r2 = makeExecutionResult({ id: "r-002", testCaseId: "tc-002", sessionId, status: "FAILED" });
      executionResultRepo.create(r1);
      executionResultRepo.create(r2);

      const failedIds = testCaseRepo.getFailedTestIds(sessionId);
      const failedTests = failedIds
        .map((id) => testCaseRepo.getById(id))
        .filter((tc): tc is TestCase => tc !== undefined);

      expect(failedTests).toHaveLength(1);
      expect(failedTests[0].id).toBe("tc-002");
    });
  });
});
