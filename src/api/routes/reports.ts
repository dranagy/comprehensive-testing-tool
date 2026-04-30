import { Router } from "express";
import { AuditLogger } from "../../core/audit-log.js";
import { TestCaseRepository } from "../../db/repositories/test-case-repo.js";
import { ExecutionResultRepository } from "../../db/repositories/execution-result-repo.js";
import { SecurityFindingRepository } from "../../db/repositories/security-finding-repo.js";
import { getDb } from "../db.js";
import { resolveSession } from "../middleware/session-resolver.js";
import "../types.js";
import type { ExecutionResult } from "../../shared/types.js";

export const reportsRouter = Router();

// Summary report
reportsRouter.get("/:sessionId/summary", resolveSession, (req, res) => {
  const db = getDb();
  const testCaseRepo = new TestCaseRepository(db);
  const executionResultRepo = new ExecutionResultRepository(db);
  const securityFindingRepo = new SecurityFindingRepository(db);

  const session = req.session!;

  const executionSummary = executionResultRepo.getSummary(session.id);
  const functionalCount = testCaseRepo.countByPhase(session.id, "FUNCTIONAL");
  const performanceCount = testCaseRepo.countByPhase(session.id, "PERFORMANCE");
  const securityCount = testCaseRepo.countByPhase(session.id, "SECURITY");
  const securityFindings = securityFindingRepo.getBySession(session.id);
  const severityCounts = securityFindingRepo.getCountsBySeverity(session.id);

  const passRate =
    executionSummary.total > 0
      ? ((executionSummary.passed / executionSummary.total) * 100).toFixed(1)
      : "0.0";

  res.json({
    session: { id: session.id, name: session.name },
    testCases: {
      functional: functionalCount,
      performance: performanceCount,
      security: securityCount,
      total: functionalCount + performanceCount + securityCount,
    },
    execution: executionSummary,
    passRate: `${passRate}%`,
    security: {
      findings: securityFindings.length,
      bySeverity: severityCounts,
    },
  });
});

// Functional report
reportsRouter.get("/:sessionId/functional", resolveSession, (req, res) => {
  const db = getDb();
  const testCaseRepo = new TestCaseRepository(db);
  const executionResultRepo = new ExecutionResultRepository(db);

  const session = req.session!;

  const testCases = testCaseRepo.getBySession(session.id, "FUNCTIONAL");
  const executionResults = executionResultRepo.getBySession(session.id);
  const summary = executionResultRepo.getSummary(session.id);

  const resultsByTest = new Map(executionResults.map((er) => [er.testCaseId, er]));

  const results = testCases.map((tc) => {
    const result = resultsByTest.get(tc.id);
    return {
      id: tc.id,
      name: tc.name,
      status: result?.status ?? "NOT_RUN",
      durationMs: result?.durationMs ?? null,
      browser: result?.browser ?? null,
      errorMessage: result?.errorMessage ?? null,
    };
  });

  const filter = req.query.status as string | undefined;
  const filtered = filter ? results.filter((r) => r.status === filter) : results;

  res.json({
    total: testCases.length,
    summary,
    results: filtered,
  });
});

// Performance report
reportsRouter.get("/:sessionId/performance", resolveSession, (req, res) => {
  const db = getDb();
  const executionResultRepo = new ExecutionResultRepository(db);

  const session = req.session!;
  const executionResults = executionResultRepo.getBySession(session.id);

  const perfResults = executionResults.filter(
    (er: ExecutionResult) => er.artifacts && er.artifacts.metric,
  );

  const metrics = perfResults.map((er: ExecutionResult) => ({
    testCaseId: er.testCaseId,
    status: er.status,
    durationMs: er.durationMs,
    ...(er.artifacts.metric as Record<string, unknown>),
  }));

  res.json({
    totalResults: perfResults.length,
    metrics,
  });
});

// Security report
reportsRouter.get("/:sessionId/security", resolveSession, (req, res) => {
  const db = getDb();
  const securityFindingRepo = new SecurityFindingRepository(db);

  const session = req.session!;
  const findings = securityFindingRepo.getBySession(session.id);
  const severityCounts = securityFindingRepo.getCountsBySeverity(session.id);

  const severity = req.query.severity as string | undefined;
  const filtered = severity
    ? findings.filter((f) => f.severity === severity)
    : findings;

  res.json({
    totalFindings: findings.length,
    bySeverity: severityCounts,
    findings: filtered,
  });
});

// Audit trail
reportsRouter.get("/:sessionId/audit", resolveSession, (req, res) => {
  const db = getDb();
  const auditLogger = new AuditLogger(db);

  const session = req.session!;
  const auditTrail = auditLogger.exportSessionLog(session.id);

  const action = req.query.action as string | undefined;
  const filtered = action
    ? auditTrail.filter((e) => e.action === action)
    : auditTrail;

  res.json({
    sessionId: session.id,
    totalEntries: auditTrail.length,
    entries: filtered,
  });
});
