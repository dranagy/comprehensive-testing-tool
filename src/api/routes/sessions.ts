import { Router } from "express";
import { SessionManager } from "../../core/session.js";
import { AuditLogger } from "../../core/audit-log.js";
import { TestCaseRepository } from "../../db/repositories/test-case-repo.js";
import { ExecutionResultRepository } from "../../db/repositories/execution-result-repo.js";
import { ApprovalGateManager } from "../../core/approval-gate.js";
import { getDb } from "../db.js";
import { ApiError } from "../middleware/error-handler.js";
import { resolveSession } from "../middleware/session-resolver.js";
import "../types.js";
import type { SessionConfig, Session } from "../../shared/types.js";

export const sessionsRouter = Router();

// List sessions
sessionsRouter.get("/", (_req, res) => {
  const db = getDb();
  const sessionManager = new SessionManager(db);
  const sessions = sessionManager.listSessions();
  res.json(sessions);
});

// Create session
sessionsRouter.post("/", (req, res) => {
  const { name, targetUrl, config } = req.body as {
    name?: string;
    targetUrl?: string;
    config?: SessionConfig;
  };

  if (!targetUrl) {
    throw new ApiError(400, "targetUrl is required");
  }

  const db = getDb();
  const sessionManager = new SessionManager(db);
  const auditLogger = new AuditLogger(db);

  const session = sessionManager.createSession(
    name ?? `session-${Date.now()}`,
    targetUrl,
    config ?? { browsers: ["chromium"] },
  );

  auditLogger.log(session.id, "SESSION_CREATED", "api", {
    name: session.name,
    targetUrl,
  });

  res.status(201).json(session);
});

// Get session by ID
sessionsRouter.get("/:sessionId", resolveSession, (req, res) => {
  const db = getDb();
  const testCaseRepo = new TestCaseRepository(db);
  const executionResultRepo = new ExecutionResultRepository(db);
  const approvalGateManager = new ApprovalGateManager(db);

  const session = req.session!;

  const testCounts = {
    functional: testCaseRepo.countByPhase(session.id, "FUNCTIONAL"),
    performance: testCaseRepo.countByPhase(session.id, "PERFORMANCE"),
    security: testCaseRepo.countByPhase(session.id, "SECURITY"),
  };

  const pendingGates = approvalGateManager.getPendingGates(session.id);
  const executionSummary = executionResultRepo.getSummary(session.id);

  res.json({
    ...session,
    testCounts,
    pendingGates,
    executionSummary,
  });
});

// Resume session
sessionsRouter.post("/:sessionId/resume", resolveSession, (req, res) => {
  const db = getDb();
  const sessionManager = new SessionManager(db);
  const auditLogger = new AuditLogger(db);

  const sessionId = req.params.sessionId as string;
  const session = sessionManager.resumeSession(sessionId);

  auditLogger.log(session.id, "SESSION_RESUMED", "api", {
    resumedAtPhase: session.status,
  });

  res.json(session);
});

// Advance phase
sessionsRouter.post("/:sessionId/advance", resolveSession, (req, res) => {
  const db = getDb();
  const sessionManager = new SessionManager(db);

  const sessionId = req.params.sessionId as string;
  if (!sessionManager.canAdvance(sessionId)) {
    throw new ApiError(400, "Cannot advance session to next phase");
  }

  const session = sessionManager.advancePhase(sessionId);
  res.json(session);
});

// Export session
sessionsRouter.get("/:sessionId/export", resolveSession, (req, res) => {
  const db = getDb();
  const auditLogger = new AuditLogger(db);
  const testCaseRepo = new TestCaseRepository(db);
  const executionResultRepo = new ExecutionResultRepository(db);

  const session = req.session!;

  const auditTrail = auditLogger.exportSessionLog(session.id);
  const testCases = testCaseRepo.getBySession(session.id);
  const executionResults = executionResultRepo.getBySession(session.id);

  const exportData = {
    session: {
      id: session.id,
      name: session.name,
      status: session.status,
      targetUrl: session.targetUrl,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
    testCases: testCases.map((tc) => ({
      id: tc.id,
      name: tc.name,
      phase: tc.phase,
      approvalStatus: tc.approvalStatus,
      definition: tc.definition,
    })),
    executionResults: executionResults.map((er) => ({
      id: er.id,
      testCaseId: er.testCaseId,
      status: er.status,
      durationMs: er.durationMs,
      errorMessage: er.errorMessage,
      startedAt: er.startedAt,
      completedAt: er.completedAt,
    })),
    auditTrail,
  };

  res.json(exportData);
});
