import { Router } from "express";
import { SessionManager } from "../../core/session.js";
import { AuditLogger } from "../../core/audit-log.js";
import { ApprovalGateManager } from "../../core/approval-gate.js";
import { TestCaseRepository } from "../../db/repositories/test-case-repo.js";
import { getDb } from "../db.js";
import { ApiError } from "../middleware/error-handler.js";
import { resolveSession } from "../middleware/session-resolver.js";
import "../types.js";
import type { TestPhase, TestCaseDefinition, EditEntry } from "../../shared/types.js";

export const reviewRouter = Router();

// List test cases (with optional phase filter)
reviewRouter.get("/:sessionId/test-cases", resolveSession, (req, res) => {
  const db = getDb();
  const testCaseRepo = new TestCaseRepository(db);
  const session = req.session!;

  const phase = req.query.phase as string | undefined;
  const status = req.query.status as string | undefined;
  const tags = req.query.tags as string | undefined;

  let testCases;

  if (phase) {
    testCases = testCaseRepo.getBySession(session.id, phase.toUpperCase() as TestPhase);
  } else if (tags) {
    testCases = testCaseRepo.getByTags(session.id, tags.split(","));
  } else {
    testCases = testCaseRepo.getBySession(session.id);
  }

  if (status) {
    testCases = testCases.filter((tc) => tc.approvalStatus === status);
  }

  res.json(testCases);
});

// Get single test case
reviewRouter.get("/:sessionId/test-cases/:testId", (req, res) => {
  const db = getDb();
  const testCaseRepo = new TestCaseRepository(db);

  const tc = testCaseRepo.getById(req.params.testId as string);
  if (!tc) {
    throw new ApiError(404, `Test case not found: ${req.params.testId}`);
  }

  res.json(tc);
});

// Update test case definition
reviewRouter.put("/:sessionId/test-cases/:testId", (req, res) => {
  const db = getDb();
  const testCaseRepo = new TestCaseRepository(db);
  const auditLogger = new AuditLogger(db);

  const testId = req.params.testId as string;
  const existing = testCaseRepo.getById(testId);
  if (!existing) {
    throw new ApiError(404, `Test case not found: ${testId}`);
  }

  const { definition } = req.body as { definition?: TestCaseDefinition };
  if (!definition) {
    throw new ApiError(400, "definition is required");
  }

  const editEntry: EditEntry = {
    timestamp: new Date().toISOString(),
    field: "definition",
    previousValue: existing.definition,
    newValue: definition,
  };

  testCaseRepo.updateDefinition(testId, definition, editEntry);

  auditLogger.log(existing.sessionId, "TEST_EDITED", "api", {
    testCaseId: testId,
    testCaseName: existing.name,
  });

  const updated = testCaseRepo.getById(testId);
  res.json(updated);
});

// Approve test cases by phase
reviewRouter.post("/:sessionId/approve", resolveSession, (req, res) => {
  const db = getDb();
  const auditLogger = new AuditLogger(db);
  const approvalGateManager = new ApprovalGateManager(db);
  const testCaseRepo = new TestCaseRepository(db);

  const session = req.session!;
  const { phase, testIds } = req.body as {
    phase?: string;
    testIds?: string[];
  };

  let approved = 0;

  if (testIds && testIds.length > 0) {
    for (const id of testIds) {
      const tc = testCaseRepo.getById(id);
      if (tc && (tc.approvalStatus === "GENERATED" || tc.approvalStatus === "MODIFIED")) {
        testCaseRepo.updateApprovalStatus(id, "APPROVED");
        auditLogger.log(session.id, "TEST_APPROVED", "api", {
          testCaseId: id,
          testCaseName: tc.name,
        });
        approved++;
      }
    }
  } else if (phase) {
    const testPhase = phase.toUpperCase() as TestPhase;
    const testCases = testCaseRepo.getBySession(session.id, testPhase);
    const pending = testCases.filter(
      (tc) => tc.approvalStatus === "GENERATED" || tc.approvalStatus === "MODIFIED",
    );

    for (const tc of pending) {
      testCaseRepo.updateApprovalStatus(tc.id, "APPROVED");
      auditLogger.log(session.id, "TEST_APPROVED", "api", {
        testCaseId: tc.id,
        testCaseName: tc.name,
        phase: testPhase,
      });
      approved++;
    }

    try {
      approvalGateManager.approve(session.id, testPhase, "api-user");
    } catch {
      // Gate may already exist or be resolved
    }
  }

  res.json({ approved });
});

// Reject test case
reviewRouter.post("/:sessionId/test-cases/:testId/reject", (req, res) => {
  const db = getDb();
  const testCaseRepo = new TestCaseRepository(db);
  const auditLogger = new AuditLogger(db);

  const testId = req.params.testId as string;
  const tc = testCaseRepo.getById(testId);
  if (!tc) {
    throw new ApiError(404, `Test case not found: ${testId}`);
  }

  const { reason } = req.body as { reason?: string };

  testCaseRepo.updateApprovalStatus(testId, "REJECTED");
  auditLogger.log(tc.sessionId, "TEST_REJECTED", "api", {
    testCaseId: testId,
    testCaseName: tc.name,
    reason: reason ?? null,
  });

  res.json({ id: testId, status: "REJECTED" });
});

// Get approval gates
reviewRouter.get("/:sessionId/gates", resolveSession, (req, res) => {
  const db = getDb();
  const approvalGateManager = new ApprovalGateManager(db);
  const session = req.session!;

  const gates = approvalGateManager.getPendingGates(session.id);
  res.json(gates);
});

// Resolve approval gate
reviewRouter.post("/:sessionId/gates/:phase", resolveSession, (req, res) => {
  const db = getDb();
  const approvalGateManager = new ApprovalGateManager(db);
  const session = req.session!;

  const { action, comments } = req.body as {
    action: "approve" | "reject" | "skip";
    comments?: string;
  };

  const phase = (req.params.phase as string).toUpperCase() as TestPhase;

  let gate;
  if (action === "approve") {
    gate = approvalGateManager.approve(session.id, phase, "api-user", comments);
  } else if (action === "reject") {
    gate = approvalGateManager.reject(session.id, phase, "api-user", comments);
  } else if (action === "skip") {
    gate = approvalGateManager.skip(session.id, phase, "api-user", comments);
  } else {
    throw new ApiError(400, `Invalid gate action: ${action}`);
  }

  res.json(gate);
});
